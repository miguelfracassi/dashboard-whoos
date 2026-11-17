const ROOT=document.currentScript.src.replace(/js\/app\.js.*$/,'');
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const brl=n=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
async function api(p,o={}){const r=await fetch('/api'+p,{...o,headers:{'Content-Type':'application/json'},body:o.body?JSON.stringify(o.body):undefined});
 const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'API indisponível (rode com vercel dev ou publique na Vercel)');return d}
function toast(t){const e=$('#toast');e.textContent=t;e.style.display='block';clearTimeout(e._t);e._t=setTimeout(()=>e.style.display='none',3200)}
const mascot=(s=60)=>`<svg width="${s}" height="${s}" viewBox="0 0 100 100" aria-hidden="true"><path d="M16 44 24 8l26 18M84 44 76 8 50 26" fill="#b8324f"/><rect x="14" y="24" width="72" height="60" rx="30" fill="#e5506f"/><rect x="23" y="38" width="54" height="38" rx="19" fill="#dff4f1"/><path d="M33 56q6-9 12 0M55 56q6-9 12 0" stroke="#17142b" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M42 65q8 7 16 0" stroke="#17142b" stroke-width="3.5" fill="none" stroke-linecap="round"/><circle cx="50" cy="19" r="5" fill="#ff9fd0"/><path d="M36 86q-6 8 0 12M64 86q6 8 0 12" stroke="#b8324f" stroke-width="6" fill="none" stroke-linecap="round"/></svg>`;
const P={chat:'M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.2A8 8 0 1 1 21 12z',box:'M3 7.5 12 3l9 4.5v9L12 21l-9-4.5zM3 7.5l9 4.5 9-4.5M12 12v9',ticket:'M4 6h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4zM14 6v12',lock:'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',check:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 12.5l3 3 5-6',coin:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM14.8 9.2c-.6-.8-1.6-1.2-2.8-1.2-1.5 0-2.6.7-2.6 1.9 0 2.6 5.4 1.2 5.4 3.9 0 1.2-1.2 2-2.8 2-1.3 0-2.4-.5-3-1.4M12 6.5V8M12 16v1.5',bell:'M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0',book:'M4 5.5C6.5 4 9.5 4 12 5.5 14.5 4 17.5 4 20 5.5V19c-2.5-1.5-5.5-1.5-8 0-2.5-1.5-5.5-1.5-8 0zM12 5.5V19',arrow:'M5 12h14M13 6l6 6-6 6',arrowur:'M7 17 17 7M8 7h9v9'};
const ico=(n,s=20)=>`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${P[n]||''}"/></svg>`;
const hydrate=()=>document.querySelectorAll('[data-i]').forEach(e=>{e.innerHTML=ico(e.dataset.i,+e.dataset.s||20);e.removeAttribute('data-i')});
function shell(active){
 const L=[['/','index.html','Dashboard'],['/gerenciar/products','gerenciar/products.html','Produtos'],['/gerenciar/tickets','gerenciar/tickets.html','Tickets'],['/vendas','vendas.html','Vendas']];
 $('#nav').outerHTML=`<header class="top"><span>${mascot(46)}</span><nav>${L.map(([k,h,t])=>`<a href="${ROOT}${h}" class="${k===active?'on':''}">${t}</a>`).join('')}</nav>
 <div class="me"><div><b>Olá, Admin</b><i class="bar"><u style="width:60%"></u></i></div><span class="av">${mascot(30)}</span>
 <a class="ic gl" href="${ROOT}vendas.html" aria-label="Vendas">${ico('coin')}</a><a class="ic gl" href="${ROOT}gerenciar/tickets.html" aria-label="Tickets">${ico('bell')}<s></s></a></div></header>`;
 document.body.insertAdjacentHTML('beforeend',`<div id="toast"></div>
 <section id="chat" class="gl" aria-label="Assistente IA"><b>Assistente IA (Groq)</b><div id="msgs"><div class="m">Oi! Posso criar e excluir produtos, ver tickets, fechar ou marcar como realizado e mostrar o total vendido.</div></div>
 <form id="cf" style="display:flex;gap:8px"><input id="ci" placeholder="Peça algo..." autocomplete="off"><button class="btn">Enviar</button></form></section>
 <button class="fab gl" id="fab" aria-label="Abrir assistente">${mascot(54)}</button>`);
 const hist=[];window.openChat=()=>$('#chat').classList.toggle('open');$('#fab').onclick=openChat;
 const add=(t,c='')=>{const d=document.createElement('div');d.className='m '+c;d.textContent=t;$('#msgs').append(d);$('#msgs').scrollTop=1e9;return d};
 window.askAI=async t=>{$('#chat').classList.add('open');add(t,'u');hist.push({role:'user',content:t});const w=add('Pensando...');
  try{const{reply}=await api('/ai',{method:'POST',body:{messages:hist}});w.textContent=reply;hist.push({role:'assistant',content:reply});window.refresh&&refresh()}
  catch(err){w.textContent='Erro: '+err.message}};
 hydrate();$('#cf').onsubmit=e=>{e.preventDefault();const t=$('#ci').value.trim();if(t){$('#ci').value='';askAI(t)}};
}

document.addEventListener('pointermove',e=>{const g=e.target.closest&&e.target.closest('.gl');if(g){const r=g.getBoundingClientRect();g.style.setProperty('--mx',e.clientX-r.left+'px');g.style.setProperty('--my',e.clientY-r.top+'px')}});
function cnt(el,to,f=v=>Math.round(v)){const a=+el.dataset.v||0;el.dataset.v=to;const t0=performance.now();(function s(t){const k=Math.min(1,(t-t0)/1000),e=1-Math.pow(1-k,3);el.textContent=f(a+(to-a)*e);k<1&&requestAnimationFrame(s)})(t0)}
