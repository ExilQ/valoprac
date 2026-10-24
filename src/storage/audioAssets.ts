import type { WeaponId } from '../engine/types';
import type { AudioAction } from '../config/audio';
export interface LocalAudioAsset {id:string;name:string;bytes:ArrayBuffer;authorized:true}
export const AUDIO_MAX_BYTES=2*1024*1024;
function open(){return new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('valoprac-audio-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('audio',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function readAudioAssets():Promise<LocalAudioAsset[]>{const db=await open();try{return await new Promise((resolve,reject)=>{const t=db.transaction('audio','readonly'),r=t.objectStore('audio').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}finally{db.close();}}
export async function saveAudioAsset(weapon:WeaponId,action:AudioAction,file:File,authorized:boolean){
  if(!authorized)throw new Error('사용 권한을 먼저 확인하세요.');if(file.size>AUDIO_MAX_BYTES)throw new Error('파일은 2메가바이트 이하여야 합니다.');
  if(!/\.(wav|mp3|ogg|m4a|flac)$/i.test(file.name))throw new Error('지원하는 오디오 파일을 선택하세요.');
  const bytes=await file.arrayBuffer();const ctx=new AudioContext();try{const buffer=await ctx.decodeAudioData(bytes.slice(0));if(buffer.duration>8)throw new Error('음원 길이는 8초 이하여야 합니다.');}finally{await ctx.close();}
  const db=await open();try{await new Promise<void>((resolve,reject)=>{const t=db.transaction('audio','readwrite');t.objectStore('audio').put({id:`${weapon}:${action}`,name:file.name,bytes,authorized:true});t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error);});}finally{db.close();}
}
export async function deleteAudioAsset(id:string){const db=await open();try{await new Promise<void>((resolve,reject)=>{const t=db.transaction('audio','readwrite');t.objectStore('audio').delete(id);t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error);});}finally{db.close();}}
