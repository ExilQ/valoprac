import type {MovementPracticePose} from '../../engine/movement/Movement';
import type {Vec3} from '../../engine/types';
import {isMovementAction,type MovementAction,type MovementActionResult,type MovementAttempt,type MovementPracticeContext,type MovementPracticeSnapshot,type MovementTracePoint} from './types';

const SAMPLE_TICKS=4,MAX_SAMPLES=600,MAX_SECONDS=20;
const copy=<T,>(value:T):T=>structuredClone(value);
const point=(v:Vec3):Vec3=>({x:v.x,y:v.y,z:v.z});

/** Practice bookkeeping observes actual resolved motion. It never moves the
 * player except through the explicitly requested, collision-validated restore. */
export class MovementPractice {
 private enabled=false;private savedPose:MovementPracticePose|null=null;private lastTakeoffPose:MovementPracticePose|null=null;private attemptOrigin:MovementPracticePose|null=null;
 private current:MovementAttempt|null=null;private last:MovementAttempt|null=null;private beforePose:MovementPracticePose|null=null;
 private jumpSerial=0;private landingSerial=0;private sequence=0;private lastSampleTick=-1;
 private lastPosition:Vec3|null=null;private restores=0;private message='위치 저장 또는 점프로 이동 시도를 시작하세요.';

 beforeStep(c:MovementPracticeContext){
  this.enabled=true;this.beforePose=c.movement.capturePracticePose(c.map,c.yaw,c.pitch,c.time);
  this.attemptOrigin??=copy(this.beforePose);this.jumpSerial=c.movement.jumpSerial;this.landingSerial=c.movement.landingSerial;
 }
 afterStep(c:MovementPracticeContext){
  const before=this.beforePose;if(!before)return;const m=c.movement,landed=m.landingSerial!==this.landingSerial,jumped=m.jumpSerial!==this.jumpSerial;
  if(landed&&this.current)this.finish(c,{x:m.position.x,y:m.supportHeight,z:m.position.z});
  if(jumped||before.grounded&&!m.grounded){
   if(this.current)this.finish(c,null,true);
   const takeoff=m.physicsSnapshot().takeoff;
   this.lastTakeoffPose=copy(before);
   if(takeoff){this.lastTakeoffPose.position=point(takeoff.position);this.lastTakeoffPose.velocity=point(takeoff.velocity);this.lastTakeoffPose.velocity.y=0;}
   // Include the last grounded simulation boundary in a replay segment. The
   // takeoff is resolved during this tick, so starting at its post-step tick
   // would lose the first vertical displacement from the ghost's origin.
   const origin=takeoff?.position??before.position,startTime=Math.min(takeoff?.time??before.capturedAt,Math.max(0,(c.ticks-1)/120));
   this.lastTakeoffPose.capturedAt=startTime;
   // A new physical attempt has its own return point. Keep the explicit saved
   // bookmark independent so reset and restore remain different tools.
   this.attemptOrigin=copy(this.lastTakeoffPose);
   this.begin(c,origin,startTime,Math.hypot(before.velocity.x,before.velocity.z));
  }
  const a=this.current;
  if(a){
   const p=m.position;a.duration=Math.max(0,c.time-a.startTime);a.endTick=c.ticks;a.peakHeight=Math.max(a.peakHeight,p.y-a.takeoff.y);a.peakSpeed=Math.max(a.peakSpeed,m.speed);
   if(this.lastPosition)a.distance+=Math.hypot(p.x-this.lastPosition.x,p.z-this.lastPosition.z);this.lastPosition=point(p);
   if(c.ticks-this.lastSampleTick>=SAMPLE_TICKS&&a.samples.length<MAX_SAMPLES){a.samples.push(this.sample(c,a.startTime));this.lastSampleTick=c.ticks;}
   if(a.duration>=MAX_SECONDS||a.samples.length>=MAX_SAMPLES)this.finish(c,null,true);
  }
  this.beforePose=null;
 }
 private begin(c:MovementPracticeContext,origin:Vec3,startTime:number,speed:number){
  this.current={id:++this.sequence,startTick:Math.max(0,Math.floor(startTime*120+1e-8)),endTick:c.ticks,startTime,duration:0,takeoff:point(origin),landing:null,peakHeight:0,peakSpeed:speed,distance:0,takeoffSpeed:speed,landingSpeed:null,speedPreservation:null,truncated:false,samples:[[0,origin.x,origin.y,origin.z,speed,c.movement.grounded,c.yaw,c.movement.crouch]]};
  this.lastPosition=point(origin);this.lastSampleTick=c.ticks-SAMPLE_TICKS;
 }
 private sample(c:MovementPracticeContext,start:number):MovementTracePoint{const m=c.movement,p=m.position;return[Math.max(0,c.time-start),p.x,p.y,p.z,m.speed,m.grounded,c.yaw,m.crouch];}
 private finish(c:MovementPracticeContext,landing:Vec3|null,truncated=false){
  const a=this.current;if(!a)return;if(this.lastPosition)a.distance+=Math.hypot(c.movement.position.x-this.lastPosition.x,c.movement.position.z-this.lastPosition.z);a.peakHeight=Math.max(a.peakHeight,c.movement.position.y-a.takeoff.y);a.peakSpeed=Math.max(a.peakSpeed,c.movement.speed);a.endTick=c.ticks;a.duration=Math.max(0,c.time-a.startTime);a.landing=landing?point(landing):null;a.truncated=truncated;
  if(landing){a.landingSpeed=c.movement.speed;a.speedPreservation=a.takeoffSpeed>1e-8?a.landingSpeed/a.takeoffSpeed:null;}
  if(a.samples.length<MAX_SAMPLES)a.samples.push(this.sample(c,a.startTime));
  this.last=copy(a);this.current=null;this.lastPosition=null;this.message=truncated?'시도 기록 한도에 도달했습니다. 최근 20초만 비교합니다.':'착지한 이동 시도를 기록했습니다.';
 }
 action(action:MovementAction,c:MovementPracticeContext):MovementActionResult {
  this.enabled=true;if(!isMovementAction(action))return{ok:false,message:'지원하지 않는 이동 도구 명령입니다.'};
  if(action.kind==='movement-save'){
   this.savedPose=c.movement.capturePracticePose(c.map,c.yaw,c.pitch,c.time);this.attemptOrigin=copy(this.savedPose);this.message='현재 위치·방향·속도를 저장했습니다.';return{ok:true,message:this.message};
  }
  const pose=action.kind==='movement-restore'?this.savedPose:action.kind==='movement-takeoff'?this.lastTakeoffPose:this.attemptOrigin;
  if(!pose){this.message=action.kind==='movement-restore'?'먼저 위치를 저장하세요.':action.kind==='movement-takeoff'?'아직 되돌아갈 이륙 지점이 없습니다.':'이동 시도를 시작한 뒤 초기화할 수 있습니다.';return{ok:false,message:this.message};}
  const restored=c.movement.restorePracticePose(copy(pose),c.map,c.time,c.bounds);
  if(!restored.ok){this.message=restored.reason??'저장한 위치를 복원하지 못했습니다.';return{ok:false,message:this.message};}
  this.restores++;this.current=null;this.beforePose=null;this.lastPosition=null;this.lastSampleTick=-1;this.jumpSerial=c.movement.jumpSerial;this.landingSerial=c.movement.landingSerial;
  if(!c.movement.grounded)this.begin(c,c.movement.position,c.time,c.movement.speed);
  this.message=action.kind==='movement-takeoff'?'마지막 이륙 지점으로 돌아왔습니다.':action.kind==='movement-reset'?'이동 시도의 시작점으로 돌아왔습니다.':'저장한 위치·방향·속도를 복원했습니다.';
  return{ok:true,message:this.message,restored:{yaw:restored.yaw??pose.yaw,pitch:restored.pitch??pose.pitch}};
 }
 snapshot():MovementPracticeSnapshot{return copy({enabled:this.enabled,saved:!!this.savedPose,canReturnTakeoff:!!this.lastTakeoffPose,canReset:!!this.attemptOrigin,message:this.message,savedPose:this.savedPose,lastTakeoffPose:this.lastTakeoffPose,attemptOrigin:this.attemptOrigin,current:this.current,last:this.last,restores:this.restores});}
 /** Only authoritative bookmark/attempt data belongs in replay integrity. A
  * ghost cache and display camera remain outside this state. */
 trainingState(){return{...this.snapshot(),internal:copy({sequence:this.sequence,lastSampleTick:this.lastSampleTick,lastPosition:this.lastPosition,beforePose:this.beforePose,jumpSerial:this.jumpSerial,landingSerial:this.landingSerial})};}
}
