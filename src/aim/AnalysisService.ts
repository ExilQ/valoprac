import type {AimMeta,AimRecord} from './types';
import {analyzeAim,compactTrace} from './analyzer';
// One lazy shared worker; bounded pending jobs, no model on the input handler.
class AnalysisService {
 private worker:Worker|null=null;private id=0;private pending=new Map<number,{resolve:(r:AimRecord)=>void;reject:(e:Error)=>void}>();
 run(buffer:Float64Array,meta:AimMeta):Promise<AimRecord>{if(this.pending.size>=8)return Promise.reject(new Error('analysis-queue-full'));if(typeof Worker==='undefined')return Promise.resolve().then(()=>({meta,metrics:analyzeAim(buffer,meta),trace:compactTrace(buffer)}));
  if(!this.worker){this.worker=new Worker(new URL('./analysis.worker.ts',import.meta.url),{type:'module'});this.worker.onmessage=e=>{const p=this.pending.get(e.data.id);if(!p)return;this.pending.delete(e.data.id);if(e.data.result)p.resolve(e.data.result);else p.reject(new Error('analysis-failed'));};this.worker.onerror=()=>this.dispose();}
  return new Promise((resolve,reject)=>{const id=++this.id;this.pending.set(id,{resolve,reject});this.worker!.postMessage({id,meta,buffer},[buffer.buffer]);});
 }
 dispose(){this.worker?.terminate();this.worker=null;for(const p of this.pending.values())p.reject(new Error('analysis-disposed'));this.pending.clear();}
 get queued(){return this.pending.size;}
}
export const aimAnalysis=new AnalysisService();
