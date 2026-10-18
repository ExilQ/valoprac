import type { SessionData } from '../engine/types';
export const MAX_SESSIONS=40;
export const MAX_DETAILED_SESSIONS=10;
let database:Promise<IDBDatabase>|null=null;
function open(){
  if(!database)database=new Promise<IDBDatabase>((resolve,reject)=>{
    const request=indexedDB.open('tactical-aim-v1',1);
    request.onupgradeneeded=()=>{const store=request.result.createObjectStore('sessions',{keyPath:'id'});store.createIndex('createdAt','createdAt');};
    request.onsuccess=()=>{request.result.onversionchange=()=>{request.result.close();database=null;};resolve(request.result);};request.onerror=()=>{database=null;reject(request.error);};
  });return database;
}
export async function loadHistory():Promise<SessionData[]>{const db=await open();return new Promise((resolve,reject)=>{
  const tx=db.transaction('sessions','readonly'),r=tx.objectStore('sessions').getAll();r.onsuccess=()=>resolve((r.result as SessionData[]).sort((a,b)=>b.createdAt-a.createdAt));r.onerror=()=>reject(r.error);
});}
export async function saveSession(session:SessionData){
  const db=await open();const existing=await loadHistory();const records=[session,...existing.filter(s=>s.id!==session.id)].sort((a,b)=>b.createdAt-a.createdAt);
  return new Promise<void>((resolve,reject)=>{
    const tx=db.transaction('sessions','readwrite'),store=tx.objectStore('sessions');
    records.forEach((record,i)=>{if(i>=MAX_SESSIONS)store.delete(record.id);else if(i>=MAX_DETAILED_SESSIONS)store.put({...record,shots:[],kills:[],reactions:[]});else if(record.id===session.id)store.put(record);});
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });
}
export async function clearHistory(){const db=await open();return new Promise<void>((resolve,reject)=>{const tx=db.transaction('sessions','readwrite');tx.objectStore('sessions').clear();tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}
