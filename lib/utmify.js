import { createHash, createHmac, randomUUID } from 'node:crypto';
import { blobOrderStore } from './order-store.js';
const API='https://api.utmify.com.br/api-credentials/orders';
function paidTime(value,fallback){if(typeof value==='string'){const normalized=value.replace(' ','T');const time=Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/.test(normalized)?normalized:normalized+'-03:00');if(Number.isFinite(time))return utc(time);}return utc(fallback);}
const utc=value=>new Date(value).toISOString().slice(0,19).replace('T',' ');
export class TrackingError extends Error {constructor(message,status=503){super(message);this.status=status;}}
export function trackingEnabled(){return !!process.env.UTMIFY_API_TOKEN;}
export function orderReference(event){return createHmac('sha256',process.env.PIX_SIGNING_SECRET||process.env.URUSPAY_API_KEY||'').update('utmify:'+event).digest('hex');}
const fingerprint=p=>createHash('sha256').update(JSON.stringify({email:p.email,cpf:p.cpf,itens:p.itens,valor:p.valor})).digest('hex');
export function makeOrder(payload,cents){const customer={name:payload.nome,email:payload.email,phone:payload.telefone||null,document:payload.cpf||null,country:'BR',...(payload.ip?{ip:payload.ip}:{})};const trackingParameters=Object.fromEntries(['src','sck','utm_source','utm_campaign','utm_medium','utm_content','utm_term'].map(k=>[k,payload[k]||null]));return {fingerprint:fingerprint(payload),createdAt:utc(Date.now()),cents,customer,products:payload.itens.map(i=>({id:String(i.id),name:i.nome,quantity:i.quantidade,priceInCents:Math.round(i.preco_unitario*100),planId:null,planName:null})),trackingParameters,id:null,observed:'waiting_payment',sent:null,approvedDate:null,refundedAt:null,lease:null,payment:null,providerManaged:false};}
export function utmifyPayload(record){return {orderId:String(record.id),platform:'UrusPay',paymentMethod:'pix',status:record.observed,createdAt:record.createdAt,approvedDate:record.approvedDate,refundedAt:record.refundedAt,customer:record.customer,products:record.products,trackingParameters:record.trackingParameters,commission:{totalPriceInCents:record.cents,gatewayFeeInCents:0,userCommissionInCents:record.cents,currency:'BRL'},isTest:false};}
export function createOrderTracker({store=blobOrderStore,fetcher=(...args)=>fetch(...args),now=()=>Date.now()}={}){
 async function lock(ref){for(let attempt=0;attempt<3;attempt++){const row=await store.read(ref);if(!row)throw new TrackingError('Pedido de rastreamento não encontrado.',404);if(row.value.lease?.until>now())throw new TrackingError('Pedido sendo sincronizado.');const value={...row.value,lease:{id:randomUUID(),until:now()+60000}};try{const saved=await store.save(ref,value,row.etag);return {value,etag:saved.etag};}catch(err){if(err.name!=='BlobPreconditionFailedError')throw err;}}throw new TrackingError('Pedido sendo sincronizado.');}
 async function withLock(ref,fn){const row=await lock(ref);let value=row.value;let response;try{response=await fn(value);}finally{value.lease=null;await store.save(ref,value,row.etag);}return response;}
 return {
  async begin(ref,payload,cents){const existing=await store.read(ref);if(existing){if(existing.value.fingerprint!==fingerprint(payload))throw new TrackingError('O pedido foi alterado. Recarregue o checkout.',409);if(existing.value.payment)return existing.value.payment;throw new TrackingError('Já existe uma tentativa deste Pix. Aguarde a confirmação antes de repetir.',409);}await store.create(ref,makeOrder(payload,cents));return null;},
  async bind(ref,id,payment,nativeTracking){return withLock(ref,async record=>{record.id=String(id);record.payment=payment;record.providerManaged=nativeTracking==='enviado';});},
  async sync(ref,verify){return withLock(ref,async record=>{
   if(!record.id)throw new TrackingError('A geração deste Pix ainda está sendo concluída.');
   const status=await verify(record.id);if(String(status.venda_id)!==record.id||Math.round(Number(status.valor)*100)!==record.cents)throw new TrackingError('Confirmação de pagamento divergente.',502);
   const paid=status.pago===true||status.status==='paid';
   if(status.status==='refunded'){record.observed='refunded';record.refundedAt=record.refundedAt||utc(now());}
   else if(paid&&record.observed!=='refunded'){record.observed='paid';record.approvedDate=record.approvedDate||paidTime(status.pago_em,now());}
   else if(status.status==='cancelled'&&record.observed==='waiting_payment')record.observed='refused';
   if(record.providerManaged)return {ok:true,managedBy:'uruspay',status:record.observed};
   if(record.sent===record.observed)return {ok:true,status:record.observed,alreadySent:true};
   let response;try{response=await fetcher(API,{method:'POST',headers:{'Content-Type':'application/json','x-api-token':process.env.UTMIFY_API_TOKEN},body:JSON.stringify(utmifyPayload(record)),signal:AbortSignal.timeout(8000),redirect:'error'});}catch{record.lastError='UTMIFY_UNAVAILABLE';throw new TrackingError('UTMify temporariamente indisponível.');}
   if(!response.ok){record.lastError='UTMIFY_HTTP_'+response.status;console.error('utmify_delivery_error',{status:response.status,orderId:record.id});throw new TrackingError('UTMify recusou a sincronização.');}
   let result;try{result=await response.json();}catch{record.lastError='UTMIFY_INVALID_RESPONSE';throw new TrackingError('Resposta UTMify inválida.');}
   if(result?.OK===false||result?.ok===false||result?.success===false||result?.result==='ERROR'||result?.statusCode>=400||result?.error||!(result?.OK===true||result?.ok===true||result?.success===true||result?.result==='SUCCESS')){record.lastError='UTMIFY_REJECTED';throw new TrackingError('UTMify recusou a sincronização.');}
   record.sent=record.observed;record.lastError=null;record.sentAt=utc(now());console.info('utmify_delivery_success',{orderId:record.id,status:record.sent});return {ok:true,status:record.sent};
  });},
  async record(ref){return (await store.read(ref))?.value||null;},
  async page(cursor){return store.page(cursor);}
 };
}
export const orderTracker=createOrderTracker();
