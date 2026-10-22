import { readReconcileCursor,saveReconcileCursor } from './order-store.js';
export async function reconcileTracking(tracker,verify,{readCursor=readReconcileCursor,saveCursor=saveReconcileCursor,now=()=>Date.now()}={}){
 const started=now();let checkpoint=await readCursor(),scanned=0,synced=0,failed=0;
 do{const page=await tracker.page(checkpoint.cursor);for(let i=checkpoint.index||0;i<page.refs.length;i++){
  if(now()-started>45000){await saveCursor({cursor:checkpoint.cursor,index:i});return {ok:true,scanned,synced,failed,continued:true};}
  const ref=page.refs[i];scanned++;
  try{const record=await tracker.record(ref);if(!record?.id||record.providerManaged||record.sent==='refunded'||record.sent==='refused'||record.sent==='paid')continue;if(Date.now()-Date.parse(record.createdAt.replace(' ','T')+'Z')>7*86400000)continue;await tracker.sync(ref,verify);synced++;}catch{failed++;}
 }checkpoint={cursor:page.cursor,index:0};}while(checkpoint.cursor);
 await saveCursor({cursor:null,index:0});return {ok:true,scanned,synced,failed,continued:false};
}
