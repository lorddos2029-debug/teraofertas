(() => {
'use strict';
const $=s=>document.querySelector(s);
const products=window.STORE_PRODUCTS||[],config=window.STORE_CONFIG||{};
const byId=new Map(products.map(p=>[String(p.id),p]));
const isPixPage=location.pathname.replace(/\/$/,'')==='/pix';
let activeQuery='';try{activeQuery=sessionStorage.getItem('loja-active-pix-order')||'';}catch{}
const params=new URLSearchParams(isPixPage?activeQuery:location.search);
const money=cents=>(cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const qty=v=>Math.max(1,Math.min(99,Math.floor(Number(v)||1)));
let items=[],step=1,customer=null,address=null,payment=null;
let pollTimer=null,expiryTimer=null,checking=false,generating=false;
let eventId=window.StoreTracking.newEventId();
const selected=params.get('product');
if(selected){const p=byId.get(selected)||products.find(p=>p.slug===selected);if(p)items=[{product:p,quantity:qty(params.get('quantity'))}];}
else if(params.has('items')){try{const raw=JSON.parse(params.get('items'));if(Array.isArray(raw))for(const item of raw.slice(0,50)){const p=byId.get(String(item.product_id||item.id));if(!p)continue;const same=items.find(i=>i.product.id===p.id);if(same)same.quantity=qty(same.quantity+qty(item.quantity));else items.push({product:p,quantity:qty(item.quantity)});}}catch{}}
let shippingCents=0,shippingMethod='pac';
const subtotal=()=>items.reduce((sum,i)=>sum+Math.round(i.product.price*100)*i.quantity,0);
const total=()=>subtotal()+shippingCents;
function error(message){const el=$('#step-error');el.textContent=message;el.hidden=!message;if(message)el.scrollIntoView({block:'nearest',behavior:'smooth'});}
function renderSummary(){
$('#order-items').innerHTML=items.map(i=>`<article class="order-item"><img src="${esc(i.product.images[0])}" alt="${esc(i.product.name)}"><div><h3>${esc(i.product.name)}</h3><p class="unit-price">${money(Math.round(i.product.price*100))}</p><label class="quantity-line">Quantidade<input type="number" min="1" max="99" value="${i.quantity}" data-quantity="${i.product.id}" aria-label="Quantidade de ${esc(i.product.name)}"></label></div></article>`).join('');
$('#order-subtotal').textContent=money(subtotal());$('#order-shipping').textContent=shippingCents?money(shippingCents):'Grátis';$('#order-total').textContent=money(total());$('#shipping-label').textContent=shippingCents?'Frete: '+money(shippingCents):'Frete grátis';
}
function go(next){step=next;error('');document.querySelectorAll('[data-panel]').forEach(p=>p.hidden=Number(p.dataset.panel)!==step);document.querySelectorAll('[data-step]').forEach(el=>{const n=Number(el.dataset.step);el.classList.toggle('active',n===step);el.classList.toggle('complete',n<step);if(n===step)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');});if(step===3)renderPayment();const heading=$(`[data-panel="${step}"] h1`);heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true});}
function renderPayment(){
$('#review-customer').textContent=customer?customer.name+'\n'+customer.email+'\n'+customer.phone:'Dados enviados com a cobrança.';
$('#review-address').textContent=address?address.street+', '+address.number+(address.complement?' — '+address.complement:'')+'\n'+address.district+' — '+address.city+' / '+address.state+'\nCEP '+address.zip:'Endereço informado antes da geração do Pix.';
$('#generate-pix').disabled=!config.pixEndpoint||!!payment||generating;$('#pix-pending').hidden=true;
}
function validCpf(value){const digits=value.replace(/\D/g,'');if(digits.length!==11||/^(\d)\1+$/.test(digits))return false;for(let n=9;n<11;n++){let sum=0;for(let i=0;i<n;i++)sum+=Number(digits[i])*(n+1-i);let check=(sum*10)%11;if(check===10)check=0;if(check!==Number(digits[n]))return false;}return true;}
function data(form){return Object.fromEntries([...new FormData(form)].map(([k,v])=>[k,String(v).trim()]));}
const identity=$('#identity-form'),delivery=$('#delivery-form');
function updateShipping(){const complete=delivery.elements.zip.value.replace(/\D/g,'').length===8;$('#shipping-options').hidden=!complete;if(!complete)delivery.querySelector('[value="pac"]').checked=true;shippingMethod=complete?delivery.elements.shipping_method.value:'pac';shippingCents=shippingMethod==='sedex'?1790:0;renderSummary();if(!complete)$('#order-shipping').textContent='Informe o CEP';}
delivery.elements.zip.addEventListener('input',updateShipping);delivery.elements.zip.addEventListener('change',updateShipping);delivery.querySelectorAll('[name="shipping_method"]').forEach(input=>input.addEventListener('change',updateShipping));
identity.addEventListener('submit',e=>{e.preventDefault();if(!identity.reportValidity())return;const values=data(identity);if(values.name.split(/\s+/).length<2){error('Informe seu nome completo.');identity.elements.name.focus();return;}if(!validCpf(values.document)){error('Confira o CPF informado.');identity.elements.document.focus();return;}if(!/^\d{10,11}$/.test(values.phone.replace(/\D/g,''))){error('Informe um celular com DDD, com 10 ou 11 dígitos.');identity.elements.phone.focus();return;}customer=values;go(2);});
delivery.addEventListener('submit',e=>{e.preventDefault();if(!delivery.reportValidity())return;const values=data(delivery);if(values.zip.replace(/\D/g,'').length!==8){error('Informe um CEP com 8 dígitos.');delivery.elements.zip.focus();return;}address=values;go(3);});
for(const uf of ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']){const opt=document.createElement('option');opt.value=uf;opt.textContent=uf;delivery.elements.state.append(opt);}
identity.elements.document.addEventListener('blur',e=>{const s=e.target.value.replace(/\D/g,'');if(s.length===11)e.target.value=s.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4');});
delivery.elements.zip.addEventListener('blur',e=>{const s=e.target.value.replace(/\D/g,'');if(s.length===8)e.target.value=s.replace(/(\d{5})(\d{3})/,'$1-$2');});
document.addEventListener('click',e=>{const back=e.target.closest('[data-back]');if(back)go(Number(back.dataset.back));});
function quantityChanged(e){if(!e.target.matches('[data-quantity]'))return;const item=items.find(i=>i.product.id===e.target.dataset.quantity);if(!item)return;item.quantity=qty(e.target.value);payment=null;$('#pix-result').hidden=true;e.target.value=item.quantity;$('#order-subtotal').textContent=money(subtotal());$('#order-total').textContent=money(total());const url=new URL(location.href);url.search='';if(items.length===1){url.searchParams.set('product',items[0].product.id);url.searchParams.set('quantity',items[0].quantity);}else url.searchParams.set('items',JSON.stringify(items.map(i=>({product_id:i.product.id,quantity:i.quantity}))));history.replaceState(null,'',url);if(step===3)renderPayment();}
$('#order-items').addEventListener('input',quantityChanged);
$('#order-items').addEventListener('change',quantityChanged);
function paymentStorageKey(){return 'uruspay-pix:'+JSON.stringify(items.map(i=>[i.product.id,i.quantity,Math.round(i.product.price*100)]));}
function savePayment(){try{sessionStorage.setItem(paymentStorageKey(),JSON.stringify(payment));}catch{}}
function lockOrder(){document.querySelectorAll('[data-quantity],[data-back]').forEach(el=>el.disabled=true);}
function safeStatusUrl(value){const url=new URL(value,location.origin);if(url.origin!==location.origin||url.pathname!=='/api/pix/status')throw Error('Consulta de pagamento inválida.');return url.href;}
function updateExpiry(){if(!payment)return;const remaining=Date.parse(payment.expira_em)-Date.now();if(!Number.isFinite(remaining)){$('#pix-expires').textContent='';return;}if(payment.pago===true){$('#pix-expires').textContent='';return;}if(remaining<=0){$('#pix-expires').textContent='Prazo do Pix encerrado. Consulte o status antes de iniciar outra compra.';return;}const seconds=Math.ceil(remaining/1000);$('#pix-expires').textContent='Pix válido por '+String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');}
function showPix(){
$('#pix-code').value=payment.pix_code;const qr=$('#pix-qr');let url;try{url=new URL(payment.qr_code_url);if(url.protocol!=='https:'&&!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(payment.qr_code_url))throw Error();}catch{throw Error('QR Code inválido.');}qr.src=url.href;qr.referrerPolicy='no-referrer';qr.hidden=false;$('#pix-result').hidden=false;$('#pix-pending').hidden=true;$('#generate-pix').disabled=true;$('#generate-pix').textContent='Pix gerado';$('#payment-state').textContent='Aguardando pagamento. A confirmação é consultada a cada 5 segundos.';lockOrder();updateExpiry();clearInterval(expiryTimer);expiryTimer=setInterval(updateExpiry,1000);
}
function stopPolling(){clearTimeout(pollTimer);pollTimer=null;}
function confirmPaid(result){if(!payment)return;const already=payment.pago===true;payment={...payment,...result,pago:true,status:'paid'};savePayment();stopPolling();clearInterval(expiryTimer);$('#pix-result').hidden=true;$('#generate-pix').hidden=true;$('#paid-confirmation').hidden=false;const tutorial=document.querySelector('.pix-tutorial');if(tutorial)tutorial.hidden=true;$('#paid-reference').textContent='Pedido / pagamento #'+payment.venda_id;$('#pix-expires').textContent='';window.StoreTracking.purchase(payment,items);if(!already)$('#paid-confirmation').scrollIntoView({behavior:'smooth',block:'center'});}
async function checkPayment(){if(checking||!payment||payment.pago===true)return;checking=true;try{const response=await fetch(safeStatusUrl(payment.check_status_url),{cache:'no-store',referrerPolicy:'no-referrer'});const result=await response.json();if(!response.ok||result.ok!==true)throw Error(result.error||'Não foi possível verificar o pagamento.');if(result.pago===true||result.status==='paid'){confirmPaid(result);return;}if(result.status==='cancelled'||result.status==='refunded'){payment={...payment,...result};savePayment();stopPolling();clearInterval(expiryTimer);$('#payment-state').textContent=result.status==='refunded'?'Pagamento estornado. Entre em contato com a loja.':'Cobrança cancelada. Volte à loja para iniciar outro pedido.';$('#pix-qr').hidden=true;$('#pix-code').closest('label').hidden=true;$('#copy-pix').hidden=true;$('#check-payment').disabled=true;return;}$('#payment-state').textContent='Aguardando pagamento. Nova consulta em 5 segundos.';}catch(err){$('#payment-state').textContent=(err.message||'Consulta indisponível.')+' Tentaremos novamente em 5 segundos.';}finally{checking=false;}}
async function poll(){await checkPayment();if(payment&&!payment.pago&&!['cancelled','refunded'].includes(payment.status))pollTimer=setTimeout(poll,5000);}
function startPolling(){stopPolling();pollTimer=setTimeout(poll,5000);}
$('#check-payment').addEventListener('click',async()=>{stopPolling();await checkPayment();if(payment&&!payment.pago&&!['cancelled','refunded'].includes(payment.status))startPolling();});
window.addEventListener('pagehide',()=>{stopPolling();clearInterval(expiryTimer);});
$('#generate-pix').addEventListener('click',async()=>{
if(!config.pixEndpoint||!customer||!address||payment||generating)return;generating=true;const button=$('#generate-pix');button.disabled=true;button.textContent='Gerando Pix…';error('');
try{const response=await fetch(config.pixEndpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:items.map(i=>({product_id:i.product.id,quantity:i.quantity})),expected_total:total()/100,customer:{name:customer.name,email:customer.email,document:customer.document.replace(/\D/g,''),phone:customer.phone.replace(/\D/g,'')},shipping:{...address,method:shippingMethod},tracking:window.StoreTracking.payload(eventId)})});let result;try{result=await response.json();}catch{throw Error('O servidor não retornou uma resposta válida.');}if(!response.ok||result.ok!==true)throw Error(result.error||'Não foi possível gerar o Pix.');if(!result.venda_id||!result.pix_code||!result.qr_code_url||!result.check_status_url)throw Error('O provedor retornou um Pix incompleto.');safeStatusUrl(result.check_status_url);payment={...result,shipping_method:shippingMethod};eventId=result.evento_id;savePayment();try{sessionStorage.setItem(paymentStorageKey(),JSON.stringify(payment));sessionStorage.setItem('loja-active-pix-order',location.search);}catch{throw Error('Permita o armazenamento nesta aba para abrir o Pix.');}location.assign('/pix');return;}
catch(err){error(err.message||'Não foi possível gerar o Pix.');button.disabled=false;button.textContent='Gerar Pix';}finally{generating=false;}
});

$('#copy-pix').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('#pix-code').value);$('#copy-pix').textContent='Código copiado';}catch{$('#pix-code').select();$('#copy-pix').textContent='Selecione e copie o código';}});
if(!items.length){if(isPixPage){$('#empty-checkout h1').textContent='Seu Pix aparecerá aqui';$('#empty-checkout p').textContent='Gere o Pix no checkout para visualizar o QR Code e acompanhar o pagamento nesta aba.';}$('#checkout-content').hidden=true;$('.steps').hidden=true;$('#empty-checkout').hidden=false;return;}
$('#back-product').href=items.length===1?'/'+items[0].product.slug:'/';renderSummary();
try{const saved=JSON.parse(sessionStorage.getItem(paymentStorageKey())||'null');if(saved&&saved.check_status_url&&saved.evento_id){payment=saved;shippingMethod=saved.shipping_method==='sedex'?'sedex':'pac';shippingCents=shippingMethod==='sedex'?1790:0;renderSummary();eventId=saved.evento_id;}}catch{}
if(isPixPage&&!payment){$('#checkout-content').hidden=true;$('.steps').hidden=true;$('#empty-checkout').hidden=false;$('#empty-checkout h1').textContent='Seu Pix aparecerá aqui';$('#empty-checkout p').textContent='Gere o Pix no checkout para visualizar o QR Code e acompanhar o pagamento nesta aba.';return;}
if(payment&&!isPixPage){try{sessionStorage.setItem('loja-active-pix-order',location.search);}catch{}location.replace('/pix');return;}
if(payment){payment={...payment,pago:false,status:'pending'};go(3);showPix();checkPayment().then(()=>{if(!payment.pago&&!['cancelled','refunded'].includes(payment.status))startPolling();});}else {updateShipping();go(1);}
})();
