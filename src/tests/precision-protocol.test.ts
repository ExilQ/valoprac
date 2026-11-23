import {describe,it,expect} from 'vitest';
import {DEFAULT_SETTINGS} from '../config/settings';
import {AIM_VERSION,TASKS,type AimMeta,type AimPlan,type AimRecord,type AimSetup} from '../aim/types';
import {analyzeAim} from '../aim/analyzer';
import {conditionKey} from '../aim/experiments';
import {createPrecisionPlan,protocolEligibility,protocolProgress,resumePrecisionPlan} from '../aim/precision/protocol';
const setup:AimSetup={base:.35,alternative:.42,dpi:800,range:.2,rounds:2,goal:'tactical',schedule:'mixed',mousepad:0};
const settings=structuredClone(DEFAULT_SETTINGS),id='protocol-test';
function completed(plan:AimPlan,at=1000):AimRecord[]{return plan.blocks.flatMap(block=>Array.from({length:block.trials},(_,trialIndex)=>{
 const meta:AimMeta={schema:1,algorithm:AIM_VERSION,game:'7.0.0',id:`${block.id}-${trialIndex}`,experiment:plan.id,session:plan.id,createdAt:at+block.order,task:block.task,phase:block.phase,sensitivity:block.sensitivity,dpi:plan.dpi,dpiSource:'user-declared',coefficient:plan.coefficient,fov:plan.fov,ads:false,adsMultiplier:1,rawMode:'requested',renderer:'angular-canvas',seed:block.seed,round:block.round,pair:block.pair,order:block.order,radius:block.radius,amplitude:block.amplitude,duration:block.duration,warmup:block.warmup,condition:conditionKey(block,plan),valid:true,issues:[],appearanceKnown:true,protocol:plan.protocol,protocolId:plan.protocolId,stage:plan.stage,evaluationMode:plan.evaluationMode,blockId:block.id,trialIndex,expectedTrials:block.trials,expectedTasks:[...new Set(plan.blocks.map(b=>b.task))],inputFingerprint:'same-config'};
 return{meta,metrics:{...analyzeAim([],meta),valid:true,issues:[],score:.8+(block.sensitivity-.35)*.1,hit:true},trace:[]};
}));}
const baseline=()=>createPrecisionPlan(setup,settings,{mode:'quick',stage:'baseline',records:[],protocolId:id});
describe('Bounded precision protocol, honest stage gates and resumable blocks',()=>{
 it('requires a complete repeated baseline, then measures bounded matched candidates in counterbalanced order',()=>{
  expect(()=>createPrecisionPlan(setup,settings,{mode:'quick',stage:'coarse',records:[],protocolId:id})).toThrow(/기준선/);
  const b=baseline(),records=completed(b);expect(b.blocks).toHaveLength(6);expect(b.blocks.filter(b=>b.task==='small').every(b=>b.trials===4)).toBe(true);
  const c=createPrecisionPlan(setup,settings,{mode:'quick',stage:'coarse',records,protocolId:id});expect(c.blocks).toHaveLength(18);
  const first=c.blocks.filter(b=>b.task==='small'&&b.round===0),second=c.blocks.filter(b=>b.task==='small'&&b.round===1);
  expect(first.map(b=>b.sensitivity)).toEqual(second.map(b=>b.sensitivity).reverse());expect(new Set(first.map(b=>conditionKey(b,c))).size).toBe(1);
  expect(c.blocks.every(b=>b.sensitivity>=.35*.8&&b.sensitivity<=.35*1.2+1e-8)).toBe(true);
 });
 it('keeps incomplete and mismatched configuration baselines from unlocking a stage',()=>{
  const records=completed(baseline());expect(protocolEligibility(records.slice(1),.35,'quick',id).coarse.allowed).toBe(false);
  const mixed=records.map(r=>r.meta.task==='micro'?{...r,meta:{...r.meta,inputFingerprint:'different-config'}}:r);expect(protocolEligibility(mixed,.35,'quick',id).coarse.allowed).toBe(false);
  expect(protocolEligibility(records,.35,'precision',id).coarse.allowed).toBe(false);
  expect(()=>createPrecisionPlan(setup,{...settings,dpi:1600},{mode:'quick',stage:'coarse',records,protocolId:id})).not.toThrow(); // explicit setup DPI is the controlled input declaration
  expect(()=>createPrecisionPlan({...setup,dpi:1600},settings,{mode:'quick',stage:'coarse',records,protocolId:id})).toThrow();
 });
 it('uses fresh held-out conditions and compares a real alternative even if baseline remains preferred',()=>{
  const b=baseline(),records=completed(b),c=createPrecisionPlan(setup,settings,{mode:'quick',stage:'coarse',records,protocolId:id});records.push(...completed(c));
  const h=createPrecisionPlan(setup,settings,{mode:'quick',stage:'heldout',records,protocolId:id});expect(h.alternative).not.toBe(setup.base);expect(new Set(h.blocks.map(b=>b.sensitivity)).size).toBe(2);
  const searchSeeds=new Set(c.blocks.map(b=>b.seed));expect(h.blocks.every(b=>!searchSeeds.has(b.seed))).toBe(true);expect(h.blocks.every(b=>b.phase==='verification')).toBe(true);
 });
 it('applies the declared pad constraint to proposed candidates without erasing the original control or changing gameplay settings',()=>{
  const before=structuredClone(settings),b=baseline(),records=completed(b);
  const c=createPrecisionPlan({...setup,mousepad:22},settings,{mode:'quick',stage:'coarse',records,protocolId:id});const values=[...new Set(c.blocks.map(b=>b.sensitivity))];expect(values).toContain(.35);expect(values).not.toContain(.28);expect(values).toContain(.42);expect(settings).toEqual(before);
  expect(()=>createPrecisionPlan({...setup,mousepad:1},settings,{mode:'quick',stage:'coarse',records,protocolId:id})).toThrow(/패드/);
 });
 it('resumes at the first unfinished block without counting duplicate trials or invalid retries',()=>{
  const b=baseline(),records=completed(b),first=records.filter(r=>r.meta.blockId===b.blocks[0].id),duplicates=first.map(r=>({...r,meta:{...r.meta,id:r.meta.id+'-retry'}}));
  expect(protocolProgress(b,[...first,...duplicates]).completedBlocks).toBe(1);expect(resumePrecisionPlan(b,[...first,...duplicates]).resumeBlock).toBe(1);
  expect(protocolProgress(b,first.map(r=>({...r,metrics:{...r.metrics,valid:false}}))).completedBlocks).toBe(0);
  expect(()=>resumePrecisionPlan(b,records)).toThrow(/완료/);
 });
 it('uses all seven neutral categories in precision mode and keeps real tactical shooting outside the neutral canvas',()=>{
  const p=createPrecisionPlan(setup,settings,{mode:'precision',stage:'baseline',records:[],protocolId:id});expect(new Set(p.blocks.map(b=>b.task))).toEqual(new Set(TASKS));expect(p.blocks).toHaveLength(21);expect(p.blocks.some(b=>b.task==='tactical')).toBe(false);
 });
 it('requires a 24-hour delayed session and preserves baseline conditions in retention',()=>{
  const b=baseline(),records=completed(b,Date.now()-2*86400000),c=createPrecisionPlan(setup,settings,{mode:'quick',stage:'coarse',records,protocolId:id});records.push(...completed(c,Date.now()-2*86400000));
  const h=createPrecisionPlan(setup,settings,{mode:'quick',stage:'heldout',records,protocolId:id});records.push(...completed(h,Date.now()));expect(protocolEligibility(records,.35,'quick',id).retention.allowed).toBe(false);
  const old=records.map(r=>({...r,meta:{...r.meta,createdAt:r.meta.createdAt-2*86400000}}));const retained=createPrecisionPlan(setup,settings,{mode:'quick',stage:'retention',records:old,protocolId:id});
  const prior=new Set(b.blocks.map(block=>conditionKey(block,b)));expect(retained.blocks.filter(x=>x.sensitivity===setup.base).every(block=>prior.has(conditionKey(block,retained)))).toBe(true);
 });
});
