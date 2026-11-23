import type {Simulation} from '../simulation/Simulation';
import type {InputState,Settings,WeaponId} from '../types';
import {validateSessionOptions} from '../../training/platform/SessionOptions';
import {isMovementAction} from '../../training/movementTools/types';
import {replayCompatibility,replayOutcome,simulationChecksum} from './integrity';
import {MAX_REPLAY_COMMANDS,MAX_REPLAY_SECONDS,REPLAY_FIXED_DT,ReplayError,packInput,type ReplayCheckpoint,type ReplayCommand,type ReplayEvent,type ReplayHeader,type ReplayRecording} from './types';

const copy=<T>(value:T):T=>structuredClone(value);
type Callable=(...args:never[])=>unknown;
/** A single ordered command stream around the existing authority. Look remains
 * immediate; recording merely appends values. Compression never runs here. */
export class ReplayRecorder {
 private commands:ReplayCommand[]=[];private checkpoints:ReplayCheckpoint[]=[];private events:ReplayEvent[]=[];
 private depth=0;private stopped=false;private failure:string|null=null;private originals=new Map<string,Callable>();
 private terminal:ReplayRecording|null|undefined;
 private readonly header:ReplayHeader;private previousCapture:typeof this.simulation.renderedTargets.onCapture;
 constructor(readonly simulation:Simulation){
  if(simulation.ticks!==0||simulation.renderedTargets.size!==0)throw new ReplayError('리플레이는 새 훈련의 첫 입력 전에 기록을 시작해야 합니다.');
  this.header={...replayCompatibility(simulation.rules,simulation.characterGeometry),createdAt:Date.now(),fixedHz:120,map:simulation.practiceMap,physics:simulation.movement.profile.id+(simulation.movement.profile.preset?'/'+simulation.movement.profile.preset:''),seed:simulation.settings.seed,initial:{mode:simulation.mode,weapon:simulation.weaponId,settings:copy(simulation.settings),attached:simulation.renderedTargets.isAttached,options:copy(validateSessionOptions(simulation.options))}};
  this.previousCapture=simulation.renderedTargets.onCapture;
  simulation.renderedTargets.onCapture=(frame,provenance)=>{
   this.previousCapture?.(frame,provenance);if(this.stopped||this.failure)return;
   if(!provenance||provenance.tick!==simulation.ticks||!Number.isFinite(provenance.alpha)||provenance.alpha<0||provenance.alpha>1){this.fail('화면 표적 위치의 리플레이 연산 시점을 확인할 수 없습니다.');return;}
   this.append([2,frame.id,frame.submittedAt,provenance.alpha,provenance.tick]);
  };
  this.wrap('look',a=>[1,a[0] as number,a[1] as number]);
  this.wrap('captureFireView',a=>[3,a[0] as number]);this.wrap('clearFireView',()=>[4]);
  this.wrap('configure',a=>[5,copy(a[0] as Partial<Settings>)]);
  this.wrap('switchWeapon',a=>[6,a[0] as WeaponId]);
  this.wrap('retryTactical',()=>[7]);this.wrap('resetTargets',()=>[8]);this.wrap('resetStatistics',()=>[9]);this.wrap('clearMovementInput',()=>[10]);
  this.wrap('trainingAction',a=>{if(!isMovementAction(a[0])){this.fail('지원하지 않는 이동 연습 명령입니다.');return null;}return[12,copy(a[0])];});
  this.wrap('step',a=>{
   if(!simulation.running||simulation.completed)return null;
   if(!Number.isFinite(a[0])||Math.abs((a[0] as number)-REPLAY_FIXED_DT)>1e-12){this.fail('120Hz 이외의 연산 간격은 이 리플레이 버전에서 지원하지 않습니다.');return null;}
   if((simulation.ticks+1)*REPLAY_FIXED_DT>MAX_REPLAY_SECONDS){this.fail('리플레이 기록 한도에 도달했습니다. 훈련은 계속할 수 있습니다.');return null;}
   return[0,packInput(a[1] as InputState)];
  });
 }
 get status(){return{state:this.failure?'failed' as const:this.stopped?'stopped' as const:'recording' as const,reason:this.failure,commands:this.commands.length,ticks:this.simulation.ticks};}
 private fail(message:string){this.failure=message;}
 private append(command:ReplayCommand){
  if(this.failure||this.stopped)return;
  // Every exported snapshot needs one final control command. Keep that slot
  // free instead of creating an unimportable file at the exact command limit.
  if(this.commands.length>=MAX_REPLAY_COMMANDS-1||this.simulation.time>MAX_REPLAY_SECONDS){this.fail('리플레이 기록 한도에 도달했습니다. 훈련은 계속할 수 있습니다.');return;}
  this.commands.push(command);
 }
 private mark(kind:ReplayEvent['kind'],label:string,time=this.simulation.time){if(this.events.length<20_000)this.events.push({time,kind,label});else this.fail('리플레이 이벤트 한도에 도달했습니다.');}
 private wrap(name:string,command:(args:unknown[])=>ReplayCommand|null){
  const sim=this.simulation as unknown as Record<string,Callable>,original=sim[name];this.originals.set(name,original);
  sim[name]=((...args:unknown[])=>{
   const outer=this.depth===0&&!this.stopped&&!this.failure,s=this.simulation;
   const observes=outer&&(name==='step'||name==='retryTactical');
   const before=observes?{tick:s.ticks,shots:s.stats.shots,kills:s.stats.eliminations,death:s.exposure.death,jumps:s.movement.jumpSerial,landings:s.movement.landingSerial,life:s.lifeGeneration,cue:s.exercise?.cueSerial??0,turn:s.exercise?.completedCueCount??0}:null;
   if(outer){try{const c=command(args);if(c)this.append(c);}catch{this.fail('입력을 리플레이에 기록하지 못했습니다.');}}
   this.depth++;
   try{return original.apply(this.simulation,args as never[]);}
   finally{
    this.depth--;
    if(outer&&!this.failure&&!this.stopped&&before){
     if(s.stats.shots>before.shots)this.mark('shot',s.lastHit==='head'?'헤드샷 사격':'사격');
     if(s.stats.eliminations>before.kills)this.mark('kill','표적 제거');
     if(s.exposure.death&&s.exposure.death!==before.death)this.mark('death','플레이어 사망');
     if(s.lifeGeneration!==before.life)this.mark('respawn','같은 맵 재시도');
     if(s.movement.jumpSerial>before.jumps)this.mark('jump','점프');
     if(s.movement.landingSerial>before.landings)this.mark('landing','착지');
     if((s.exercise?.cueSerial??0)>before.cue)this.mark('cue','회피 신호');
     if((s.exercise?.completedCueCount??0)>before.turn){const cue=s.exercise?.latestCueEvent;this.mark('turn',cue?.success?'회피 성공':'회피 미완료',Math.min(s.time,cue?.completionTime??cue?.deadline??s.time));}
     if(name==='step'&&s.ticks!==before.tick&&s.ticks>0&&s.ticks%120===0)this.checkpoint();
    }
    if(outer&&!this.failure&&!this.stopped){if(name==='switchWeapon')this.mark('weapon','무기 변경');if(name==='configure')this.mark('settings','설정 변경');if(name==='trainingAction')this.mark('movement','이동 연습 도구');}
   }
  }) as Callable;
 }
 private checkpoint(){this.checkpoints.push({command:this.commands.length,tick:this.simulation.ticks,checksum:simulationChecksum(this.simulation)});}
 /** An immutable snapshot is also suitable for a movement-attempt segment.
  * Its final control command belongs to the copy, never to the continuing run. */
 snapshot():ReplayRecording|null{
  if(this.terminal!==undefined)return this.terminal===null?null:copy(this.terminal);
  if(this.stopped)return null;
  if(this.failure)return null;
  try{
   if(this.commands.length>=MAX_REPLAY_COMMANDS||this.simulation.time>MAX_REPLAY_SECONDS){this.fail('리플레이 기록 한도에 도달했습니다. 훈련은 계속할 수 있습니다.');return null;}
   const s=this.simulation,commands=copy(this.commands),checkpoints=copy(this.checkpoints),events=copy(this.events);
   // A timed finish is called inside Simulation.step, before the wrapper's
   // ordinary event collection. Include that last real shot/kill without delay.
   // A kind/time set keeps snapshot backfill linear in the bounded event and
   // detail journals, including frequent movement-ghost snapshots.
   const seen=new Map<ReplayEvent['kind'],Set<number>>();
   for(const event of events){let times=seen.get(event.kind);if(!times){times=new Set();seen.set(event.kind,times);}times.add(event.time);}
   const add=(kind:ReplayEvent['kind'],time:number,label:string)=>{let times=seen.get(kind);if(!times){times=new Set();seen.set(kind,times);}if(!times.has(time)){times.add(time);events.push({time,kind,label});}};
   for(const shot of s.shots)add('shot',shot.timestamp,shot.hit==='head'?'헤드샷 사격':'사격');for(const kill of s.kills)add('kill',kill.timestamp,'표적 제거');
   if(s.exposure.death)add('death',s.exposure.death.time,'플레이어 사망');
   for(const cue of s.exercise?.snapshot().flash?.events??[]){add('cue',cue.cueTime,'회피 신호');add('turn',Math.min(s.time,cue.completionTime??cue.deadline),cue.success?'회피 성공':'회피 미완료');}
   if(events.length>20_000){this.fail('리플레이 이벤트 한도에 도달했습니다.');return null;}
   events.sort((a,b)=>a.time-b.time);
   commands.push([11,s.running,s.completed]);const final=replayOutcome(s);checkpoints.push({command:commands.length,tick:s.ticks,checksum:final.checksum});
   return{schema:1,header:copy(this.header),commands,checkpoints,events,duration:s.time,ticks:s.ticks,final};
  }catch{this.fail('리플레이 사본을 만들지 못했습니다.');return null;}
 }
 finish(){
  if(this.terminal!==undefined)return this.terminal===null?null:copy(this.terminal);
  if(this.stopped)return null;
  this.terminal=this.snapshot();this.stopped=true;
  // The authority may keep running after recording stops. Keep one bounded
  // final snapshot, and never let callers mutate that retained result.
  return this.terminal===null?null:copy(this.terminal);
 }
 dispose(){
  const sim=this.simulation as unknown as Record<string,Callable>;for(const[name,original]of this.originals)sim[name]=original;
  this.simulation.renderedTargets.onCapture=this.previousCapture;this.stopped=true;
 }
}
