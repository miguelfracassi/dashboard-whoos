// Função serverless da Vercel — toda a API (/api/*). Dados no Supabase (tabela "painel").
const crypto=require('crypto');
const SB=process.env.SUPABASE_URL,SK=process.env.SUPABASE_SERVICE_KEY;
const H={apikey:SK,'Content-Type':'application/json'};if(SK&&!SK.startsWith('sb_'))H.Authorization='Bearer '+SK; // chaves novas (sb_secret_) usam só o header apikey
const uid=()=>crypto.randomBytes(4).toString('hex');
let db;
const load=async()=>{if(!SB||!SK)throw Error('Defina SUPABASE_URL e SUPABASE_SERVICE_KEY na Vercel.');
 const r=await fetch(`${SB}/rest/v1/painel?id=eq.1&select=data`,{headers:H});if(!r.ok)throw Error('Supabase: '+await r.text());
 const [row]=await r.json();db=row?.data||{};db.products??=[];db.tickets??=[];db.sales??=[]};
const save=async()=>{const r=await fetch(`${SB}/rest/v1/painel?id=eq.1`,{method:'PATCH',headers:H,body:JSON.stringify({data:db})});if(!r.ok)throw Error('Supabase: '+await r.text())};
const find=(l,i,n)=>{const x=l.find(y=>y.id===i);if(!x)throw Error(n+' não encontrado');return x};
const STATUS=['aberto','fechado','realizado'];
const A={
 summary:()=>({products:db.products.length,ticketsOpen:db.tickets.filter(t=>t.status==='aberto').length,
  ticketsClosed:db.tickets.filter(t=>t.status==='fechado').length,ticketsDone:db.tickets.filter(t=>t.status==='realizado').length,
  totalSold:db.sales.reduce((s,x)=>s+x.total,0),salesCount:db.sales.length}),
 list_products:()=>db.products,
 create_product:({name,price,stock=0,description=''})=>{if(!name)throw Error('name é obrigatório');
  const p={id:uid(),name,price:+price||0,stock:+stock||0,description,createdAt:Date.now()};db.products.push(p);return p},
 update_product:({id,...f})=>{const p=find(db.products,id,'Produto');
  for(const k of['name','price','stock','description'])if(f[k]!==undefined)p[k]=(k==='price'||k==='stock')?+f[k]:f[k];return p},
 delete_product:({id})=>{find(db.products,id,'Produto');db.products=db.products.filter(p=>p.id!==id);return{deleted:id}},
 list_tickets:({status}={})=>status?db.tickets.filter(t=>t.status===status):db.tickets,
 create_ticket:({subject,customer='',message=''})=>{if(!subject)throw Error('subject é obrigatório');
  const t={id:uid(),subject,customer,message,status:'aberto',createdAt:Date.now()};db.tickets.push(t);return t},
 update_ticket:({id,status})=>{const t=find(db.tickets,id,'Ticket');if(!STATUS.includes(status))throw Error('status deve ser: '+STATUS.join(', '));
  t.status=status;t.updatedAt=Date.now();return t},
 delete_ticket:({id})=>{find(db.tickets,id,'Ticket');db.tickets=db.tickets.filter(t=>t.id!==id);return{deleted:id}},
 list_sales:()=>db.sales,
 create_sale:({productId,quantity=1})=>{const p=find(db.products,productId,'Produto'),q=Math.max(1,+quantity||1);
  if(p.stock<q)throw Error('Estoque insuficiente');p.stock-=q;
  const s={id:uid(),productId,productName:p.name,quantity:q,total:+(p.price*q).toFixed(2),createdAt:Date.now()};db.sales.push(s);return s}
};
const R={'GET summary':'summary','GET products':'list_products','POST products':'create_product','PUT products/:id':'update_product','DELETE products/:id':'delete_product',
 'GET tickets':'list_tickets','POST tickets':'create_ticket','PATCH tickets/:id':'update_ticket','DELETE tickets/:id':'delete_ticket','GET sales':'list_sales','POST sales':'create_sale'};
const S={type:'string'},N={type:'number'};
const T=(n,d,p={},r=[])=>({type:'function',function:{name:n,description:d,parameters:{type:'object',properties:p,required:r}}});
const TOOLS=[T('summary','Resumo geral: produtos, tickets e total vendido'),T('list_products','Lista produtos'),
 T('create_product','Cria produto',{name:S,price:N,stock:N,description:S},['name','price']),
 T('update_product','Edita produto',{id:S,name:S,price:N,stock:N,description:S},['id']),T('delete_product','Exclui produto',{id:S},['id']),
 T('list_tickets','Lista tickets (status: aberto, fechado ou realizado)',{status:S}),
 T('create_ticket','Abre ticket',{subject:S,customer:S,message:S},['subject']),
 T('update_ticket','Muda status do ticket: aberto, fechado ou realizado',{id:S,status:S},['id','status']),T('delete_ticket','Exclui ticket',{id:S},['id']),
 T('list_sales','Lista vendas'),T('create_sale','Registra venda',{productId:S,quantity:N},['productId'])];
async function ai(messages){
 const key=process.env.GROQ_API_KEY;if(!key)throw Error('Defina GROQ_API_KEY nas variáveis de ambiente da Vercel.');
 const msgs=[{role:'system',content:'Você é o assistente do painel. Responda em português, curto. Use as ferramentas para criar/excluir produtos, ver e atualizar tickets e consultar vendas. Antes de excluir algo, use list_* para achar o id correto.'},...messages];
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
  const out=A[act]({...Object.fromEntries(u.searchParams),...body,id:seg[1]||body.id});
  if(req.method!=='GET')await save();
  send(200,out);
 }catch(e){send(400,{error:e.message})}
};
