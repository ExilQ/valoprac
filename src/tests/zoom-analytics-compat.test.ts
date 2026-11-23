import {describe,it,expect,vi,afterEach} from 'vitest';
import {DEFAULT_SETTINGS} from '../config/settings';
import {emptyInput} from '../engine/types';
import {calibrationFromSettings,calibrationFingerprint,validateCalibrationConfig,compareCalibration,SCOPED_PROJECTION_MODEL} from '../aim/precision/calibration';
import {aimCompatibilityKey,compatibleAimRecords,projectionModelKey} from '../aim/statistics';
import {createTacticalAssessmentPlan,tacticalAssessmentSettings,tacticalAssessmentResults,tacticalAssessmentContext} from '../aim/TacticalAssessmentRuntime';
import {createPrecisionPlan,protocolProgress} from '../aim/precision/protocol';
import {AimRuntime} from '../aim/AimRuntime';
import {makePlan} from '../aim/experiments';
import {CombatCapture} from '../aim/CombatCapture';
import {Simulation} from '../engine/simulation/Simulation';
import {analyzeAim} from '../aim/analyzer';
import {AIM_VERSION,type AimMeta,type AimRecord} from '../aim/types';
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
const settings={...DEFAULT_SETTINGS,adsSensitivity:1.3,scopeSensitivity25:.8,scopeSensitivity5:.6};
const context={inputMode:'requested',rawRequest:'accepted' as const,ads:true,weapon:'operator',scopeZoom:5};
function record(model?:string,hit=true):AimRecord {
 const c=calibrationFromSettings(settings,context);if(model===undefined)delete c.projectionModel;else c.projectionModel=model;
 const meta:AimMeta={schema:1,algorithm:AIM_VERSION,game:'9.0.1',id:'r',experiment:'e',session:'s',createdAt:1,task:'tactical',phase:'transfer',sensitivity:.35,dpi:800,dpiSource:'user-declared',coefficient:.07,fov:103,ads:true,adsMultiplier:.6,rawMode:'requested',renderer:'browser-webgl',seed:1,round:0,pair:'p',order:0,radius:.3,amplitude:0,duration:1,warmup:0,condition:'tactical-v2|operator-5|seed:1|distance:32|factor:adsMultiplier',valid:true,issues:[],appearanceKnown:false,calibration:c,inputFingerprint:calibrationFingerprint(c),scopeZoom:5,movementModel:'same-movement',blockId:'same-block',expectedTrials:8,assessmentFactor:'adsMultiplier',assessmentValue:.6,headshot:hit};
 return{meta,metrics:{...analyzeAim([],meta),valid:true,issues:[],hit},trace:[]};
}
describe('Scoped projection and independent multiplier analytics identity',()=>{
 it('keeps unscoped calibration bytes stable while selecting independent scoped multipliers',()=>{
  const c=calibrationFromSettings(settings,{inputMode:'requested',rawRequest:'accepted'});
  expect(calibrationFingerprint(c)).toBe('input-v1:'+JSON.stringify([800,.07,103,1.77777778,'requested','accepted',false,1.3,'neutral',1]));
  expect(c).not.toHaveProperty('projectionModel');
  expect(calibrationFromSettings(settings,{...context,scopeZoom:1.25}).adsMultiplier).toBe(1.3);
  expect(calibrationFromSettings(settings,{...context,scopeZoom:2.5}).adsMultiplier).toBe(.8);
  expect(calibrationFromSettings(settings,context).adsMultiplier).toBe(.6);
 });
 it('round-trips optional scoped projection identity without rewriting historical configs',()=>{
  const current=calibrationFromSettings(settings,context),old={...current};delete old.projectionModel;
  expect(current.projectionModel).toBe(SCOPED_PROJECTION_MODEL);expect(calibrationFingerprint(current)).not.toBe(calibrationFingerprint(old));
  expect(validateCalibrationConfig(old)).toEqual(old);expect(validateCalibrationConfig(current)).toEqual(current);
  expect(validateCalibrationConfig({...current,projectionModel:'<script>'})).toBeNull();
  const oldMeta={...record().meta,calibration:old,inputFingerprint:calibrationFingerprint(old)};
  expect(compareCalibration(oldMeta,old).compatible).toBe(true);expect(compareCalibration(oldMeta,current).compatible).toBe(false);
  const noConfig={...record(SCOPED_PROJECTION_MODEL).meta,calibration:undefined};
  expect(compareCalibration(noConfig,{...current,inputMode:'unknown',rawRequest:'unverified'}).compatible).toBe(true);
 });
 it('isolates old scoped records in both full and partial compatibility paths, preserving neutral keys',()=>{
  const old=record(),current=record(SCOPED_PROJECTION_MODEL),neutral={...old.meta,ads:false,scopeZoom:1,renderer:'angular-canvas' as const};
  expect(projectionModelKey(old.meta)).toBe('legacy-tangent-zoom');expect(projectionModelKey(current.meta)).toBe(SCOPED_PROJECTION_MODEL);
  expect(aimCompatibilityKey(old.meta)).not.toBe(aimCompatibilityKey(current.meta));
  expect(compatibleAimRecords([old,current],current.meta)).toEqual([current]);
  expect(compatibleAimRecords([old,current],{...current.meta,rawMode:undefined})).toEqual([current]);
  expect(aimCompatibilityKey(neutral)).toBe(aimCompatibilityKey({...neutral,projectionModel:SCOPED_PROJECTION_MODEL}));
  expect(aimCompatibilityKey(neutral)).not.toContain('projectionModel');
 });
 it('does not merge scoped result blocks or rates across camera models even when imported block ids match',()=>{
  const old=Array.from({length:8},(_,i)=>{const r=record(undefined,false);r.meta.id='old-'+i;r.meta.trialIndex=i;return r;}),current=Array.from({length:8},(_,i)=>{const r=record(SCOPED_PROJECTION_MODEL,true);r.meta.id='new-'+i;r.meta.trialIndex=i;return r;});
  const results=tacticalAssessmentResults([...old,...current]).filter(r=>r.condition==='operator-5');
  expect(results).toHaveLength(2);expect(results.find(r=>r.projectionModel==='legacy-tangent-zoom')!.comparisons[0]).toMatchObject({blocks:1,shots:8,headRate:0});expect(results.find(r=>r.projectionModel===SCOPED_PROJECTION_MODEL)!.comparisons[0]).toMatchObject({blocks:1,shots:8,headRate:1});
  expect(tacticalAssessmentResults([])).toHaveLength(5);
 });
 it('routes tactical experimental factors and precision defaults to their intended zoom without changing global settings',()=>{
  const before=structuredClone(settings),plan=createTacticalAssessmentPlan({base:.35,adsBase:1.1});
  for(const b of plan.blocks){const local=tacticalAssessmentSettings(settings,b),c=calibrationFromSettings(local,{ads:b.zoom>1,scopeZoom:b.zoom,weapon:b.weapon});if(b.zoom>1)expect(c.adsMultiplier).toBe(1.1);}
  expect(settings).toEqual(before);
  const setup={base:.35,alternative:.4,dpi:800,range:.2,rounds:2,goal:'balanced' as const,schedule:'mixed' as const,mousepad:0};
  const p25=createPrecisionPlan(setup,settings,{mode:'quick',stage:'baseline',records:[],evaluationMode:'operator-2.5'}),p5=createPrecisionPlan(setup,settings,{mode:'quick',stage:'baseline',records:[],evaluationMode:'operator-5'}),explicit=createPrecisionPlan(setup,settings,{mode:'quick',stage:'baseline',records:[],evaluationMode:'operator-5',adsMultiplier:1.4});
  expect(p25.adsMultiplier).toBe(.8);expect(p5.adsMultiplier).toBe(.6);expect(explicit.adsMultiplier).toBe(1.4);
 });
 it('uses one selected experimental multiplier in the actual neutral Runtime gain path',()=>{
  class Surface extends EventTarget {style={};clientWidth=1280;clientHeight=720;setAttribute(){}remove(){}getContext(){return{};}}
  const canvas=new Surface(),doc=Object.assign(new EventTarget(),{createElement:()=>canvas,pointerLockElement:null});vi.stubGlobal('document',doc);vi.stubGlobal('window',new EventTarget());vi.stubGlobal('requestAnimationFrame',()=>1);vi.stubGlobal('cancelAnimationFrame',()=>{});
  const plan=makePlan({base:.35,alternative:.4,dpi:800,range:.2,rounds:2,goal:'balanced',schedule:'mixed',mousepad:0},'baseline',103,.07,7,['small']);plan.evaluationMode='operator-5';plan.scopeZoom=5;plan.adsMultiplier=1.4;
  const r=new AimRuntime({appendChild(){}} as unknown as HTMLElement,plan,settings,()=>{},()=>{});
  try{r.look(100,0);expect(r.yaw*180/Math.PI).toBeCloseTo(-100*.07*.35*1.4/5,10);expect(r.settings.scopeSensitivity5).toBe(1.4);expect(r.settings.scopeSensitivity25).toBe(.8);expect(r.displayFov).toBeCloseTo(20.6,10);}finally{r.dispose();}
 });
 it('requires current scoped camera trials to complete resumed blocks while preserving old unscoped progress',()=>{
  const plan=makePlan({base:.35,alternative:.4,dpi:800,range:.2,rounds:2,goal:'balanced',schedule:'mixed',mousepad:0},'baseline',103,.07,7,['small']);plan.scopeZoom=5;plan.evaluationMode='operator-5';plan.adsMultiplier=.6;
  const b=plan.blocks[0],rows=Array.from({length:b.trials},(_,i)=>{const r=record(i<4?undefined:SCOPED_PROJECTION_MODEL);r.meta.id='trial-'+i;r.meta.blockId=b.id;r.meta.trialIndex=i;return r;});
  expect(protocolProgress(plan,rows).completedBlocks).toBe(0);
  const current=rows.map(r=>({...r,meta:{...r.meta,projectionModel:SCOPED_PROJECTION_MODEL}}));expect(protocolProgress(plan,current).completedBlocks).toBe(1);
  const changedGain=current.map(r=>({...r,meta:{...r.meta,adsMultiplier:.7}}));expect(protocolProgress(plan,changedGain).completedBlocks).toBe(0);
  expect(protocolProgress({...plan,scopeZoom:1,evaluationMode:'hip'},rows).completedBlocks).toBe(1);
 });
 it('captures an actual Operator 5x shot with its selected multiplier and new projection model',async()=>{
  let now=1000;vi.spyOn(performance,'now').mockImplementation(()=>now);
  const s=new Simulation('free','operator',{...settings,behavior:'stationary',targetCount:1});s.running=true;
  for(let n=0;n<360;n++)s.step(1/120,{...emptyInput(),scopePresses:n===0||n===60?1:0});
  const block=createTacticalAssessmentPlan({base:.35,adsBase:.6}).blocks.find(b=>b.zoom===5)!,records:AimRecord[]=[],capture=new CombatCapture(s,()=> 'requested',{...tacticalAssessmentContext(block,r=>records.push(r)),warmupSeconds:0,persist:false},()=> 'accepted');
  for(let n=0;n<12;n++){now+=16;capture.frame(now);}capture.sample(1,0,0,now,now,s.viewYaw,s.viewPitch);s.onShot=shot=>capture.shot(shot);s.step(1/120,{...emptyInput(),fire:true,firePresses:1});await capture.flush();
  expect(records).toHaveLength(1);expect(records[0].meta.adsMultiplier).toBe(.6);expect(records[0].meta.projectionModel).toBe(SCOPED_PROJECTION_MODEL);expect(records[0].meta.fov).toBeCloseTo(20.6,10);expect(records[0].meta.calibration?.adsMultiplier).toBe(.6);capture.dispose();
 });
});
