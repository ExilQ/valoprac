import type { SessionData } from '../engine/types';
export const MAX_SESSIONS=40;
export const MAX_DETAILED_SESSIONS=10;
let database:Promise<IDBDatabase>|null=null;
function open(){
  if(database)return database;
  const pending=new Promise<IDBDatabase>((resolve,reject)=>{
    const request=indexedDB.open('tactical-aim-v1',1);
    request.onupgradeneeded=()=>{const store=request.result.createObjectStore('sessions',{keyPath:'id'});store.createIndex('createdAt','createdAt');};
    request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();if(database===pending)database=null;};resolve(db);};
    request.onerror=()=>reject(request.error);
  });
  database=pending;
  // Both asynchronous open errors and synchronous browser security failures
  // must allow a later retry after storage access becomes available again.
  void pending.catch(()=>{if(database===pending)database=null;});
  return pending;
}
const aborted=(tx:IDBTransaction)=>tx.error??new DOMException('History transaction aborted','AbortError');
export async function loadHistory():Promise<SessionData[]>{const db=await open();return new Promise((resolve,reject)=>{
  const tx=db.transaction('sessions','readonly'),request=tx.objectStore('sessions').getAll();let records:SessionData[]=[];
  request.onsuccess=()=>{records=request.result as SessionData[];};
  tx.oncomplete=()=>resolve(records.sort((a,b)=>b.createdAt-a.createdAt));tx.onerror=()=>reject(aborted(tx));tx.onabort=()=>reject(aborted(tx));
});}
export async function saveSession(session:SessionData){
  const db=await open();
  return new Promise<void>((resolve,reject)=>{
    // Read, insert and retention pruning share one serialized readwrite
    // transaction, including callers in other tabs. A pending earlier save
    // therefore cannot repopulate history after a later clear transaction.
    const tx=db.transaction('sessions','readwrite'),store=tx.objectStore('sessions'),request=store.getAll();
    request.onsuccess=()=>{
      try{
        const records=[session,...(request.result as SessionData[]).filter(s=>s.id!==session.id)].sort((a,b)=>b.createdAt-a.createdAt);
        records.forEach((record,i)=>{
          if(i>=MAX_SESSIONS)store.delete(record.id);
          else if(i>=MAX_DETAILED_SESSIONS){
            if(record.id===session.id||record.replay||record.shots.length||record.kills.length||record.reactions.length)store.put({...record,replay:undefined,shots:[],kills:[],reactions:[]});
          }else if(record.id===session.id)store.put(record);
        });
      }catch(error){tx.abort();reject(error);}
    };
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(aborted(tx));tx.onabort=()=>reject(aborted(tx));
  });
}
export async function clearHistory(){const db=await open();return new Promise<void>((resolve,reject)=>{
  const tx=db.transaction('sessions','readwrite');tx.objectStore('sessions').clear();tx.oncomplete=()=>resolve();tx.onerror=()=>reject(aborted(tx));tx.onabort=()=>reject(aborted(tx));
});}
