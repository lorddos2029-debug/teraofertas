(() => {
'use strict';
try{const key='loja-attribution-v1',q=new URLSearchParams(location.search),stored=JSON.parse(sessionStorage.getItem(key)||'{}');for(const field of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','src','sck','fbclid'])if(q.has(field))stored[field]=q.get(field).slice(0,500);sessionStorage.setItem(key,JSON.stringify(stored));}catch{}

const config=window.STORE_CONFIG||{};
const products=window.STORE_PRODUCTS||[];
const current=window.STORE_PRODUCT;
const byId=new Map(products.map(p=>[p.id,p]));
const key='lojapcgamer-cart-v1';
const money=n=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let cart=[];
try{const saved=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(saved))cart=saved.filter(p=>byId.has(p.id)).map(p=>({...byId.get(p.id),quantity:Math.max(1,Math.min(99,Math.floor(Number(p.quantity)||1)))}));}catch{}
const dialog=document.createElement('dialog');dialog.id='store-cart';dialog.setAttribute('aria-label','Seu carrinho');document.body.append(dialog);
function save(){try{localStorage.setItem(key,JSON.stringify(cart.map(({id,quantity})=>({id,quantity}))));}catch{}document.querySelectorAll('.cart-count').forEach(e=>e.textContent=cart.reduce((n,p)=>n+p.quantity,0));}
function checkout(){let candidate=(cart.length===1&&config.productCheckoutUrls?.[cart[0].id])||config.checkoutUrl;try{const u=new URL(candidate);return u.protocol==='https:'?u:null;}catch{return null;}}
function render(){const url=checkout();dialog.innerHTML=`<div class="store-heading"><h2>Seu carrinho</h2><button type="button" data-close aria-label="Fechar carrinho">×</button></div>${cart.length?cart.map(p=>`<article class="store-item"><div><strong>${esc(p.name)}</strong><p>${money(p.price)}</p></div><label>Quantidade <input aria-label="Quantidade de ${esc(p.name)}" data-qty="${p.id}" type="number" min="1" max="99" value="${p.quantity}"></label><button type="button" data-remove="${p.id}">Remover</button></article>`).join(''):'<p>Seu carrinho está vazio.</p>'}${cart.length?`<p class="store-total">Subtotal: ${money(cart.reduce((n,p)=>n+p.price*p.quantity,0))}</p><p>Frete, descontos e formas de pagamento serão confirmados no checkout externo.</p>${url?`<p>Você será redirecionado para: <strong>${esc(url.hostname)}</strong></p>`:'<p role="status" class="store-notice">Checkout ainda não configurado. O link de pagamento será disponibilizado em breve.</p>'}<button type="button" class="store-checkout" ${url?'':'disabled'}>Ir para checkout externo →</button>`:''}`;}
function open(){render();if(!dialog.open)dialog.showModal();}
document.addEventListener('click',e=>{const buy=e.target.closest('[data-produto]');if(buy&&buy.matches('button')){const p=byId.get(buy.dataset.produto)||current;if(!p)return;e.preventDefault();e.stopImmediatePropagation();cart=[{...p,quantity:1}];save();location.assign('/checkout/?product='+encodeURIComponent(p.id)+'&quantity=1');}if(e.target.closest('[data-open-cart]')){e.preventDefault();open();}},true);
dialog.addEventListener('click',e=>{if(e.target.closest('[data-close]'))dialog.close();const remove=e.target.closest('[data-remove]');if(remove){cart=cart.filter(p=>p.id!==remove.dataset.remove);save();render();}if(e.target.closest('.store-checkout')){const url=checkout();if(!url||!cart.length)return;if(config.appendOrderParams)url.searchParams.set('items',JSON.stringify(cart.map(({id,quantity})=>({product_id:id,quantity}))));location.assign(url.href);}});
dialog.addEventListener('change',e=>{if(e.target.matches('[data-qty]')){const p=cart.find(p=>p.id===e.target.dataset.qty);if(!p)return;p.quantity=Math.max(1,Math.min(99,Math.floor(Number(e.target.value)||1)));save();render();}});
const form=document.querySelector('#formbusca');
if(form)form.addEventListener('submit',e=>{e.preventDefault();const q=form.querySelector('input').value.trim();if(!document.querySelector('#catalog-grid'))location.assign('/?q='+encodeURIComponent(q));});
const grid=document.querySelector('#catalog-grid');
if(grid){const search=document.querySelector('#isearch'),category=document.querySelector('#catalog-category'),sort=document.querySelector('#catalog-sort');search.value=new URLSearchParams(location.search).get('q')||'';const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();const cards=[...grid.querySelectorAll('.catalog-card')];function filter(){let count=0;const query=norm(search.value);cards.forEach(card=>{const show=norm(card.dataset.name).includes(query)&&(!category.value||card.dataset.category===category.value);card.hidden=!show;if(show)count++;});const ordered=[...cards].sort((a,b)=>sort.value==='price-asc'?Number(a.dataset.price)-Number(b.dataset.price):sort.value==='price-desc'?Number(b.dataset.price)-Number(a.dataset.price):Number(a.dataset.index)-Number(b.dataset.index));ordered.forEach(c=>grid.append(c));document.querySelector('#catalog-count').textContent=count+' produto'+(count===1?'':'s');document.querySelector('#catalog-empty').hidden=count!==0;}
search.addEventListener('input',filter);form.addEventListener('submit',filter);category.addEventListener('change',filter);sort.addEventListener('change',filter);filter();}
save();
})();
