import { get, put, list } from '@vercel/blob';
const prefix='utmify/orders/';
const options={access:'private',addRandomSuffix:false,contentType:'application/json',cacheControlMaxAge:60};
const pathname=ref=>{if(!/^[a-f0-9]{64}$/.test(ref))throw Error('Invalid order reference');return prefix+ref+'.json';};
export async function readReconcileCursor(){const result=await get('utmify/reconcile-cursor.json',{access:'private',useCache:false});return result?new Response(result.stream).json():{cursor:null,index:0};}
export async function saveReconcileCursor(value){await put('utmify/reconcile-cursor.json',JSON.stringify(value),{...options,allowOverwrite:true});}
export const blobOrderStore={
 async read(ref){const result=await get(pathname(ref),{access:'private',useCache:false});if(!result)return null;return {value:await new Response(result.stream).json(),etag:result.blob.etag};},
 async create(ref,value){return put(pathname(ref),JSON.stringify(value),{...options,allowOverwrite:false});},
 async save(ref,value,etag){return put(pathname(ref),JSON.stringify(value),{...options,allowOverwrite:true,ifMatch:etag});},
 async page(cursor){const page=await list({prefix,limit:100,cursor:cursor||undefined});return {refs:page.blobs.map(b=>b.pathname.slice(prefix.length,-5)),cursor:page.hasMore?page.cursor:null};}
};
