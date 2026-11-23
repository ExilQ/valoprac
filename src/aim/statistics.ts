import {TASKS,trackingTask,type AimRecord,type AimTask,type AimPlan,type AimMeta} from './types';
import {ci,mean,median,sd,clamp} from './math';
import {repeatedSummary,pairedEvidence,clusteredSummary,aggregateTaskDeltas,rankCorrelation} from './precision/statistics';

type ExtraMeta={inputFingerprint?:string;expectedTasks?:AimTask[];expectedTrials?:number;blockId?:string;trialIndex?:number;protocol?:string;protocolId?:string;stage?:string;scopeZoom?:number;evaluationMode?:string};
const extra=(m:AimMeta)=>m as AimMeta&ExtraMeta;
/** Sensitivity deliberately is not part of this key: it is the tested factor.
 * Input mode, projection, ADS/zoom and algorithm changes cannot be pooled. */
export function aimCompatibilityKey(meta:Pick<AimMeta,'fov'|'dpi'|'coefficient'|'algorithm'>&Partial<AimMeta>){
 const m=extra(meta as AimMeta);return JSON.stringify({algorithm:m.algorithm,dpi:m.dpi,coefficient:m.coefficient,fov:m.fov,renderer:m.renderer??'angular-canvas',ads:m.ads??false,adsMultiplier:m.adsMultiplier??1,scopeZoom:m.scopeZoom??1,inputFingerprint:m.inputFingerprint??'legacy-unfingerprinted',rawMode:m.rawMode??'unknown',evaluationMode:m.evaluationMode??'hip',protocol:m.protocol??'legacy',expectedTasks:m.expectedTasks?.slice().sort()??null});
}
export function compatibleAimRecords(records:AimRecord[],reference:Pick<AimMeta,'fov'|'dpi'|'coefficient'|'algorithm'>&Partial<AimMeta>){
 const full=reference.renderer!==undefined&&reference.rawMode!==undefined;
 if(full){const key=aimCompatibilityKey(reference);return records.filter(r=>aimCompatibilityKey(r.meta)===key);}
 return records.filter(r=>r.meta.algorithm===reference.algorithm&&r.meta.renderer===(reference.renderer??'angular-canvas')&&r.meta.ads===(reference.ads??false)&&r.meta.dpi===reference.dpi&&r.meta.coefficient===reference.coefficient&&Math.abs(r.meta.fov-reference.fov)<1e-6);
}
export interface BlockResult {key:string;session:string;experiment:string;round:number;task:AimTask;sensitivity:number;score:number;hitRate:number|null;condition:string;phase:string;count:number;createdAt:number;order:number;compatibility:string;expectedTasks:AimTask[];stage:string;}
function neutral(r:AimRecord){return r.meta.phase!=='combat'&&String(r.meta.task)!=='tactical'&&r.meta.renderer==='angular-canvas';}
export function summarizeBlocks(records:AimRecord[]):BlockResult[]{
 const groups=new Map<string,AimRecord[]>();
 for(const r of records){if(!r.meta.valid||!r.metrics.valid||r.metrics.score===null||!Number.isFinite(r.metrics.score)||!neutral(r))continue;const m=extra(r.meta),key=`${m.experiment}|${m.blockId??m.pair}|${m.task}|${m.phase}|${m.sensitivity}|${aimCompatibilityKey(m)}`;const a=groups.get(key)??[];a.push(r);groups.set(key,a);}
 return [...groups].flatMap(([key,rows])=>{
  // Resuming a saved block may retry a trial. Its latest valid result replaces
  // the same trial index; duplicate imports never increase sample size.
  const unique=new Map<string,AimRecord>();for(const r of rows){const m=extra(r.meta),id=m.trialIndex===undefined?m.id:`trial-${m.trialIndex}`;const old=unique.get(id);if(!old||r.meta.createdAt>=old.meta.createdAt)unique.set(id,r);}const a=[...unique.values()].sort((a,b)=>a.meta.createdAt-b.meta.createdAt),r=a[0],m=extra(r.meta),expected=m.expectedTrials??(trackingTask(m.task)?1:8);if(!Number.isInteger(expected)||expected<1||a.length<expected)return [];
  const use=a.slice(-expected),hits=trackingTask(m.task)?[]:use.flatMap(x=>x.metrics.hit===null?[]:[+x.metrics.hit]);return [{key,session:m.session,experiment:m.experiment,round:m.round,task:m.task,sensitivity:m.sensitivity,score:mean(use.map(x=>x.metrics.score!))!,hitRate:mean(hits),condition:m.condition,phase:m.phase,count:use.length,createdAt:m.createdAt,order:m.order,compatibility:aimCompatibilityKey(m),expectedTasks:m.expectedTasks??[],stage:m.stage??''}];
 });
}
function requiredTasks(records:AimRecord[],override?:readonly AimTask[]){
 if(override?.length)return [...new Set(override)].filter(t=>String(t)!=='tactical');
 const explicit=records.map(r=>extra(r.meta).expectedTasks).find(a=>a?.length);if(explicit)return [...new Set(explicit)].filter(t=>String(t)!=='tactical');
 const legacy=['large','small','micro','smooth','reactive','switch'];if(records.some(r=>String(r.meta.task)==='dynamic'))legacy.push('dynamic');return legacy as AimTask[];
}
/** Transparent user-goal presets. These are design priorities, not empirically
 * fitted universal coefficients. All task metrics are baseline-normalized
 * before weighting. Callers may supply explicit user-selected weights. */
export const PRECISION_GOAL_WEIGHTS:Readonly<Record<string,Readonly<Record<string,number>>>>={
 balanced:{large:1,small:1,micro:1,smooth:1,reactive:1,switch:1,dynamic:1},
 precision:{large:1,small:2,micro:2,smooth:.5,reactive:.5,switch:1,dynamic:1},
 tracking:{large:.5,small:.5,micro:.5,smooth:2,reactive:2,switch:1,dynamic:1},
 tactical:{large:1,small:3,micro:2,smooth:.5,reactive:1.5,switch:1.5,dynamic:2}
};
export interface CandidateTaskResult {task:AimTask;score:number;interval:[number,number]|null;count:number;normalizedScore:number;difference:number|null;median:number|null;variability:number|null;}
export interface CandidateResult {sensitivity:number;score:number;interval:[number,number]|null;blocks:number;rounds:number;tasks:number;precision:number|null;taskResults:CandidateTaskResult[];median:number|null;variability:number|null;}
interface CandidateContext {results:CandidateResult[];blocks:BlockResult[];required:AimTask[];base:number;weights:Readonly<Record<string,number>>;rounds:Map<number,{session:string;round:number;score:number;rawDelta:number}[]>;}
function context(records:AimRecord[],goal:AimPlan['goal'],base?:number,expected?:readonly AimTask[],customWeights?:Readonly<Record<string,number>>):CandidateContext{
 const blocks=summarizeBlocks(records.filter(r=>r.meta.phase==='exploration')),values=[...new Set(blocks.map(b=>b.sensitivity))],required=requiredTasks(records,expected),weights=customWeights??PRECISION_GOAL_WEIGHTS[goal]??PRECISION_GOAL_WEIGHTS.balanced;
 const original=base??records.find(r=>r.meta.phase==='exploration')?.meta.sensitivity??.35,baseline=blocks.filter(b=>Math.abs(b.sensitivity-original)<1e-6),rounds=new Map<number,{session:string;round:number;score:number;rawDelta:number}[]>();
 const scale=(task:AimTask)=>{const a=baseline.filter(b=>b.task===task).map(b=>b.score),m=median(a);return Math.max(.05,m===null?0:1.4826*(median(a.map(x=>Math.abs(x-m)))??0));};
 const matched=(b:BlockResult)=>baseline.find(a=>a.session===b.session&&a.round===b.round&&a.task===b.task&&a.condition===b.condition&&a.compatibility===b.compatibility);
 const results=values.map(sensitivity=>{
  const b=blocks.filter(b=>Math.abs(b.sensitivity-sensitivity)<1e-6),taskResults=required.flatMap(task=>{const a=b.filter(b=>b.task===task),summary=repeatedSummary(a.map(x=>x.score)),deltas=a.flatMap(x=>{const pair=matched(x);return pair?[x.score-pair.score]:[];}),delta=mean(deltas);return a.length?[{task,score:summary.mean!,interval:summary.interval,count:a.length,normalizedScore:delta===null?.5:clamp(.5+.25*delta/scale(task),0,1),difference:delta,median:summary.median,variability:summary.mad}]:[];});
  const clusters=[...new Set(b.map(b=>`${b.session}|${b.round}`))],complete=clusters.flatMap(key=>{const row=b.filter(b=>`${b.session}|${b.round}`===key);const paired=required.flatMap(task=>{const target=row.find(x=>x.task===task),a=target&&matched(target);return target&&a?[{task,delta:target.score-a.score}]:[];});if(paired.length!==required.length||!required.length)return [];const rawDelta=aggregateTaskDeltas(paired,weights)!,normalized=aggregateTaskDeltas(paired.map(p=>({task:p.task,delta:clamp(.5+.25*p.delta/scale(p.task),0,1)})),weights)!;return [{session:row[0].session,round:row[0].round,score:normalized,rawDelta}];});
  rounds.set(sensitivity,complete);const summary=repeatedSummary(complete.map(x=>x.score)),precision=mean(b.flatMap(x=>x.hitRate===null?[]:[x.hitRate]));return {sensitivity,score:summary.mean??mean(taskResults.map(t=>t.normalizedScore))??0,interval:summary.interval,blocks:b.length,rounds:complete.length,tasks:taskResults.length,precision,taskResults,median:summary.median,variability:summary.mad};
 }).sort((a,b)=>b.score-a.score||Math.abs(Math.log(a.sensitivity/original))-Math.abs(Math.log(b.sensitivity/original)));
 return {results,blocks,required,base:original,weights,rounds};
}
export function sensitivityResults(records:AimRecord[],goal:AimPlan['goal']='balanced'):CandidateResult[]{
 const anchor=records.find(r=>r.meta.phase==='exploration');return context(records,goal,anchor?.meta.sensitivity).results;
}
export interface PrecisionReportOptions {requiredTasks?:AimTask[];practicalMargin?:number;weights?:Readonly<Record<string,number>>;allowedSensitivities?:readonly number[];}
export function precisionReport(records:AimRecord[],base:number,goal:AimPlan['goal']='balanced',options:PrecisionReportOptions={}){
 const anchor=records.filter(r=>r.meta.phase==='exploration'&&Math.abs(r.meta.sensitivity-base)<1e-6).sort((a,b)=>b.meta.createdAt-a.meta.createdAt)[0],compatible=anchor?compatibleAimRecords(records,anchor.meta):[],margin=options.practicalMargin??.02,c=context(compatible,goal,base,options.requiredTasks??(anchor?extra(anchor.meta).expectedTasks:undefined),options.weights),results=c.results,eligible=results.filter(r=>r.rounds>=2&&r.tasks===c.required.length&&(r.precision===null||r.precision>=.7)&&(options.allowedSensitivities===undefined||options.allowedSensitivities.some(v=>Math.abs(v-r.sensitivity)<1e-6))),best=eligible[0];
 const baselineBlocks=c.blocks.filter(b=>Math.abs(b.sensitivity-base)<1e-6),orderResiduals=baselineBlocks.map(b=>b.score-(median(baselineBlocks.filter(x=>x.session===b.session&&x.task===b.task).map(x=>x.score))??b.score)),orderCorrelation=rankCorrelation(baselineBlocks.map(b=>b.order),orderResiduals),fatigueFlag=orderCorrelation!==null&&orderCorrelation<-.6,learningFlag=orderCorrelation!==null&&orderCorrelation>.6;
 let equivalentRange:[number,number]|null=null,unresolvedRange:[number,number]|null=null,range:[number,number]|null=null,equivalentRegions:[number,number][]=[],unresolvedRegions:[number,number][]=[],rangeKind:'equivalent'|'unresolved'|'insufficient'='insufficient',recommended:number|null=null;
 const taskEvidence:{task:AimTask;support:'supports'|'contradicts'|'uncertain';difference:number|null;interval:[number,number]|null;rounds:number}[]=[],explanations:string[]=[];
 if(best){
  const family=Math.max(1,eligible.length-1),equivalent:number[]=[],unresolved:number[]=[];
  for(const candidate of eligible){if(candidate===best){equivalent.push(candidate.sensitivity);unresolved.push(candidate.sensitivity);continue;}
   const leading=c.rounds.get(best.sensitivity)??[],trailing=c.rounds.get(candidate.sensitivity)??[],deltas=leading.flatMap(a=>{const b=trailing.find(b=>b.session===a.session&&b.round===a.round);return b?[b.rawDelta-a.rawDelta]:[];}),evidence=pairedEvidence(deltas,margin,6,.05/family);
   // Family-wise intervals screen the candidates selected using these same
   // exploration observations. Only held-out validation may assert improvement.
   if(evidence.conclusion==='equivalent')equivalent.push(candidate.sensitivity);
   if(evidence.conclusion!=='worse')unresolved.push(candidate.sensitivity);
  }
  const plausible=eligible.filter(r=>unresolved.includes(r.sensitivity));recommended=plausible.find(r=>Math.abs(r.sensitivity-base)<1e-6)?.sensitivity??best.sensitivity;
  // Do not bridge an observed inferior region between two good modes.
  const split=(selected:number[])=>{const regions:[number,number][]=[],ordered=results.slice().sort((a,b)=>a.sensitivity-b.sensitivity);let current:[number,number]|null=null;for(const r of ordered){if(selected.includes(r.sensitivity)){if(current)current[1]=r.sensitivity;else{current=[r.sensitivity,r.sensitivity];regions.push(current);}}else current=null;}return regions;};
  equivalentRegions=split(equivalent);unresolvedRegions=split(unresolved);
  equivalentRange=equivalentRegions.find(r=>r[0]!==r[1]&&recommended! >= r[0]&&recommended! <= r[1])??null;unresolvedRange=unresolvedRegions.find(r=>recommended! >= r[0]&&recommended! <= r[1])??null;range=equivalentRange??unresolvedRange;rangeKind=equivalentRange?'equivalent':'unresolved';
  const chosen=results.find(r=>r.sensitivity===recommended)!;for(const task of c.required){const a=c.blocks.filter(b=>b.sensitivity===recommended&&b.task===task),deltas=a.flatMap(b=>{const other=baselineBlocks.find(x=>x.session===b.session&&x.round===b.round&&x.task===task&&x.condition===b.condition);return other?[b.score-other.score]:[];}),e=repeatedSummary(deltas,.05/Math.max(1,c.required.length));taskEvidence.push({task,support:e.interval&&e.interval[0]>margin?'supports':e.interval&&e.interval[1]<-margin?'contradicts':'uncertain',difference:e.mean,interval:e.interval,rounds:e.count});}
  explanations.push(`${chosen.rounds}개 완전한 반복 묶음과 ${chosen.tasks}개 과제의 기준 대비 결과를 사용했습니다.`);
  explanations.push(equivalentRange?'실용적 동등 범위는 짝 차이의 보정된 구간 전체가 허용 차이 안에 있는 시험값에 한합니다.':'표시 범위는 현재 자료로 탈락시키지 못한 후보 범위이며, 동등성이 입증된 구간은 아닙니다.');
  explanations.push('시험하지 않은 중간 감도까지 동등하다고 보장하지 않습니다. 최종 선택은 새 표적의 보류 비교로 확인하세요.');
 }
 const validTrials=compatible.filter(r=>r.metrics.valid).length,sessions=new Set(compatible.map(r=>r.meta.session)).size,reason=!best?'기준 감도와 같은 조건의 완전한 과제 반복이 부족합니다. 먼저 기준·후보를 반복 측정하세요.':'기준 대비 잠정 결과입니다. 모형이나 탐색 점수만으로 향상 또는 유일한 최적 감도를 확정하지 않습니다.';
 if(fatigueFlag)explanations.push('기준 재시험이 순서에 따라 낮아졌습니다. 피로 또는 순서 효과를 구분할 수 없어 휴식을 권합니다.');if(learningFlag)explanations.push('기준 재시험이 순서에 따라 높아졌습니다. 워밍업·학습 효과가 후보 차이에 섞일 수 있습니다.');
 return {status:(best?'provisional':'insufficient') as 'provisional'|'insufficient',results,recommended,range,reason,equivalentRange,unresolvedRange,equivalentRegions,unresolvedRegions,rangeKind,taskEvidence,measurement:{validTrials,totalTrials:records.length,sessions,excluded:records.length-validTrials,incompatible:records.length-compatible.length},diagnostics:{orderCorrelation,fatigueFlag,learningFlag},nextAction:(fatigueFlag?'break':!baselineBlocks.length?'collect-baseline':!best?'repeat-candidates':'held-out') as 'break'|'collect-baseline'|'repeat-candidates'|'held-out',explanations,practicalMargin:margin};
}
export function recommendSensitivity(records:AimRecord[],base:number,goal:AimPlan['goal']='balanced'){return precisionReport(records,base,goal);}

/** Acquisition consumes independent complete round summaries, not one pooled
 * point per candidate. Otherwise repeated leaders would always look untested. */
export function sequentialObservations(records:AimRecord[],base:number,goal:AimPlan['goal']='balanced'){
 const anchor=records.filter(r=>r.meta.phase==='exploration'&&Math.abs(r.meta.sensitivity-base)<1e-6).sort((a,b)=>b.meta.createdAt-a.meta.createdAt)[0];
 if(!anchor)return [];
 const c=context(compatibleAimRecords(records,anchor.meta),goal,base,extra(anchor.meta).expectedTasks);
 return [...c.rounds.entries()].flatMap(([x,rounds])=>{
  const variance=Math.max(.0001,(sd(rounds.map(r=>r.score))??.2)**2);
  return rounds.map(r=>({x,y:r.score,variance,at:Math.min(...c.blocks.filter(b=>b.session===r.session&&b.round===r.round&&Math.abs(b.sensitivity-x)<1e-6).map(b=>b.createdAt))}));
 }).sort((a,b)=>a.at-b.at).map(({x,y,variance})=>({x,y,variance}));
}

export function pairedComparison(records:AimRecord[],base:number,alternative:number,phase='verification',margin=.02){
 const source=records.filter(r=>r.meta.phase===phase),required=requiredTasks(source),blocks=summarizeBlocks(source),paired:{a:BlockResult;b:BlockResult;delta:number}[]=[];
 for(const a of blocks.filter(b=>Math.abs(b.sensitivity-base)<1e-6)){const b=blocks.find(b=>b.session===a.session&&b.condition===a.condition&&b.round===a.round&&b.task===a.task&&b.compatibility===a.compatibility&&Math.abs(b.sensitivity-alternative)<1e-6);if(b&&Math.abs(base-alternative)>1e-6)paired.push({a,b,delta:b.score-a.score});}
 const keys=[...new Set(paired.map(p=>`${p.a.session}|${p.a.round}`))],complete=keys.flatMap(key=>{const row=paired.filter(p=>`${p.a.session}|${p.a.round}`===key);return required.every(t=>row.some(p=>p.a.task===t))?[{session:row[0].a.session,delta:aggregateTaskDeltas(row.map(p=>({task:p.a.task,delta:p.delta})),PRECISION_GOAL_WEIGHTS.balanced)!}]:[];}),deltas=complete.map(x=>x.delta),sessionIds=[...new Set(complete.map(p=>p.session))],summary=clusteredSummary(sessionIds.map(id=>complete.filter(x=>x.session===id).map(x=>x.delta))),interval=summary.interval,sessions=sessionIds.length,valid=deltas.length>=6&&sessions>=2;
 const precisionA=mean(paired.filter(p=>!trackingTask(p.a.task)).flatMap(p=>p.a.hitRate===null?[]:[p.a.hitRate])),precisionB=mean(paired.filter(p=>!trackingTask(p.b.task)).flatMap(p=>p.b.hitRate===null?[]:[p.b.hitRate])),precisionGuard=precisionA!==null&&precisionB!==null&&(precisionB<.7||precisionB<precisionA-.03);
 const conclusion=!valid||!interval?'inconclusive':precisionGuard?'worse':interval[0]>margin?'improved':interval[1]<-margin?'worse':interval[0]>=-margin&&interval[1]<=margin?'equivalent':'inconclusive';
 const spread=sd(deltas),difference=summary.mean;return {conclusion,baseline:mean(paired.map(p=>p.a.score)),optimized:mean(paired.map(p=>p.b.score)),difference,medianDifference:median(deltas),interval,effectSize:spread&&difference!==null?difference/spread:null,pairedBlocks:paired.length,independentRounds:deltas.length,sessions,margin,deltaSamples:deltas,precisionA,precisionB,precisionGuard};
}
export function assessmentComparison(records:AimRecord[],phase:'post'|'retention'){
 const blocks=summarizeBlocks(records),required=requiredTasks(records),baseline=blocks.filter(b=>b.phase==='baseline'),after=blocks.filter(b=>b.phase===phase),pairs=after.flatMap(b=>{const a=baseline.filter(a=>a.condition===b.condition&&a.task===b.task&&a.compatibility===b.compatibility&&a.sensitivity===b.sensitivity&&a.createdAt<b.createdAt&&(phase!=='retention'||b.createdAt-a.createdAt>=86400000)).sort((a,c)=>c.createdAt-a.createdAt)[0];return a?[{a,b,delta:b.score-a.score}]:[];}),keys=[...new Set(pairs.map(p=>`${p.a.session}|${p.b.session}|${p.b.round}`))],complete=keys.flatMap(key=>{const row=pairs.filter(p=>`${p.a.session}|${p.b.session}|${p.b.round}`===key);return required.every(t=>row.some(p=>p.b.task===t))?[{session:row[0].b.session,delta:mean(row.map(p=>p.delta))!}]:[];}),deltas=complete.map(x=>x.delta),sessions=[...new Set(complete.map(p=>p.session))],interval=clusteredSummary(sessions.map(id=>complete.filter(x=>x.session===id).map(x=>x.delta))).interval;return {baseline:mean(pairs.map(p=>p.a.score)),after:mean(pairs.map(p=>p.b.score)),difference:mean(deltas),interval,pairs:pairs.length,rounds:deltas.length,sessions:sessions.length,conclusion:deltas.length>=6&&sessions.length>=2&&interval?interval[0]>.02?'improved':interval[1]<-.02?'worse':interval[0]>=-.02&&interval[1]<=.02?'equivalent':'inconclusive':'inconclusive'};
}
export function directionalSummary(records:AimRecord[]){return Array.from({length:8},(_,sector)=>{const a=records.filter(r=>r.metrics.valid&&r.meta.phase!=='combat'&&r.metrics.sector===sector),errors=a.flatMap(r=>r.metrics.signedError===null?[]:[r.metrics.signedError]);return {sector,count:a.length,signed:mean(errors),absolute:mean(errors.map(Math.abs)),interval:errors.length>=8?ci(errors):null,over:a.filter(r=>r.metrics.extent==='over').length,under:a.filter(r=>r.metrics.extent==='under').length,correction:median(a.flatMap(r=>r.metrics.correctionTime===null?[]:[r.metrics.correctionTime]))};});}
export function longitudinal(records:AimRecord[]){const groups=new Map<string,AimRecord[]>();for(const r of records){if(!r.metrics.valid)continue;const key=`${new Date(r.meta.createdAt+9*3600000).toISOString().slice(0,10)}|${r.meta.task}|${r.meta.sensitivity}|${r.meta.phase}|${r.meta.fov}|${r.meta.radius}|${r.meta.algorithm}|${r.meta.renderer}|${r.meta.amplitude}|${aimCompatibilityKey(r.meta)}`;const a=groups.get(key)??[];a.push(r);groups.set(key,a);}return [...groups].map(([key,a])=>({key,date:new Date(a[0].meta.createdAt+9*3600000).toISOString().slice(0,10),task:a[0].meta.task,sensitivity:a[0].meta.sensitivity,phase:a[0].meta.phase,score:mean(a.flatMap(r=>r.metrics.score===null?[]:[r.metrics.score])),count:a.length,error:median(a.flatMap(r=>r.metrics.initialError===null?[]:[r.metrics.initialError])),click:median(a.flatMap(r=>r.metrics.clickTime===null?[]:[r.metrics.clickTime])),tracking:median(a.flatMap(r=>r.metrics.trackingRms===null?[]:[r.metrics.trackingRms]))})).sort((a,b)=>a.date.localeCompare(b.date));}
