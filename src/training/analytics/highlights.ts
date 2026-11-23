import type {SessionData,ShotEvent} from '../../engine/types';

export const HIGHLIGHT_ALGORITHM='session-highlights-1' as const;
export const MAX_SESSION_HIGHLIGHTS=5;
const MAX_EVENTS=4096,EPS=1e-8;
export type HighlightType='fastest-reacquisition'|'fastest-elimination'|'slowest-elimination'|'longest-miss-streak'|'best-braking-shot'|'largest-first-shot-error'|'death-exposure';
export type HighlightUnit='seconds'|'degrees'|'shots';
export interface SessionHighlight {
 id:string;type:HighlightType;timestamp:number;endTimestamp?:number;metric:number;unit:HighlightUnit;
 title:string;reason:string;source:'reaction'|'kill'|'shot'|'death';eventIndex:number;
}
type Candidate=SessionHighlight&{priority:number};
type MissRun={start:number;end:number;count:number;index:number;life:number|undefined};
const finite=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n);
const inTime=(n:unknown,duration:number):n is number=>finite(n)&&n>=0&&n<=duration&&Number.isSafeInteger(Math.round(n*1e6));
const misses=(hit:ShotEvent['hit'])=>hit==='miss'||hit==='wall';
const recent=<T,>(rows:readonly T[]|undefined):{event:T;index:number}[]=>Array.isArray(rows)?rows.slice(-MAX_EVENTS).map((event,i)=>({event,index:Math.max(0,rows.length-MAX_EVENTS)+i})):[];
const number=(n:number,digits=3)=>n.toFixed(digits);

/** I9: deterministic summaries of retained events, not invented recommendations.
 * Times use the simulation session's zero-based clock. Invalid/future events are
 * rejected rather than clamped to a plausible replay position. The fixed event
 * horizon and at most five outputs also bound imported/long-running histories.
 * Pure mouse flick error is unavailable in ShotEvent: the first-shot error below
 * explicitly includes the recorded ballistic ray's spread/recoil instead. */
export function sessionHighlights(session:SessionData,requestedLimit=MAX_SESSION_HIGHLIGHTS):SessionHighlight[]{
 const duration=session.duration;
 if(!finite(duration)||duration<=0)return[];
 const limit=finite(requestedLimit)?Math.min(MAX_SESSION_HIGHLIGHTS,Math.max(0,Math.floor(requestedLimit))):MAX_SESSION_HIGHLIGHTS;
 if(!limit)return[];
 const candidates:Candidate[]=[];
 const add=(type:HighlightType,timestamp:number,metric:number,unit:HighlightUnit,title:string,reason:string,source:SessionHighlight['source'],eventIndex:number,priority:number,endTimestamp?:number)=>{
  if(!inTime(timestamp,duration)||!finite(metric)||metric<0||!Number.isSafeInteger(eventIndex)||eventIndex<0)return;
  if(endTimestamp!==undefined&&(!inTime(endTimestamp,duration)||endTimestamp<timestamp))return;
  candidates.push({id:`${type}-${source}-${eventIndex}-${Math.round(timestamp*1e6)}`,type,timestamp,endTimestamp,metric,unit,title,reason,source,eventIndex,priority});
 };

 const reactions=recent(session.reactions).filter(({event:r})=>r&&inTime(r.changeTime,duration)&&finite(r.latency)&&r.latency>=0&&r.latency<=2&&inTime(r.changeTime+r.latency,duration));
 reactions.sort((a,b)=>a.event.latency-b.event.latency||a.event.changeTime-b.event.changeTime||a.index-b.index);
 if(reactions.length){const{event:r,index}=reactions[0];add('fastest-reacquisition',r.changeTime+r.latency,r.latency,'seconds','가장 빠른 머리 재획득','방향 전환 후 머리를 다시 조준하거나 명중한 게임 내 지연입니다. 사람의 순수 시각 반응속도 측정은 아닙니다.','reaction',index,85);}

 const kills=recent(session.kills).filter(({event:k})=>k&&inTime(k.timestamp,duration)&&finite(k.elapsed)&&k.elapsed>0&&k.elapsed<=k.timestamp+EPS);
 kills.sort((a,b)=>a.event.elapsed-b.event.elapsed||a.event.timestamp-b.event.timestamp||a.index-b.index);
 if(kills.length){const{event:k,index}=kills[0];add('fastest-elimination',k.timestamp,k.elapsed,'seconds','가장 빠른 표적 제거','남아 있는 제거 이벤트 중 생성부터 제거까지 가장 짧은 시간입니다.','kill',index,60);}
 if(kills.length>1){const slow=kills[kills.length-1],fast=kills[0];if(slow.event.elapsed>fast.event.elapsed+EPS)add('slowest-elimination',slow.event.timestamp,slow.event.elapsed,'seconds','가장 오래 걸린 표적 제거','남아 있는 제거 이벤트 중 생성부터 제거까지 가장 긴 시간입니다.','kill',slow.index,80);}

 const shots=recent(session.shots),validShots=shots.filter(({event:s})=>s&&inTime(s.timestamp,duration));
 // Wall analysis is intentionally shot at cover; calling it a missed aiming
 // sequence or target flick would misrepresent the exercise.
 if(session.mode!=='spray'&&!session.settings?.analysisWall){
  let run:MissRun|null=null,best:MissRun|null=null,previousTime=-Infinity;
  const finish=()=>{if(run&&(!best||run.count>best.count||run.count===best.count&&run.start<best.start))best={...run};run=null;};
  for(const{event:s,index}of shots){
   if(!s||typeof s!=='object'){finish();previousTime=-Infinity;continue;}
   if(!inTime(s.timestamp,duration)||s.timestamp<previousTime){finish();previousTime=inTime(s.timestamp,duration)?s.timestamp:-Infinity;continue;}
   previousTime=s.timestamp;
   if(!misses(s.hit)){finish();continue;}
   if(run&&run.life!==s.lifeGeneration)finish();
   if(!run)run={start:s.timestamp,end:s.timestamp,count:1,index,life:s.lifeGeneration};else{run.count++;run.end=s.timestamp;}
  }
  finish();
  // TS does not infer assignments made inside finish() across loop iterations.
  const streak=best as MissRun|null;
  if(streak&&streak.count>=2)add('longest-miss-streak',streak.start,streak.count,'shots','가장 긴 연속 비명중','남아 있는 연속 사격 이벤트에서 머리·몸통·팔다리에 맞지 않은 최장 구간입니다. 기록이 끊기거나 생명이 바뀌면 구간을 나눕니다.','shot',streak.index,90,streak.end);
  const errors=validShots.filter(({event:s})=>s.firstShot&&finite(s.angularError)&&s.angularError>=0&&s.angularError<=180);
  errors.sort((a,b)=>b.event.angularError!-a.event.angularError!||a.event.timestamp-b.event.timestamp||a.index-b.index);
  if(errors.length){const{event:s,index}=errors[0];add('largest-first-shot-error',s.timestamp,s.angularError!,'degrees','첫 발의 가장 큰 각도 오차','실제 사격 방향과 기록된 머리 방향의 차이입니다. 반동·산포를 포함하며 순수 마우스 플릭 오차는 아닙니다.','shot',index,70);}
 }

 const brakes=validShots.filter(({event:s})=>s.hit==='head'&&s.accurate&&(s.brakingKind==='neutral'||s.brakingKind==='opposite')&&inTime(s.releaseTime,duration)&&s.releaseTime<=s.timestamp&&finite(s.initialSpeed)&&s.initialSpeed>=.5&&finite(s.thresholdDelta)&&s.thresholdDelta>=0&&s.thresholdDelta<=s.timestamp-s.releaseTime+EPS&&finite(s.velocity?.x)&&finite(s.velocity?.z));
 brakes.sort((a,b)=>a.event.thresholdDelta!-b.event.thresholdDelta!||Math.hypot(a.event.velocity.x,a.event.velocity.z)-Math.hypot(b.event.velocity.x,b.event.velocity.z)||a.event.timestamp-b.event.timestamp||a.index-b.index);
 if(brakes.length){const{event:s,index}=brakes[0];add('best-braking-shot',s.timestamp,s.thresholdDelta!,'seconds','정확도 기준에 가장 가까운 제동 헤드샷',`${s.brakingKind==='opposite'?'반대 입력':'키 놓기'} 제동 후 실제 정확도 기준을 통과한 뒤 ${number(s.thresholdDelta!*1000,1)}ms에 발사했습니다. 발사 속도 ${number(Math.hypot(s.velocity.x,s.velocity.z),2)}m/s.`,'shot',index,75);}

 const deaths=[session.peeking?.lastDeath,session.tactical?.lastDeath].flatMap((death,index)=>death&&inTime(death.time,duration)&&finite(death.duration)&&death.duration>0&&death.duration<=death.time+EPS?[{death,index}]:[]);
 deaths.sort((a,b)=>b.death.duration-a.death.duration||a.death.time-b.death.time||a.index-b.index);
 if(deaths.length){const{death,index}=deaths[0];add('death-exposure',death.time,death.duration,'seconds','사망 직전 노출','남아 있는 사망 이벤트에 기록된 노출 시간입니다. 모든 사망의 이력이나 화면에 보인 면적을 뜻하지 않습니다.','death',index,100);}

 // Prioritize recorded problems, then distinct positive examples; show the
 // selected moments chronologically so their timestamps match a replay timeline.
 return candidates.sort((a,b)=>b.priority-a.priority||a.timestamp-b.timestamp||(a.id<b.id?-1:a.id>b.id?1:0)).slice(0,limit).sort((a,b)=>a.timestamp-b.timestamp||(a.id<b.id?-1:a.id>b.id?1:0)).map(({priority:_,...highlight})=>highlight);
}

export function highlightTime(seconds:number){const value=finite(seconds)?Math.max(0,seconds):0,tenths=Math.round(value*10);return`${Math.floor(tenths/600).toString().padStart(2,'0')}:${(tenths%600/10).toFixed(1).padStart(4,'0')}`;}
export function highlightMetric(moment:Pick<SessionHighlight,'metric'|'unit'>){return moment.unit==='shots'?`${Math.round(moment.metric)}발`:moment.unit==='degrees'?`${moment.metric.toFixed(2)}°`:`${(moment.metric*1000).toFixed(1)}ms`;}
