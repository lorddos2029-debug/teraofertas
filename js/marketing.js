(() => {
'use strict';
try{if(localStorage.getItem('store-marketing-consent')==='denied'){document.addEventListener('DOMContentLoaded',()=>{const checkbox=document.getElementById('marketing-consent');if(checkbox)checkbox.checked=false;});return;}}catch{}
if(window.__storeMarketingStarted)return;window.__storeMarketingStarted=true;
const pixel=String(window.STORE_MARKETING?.metaPixelId||'');
if(/^\d{5,25}$/.test(pixel)){
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=true;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=true;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
window.fbq('init',pixel);window.fbq('track','PageView');
}
document.addEventListener('DOMContentLoaded',()=>{if(typeof window.fbq!=='function')return;const product=window.STORE_PRODUCT;if(product)window.fbq('track','ViewContent',{content_ids:[String(product.id)],content_type:'product',value:Number(product.price),currency:'BRL'});if(location.pathname.replace(/\/$/,'')==='/checkout')window.fbq('track','InitiateCheckout');},{once:true});
const utm=document.createElement('script');utm.src='https://cdn.utmify.com.br/scripts/utms/latest.js';utm.async=true;utm.defer=true;utm.setAttribute('data-utmify-prevent-xcod-sck','');utm.setAttribute('data-utmify-prevent-subids','');document.head.appendChild(utm);
})();
