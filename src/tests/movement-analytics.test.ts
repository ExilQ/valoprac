import {describe,it,expect,vi,afterEach} from 'vitest';
import {DEFAULT_SETTINGS} from '../config/settings';
import {MOVEMENT_PHYSICS_VERSION} from '../config/movement';
import {Simulation} from '../engine/simulation/Simulation';
import {emptyInput} from '../engine/types';
import {CombatCapture} from '../aim/CombatCapture';
import {aimCompatibilityKey,compatibleAimRecords,movementModelIdentity} from '../aim/statistics';
import {tacticalAssessmentResults} from '../aim/TacticalAssessmentRuntime';
import {analyzeAim} from '../aim/analyzer';
import {AIM_VERSION,type AimMeta,type AimRecord} from '../aim/types';

const val=movementModelIdentity(DEFAULT_SETTINGS),cs=movementModelIdentity({...DEFAULT_SETTINGS,movementPhysics:'counterStrike'});
function fixture(patch:Partial<AimMeta>={}):AimRecord{
 const meta:AimMeta={schema:1,algorithm:AIM_VERSION,game:'test',id:'row',experiment:'test',session:'test',createdAt:1000,task:'tactical',phase:'transfer',sensitivity:.35,dpi:800,dpiSource:'user-declared',coefficient:.07,fov:103,ads:false,adsMultiplier:1,rawMode:'requested',renderer:'browser-webgl',seed:9,round:0,pair:'0-tactical-hip',order:0,radius:.3,amplitude:0,duration:4,warmup:0,condition:'tactical-v2|tactical-hip|seed:9|distance:20|factor:sensitivity',valid:true,issues:[],appearanceKnown:false,blockId:'block',expectedTrials:8,assessmentFactor:'sensitivity',assessmentValue:.35,inputFingerprint:'same-input',headshot:true,...patch};
 return{meta,metrics:{...analyzeAim([],meta),valid:true,issues:[],hit:meta.headshot??true},trace:[]};
}
function paired(model?:string){return ['one','two'].flatMap(session=>Array.from({length:3},(_,round)=>[.35,.42].flatMap(value=>Array.from({length:8},(_,trial)=>fixture({id:`${session}-${round}-${value}-${trial}`,blockId:`${session}-${round}-${value}`,session,round,pair:`pair-${round}`,sensitivity:value,assessmentValue:value,trialIndex:trial,movementModel:model}))))).flat();}
afterEach(()=>vi.restoreAllMocks());
describe('Movement conditions remain isolated in aim history',()=>{
 it('versions solver, profile, CS preset and effective jump window independently of mouse sensitivity',()=>{
  expect(val).toContain(MOVEMENT_PHYSICS_VERSION);expect(val).not.toBe(cs);
  expect(cs).not.toBe(movementModelIdentity({...DEFAULT_SETTINGS,movementPhysics:'counterStrike',csMovementPreset:'sourceClassic'}));
  expect(cs).toBe(movementModelIdentity({...DEFAULT_SETTINGS,movementPhysics:'counterStrike',jumpBufferMs:100}));
  expect(cs).not.toBe(movementModelIdentity({...DEFAULT_SETTINGS,movementPhysics:'counterStrike',jumpBufferMs:20}));
  const changedSensitivity={...DEFAULT_SETTINGS,sensitivity:.9};expect(movementModelIdentity(changedSensitivity)).toBe(val);
 });
 it('preserves legacy records while excluding them from new browser model pools, including partial references',()=>{
  const old=fixture(),a=fixture({id:'val',movementModel:val}),b=fixture({id:'cs',movementModel:cs});
  expect(aimCompatibilityKey(old.meta)).not.toBe(aimCompatibilityKey(a.meta));
  expect(compatibleAimRecords([old,a,b],a.meta)).toEqual([a]);
  const {rawMode:_,...partial}=a.meta;expect(compatibleAimRecords([old,a,b],partial)).toEqual([a]);
  expect(compatibleAimRecords([old,a,b],old.meta)).toEqual([old]);
 });
 it('leaves neutral angular calibration and its stored compatibility key unchanged',()=>{
  const neutral=fixture({task:'small',phase:'exploration',renderer:'angular-canvas'}).meta;
  expect(aimCompatibilityKey(neutral)).toBe(aimCompatibilityKey({...neutral,movementModel:cs}));
  expect(aimCompatibilityKey(neutral)).not.toContain('movementModel');
 });
 it('keeps same legacy pairs comparable and separates all new tactical averages and confidence intervals',()=>{
  const history=[...paired(),...paired(val).map(r=>({...r,meta:{...r.meta,id:`v-${r.meta.id}`,blockId:`v-${r.meta.blockId}`}})),...paired(cs).map(r=>({...r,meta:{...r.meta,id:`c-${r.meta.id}`,blockId:`c-${r.meta.blockId}`,headshot:false},metrics:{...r.metrics,hit:false}}))];
  const rows=tacticalAssessmentResults(history).filter(r=>r.condition==='tactical-hip');
  expect(rows).toHaveLength(3);for(const row of rows){expect(row.pairedRounds).toBe(6);expect(row.sessions).toBe(2);expect(row.conclusion).toBe('equivalent');expect(row.comparisons.every(c=>c.shots===48)).toBe(true);}
  expect(rows.find(r=>r.movementModel===cs)!.comparisons[0].headRate).toBe(0);
  expect(rows.find(r=>r.movementModel===val)!.comparisons[0].headRate).toBe(1);
  expect(rows.find(r=>r.movementModel==='legacy-movement')!.label).toContain('이전 이동 모델');
  expect(history).toHaveLength(288);
 });
 it('does not complete a block with four shots in each of two profiles or pair opposite values across profiles',()=>{
  const split=Array.from({length:8},(_,trial)=>fixture({id:`split-${trial}`,trialIndex:trial,movementModel:trial<4?val:cs}));
  const rows=tacticalAssessmentResults(split).filter(r=>r.condition==='tactical-hip');
  expect(rows.every(r=>r.comparisons.every(c=>c.blocks===0&&c.headRate===null))).toBe(true);
  const unmatched=paired(val).map(r=>r.meta.assessmentValue===.42?{...r,meta:{...r.meta,movementModel:cs}}:r);
  expect(tacticalAssessmentResults(unmatched).every(r=>r.pairedRounds===0)).toBe(true);
 });
 it('captures actual shot metadata and discards mouse samples accumulated before a profile switch',async()=>{
  let now=1000;vi.spyOn(performance,'now').mockImplementation(()=>now);
  const settings={...structuredClone(DEFAULT_SETTINGS),aimTelemetry:true,targetCount:1,behavior:'stationary' as const},s=new Simulation('free','rifleA',settings),records:AimRecord[]=[];
  const capture=new CombatCapture(s,()=> 'requested',{experiment:'x',session:'s',blockId:'b',condition:'c',round:0,pair:'p',order:0,weapon:'rifleA',expectedZoom:1,expectedTrials:8,warmupSeconds:0,persist:false,onRecord:r=>records.push(r)});
  s.running=true;s.onShot=shot=>capture.shot(shot);for(let i=0;i<12;i++){now+=10;capture.frame(now);}
  s.configure({...s.settings,movementPhysics:'counterStrike'});now+=8;s.step(1/120,{...emptyInput(),fire:true,firePresses:1});await capture.flush();
  expect(records).toHaveLength(1);expect(records[0].meta.movementModel).toBe(cs);expect(records[0].meta.issues).toContain('insufficient-samples');expect(records[0].metrics.valid).toBe(false);capture.dispose();
 });
});
