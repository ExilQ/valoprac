import {SeededRandom} from '../../engine/simulation/random';
import {EXERCISE_PROTOCOL,EXERCISE_VERSION,validateExerciseOptions,type ExerciseContext,type ExerciseOptions,type ExerciseReport,type FlashCue} from './types';

import type {Vec3} from '../../engine/types';
const EPS=1e-9,DEG=180/Math.PI;
function direction(yaw:number,pitch:number):Vec3{return{x:-Math.sin(yaw)*Math.cos(pitch),y:Math.sin(pitch),z:-Math.cos(yaw)*Math.cos(pitch)};}
function cueCopy(cue:FlashCue):FlashCue{return{...cue,source:{...cue.source},initialDirection:{...cue.initialDirection}};}
const mean=(values:number[])=>values.length?values.reduce((a,b)=>a+b,0)/values.length:null;

/** A deterministic task controller around the existing movement, Target.step,
 * weapon and hit authority. It never drives the player's camera or movement. */
export class Exercises {
 readonly ownsTargets=true;
 readonly options:ExerciseOptions;
 private rng:SeededRandom;
 private startTime=0;private elapsed=0;private initialized=false;private done=false;
 private appearances=0;private escaped=0;private firstTargetAt:number|null=null;private nextTargetAt:number|null=null;
 private stats={eliminations:0,shots:0,heads:0,bodies:0,limbs:0};
 private nextCueAt=0;private nextCueId=1;private active:FlashCue|null=null;private events:FlashCue[]=[];
 constructor(options:ExerciseOptions,seed:number){this.options=validateExerciseOptions(options);this.rng=new SeededRandom(seed^0xE1C15E);}
 get completed(){return this.done;}
 get cueSerial(){return this.nextCueId-1;}
 get completedCueCount(){return this.events.length;}
 get latestCueEvent(){const last=this.events.at(-1);return last?cueCopy(last):null;}
 get currentCue(){return this.active?cueCopy(this.active):null;}
 initialize(ctx:ExerciseContext){
  this.startTime=ctx.time;this.elapsed=0;this.done=false;this.initialized=true;
  this.appearances=0;this.escaped=0;this.firstTargetAt=null;this.nextTargetAt=null;this.events=[];this.active=null;this.nextCueId=1;this.stats={eliminations:ctx.stats.eliminations,shots:ctx.stats.shots,heads:ctx.stats.heads,bodies:ctx.stats.bodies,limbs:ctx.stats.limbs};
  this.hideTargets(ctx);
  if(this.options.kind==='warmup')this.spawn(ctx);
  else this.nextCueAt=ctx.time+this.rng.range(.8,1.3);
 }
 private hideTargets(ctx:ExerciseContext){for(const target of ctx.targets){target.enabled=false;target.active=false;target.velocity.set(0,0,0);}}
 private spawn(ctx:ExerciseContext){
  const target=ctx.targets[0];if(!target)return;
  const sign=this.rng.next()<.5?-1:1;
  target.enabled=true;target.scale=1;target.behavior='long';target.speedMultiplier=EXERCISE_PROTOCOL.warmup.speedMultiplier;target.difficulty='normal';
  target.spawn(sign*EXERCISE_PROTOCOL.warmup.startX,-15,ctx.time);
  target.anchor.set(0,0,-15);target.direction=-sign;target.directionZ=0;target.nextChange=ctx.time+4;target.updatePose(ctx.time);
  this.nextTargetAt=null;this.appearances++;this.firstTargetAt??=ctx.time-this.startTime;
 }
 /** A manual target reset changes the target appearance, not the session clock,
  * random stream or score. Its existing Simulation command is replayed normally. */
 resetTargets(ctx:ExerciseContext){this.hideTargets(ctx);if(!this.done&&this.options.kind==='warmup')this.spawn(ctx);}
 private scheduleTarget(ctx:ExerciseContext){
  if(this.nextTargetAt!==null||this.done)return;
  this.nextTargetAt=ctx.time+this.rng.range(EXERCISE_PROTOCOL.warmup.minimumGapSeconds,EXERCISE_PROTOCOL.warmup.maximumGapSeconds);
 }
 beforeTargets(ctx:ExerciseContext,_dt:number){
  if(!this.initialized)this.initialize(ctx);
  // Configuration edits cannot accidentally re-enable the ordinary free-range
  // targets while this protocol owns its target slots.
  for(let i=this.options.kind==='warmup'?1:0;i<ctx.targets.length;i++){ctx.targets[i].enabled=false;ctx.targets[i].active=false;}
  if(this.done)return;
  if(this.options.kind==='warmup'){
   const t=ctx.targets[0];if(!t)return;t.enabled=true;t.scale=1;t.behavior='long';t.speedMultiplier=EXERCISE_PROTOCOL.warmup.speedMultiplier;t.difficulty='normal';
   if(this.nextTargetAt!==null&&ctx.time+EPS>=this.nextTargetAt)this.spawn(ctx);
  }
 }
 afterTargets(ctx:ExerciseContext,_dt:number){
  if(this.done||this.options.kind!=='warmup')return;
  const t=ctx.targets[0];if(!t)return;
  if(t.active&&Math.abs(t.position.x)>=EXERCISE_PROTOCOL.warmup.exitX){t.eliminate(ctx.time);this.escaped++;}
  if(!t.active)this.scheduleTarget(ctx);
 }
 afterStep(ctx:ExerciseContext,_dt:number){
  if(!this.initialized)this.initialize(ctx);
  this.elapsed=Math.max(0,Math.min(this.options.durationSeconds,ctx.time-this.startTime));this.stats={eliminations:ctx.stats.eliminations,shots:ctx.stats.shots,heads:ctx.stats.heads,bodies:ctx.stats.bodies,limbs:ctx.stats.limbs};
  if(this.done)return;
  if(this.options.kind==='warmup'){
   if(ctx.targets[0]&&!ctx.targets[0].active)this.scheduleTarget(ctx);
  }else this.flashStep(ctx);
  if(this.elapsed+EPS>=this.options.durationSeconds){
   this.done=true;this.nextTargetAt=null;
   if(this.active){this.active.success=false;this.events.push(cueCopy(this.active));this.active=null;}
   for(const target of ctx.targets)if(target.active)target.eliminate(ctx.time);
  }
 }
 private flashStep(ctx:ExerciseContext){
  if(this.options.kind!=='flash')return;
  const end=this.startTime+this.options.durationSeconds;
  if(!this.active&&ctx.time+EPS>=this.nextCueAt&&ctx.time+this.options.responseWindowSeconds<=end+EPS){
   const forward=direction(ctx.viewYaw,ctx.viewPitch),p=ctx.movement.position;
   this.active={id:this.nextCueId++,cueTime:ctx.time,deadline:ctx.time+this.options.responseWindowSeconds,source:{x:p.x+forward.x*6,y:p.y+ctx.movement.eyeHeight+forward.y*6,z:p.z+forward.z*6},initialDirection:forward,movementOnset:null,maximumTurnDegrees:0,completionTime:null,success:null};
  }
  const cue=this.active;if(!cue)return;
  const current=direction(ctx.viewYaw,ctx.viewPitch),dot=current.x*cue.initialDirection.x+current.y*cue.initialDirection.y+current.z*cue.initialDirection.z;
  const turn=Math.acos(Math.max(-1,Math.min(1,dot)))*DEG;
  if(ctx.time<=cue.deadline+EPS){
   cue.maximumTurnDegrees=Math.max(cue.maximumTurnDegrees,turn);
   if(turn+EPS>=EXERCISE_PROTOCOL.flash.movementOnsetDegrees)cue.movementOnset??=ctx.time;
   if(turn+EPS>=this.options.turnThresholdDegrees){cue.completionTime=ctx.time;cue.success=true;}
  }
  if(cue.success===true||ctx.time+EPS>=cue.deadline){
   cue.success=cue.success===true;this.events.push(cueCopy(cue));if(this.events.length>128)this.events.shift();
   this.active=null;this.nextCueAt=ctx.time+this.rng.range(EXERCISE_PROTOCOL.flash.minimumRestSeconds,EXERCISE_PROTOCOL.flash.maximumRestSeconds);
  }
 }
 snapshot():ExerciseReport {
  const base={schema:1 as const,version:EXERCISE_VERSION,kind:this.options.kind,durationSeconds:60 as const,elapsedSeconds:this.elapsed,completed:this.done,score:0};
  if(this.options.kind==='warmup'){
   const hits=this.stats.heads+this.stats.bodies+this.stats.limbs;
   return{...base,score:this.stats.eliminations,warmup:{appearances:this.appearances,escaped:this.escaped,eliminations:this.stats.eliminations,shots:this.stats.shots,hits,headshots:this.stats.heads,hitAccuracy:this.stats.shots?hits/this.stats.shots*100:0,firstTargetAt:this.firstTargetAt,targetActive:this.nextTargetAt===null&&!this.done,nextTargetAt:this.nextTargetAt===null?null:this.nextTargetAt-this.startTime}};
  }
  const successes=this.events.filter(e=>e.success).length,failures=this.events.length-successes,onsets=this.events.flatMap(e=>e.movementOnset===null?[]:[e.movementOnset-e.cueTime]),completions=this.events.flatMap(e=>e.completionTime===null?[]:[e.completionTime-e.cueTime]);
  return{...base,score:successes,flash:{cues:this.events.length+Number(!!this.active),successes,failures,successRate:this.events.length?successes/this.events.length*100:0,meanOnsetSeconds:mean(onsets),meanCompletionSeconds:mean(completions),events:this.events.map(cueCopy),active:this.currentCue}};
 }
 /** All controller state that can affect subsequent targets/cues/outcomes.
  * UI records and local personal-best storage never enter this state. */
 integrityState(){return{version:EXERCISE_VERSION,options:{...this.options},rngState:(this.rng as unknown as {state:number}).state,startTime:this.startTime,elapsed:this.elapsed,initialized:this.initialized,completed:this.done,appearances:this.appearances,escaped:this.escaped,firstTargetAt:this.firstTargetAt,nextTargetAt:this.nextTargetAt,nextCueAt:this.nextCueAt,nextCueId:this.nextCueId,active:this.currentCue,events:this.events.map(cueCopy),stats:{...this.stats}};}
}
