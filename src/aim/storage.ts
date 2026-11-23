import type {AimPlan,AimRecord} from './types';
// A full multi-stage precision protocol can exceed 1,200 trials. Preserve
// several independent days of summaries while keeping raw trajectories small.
export const AIM_RECORD_LIMIT=12000,AIM_TRACE_LIMIT=64,AIM_PLAN_LIMIT=180;
let dbPromise:Promise<IDBDatabase>|null=null,epoch=0;
export const aimDataEpoch=()=>epoch;
function open(){
 if(dbPromise)return dbPromise;
 const pending=new Promise<IDBDatabase>((resolve,reject)=>{
  const r=indexedDB.open('valoprac-aim-v1',2);
  r.onupgradeneeded=e=>{
   const db=r.result;if(!db.objectStoreNames.contains('records'))db.createObjectStore('records',{keyPath:'meta.id'});if(!db.objectStoreNames.contains('plans'))db.createObjectStore('plans',{keyPath:'id'});if(!db.objectStoreNames.contains('traces'))db.createObjectStore('traces',{keyPath:'id'});
   if((e as IDBVersionChangeEvent).oldVersion===1){const request=r.transaction!.objectStore('records').openCursor();request.onsuccess=()=>{const cursor=request.result;if(!cursor)return;const record=cursor.value as AimRecord;if(record.trace.length)r.transaction!.objectStore('traces').put({id:record.meta.id,data:record.trace});cursor.update({...record,trace:[]});cursor.continue();};}
  };
  r.onsuccess=()=>{const db=r.result;db.onversionchange=()=>{db.close();if(dbPromise===pending)dbPromise=null;};resolve(db);};r.onerror=()=>reject(r.error);
 });
 dbPromise=pending;void pending.catch(()=>{if(dbPromise===pending)dbPromise=null;});return pending;
}
const aborted=(tx:IDBTransaction)=>tx.error??new DOMException('Aim storage transaction aborted','AbortError');
async function all<T>(store:string):Promise<T[]>{const db=await open();return new Promise((resolve,reject)=>{
 const tx=db.transaction(store,'readonly'),r=tx.objectStore(store).getAll();let records:T[]=[];r.onsuccess=()=>{records=r.result;};tx.oncomplete=()=>resolve(records);tx.onerror=()=>reject(aborted(tx));tx.onabort=()=>reject(aborted(tx));
});}
export async function loadAimRecords(){const [records,traces]=await Promise.all([all<AimRecord>('records'),all<{id:string;data:number[]}>('traces')]),map=new Map(traces.map(t=>[t.id,t.data]));return records.map(r=>({...r,trace:map.get(r.meta.id)??[]})).sort((a,b)=>b.meta.createdAt-a.meta.createdAt);}
export async function loadAimPlans(){return (await all<AimPlan>('plans')).sort((a,b)=>b.createdAt-a.createdAt);}
let writes=Promise.resolve();
export function saveAimRecord(record:AimRecord,expectedEpoch=epoch){
 const operation=writes.catch(()=>{}).then(async()=>{
  if(expectedEpoch!==epoch)return;const db=await open();if(expectedEpoch!==epoch)return;
  await new Promise<void>((resolve,reject)=>{
   // The transaction serializes retention against other tabs as well as this
   // module's queue. Read and prune cannot use an earlier unlocked snapshot.
   const tx=db.transaction(['records','traces'],'readwrite'),store=tx.objectStore('records'),traces=tx.objectStore('traces'),request=store.getAll();
   request.onsuccess=()=>{try{
    const records=[record,...(request.result as AimRecord[]).filter(r=>r.meta.id!==record.meta.id)].sort((a,b)=>b.meta.createdAt-a.meta.createdAt);
    records.forEach((r,i)=>{if(i>=AIM_RECORD_LIMIT){store.delete(r.meta.id);traces.delete(r.meta.id);}else{if(i>=AIM_TRACE_LIMIT)traces.delete(r.meta.id);if(r.meta.id===record.meta.id){store.put({...r,trace:[]});if(i<AIM_TRACE_LIMIT&&r.trace.length)traces.put({id:r.meta.id,data:r.trace});}}});
   }catch(error){tx.abort();reject(error);}};
   tx.oncomplete=()=>resolve();tx.onerror=()=>reject(aborted(tx));tx.onabort=()=>reject(aborted(tx));
  });
 });writes=operation;return operation;
}
export function saveAimPlan(plan:AimPlan,expectedEpoch=epoch){
 const operation=writes.catch(()=>{}).then(async()=>{
  if(expectedEpoch!==epoch)return;const db=await open();if(expectedEpoch!==epoch)return;
  await new Promise<void>((resolve,reject)=>{
   const tx=db.transaction('plans','readwrite'),store=tx.objectStore('plans'),request=store.getAll();
   request.onsuccess=()=>{try{const plans=[plan,...(request.result as AimPlan[]).filter(p=>p.id!==plan.id)].sort((a,b)=>b.createdAt-a.createdAt);plans.forEach((p,i)=>{if(i>=AIM_PLAN_LIMIT)store.delete(p.id);else if(p.id===plan.id)store.put(p);});}catch(error){tx.abort();reject(error);}};
   tx.oncomplete=()=>resolve();tx.onerror=()=>reject(aborted(tx));tx.onabort=()=>reject(aborted(tx));
  });
 });writes=operation;return operation;
}
export async function clearAimData(){epoch++;await writes.catch(()=>{});const db=await open();return new Promise<void>((resolve,reject)=>{const tx=db.transaction(['records','plans','traces'],'readwrite');for(const store of ['records','plans','traces'])tx.objectStore(store).clear();tx.oncomplete=()=>resolve();tx.onerror=()=>reject(aborted(tx));tx.onabort=()=>reject(aborted(tx));});}
export async function exportAimData(){return {schema:1,exportedAt:new Date().toISOString(),records:await loadAimRecords(),plans:await loadAimPlans()};}
