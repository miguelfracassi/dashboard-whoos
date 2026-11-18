// Função serverless da Vercel — toda a API (/api/*). Dados no Supabase (tabela "painel").
const crypto=require('crypto');
const SB=process.env.SUPABASE_URL,SK=process.env.SUPABASE_SERVICE_KEY;
const H={apikey:SK,'Content-Type':'application/json'};if(SK&&!SK.startsWith('sb_'))H.Authorization='Bearer '+SK; // chaves novas (sb_secret_) usam só o header apikey
const uid=()=>crypto.randomBytes(4).toString('hex');
let db;
const load=async()=>{if(!SB||!SK)throw Error('Defina SUPABASE_URL e SUPABASE_SERVICE_KEY na Vercel.');
 const r=await fetch(`${SB}/rest/v1/painel?id=eq.1&select=data`,{headers:H});if(!r.ok)throw Error('Supabase: '+await r.text());
 const [row]=await r.json();db=row?.data||{};db.products??=[];db.tickets??=[];db.sales??=[];db.categories??=[];db.coupons??=[]};
const save=async()=>{const r=await fetch(`${SB}/rest/v1/painel?on_conflict=id`,{method:'POST',headers:{...H,Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({id:1,data:db})});if(!r.ok)throw Error('Supabase: '+await r.text())}; // upsert: cria a linha id=1 se não existir (PATCH ignorava em silêncio)
const find=(l,i,n)=>{const x=l.find(y=>y.id===i);if(!x)throw Error(n+' não encontrado');return x};
const STATUS=['aberto','fechado','realizado'];
const YES=v=>v===true||v==='true'||v==='on'||v==='1';
const money=n=>+(+n).toFixed(2);
const brl=n=>'R$ '+money(n).toFixed(2).replace('.',',');
const exp=v=>{if(v===''||v==null)return null;const t=/^\d+$/.test(String(v))?+v:new Date(String(v).length===10?v+'T23:59:59-03:00':v).getTime();if(isNaN(t))throw Error('expiresAt inválido');return t};
const findCoupon=code=>db.coupons.find(c=>c.code===String(code||'').trim().toUpperCase());
function checkCoupon(code,p,subtotal){const c=findCoupon(code);if(!c)throw Error('Cupom inválido');
 if(!c.active)throw Error('Cupom desativado');
 if(c.expiresAt&&Date.now()>c.expiresAt)throw Error('Cupom expirado');
 if(c.maxUses&&c.uses>=c.maxUses)throw Error('Cupom esgotado');
 if(c.productId&&c.productId!==p.id)throw Error('Cupom não vale para este produto');
 if(c.minTotal&&subtotal<c.minTotal)throw Error('Compra mínima de '+brl(c.minTotal)+' para este cupom');
 const d=c.type==='percent'?subtotal*c.value/100:c.value;return{c,discount:money(Math.min(d,subtotal))}}
function order(productId,quantity,coupon){const p=find(db.products,productId,'Produto'),q=Math.max(1,Math.floor(+quantity||1));
 if(!p.unlimited&&p.stock<q)throw Error('Estoque insuficiente');
 const subtotal=money(p.price*q);let discount=0,c=null,couponError;
 if(coupon&&String(coupon).trim()){try{({c,discount}=checkCoupon(coupon,p,subtotal))}catch(e){couponError=e.message;c=null;discount=0}}
 return{o:{productId:p.id,productName:p.name,quantity:q,unitPrice:p.price,subtotal,coupon:c?c.code:'',discount,total:money(subtotal-discount)},c,p,couponError}}
const dc=async(m,p,b)=>{const t=process.env.DISCORD_TOKEN;if(!t)throw Error('Defina DISCORD_TOKEN nas variáveis de ambiente da Vercel.');
 const r=await fetch('https://discord.com/api/v10'+p,{method:m,headers:{Authorization:'Bot '+t,'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined});
 const d=await r.json().catch(()=>({}));if(!r.ok)throw Error('Discord: '+(d.message||r.status));return d};
const guildId=async()=>{if(process.env.DISCORD_GUILD_ID)return process.env.DISCORD_GUILD_ID;const g=await dc('GET','/users/@me/guilds');if(!g[0])throw Error('O bot não está em nenhum servidor');return g[0].id};
const A={
 summary:()=>({products:db.products.length,categories:db.categories.length,ticketsOpen:db.tickets.filter(t=>t.status==='aberto').length,
  ticketsClosed:db.tickets.filter(t=>t.status==='fechado').length,ticketsDone:db.tickets.filter(t=>t.status==='realizado').length,
  totalSold:db.sales.reduce((s,x)=>s+x.total,0),salesCount:db.sales.length}),
 list_products:()=>db.products,
 list_categories:()=>db.categories.map(c=>({...c,products:db.products.filter(p=>p.categoryId===c.id).length})),
 create_category:({name})=>{name=(name||'').trim();if(!name)throw Error('name é obrigatório');
  if(db.categories.some(c=>c.name.toLowerCase()===name.toLowerCase()))throw Error('Categoria já existe');
  const c={id:uid(),name,createdAt:Date.now()};db.categories.push(c);return c},
 update_category:({id,name})=>{const c=find(db.categories,id,'Categoria');name=(name||'').trim();if(!name)throw Error('name é obrigatório');c.name=name;return c},
 delete_category:({id})=>{find(db.categories,id,'Categoria');db.categories=db.categories.filter(c=>c.id!==id);db.products.forEach(p=>{if(p.categoryId===id)p.categoryId=''});return{deleted:id}},
 create_product:({name,price,stock=0,description='',categoryId='',unlimited=false})=>{if(!name)throw Error('name é obrigatório');
  if(categoryId)find(db.categories,categoryId,'Categoria');
  const p={id:uid(),name,price:+price||0,stock:+stock||0,unlimited:YES(unlimited),categoryId:categoryId||'',description,createdAt:Date.now()};db.products.push(p);return p},
 update_product:({id,...f})=>{const p=find(db.products,id,'Produto');
  if(f.categoryId)find(db.categories,f.categoryId,'Categoria');
  for(const k of['name','price','stock','description','categoryId','unlimited'])if(f[k]!==undefined)p[k]=(k==='price'||k==='stock')?+f[k]:k==='unlimited'?YES(f[k]):f[k];return p},
 delete_product:({id})=>{find(db.products,id,'Produto');db.products=db.products.filter(p=>p.id!==id);return{deleted:id}},
 list_tickets:({status}={})=>status?db.tickets.filter(t=>t.status===status):db.tickets,
 create_ticket:({subject,customer='',message='',productId='',quantity=1,coupon='',channelId='',userId=''})=>{if(!subject)throw Error('subject é obrigatório');
  const t={id:uid(),subject,customer,message,status:'aberto',createdAt:Date.now()};if(channelId)t.channelId=String(channelId);if(userId)t.userId=String(userId);
  if(productId){const{o,c,couponError}=order(productId,quantity,coupon);if(couponError)throw Error(couponError);t.order=o;if(c)c.uses++}
  db.tickets.push(t);return t},
 update_ticket:({id,status})=>{const t=find(db.tickets,id,'Ticket');if(!STATUS.includes(status))throw Error('status deve ser: '+STATUS.join(', '));
  t.status=status;t.updatedAt=Date.now();return t},
 delete_ticket:({id})=>{find(db.tickets,id,'Ticket');db.tickets=db.tickets.filter(t=>t.id!==id);return{deleted:id}},
 list_sales:()=>db.sales,
 create_sale:({productId,quantity=1,coupon=''})=>{const{o,c,p,couponError}=order(productId,quantity,coupon);if(couponError)throw Error(couponError);
  if(!p.unlimited)p.stock-=o.quantity;if(c)c.uses++;
  const s={id:uid(),productId,productName:p.name,quantity:o.quantity,total:o.total,createdAt:Date.now()};if(c){s.coupon=o.coupon;s.discount=o.discount}db.sales.push(s);return s},
 list_coupons:()=>db.coupons,
 create_coupon:({code,type='percent',value,maxUses=0,expiresAt='',minTotal=0,productId=''})=>{code=String(code||'').trim().toUpperCase();
  if(!code)throw Error('code é obrigatório');if(!/^[A-Z0-9_-]{2,32}$/.test(code))throw Error('code: use letras, números, - ou _ (2 a 32 caracteres)');
  if(findCoupon(code))throw Error('Cupom já existe');if(!['percent','fixed'].includes(type))throw Error('type deve ser percent ou fixed');
  value=+value;if(!(value>0))throw Error('value deve ser maior que 0');if(type==='percent'&&value>100)throw Error('Porcentagem máxima é 100');
  if(productId)find(db.products,productId,'Produto');
  const c={id:uid(),code,type,value,maxUses:Math.max(0,Math.floor(+maxUses||0)),uses:0,minTotal:+minTotal||0,productId:productId||'',expiresAt:exp(expiresAt),active:true,createdAt:Date.now()};db.coupons.push(c);return c},
 update_coupon:({id,...f})=>{const c=find(db.coupons,id,'Cupom');
  if(f.type!==undefined){if(!['percent','fixed'].includes(f.type))throw Error('type deve ser percent ou fixed');c.type=f.type}
  if(f.value!==undefined){const v=+f.value;if(!(v>0))throw Error('value deve ser maior que 0');c.value=v}
  if(c.type==='percent'&&c.value>100)throw Error('Porcentagem máxima é 100');
  if(f.active!==undefined)c.active=YES(f.active);
  if(f.maxUses!==undefined)c.maxUses=Math.max(0,Math.floor(+f.maxUses||0));
  if(f.minTotal!==undefined)c.minTotal=+f.minTotal||0;
  if(f.productId!==undefined){if(f.productId)find(db.products,f.productId,'Produto');c.productId=f.productId}
  if(f.expiresAt!==undefined)c.expiresAt=exp(f.expiresAt);return c},
 delete_coupon:({id})=>{find(db.coupons,id,'Cupom');db.coupons=db.coupons.filter(c=>c.id!==id);return{deleted:id}},
 quote:({productId,quantity=1,coupon=''})=>{const{o,couponError}=order(productId,quantity,coupon);return couponError?{...o,couponError}:o},
 list_channels:async()=>{const l=await dc('GET','/guilds/'+await guildId()+'/channels');const cat=Object.fromEntries(l.filter(c=>c.type===4).map(c=>[c.id,c.name]));
  return l.filter(c=>c.type===0||c.type===5).sort((a,b)=>a.position-b.position).map(c=>({id:c.id,name:c.name,category:cat[c.parent_id]||''}))},
 send_embed:async({channelId,color,blocks})=>{if(!/^\d{15,22}$/.test(String(channelId||'')))throw Error('Escolha o canal');
  if(!Array.isArray(blocks)||!blocks.length)throw Error('Adicione ao menos um bloco');if(blocks.length>30)throw Error('Máximo de 30 blocos');
  const url=u=>{u=String(u||'').trim();if(!/^https?:\/\/\S+$/i.test(u))throw Error('URL de imagem inválida: '+(u||'(vazia)'));return u};
  const txt=v=>{v=String(v||'').trim();if(!v)throw Error('Há um bloco de texto vazio');return v.slice(0,4000)};
  const cs=blocks.map(b=>b.t==='text'?{type:10,content:txt(b.v)}:b.t==='image'?{type:12,items:[{media:{url:url(b.u)}}]}:b.t==='sep'?{type:14,divider:true,spacing:1}:b.t==='long'?{type:14,divider:true,spacing:2}:b.t==='thumb'?{type:9,components:[{type:10,content:txt(b.v)}],accessory:{type:11,media:{url:url(b.u)}}}:(()=>{throw Error('Bloco inválido')})());
  const box={type:17,components:cs};if(/^#[0-9a-f]{6}$/i.test(color||''))box.accent_color=parseInt(color.slice(1),16);
  const m=await dc('POST','/channels/'+channelId+'/messages',{flags:32768,components:[box]});return{sent:m.id}}
};
const R={'GET channels':'list_channels','POST embeds':'send_embed','GET coupons':'list_coupons','POST coupons':'create_coupon','PUT coupons/:id':'update_coupon','DELETE coupons/:id':'delete_coupon','GET quote':'quote','POST quote':'quote','GET categories':'list_categories','POST categories':'create_category','PUT categories/:id':'update_category','DELETE categories/:id':'delete_category','GET summary':'summary','GET products':'list_products','POST products':'create_product','PUT products/:id':'update_product','DELETE products/:id':'delete_product',
 'GET tickets':'list_tickets','POST tickets':'create_ticket','PATCH tickets/:id':'update_ticket','DELETE tickets/:id':'delete_ticket','GET sales':'list_sales','POST sales':'create_sale'};
const S={type:'string'},N={type:'number'},B={type:'boolean'};
const T=(n,d,p={},r=[])=>({type:'function',function:{name:n,description:d,parameters:{type:'object',properties:p,required:r}}});
const TOOLS=[T('summary','Resumo geral: produtos, tickets e total vendido'),T('list_products','Lista produtos'),
 T('list_categories','Lista categorias'),T('create_category','Cria categoria',{name:S},['name']),T('update_category','Renomeia categoria',{id:S,name:S},['id','name']),T('delete_category','Exclui categoria (os produtos ficam sem categoria)',{id:S},['id']),
 T('create_product','Cria produto, opcionalmente numa categoria (categoryId) e com estoque infinito (unlimited:true)',{name:S,price:N,stock:N,description:S,categoryId:S,unlimited:B},['name','price']),
 T('update_product','Edita produto, inclusive categoria (categoryId) e estoque infinito (unlimited)',{id:S,name:S,price:N,stock:N,description:S,categoryId:S,unlimited:B},['id']),T('delete_product','Exclui produto',{id:S},['id']),
 T('list_tickets','Lista tickets (status: aberto, fechado ou realizado)',{status:S}),
 T('create_ticket','Abre ticket',{subject:S,customer:S,message:S},['subject']),
 T('update_ticket','Muda status do ticket: aberto, fechado ou realizado',{id:S,status:S},['id','status']),T('delete_ticket','Exclui ticket',{id:S},['id']),
 T('list_coupons','Lista cupons'),T('create_coupon','Cria cupom de desconto (type: percent ou fixed)',{code:S,type:S,value:N,maxUses:N,expiresAt:S,productId:S},['code','value']),T('update_coupon','Edita, ativa ou desativa cupom',{id:S,value:N,active:B,maxUses:N,expiresAt:S},['id']),T('delete_coupon','Exclui cupom',{id:S},['id']),T('quote','Resumo da compra com desconto do cupom',{productId:S,quantity:N,coupon:S},['productId']),
 T('list_sales','Lista vendas'),T('create_sale','Registra venda (cupom opcional)',{productId:S,quantity:N,coupon:S},['productId'])];
async function ai(messages){
 const key=process.env.GROQ_API_KEY;if(!key)throw Error('Defina GROQ_API_KEY nas variáveis de ambiente da Vercel.');
 const msgs=[{role:'system',content:'Você é o assistente do painel. Responda em português, curto. Use as ferramentas para criar/excluir produtos, ver e atualizar tickets e consultar vendas. Produtos podem ter categoria e estoque infinito. Existem cupons de desconto. Antes de excluir ou mover algo, use list_* para achar o id correto.'},...messages];
 for(let n=0;n<6;n++){
  const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
   body:JSON.stringify({model:process.env.GROQ_MODEL||'llama-3.3-70b-versatile',messages:msgs,tools:TOOLS,tool_choice:'auto'})});
  const d=await r.json();if(!r.ok)throw Error(d.error?.message||'Erro na Groq');
  const m=d.choices[0].message;msgs.push({role:'assistant',content:m.content||'',tool_calls:m.tool_calls});
  if(!m.tool_calls?.length)return m.content||'Pronto.';
  for(const c of m.tool_calls){let out;try{if(!A[c.function.name])throw Error('Ferramenta inválida');out=A[c.function.name](JSON.parse(c.function.arguments||'{}'))}catch(e){out={error:e.message}}
   msgs.push({role:'tool',tool_call_id:c.id,content:JSON.stringify(out)})}
 }return 'Terminei as ações.';
}
module.exports=async(req,res)=>{
 const send=(c,b)=>res.status(c).json(b);
 const u=new URL(req.url,'http://x'),same=req.headers['sec-fetch-site']==='same-origin';
 const hasKey=!!process.env.API_KEY&&req.headers['x-api-key']===process.env.API_KEY;
 if(!same&&!hasKey)return send(401,{error:'API key inválida. Envie o header x-api-key.'});
 try{
  let body=req.body||{};if(typeof body==='string')body=body?JSON.parse(body):{};
  const seg=u.pathname.replace(/^\/api\/?/,'').split('/').filter(Boolean);
  if(seg[0]==='key'){if(!same)return send(403,{error:'Somente pelo painel'});return send(200,{key:process.env.API_KEY||'Defina API_KEY nas variáveis de ambiente da Vercel'})}
  await load();
  if(seg[0]==='ai'&&req.method==='POST'){const reply=await ai(body.messages||[]);await save();return send(200,{reply})}
  const act=R[`${req.method} ${seg[0]}${seg[1]?'/:id':''}`];if(!act)return send(404,{error:'Rota não encontrada'});
  const out=await A[act]({...Object.fromEntries(u.searchParams),...body,id:seg[1]||body.id});
  if(req.method!=='GET')await save();
  send(200,out);
 }catch(e){send(400,{error:e.message})}
};
