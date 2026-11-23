import {beforeEach,describe,expect,it,vi} from 'vitest';
import {IDBFactory} from 'fake-indexeddb';
import {analyzeAim} from '../aim/analyzer';
import type {AimMeta,AimPlan,AimRecord} from '../aim/types';
const plan=(id:string,createdAt:number):AimPlan=>({id,createdAt,kind:'exploration',base:.35,alternative:null,fov:103,coefficient:.07,dpi:800,blocks:[],schedule:'blocked',goal:'balanced',seed:42});
function record(id:string,createdAt:number):AimRecord{
 const meta:AimMeta={schema:1,algorithm:'aim-2.0.0',game:'12.0.0',id,experiment:'storage',session:'storage',createdAt,task:'small',phase:'exploration',sensitivity:.35,dpi:800,dpiSource:'user-declared',coefficient:.07,fov:103,ads:false,adsMultiplier:1,rawMode:'unknown',renderer:'angular-canvas',seed:42,round:0,pair:'storage',order:0,radius:.2,amplitude:10,duration:1,warmup:0,condition:'storage',valid:true,issues:[],appearanceKnown:true};
 return{meta,metrics:analyzeAim([],meta),trace:[0,1,2]};
}
beforeEach(()=>{vi.resetModules();vi.stubGlobal('indexedDB',new IDBFactory());});
describe('Aim storage preserves bounds and deletion across independent writers',()=>{
 it('retries a synchronous storage security failure instead of caching rejection forever',async()=>{
  vi.stubGlobal('indexedDB',{open:()=>{throw new DOMException('Aim storage blocked','SecurityError');}});
  const storage=await import('../aim/storage');await expect(storage.loadAimPlans()).rejects.toThrow('Aim storage blocked');
  vi.stubGlobal('indexedDB',new IDBFactory());await storage.saveAimPlan(plan('recovered',1));expect((await storage.loadAimPlans()).map(p=>p.id)).toEqual(['recovered']);
 });
 it('enforces plan retention when separate browser contexts save concurrently',async()=>{
  const a=await import('../aim/storage');for(let i=0;i<a.AIM_PLAN_LIMIT-1;i++)await a.saveAimPlan(plan(`prior-${i}`,i));
  vi.resetModules();const b=await import('../aim/storage');
  await Promise.all([a.saveAimPlan(plan('context-a',180)),b.saveAimPlan(plan('context-b',181))]);
  const plans=await a.loadAimPlans();expect(plans).toHaveLength(a.AIM_PLAN_LIMIT);expect(plans.slice(0,2).map(p=>p.id)).toEqual(['context-b','context-a']);expect(plans.some(p=>p.id==='prior-0')).toBe(false);
 });
 it('does not restore a pending plan after the user clears aim data',async()=>{
  const storage=await import('../aim/storage'),saving=storage.saveAimPlan(plan('before-clear',1)),clearing=storage.clearAimData();
  await Promise.all([saving,clearing]);expect(await storage.loadAimPlans()).toEqual([]);
  await storage.saveAimPlan(plan('after-clear',2));expect((await storage.loadAimPlans()).map(p=>p.id)).toEqual(['after-clear']);
 });
 it('keeps the raw-trace budget across independent record queues without discarding summaries',async()=>{
  const a=await import('../aim/storage');for(let i=0;i<a.AIM_TRACE_LIMIT-1;i++)await a.saveAimRecord(record(`prior-${i}`,i));
  vi.resetModules();const b=await import('../aim/storage');
  await Promise.all([a.saveAimRecord(record('context-a',64)),b.saveAimRecord(record('context-b',65))]);
  const records=await a.loadAimRecords();expect(records).toHaveLength(a.AIM_TRACE_LIMIT+1);expect(records.filter(r=>r.trace.length)).toHaveLength(a.AIM_TRACE_LIMIT);expect(records.find(r=>r.meta.id==='prior-0')?.trace).toEqual([]);expect(records.slice(0,2).map(r=>r.meta.id)).toEqual(['context-b','context-a']);
 });
});
