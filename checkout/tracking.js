(() => {
const storageKey='loja-attribution-v1';
const fields=['utm_source','utm_medium','utm_campaign','utm_content','utm_term','src','sck','fbclid'];
let saved={};try{saved=JSON.parse(sessionStorage.getItem(storageKey)||'{}');}catch{}
const params=new URLSearchParams(location.search);
for(const field of fields){if(params.has(field))saved[field]=params.get(field).slice(0,500);}
try{sessionStorage.setItem(storageKey,JSON.stringify(saved));}catch{}
function cookie(name){const item=document.cookie.split('; ').find(v=>v.startsWith(name+'='));if(!item)return '';try{return decodeURIComponent(item.slice(name.length+1));}catch{return '';}}
let fbc=cookie('_fbc');if(!fbc&&saved.fbclid){fbc=saved.fbc||'fb.1.'+Date.now()+'.'+saved.fbclid;saved.fbc=fbc;try{sessionStorage.setItem(storageKey,JSON.stringify(saved));}catch{}}
window.StoreTracking={
newEventId(){return 'ev_'+Date.now()+'_'+(crypto.randomUUID?crypto.randomUUID().replace(/-/g,''):Math.random().toString(36).slice(2));},
payload(evento_id){const result={evento_id,user_agent:navigator.userAgent,fbp:cookie('_fbp'),fbc};for(const key of fields.filter(k=>k!=='fbclid'))if(saved[key])result[key]=saved[key];return result;},
purchase(payment,items){if(typeof window.fbq!=='function')return false;const key='purchase-sent:'+payment.evento_id;try{if(sessionStorage.getItem(key))return true;}catch{}window.fbq('track','Purchase',{value:Number(payment.valor),currency:'BRL',content_type:'product',content_ids:items.map(i=>i.product.id),contents:items.map(i=>({id:i.product.id,quantity:i.quantity})),num_items:items.reduce((n,i)=>n+i.quantity,0)},{eventID:payment.evento_id});try{sessionStorage.setItem(key,'1');}catch{}return true;}
};
})();
