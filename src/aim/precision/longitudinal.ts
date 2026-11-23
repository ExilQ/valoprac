import type {AimMeta,AimPlan,AimRecord,AimTask} from '../types';
import {AIM_VERSION,trackingTask} from '../types';
import {ci,mean,median,sd} from '../math';
import {recommendSensitivity} from '../statistics';

interface CapturedMeta extends AimMeta {inputFingerprint?:string;expectedTrials?:number;expectedTasks?:AimTask[];blockId?:string;trialIndex?:number;scopeZoom?:number;}
export interface LongitudinalOptions {base?:number;goal?:AimPlan['goal'];fingerprint?:string;algorithm?:string;task?:AimTask;minimumSessions?:number;minimumDays?:number;practicalMargin?:number;now?:number;}
export interface LongitudinalSession {session:string;date:string;createdAt:number;lastAt:number;sensitivities:number[];range:[number,number]|null;preferred:number|null;blocks:number;tasks:number;validTrials:number;status:string;rangeKind:'equivalent'|'unresolved'|'insufficient';}
interface Block {key:string;session:string;round:number;task:AimTask;sensitivity:number;condition:string;phase:string;score:number;createdAt:number;lastAt:number;order:number;count:number;fingerprint:string;}
const date=(time:number)=>new Date(time+9*3600000).toISOString().slice(0,10);
const fingerprintOf=(r:AimRecord)=>(r.meta as CapturedMeta).inputFingerprint;
const scoreValid=(r:AimRecord)=>r.meta.valid&&r.metrics.valid&&r.metrics.score!==null&&Number.isFinite(r.metrics.score)&&r.meta.createdAt>=0&&Number.isFinite(r.meta.createdAt);
function completeBlocks(records:AimRecord[]):Block[]{
 const groups=new Map<string,AimRecord[]>();for(const r of records){const m=r.meta as CapturedMeta,key=`${m.session}|${m.blockId??m.round}|${m.task}|${m.condition}|${m.sensitivity}|${m.phase}`;const group=groups.get(key)??[];group.push(r);groups.set(key,group);}
 return [...groups].flatMap(([key,rows])=>{
  const unique=new Map<string,AimRecord>();for(const r of rows){const m=r.meta as CapturedMeta,id=m.trialIndex===undefined?m.id:`trial-${m.trialIndex}`,old=unique.get(id);if(!old||r.meta.createdAt>=old.meta.createdAt)unique.set(id,r);}
  const trials=[...unique.values()].sort((a,b)=>a.meta.createdAt-b.meta.createdAt),first=trials[0],meta=first.meta as CapturedMeta,expected=meta.expectedTrials??(trackingTask(meta.task)?1:8);if(!Number.isSafeInteger(expected)||expected<1||trials.length<expected)return[];const values=trials.slice(-expected);return[{key,session:meta.session,round:meta.round,task:meta.task,sensitivity:meta.sensitivity,condition:meta.condition,phase:meta.phase,score:median(values.map(r=>r.metrics.score!))!,createdAt:Math.min(...values.map(r=>r.meta.createdAt)),lastAt:Math.max(...values.map(r=>r.meta.createdAt)),order:meta.order,count:values.length,fingerprint:fingerprintOf(first)!}];
 });
}
/** Time summaries use complete trial blocks and independent sessions, never
 * the thousands of correlated mouse samples inside those blocks. Selection
 * uses the same recommendation engine as the laboratory, not a second score. */
export function longitudinalStability(records:AimRecord[],options:LongitudinalOptions={}) {
 const algorithm=options.algorithm??AIM_VERSION,now=options.now??Date.now(),valid=records.filter(r=>scoreValid(r)&&r.meta.createdAt<=now&&r.meta.algorithm===algorithm&&(options.task===undefined||r.meta.task===options.task)&&r.meta.phase!=='combat'&&r.meta.phase!=='training');
 const anchor=valid.slice().sort((a,b)=>b.meta.createdAt-a.meta.createdAt).find(r=>fingerprintOf(r));
 const identity=options.fingerprint??(anchor?fingerprintOf(anchor):undefined);
 const taskSet=(r:AimRecord)=>JSON.stringify(r.meta.expectedTasks?.slice().sort()??null),compatible=identity?valid.filter(r=>fingerprintOf(r)===identity&&r.meta.protocol===anchor?.meta.protocol&&taskSet(r)===taskSet(anchor??r)):[],blocks=completeBlocks(compatible),base=options.base??compatible.find(r=>r.meta.phase==='baseline')?.meta.sensitivity??compatible[0]?.meta.sensitivity??.35;
 const sessionIds=[...new Set(compatible.map(r=>r.meta.session))],sessionResults:LongitudinalSession[]=sessionIds.map(session=>{const rows=compatible.filter(r=>r.meta.session===session),b=blocks.filter(b=>b.session===session),report=recommendSensitivity(rows,base,options.goal??'balanced');return{session,date:date(Math.min(...rows.map(r=>r.meta.createdAt))),createdAt:Math.min(...rows.map(r=>r.meta.createdAt)),lastAt:Math.max(...rows.map(r=>r.meta.createdAt)),sensitivities:[...new Set(b.map(x=>x.sensitivity))].sort((a,b)=>a-b),range:report.range,preferred:report.recommended,blocks:b.length,tasks:new Set(b.map(b=>b.task)).size,validTrials:b.reduce((n,b)=>n+b.count,0),status:report.status,rangeKind:report.rangeKind};}).sort((a,b)=>a.createdAt-b.createdAt);
 const candidates=sessionResults.filter(s=>s.range!==null),days=new Set(sessionResults.map(s=>s.date)).size,spanHours=sessionResults.length>1?(sessionResults.at(-1)!.lastAt-sessionResults[0].createdAt)/3600000:0;
 const requiredSessions=Math.max(3,options.minimumSessions??3),requiredDays=Math.max(2,options.minimumDays??2),hasRepeatedEvidence=candidates.length>=requiredSessions&&days>=requiredDays&&spanHours>=24;
 const overlap=candidates.length?[Math.max(...candidates.map(s=>s.range![0])),Math.min(...candidates.map(s=>s.range![1]))] as [number,number]:null,hasOverlap=overlap!==null&&overlap[0]<=overlap[1]+1e-8;
 let range:[number,number]|null=hasOverlap?overlap:null;
 const assignedBaselines=new Map<string,string>(),usedBaselineSessions=new Set<string>();
 const retentionPairs:{baseline:Block;followup:Block;difference:number}[]=[];
 for(const followup of blocks.filter(b=>b.phase==='retention').sort((a,b)=>a.createdAt-b.createdAt)){const assigned=assignedBaselines.get(followup.session);const baseline=blocks.filter(b=>b.phase==='baseline'&&b.session!==followup.session&&(assigned?b.session===assigned:!usedBaselineSessions.has(b.session))&&b.condition===followup.condition&&b.task===followup.task&&Math.abs(b.sensitivity-followup.sensitivity)<1e-8&&followup.createdAt-b.lastAt>=86400000).sort((a,b)=>b.lastAt-a.lastAt)[0];if(baseline){assignedBaselines.set(followup.session,baseline.session);usedBaselineSessions.add(baseline.session);retentionPairs.push({baseline,followup,difference:followup.score-baseline.score});}}
 const clusters=new Map<string,number[]>();for(const p of retentionPairs){const key=`${p.baseline.session}|${p.followup.session}`,values=clusters.get(key)??[];values.push(p.difference);clusters.set(key,values);}
 const retentionDeltas=[...clusters.values()].map(a=>median(a)!),retentionInterval=retentionDeltas.length>=4?ci(retentionDeltas):null;
 const enoughRetention=retentionDeltas.length>=4&&new Set(retentionPairs.map(p=>p.followup.session)).size>=2;
 const commonTested=candidates.length?candidates[0].sensitivities.filter(v=>candidates.every(s=>s.sensitivities.some(x=>Math.abs(x-v)<1e-8))&&range!==null&&v>=range[0]&&v<=range[1]):[];
 const equivalentRepeated=candidates.every(s=>s.rangeKind==='equivalent')&&commonTested.length>0;
 const status=!candidates.length?'insufficient':!hasRepeatedEvidence?'provisional':!hasOverlap?'conflicting':enoughRetention&&equivalentRepeated?'stable':'provisional';
 if(status==='insufficient'||status==='conflicting')range=null;
 const preferences=range?candidates.flatMap(s=>s.preferred!==null&&s.preferred>=range![0]&&s.preferred<=range![1]?[s.preferred]:[]):[],counts=new Map<number,number>();for(const v of preferences)counts.set(v,(counts.get(v)??0)+1);
 const preferred=[...counts.keys()].sort((a,b)=>(counts.get(b)!-counts.get(a)!)||Math.abs(Math.log(a/base))-Math.abs(Math.log(b/base)))[0]??null;
 const perSessionOrder=blocks.filter(b=>b.sensitivity===base).reduce((map,b)=>{const row=map.get(b.session)??[];row.push(b);map.set(b.session,row);return map;},new Map<string,Block[]>());
 const orderChanges:number[]=[];for(const rows of perSessionOrder.values()){const conditions=[...new Set(rows.map(r=>`${r.task}|${r.condition}`))];for(const condition of conditions){const samples=rows.filter(r=>`${r.task}|${r.condition}`===condition).sort((a,b)=>a.order-b.order);if(samples.length>=4){const half=Math.floor(samples.length/2),early=median(samples.slice(0,half).map(r=>r.score)),late=median(samples.slice(half).map(r=>r.score));if(early!==null&&late!==null)orderChanges.push(late-early);}}}
 const orderDelta=median(orderChanges),margin=options.practicalMargin??.02;
 const reason=status==='insufficient'?'완료된 호환 반복 실험이 없습니다. 과거 설정이 빠진 기록은 참고용으로 보존합니다.':status==='conflicting'?'날짜별 잠정 범위가 겹치지 않습니다. 감도를 바꾸기 전에 같은 설정에서 추가 검증하세요.':status==='stable'?'여러 날짜의 반복 범위가 겹치고 24시간 이후의 별도 유지 측정이 있습니다. 이것만으로 실제 게임 향상을 확정하지 않습니다.':'잠정 범위입니다. 최소 3세션·2일·24시간 간격과 별도 유지 측정 전에는 장기 안정성을 확정하지 않습니다.';
 return {status,sessions:sessionResults.length,days,spanHours,validTrials:valid.length,compatibleTrials:compatible.length,excludedTrials:records.length-compatible.length,legacyTrials:records.filter(r=>!fingerprintOf(r)).length,fingerprint:identity??null,range,preferred,reason,commonTested,sessionResults,requirements:{sessions:requiredSessions,days:requiredDays,minimumSpanHours:24,retentionPairs:4},retention:{eligible:enoughRetention,pairedSessions:retentionDeltas.length,pairedBlocks:retentionPairs.length,difference:mean(retentionDeltas),medianDifference:median(retentionDeltas),interval:retentionInterval,effectSize:retentionDeltas.length>=4&&sd(retentionDeltas)&&mean(retentionDeltas)!==null?mean(retentionDeltas)!/sd(retentionDeltas)!:null},order:{matchedRetests:orderChanges.length,medianLaterMinusEarlier:orderDelta,learningOrFatigueFlag:orderDelta!==null&&Math.abs(orderDelta)>margin,interpretation:'Matched-condition baseline changes can flag order, practice or fatigue; they do not identify a causal fatigue mechanism.'},limits:['Only identical captured input fingerprints and algorithm versions are combined.','Intervals resample non-overlapping baseline/follow-up session-pair summaries, not individual mouse samples.','Overlapping provisional ranges alone do not prove practical equivalence or long-term improvement.']};
}
