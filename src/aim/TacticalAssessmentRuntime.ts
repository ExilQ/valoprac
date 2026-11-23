import type {Settings,WeaponId} from '../engine/types';
import type {AimRecord,EvaluationMode} from './types';
import {mean} from './math';
import {clusteredSummary} from './precision/statistics';
import {random,shuffled,clamp} from './math';
import type {CombatAssessmentContext} from './CombatCapture';
import {movementModelKey} from './statistics';
import {calibrationFingerprint} from './precision/calibration';

export interface TacticalAssessmentBlock {
 id:string;experiment:string;session:string;condition:string;label:string;round:number;pair:string;order:number;
 weapon:WeaponId;zoom:number;evaluationMode:EvaluationMode;factor:'sensitivity'|'adsMultiplier';value:number;
 sensitivity:number;adsMultiplier:number;seed:number;duration:number;warmupSeconds:number;trials:number;distance:number;
}
export interface TacticalAssessmentPlan {id:string;createdAt:number;blocks:TacticalAssessmentBlock[];base:number;alternative:number;adsBase:number;adsAlternative:number;seed:number;}
export interface TacticalAssessmentSetup {base:number;alternative?:number;adsBase:number;adsAlternative?:number;seed?:number;rounds?:number;}
declare module './types' {
 interface AimMeta {assessmentFactor?:'sensitivity'|'adsMultiplier';assessmentValue?:number;headshot?:boolean;aimedHead?:boolean;targetPoseSource?:string;renderedFrameTime?:number;actualScopeZoom?:number;}
}
const CONDITIONS=[
 {condition:'tactical-hip',label:'전술 각쪼개기 · 밴달 비조준',weapon:'rifleA',zoom:1,evaluationMode:'hip',distance:20},
 {condition:'vandal-ads',label:'밴달 · 1.25배 정조준',weapon:'rifleA',zoom:1.25,evaluationMode:'rifle-ads',distance:20},
 {condition:'phantom-ads',label:'팬텀 · 1.25배 정조준',weapon:'rifleB',zoom:1.25,evaluationMode:'rifle-ads',distance:25},
 {condition:'operator-2.5',label:'오퍼레이터 · 2.5배',weapon:'operator',zoom:2.5,evaluationMode:'operator-2.5',distance:25},
 {condition:'operator-5',label:'오퍼레이터 · 5배',weapon:'operator',zoom:5,evaluationMode:'operator-5',distance:32}
] as const;
export function createTacticalAssessmentPlan(setup:TacticalAssessmentSetup):TacticalAssessmentPlan {
 const seed=(setup.seed??1947)>>>0,rng=random(seed),createdAt=Date.now(),id=globalThis.crypto?.randomUUID?.()??`tactical-${createdAt}-${seed}`;
 const sane=(value:number|undefined,fallback:number,min:number,max:number)=>clamp(Number.isFinite(value)?value!:fallback,min,max);
 const base=sane(setup.base,.35,.01,5),alternative=sane(setup.alternative,base,.01,5),adsBase=sane(setup.adsBase,1,.1,2),adsAlternative=sane(setup.adsAlternative,adsBase,.1,2),blocks:TacticalAssessmentBlock[]=[];
 const conditions=shuffled([...CONDITIONS],rng),rounds=Math.round(sane(setup.rounds,2,2,6));
 for(let round=0;round<rounds;round++)for(const [index,condition]of conditions.entries()){
  const factor=condition.zoom===1?'sensitivity':'adsMultiplier',a=factor==='sensitivity'?base:adsBase,b=factor==='sensitivity'?alternative:adsAlternative,values=Math.abs(a-b)<1e-6?[a]:[a,b];
  // Randomize the initial order once, reverse on the next repetition. Target
  // distributions/seed are identical inside each pair and new across rounds.
  if(((index+seed)%2===0)!==(round%2===1))values.reverse();
  for(const value of values){const order=blocks.length;blocks.push({...condition,id:`${id}-${order}`,experiment:id,session:id,round,pair:`${round}-${condition.condition}`,order,factor,value,sensitivity:factor==='sensitivity'?value:base,adsMultiplier:factor==='adsMultiplier'?value:adsBase,seed:(seed+0x700001+round*1009+index*71)>>>0,duration:40,warmupSeconds:2,trials:8});}
 }
 return{id,createdAt,blocks,base,alternative,adsBase,adsAlternative,seed};
}
/** The live Runtime receives a private sanitized-shape copy. It may mutate its
 * own copy normally without ever writing the player's global settings store. */
export function tacticalAssessmentSettings(settings:Settings,block:TacticalAssessmentBlock):Settings {
 return{...settings,bindings:{...settings.bindings},sensitivity:block.sensitivity,adsSensitivity:block.adsMultiplier,seed:block.seed,aimTelemetry:true,practiceMap:block.zoom===1?'complex':'range',peekScenario:'slicing',peekingTimed:false,targetCount:3,targetSize:1,targetDistance:block.distance,targetSpeed:1,behavior:block.weapon==='operator'?'stationary':'reactive',randomDefenders:false,drill:'none',analysisWall:false,eliminationRule:'head',exposureEnabled:true,infiniteReserve:true,autoReload:true};
}
export function tacticalAssessmentContext(block:TacticalAssessmentBlock,onRecord:(record:AimRecord)=>void,onError?:(message:string)=>void):CombatAssessmentContext {
 return{experiment:block.experiment,session:block.session,blockId:block.id,condition:`tactical-v2|${block.condition}|seed:${block.seed}|distance:${block.distance}|factor:${block.factor}`,round:block.round,pair:block.pair,order:block.order,weapon:block.weapon,expectedZoom:block.zoom,expectedTrials:block.trials,warmupSeconds:block.warmupSeconds,assessmentFactor:block.factor,assessmentValue:block.value,onRecord,onError};
}
function pairedFingerprint(record:AimRecord){const config=record.meta.calibration;return JSON.stringify([config?calibrationFingerprint({...config,adsMultiplier:record.meta.assessmentFactor==='adsMultiplier'?1:config.adsMultiplier}):record.meta.inputFingerprint,movementModelKey(record.meta)]);}
function movementModelLabel(model:string){if(model==='legacy-movement')return '이전 이동 모델';const [version,,,buffer]=model.split('|'),label=model.includes('|valorant|')?'발로란트 물리엔진':model.includes('|sourceClassic|')?'카운터 스트라이크 · 클래식 Source':'카운터 스트라이크 · CS2';return `${label} · ${version.replace('dual-movement-','')} · 점프 입력 ${buffer?.replace('buffer:','')??'?'}ms`;}
export function tacticalAssessmentResults(records:AimRecord[]){
 const relevant=records.filter(r=>r.meta.task==='tactical'&&r.meta.renderer==='browser-webgl'&&r.meta.blockId&&r.meta.assessmentFactor),groups=new Map<string,AimRecord[]>();
 for(const record of relevant){const key=JSON.stringify([record.meta.blockId,movementModelKey(record.meta)]),a=groups.get(key)??[];if(!a.some(r=>r.meta.id===record.meta.id))a.push(record);groups.set(key,a);}
 const blocks=[...groups.values()].map(rows=>{const meta=rows[0].meta,expected=meta.expectedTrials??8,valid=rows.filter(r=>r.meta.valid&&r.metrics.valid),confounded=valid.filter(r=>r.meta.moving||Math.abs(r.meta.recoil??0)>.1||(r.meta.spread??0)>.3),clean=valid.filter(r=>!confounded.includes(r));return{meta,record:rows[0],rows:rows.length,valid:valid.length,complete:rows.length===expected,headRate:mean(valid.map(r=>Number(r.meta.headshot??r.metrics.hit))),cleanHeadRate:mean(clean.map(r=>Number(r.meta.headshot??r.metrics.hit))),clean:clean.length,confounded:confounded.length,aimError:mean(valid.flatMap(r=>r.metrics.clickError===null?[]:[r.metrics.clickError])),correction:mean(valid.flatMap(r=>r.metrics.correctionTime===null?[]:[r.metrics.correctionTime]))};});
 const movementModels=[...new Set(relevant.map(r=>movementModelKey(r.meta)!))];
 if(!movementModels.length)movementModels.push('legacy-movement');
 return movementModels.flatMap(movementModel=>CONDITIONS.map(condition=>{
  const a=blocks.filter(b=>movementModelKey(b.meta)===movementModel&&b.meta.condition.includes(`|${condition.condition}|`)),values=[...new Set(a.map(b=>b.meta.assessmentValue!))].sort((x,y)=>x-y),comparisons=values.map(value=>{const selected=a.filter(b=>b.meta.assessmentValue===value),complete=selected.filter(b=>b.complete&&b.valid===(b.meta.expectedTrials??8));return{value,blocks:complete.length,attemptedBlocks:selected.length,shots:selected.reduce((n,b)=>n+b.rows,0),validShots:selected.reduce((n,b)=>n+b.valid,0),headRate:mean(complete.flatMap(b=>b.headRate===null?[]:[b.headRate])),cleanHeadRate:mean(complete.flatMap(b=>b.cleanHeadRate===null?[]:[b.cleanHeadRate])),confounded:selected.reduce((n,b)=>n+b.confounded,0),aimError:mean(complete.flatMap(b=>b.aimError===null?[]:[b.aimError])),correction:mean(complete.flatMap(b=>b.correction===null?[]:[b.correction]))};});
  const deltas:number[]=[],pairSessions:string[]=[];if(values.length===2)for(const first of a.filter(b=>b.complete&&b.valid===(b.meta.expectedTrials??8)&&b.meta.assessmentValue===values[0])){const second=a.find(b=>b.complete&&b.valid===(b.meta.expectedTrials??8)&&b.meta.assessmentValue===values[1]&&b.meta.session===first.meta.session&&b.meta.pair===first.meta.pair&&b.meta.condition===first.meta.condition&&pairedFingerprint(b.record)===pairedFingerprint(first.record));if(second&&first.headRate!==null&&second.headRate!==null){deltas.push(second.headRate-first.headRate);pairSessions.push(first.meta.session);}}
  // Independent repetition units, not individual shots. One short assessment
  // cannot establish transfer or an ADS optimum.
  const sessions=new Set(pairSessions).size,clustered=clusteredSummary([...new Set(pairSessions)].map(session=>deltas.filter((_,i)=>pairSessions[i]===session))),interval=deltas.length>=6&&sessions>=2?clustered.interval:null;
  return{...condition,movementModel,label:`${condition.label} · ${movementModelLabel(movementModel)}`,factor:condition.zoom===1?'sensitivity' as const:'adsMultiplier' as const,comparisons,pairedRounds:deltas.length,sessions,difference:clustered.mean,interval,conclusion:interval?(interval[0]>.03?'improved':interval[1]<-.03?'worse':interval[0]>=-.03&&interval[1]<=.03?'equivalent':'inconclusive'):'inconclusive'};
 }));
}
