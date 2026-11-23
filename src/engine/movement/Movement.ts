import {Vector3} from 'three';
import {MOVEMENT,MOVEMENT_PHYSICS_VERSION,VALORANT_PHYSICS,resolveMovementPhysics,type MovementProfile,type MovementPhysicsProfile,type MovementPhysicsSettings} from '../../config/movement';
import type {InputState,Vec3,WeaponId} from '../types';
import {ENVIRONMENT,type Obstacle} from '../collision/environment';
import {CollisionController} from './CollisionController';
import {JumpController} from './JumpController';
import {wishMovement,solveGroundMovement,solveAirMovement,limitContactSpeed,landingRetention} from './MovementSolvers';

export interface HopEvent {kind:'jump'|'chain'|'land'|'missed';time:number;speed:number;inputTimingMs:number|null;groundContactSeconds:number;position:Vec3;}
export interface HopSnapshot {jumps:number;chainedJumps:number;missedInputs:number;landings:number;peakSpeed:number;lastLandingInterval:number|null;lastInputTimingMs:number|null;timingMeanMs:number|null;timingDeviationMs:number|null;groundContactSeconds:number;speedPreservation:number|null;events:HopEvent[];}
export interface TakeoffState {
 kind:'jump'|'fall';time:number;position:Vec3;velocity:Vec3;horizontalSpeed:number;
 movementState:'running'|'walking'|'crouching'|'crouch-walking'|'stationary';
 weapon:WeaponId|null;weaponRunSpeed:number;ads:boolean;speedCap:number|null;
 calibration:'report-provisional'|'source-profile';
}
export interface MovementPracticePose {
 schema:1;map:string;physicsVersion:string;profile:MovementPhysicsProfile['id'];preset:MovementPhysicsProfile['preset'];capturedAt:number;
 position:Vec3;velocity:Vec3;yaw:number;pitch:number;crouch:number;grounded:boolean;takeoff:TakeoffState|null;
}
export interface MovementPracticeRestore {ok:boolean;reason?:string;yaw?:number;pitch?:number;}
const EPS=1e-9;
const plain=(v:Vec3):Vec3=>({x:v.x,y:v.y,z:v.z});
/** Shared contact/command integration with distinct tactical and Source-inspired
 * solvers. Gameplay, weapon and sound systems consume the resolved real velocity. */
export class Movement {
 get jumpSerial(){return this.hops.jumps;}
 position=new Vector3(0,0,5);previous=new Vector3(0,0,5);velocity=new Vector3();
 previousVelocity=new Vector3();acceleration=new Vector3();desiredDirection=new Vector3();previousSpeed=0;braking=false;deceleration=0;opposedInput=false;
 airAcceleration=new Vector3();groundNormal=new Vector3(0,1,0);supportHeight=0;
 speedModifier=1;grounded=true;crouch=0;eyeHeight=1.64;previousEyeHeight=1.64;speed=0;landedAt=-100;
 landingSerial=0;lastLandingImpactSpeed=0;lastLandingTime=-Infinity;
 readonly weaponSpeedReference=5.4;profile:MovementPhysicsProfile;
 private takeoff:TakeoffState|null=null;
 private weaponContext:{id:WeaponId;runSpeed:number;ads:boolean}|null=null;
 private activeInput:Pick<InputState,'walk'|'crouch'>={walk:false,crouch:false};
 private baseSpeed:number;private jumps=new JumpController();private collision:CollisionController;
 private lastTakeoff=-Infinity;private lastLanding=-Infinity;private landingSpeed=0;private groundContact=0;private landingPenaltyPending=false;private landingImpact=0;private lastTime=0;
 private hops={jumps:0,chainedJumps:0,missedInputs:0,landings:0,peakSpeed:0,lastLandingInterval:null as number|null,lastInputTimingMs:null as number|null,timingMean:0,timingM2:0,timingCount:0,speedPreservation:null as number|null,events:[] as HopEvent[]};
 constructor(profile:MovementProfile={...MOVEMENT},public obstacles:Obstacle[]=ENVIRONMENT){this.profile={...VALORANT_PHYSICS,...profile};this.baseSpeed=profile.maxSpeed;this.collision=new CollisionController(obstacles);}
 /** Presentation and ADS modifiers remain separate from the weapon's unscoped
  * run speed. Freeze this context at takeoff; switching midair cannot refill it. */
 setWeaponContext(id:WeaponId,runSpeed:number,ads:boolean){
  if(Number.isFinite(runSpeed)&&runSpeed>0){const context=this.weaponContext;if(context){context.id=id;context.runSpeed=runSpeed;context.ads=ads;}else this.weaponContext={id,runSpeed,ads};}
 }
 private recordTakeoff(time:number,kind:TakeoffState['kind']){
  const p=this.profile,speed=Math.hypot(this.velocity.x,this.velocity.z),weaponRun=this.weaponContext?.runSpeed??p.maxSpeed*Math.min(1,this.speedModifier),tactical=p.airModel==='tactical';
  const proposed=tactical?Math.min(speed+(p.airTakeoffAllowance??.75),weaponRun*(p.airWeaponRunFactor??1.05)):null;
  this.takeoff={kind,time,position:plain(this.position),velocity:plain(this.velocity),horizontalSpeed:speed,movementState:speed<.01?'stationary':this.activeInput.crouch?(this.activeInput.walk?'crouch-walking':'crouching'):this.activeInput.walk?'walking':'running',weapon:this.weaponContext?.id??null,weaponRunSpeed:weaponRun,ads:this.weaponContext?.ads??false,speedCap:proposed===null?null:Math.min(proposed,p.hopSpeedCap??Infinity,p.airSpeedLimit??Infinity),calibration:tactical?'report-provisional':'source-profile'};
 }
 get profileBaseMaxSpeed(){return this.baseSpeed;}
 get accurate(){return this.grounded&&this.speed<=this.profile.accuracyVelocityThreshold;}
 private get buffer(){return Math.max(0,Math.min(.14,this.profile.jumpBufferSeconds??.08));}
 private bodyHeight(){return this.crouch>.5?1.35:1.85;}
 /** Profile changes are controlled horizontal resets at the current position.
  * Air/contact state, vertical momentum and crouch headroom are not invented. */
 configurePhysics(settings:MovementPhysicsSettings,time=this.lastTime){
  const next=resolveMovementPhysics(settings),changed=next.id!==this.profile.id||next.preset!==this.profile.preset;
  this.profile=next;this.baseSpeed=next.maxSpeed;
  if(changed){this.velocity.x=this.velocity.z=0;this.previous.copy(this.position);this.previousVelocity.copy(this.velocity);this.speed=0;this.previousSpeed=0;this.acceleration.set(0,0,0);this.airAcceleration.set(0,0,0);this.desiredDirection.set(0,0,0);this.braking=false;this.deceleration=0;this.opposedInput=false;this.jumps.reset(time);this.lastTakeoff=this.lastLanding=-Infinity;this.takeoff=null;this.landingPenaltyPending=false;this.groundContact=0;this.landingSpeed=0;}
  return changed;
 }
 private hopEvent(kind:HopEvent['kind'],time:number,timing:number|null=null){const events=this.hops.events;events.push({kind,time,speed:Math.hypot(this.velocity.x,this.velocity.z),inputTimingMs:timing,groundContactSeconds:this.groundContact,position:plain(this.position)});if(events.length>64)events.shift();}
 private launch(time:number){
  if(!this.grounded||!this.jumps.canLaunch(time))return false;
  const p=this.profile,window=p.preset==='cs2'?p.landingWindow/2:this.buffer;
  const timing=Number.isFinite(this.lastLanding)?(this.jumps.requestedAt-this.lastLanding)*1000:null;
  const chain=Number.isFinite(this.lastTakeoff)&&time-this.lastLanding<=window+EPS&&timing!==null&&Math.abs(timing)<=window*1000+1e-6;
  if(p.jumpSpeedLimit!==null)limitContactSpeed(this.velocity,p.jumpSpeedLimit*Math.min(1,this.speedModifier));
  this.recordTakeoff(time,'jump');this.velocity.y=p.jumpImpulse;this.grounded=false;this.jumps.consume(time,p);this.lastTakeoff=time;this.landingPenaltyPending=false;
  this.hops.jumps++;if(chain){this.hops.chainedJumps++;this.hops.lastInputTimingMs=timing;this.hops.speedPreservation=this.landingSpeed>1e-6?Math.hypot(this.velocity.x,this.velocity.z)/this.landingSpeed:null;if(timing!==null){const h=this.hops;h.timingCount++;const delta=timing-h.timingMean;h.timingMean+=delta/h.timingCount;h.timingM2+=delta*(timing-h.timingMean);}}
  this.hopEvent(chain?'chain':'jump',time,chain?timing:null);this.groundContact=0;return true;
 }
 step(input:InputState,yaw:number,dt:number,time:number){
  if(!(dt>0)||!Number.isFinite(dt)||!Number.isFinite(time))return;
  const p=this.profile;this.activeInput={walk:input.walk,crouch:input.crouch};this.lastTime=time;this.collision.obstacles=this.obstacles;
  this.previous.copy(this.position);this.previousEyeHeight=this.eyeHeight;this.previousVelocity.copy(this.velocity);this.previousSpeed=Math.hypot(this.velocity.x,this.velocity.z);const wasGrounded=this.grounded;
  this.jumps.update(input,time,p);
  let crouchTarget=input.crouch?1:0;if(!crouchTarget&&this.crouch>.5&&!this.collision.canStand(this.position,1.35,1.85,p.radius))crouchTarget=1;
  this.crouch+=Math.sign(crouchTarget-this.crouch)*Math.min(Math.abs(crouchTarget-this.crouch),dt*8);this.eyeHeight=p.standingEyeHeight+(p.crouchingEyeHeight-p.standingEyeHeight)*this.crouch;
  const forward=input.forward,side=input.strafe,modifier=(input.walk?p.walkModifier:1)*(1+(p.crouchModifier-1)*this.crouch)*(forward<0?p.backwardModifier:1)*(Math.abs(side)>0?p.lateralModifier:1)*this.speedModifier;
  const wish=wishMovement(forward,side,yaw,p.maxSpeed,modifier);this.desiredDirection.set(wish.x*wish.amount,0,wish.z*wish.amount);this.opposedInput=wish.amount>0&&wish.x*this.previousVelocity.x+wish.z*this.previousVelocity.z<-.05;
  const supportBefore=this.collision.support(this.position,this.position.y+.01,p.maxSlopeCos);
  if(this.grounded&&(this.position.y-supportBefore.height>.08||!supportBefore.walkable)){this.grounded=false;this.recordTakeoff(time,'fall');}
  // Manual timing is evaluated before ground friction. Merely holding Space
  // cannot issue a fresh request after a real contact transition.
  // A fresh grounded edge occurs at its own point inside this tick. A zero
  // early-landing buffer must not discard ordinary ground jumps merely because
  // the input arrived between fixed boundaries. Stale edges retain their age.
  const requestTime=this.jumps.requestedAt;
  this.launch(requestTime>=time-dt-EPS&&requestTime<=time?requestTime:time);
  if(this.grounded){
   if(this.landingPenaltyPending&&time-this.lastLanding>=p.landingWindow/2-EPS){const retention=landingRetention(p,this.landingImpact);this.velocity.x*=retention;this.velocity.z*=retention;this.landingPenaltyPending=false;}
   solveGroundMovement(this.velocity,wish,p,dt);this.airAcceleration.set(0,0,0);
  }else{if(!this.takeoff)this.recordTakeoff(time,'fall');solveAirMovement(this.velocity,wish,p,dt,this.airAcceleration,this.takeoff?.speedCap);}
  const beforeVertical=this.velocity.y;
  if(!this.grounded)this.velocity.y=Math.max(-55,this.velocity.y-p.gravity*dt);
  const gravityTime=!this.grounded&&p.verticalIntegration==='ballistic'?(p.gravity>0?Math.min(dt,Math.max(0,(beforeVertical+55)/p.gravity)):dt):0;
  const verticalTravel=gravityTime>0?beforeVertical*gravityTime-.5*p.gravity*gravityTime*gravityTime+this.velocity.y*(dt-gravityTime):this.velocity.y*dt;
  this.collision.moveHorizontal(this.position,this.velocity,dt,{radius:p.radius,bodyHeight:this.bodyHeight(),grounded:this.grounded,stepHeight:p.stepHeight,maxSlopeCos:p.maxSlopeCos});
  // Tactical vertical motion uses the exact constant-gravity displacement.
  // Source presets retain their previous semi-implicit integration byte-for-byte.
  const oldY=this.position.y;this.position.y+=verticalTravel;const contact=this.collision.support(this.position,this.grounded?oldY+p.stepHeight:oldY+.01,p.maxSlopeCos);this.supportHeight=contact.height;this.groundNormal.copy(contact.normal);
  if(this.velocity.y<=0&&this.position.y<=contact.height+1e-6){
   const landed=!this.grounded,impact=Math.max(0,-this.velocity.y),dy=oldY-this.position.y;
   const fraction=dy>EPS?Math.min(1,Math.max(0,(oldY-contact.height)/dy)):1;
   const contactTime=p.preset==='cs2'?time-dt+fraction*dt:time;
   this.position.y=contact.height;
   if(contact.walkable){this.velocity.y=0;this.grounded=true;
    if(landed){this.landedAt=contactTime;this.hops.landings++;this.hops.lastLandingInterval=Number.isFinite(this.lastLanding)?contactTime-this.lastLanding:null;this.lastLanding=contactTime;this.landingSpeed=Math.hypot(this.velocity.x,this.velocity.z);this.groundContact=0;this.landingImpact=impact;this.landingPenaltyPending=p.preset==='cs2';this.landingSerial++;this.lastLandingImpactSpeed=impact;this.lastLandingTime=contactTime;this.hopEvent('land',contactTime);
     const launchTime=Math.max(contactTime,this.jumps.requestedAt);if(this.launch(launchTime)&&time>launchTime){const remainder=time-launchTime;this.velocity.y-=p.gravity*remainder;this.position.y+=this.velocity.y*remainder+(p.verticalIntegration==='ballistic'?.5*p.gravity*remainder*remainder:0);}
    }
   }else{this.grounded=false;const normalSpeed=this.velocity.dot(contact.normal);if(normalSpeed<0)this.velocity.addScaledVector(contact.normal,-normalSpeed);}
  }else if(this.grounded){if(contact.walkable&&contact.height>=oldY-p.stepHeight&&contact.height<=oldY+p.stepHeight)this.position.y=contact.height;else this.grounded=false;}
  this.collision.resolveCeiling(this.position,this.velocity,oldY,this.bodyHeight(),p.radius);
  if(this.jumps.expire(time)){this.hops.missedInputs++;this.hopEvent('missed',time);}
  this.speed=Math.hypot(this.velocity.x,this.velocity.z);this.hops.peakSpeed=Math.max(this.hops.peakSpeed,this.speed);if(this.grounded)this.groundContact+=dt;
  this.acceleration.copy(this.velocity).sub(this.previousVelocity).multiplyScalar(1/dt);this.deceleration=Math.max(0,(this.previousSpeed-this.speed)/dt);
  const brakingPower=this.previousVelocity.x*this.acceleration.x+this.previousVelocity.z*this.acceleration.z;
  this.braking=wasGrounded&&this.grounded&&this.previousSpeed>.08&&this.previousSpeed-this.speed>.0001&&this.deceleration>.1&&brakingPower<-.01;
 }
 reset(position:Vec3={x:0,y:0,z:5},time=0,preserveHopStats=false){
  this.position.set(position.x,position.y,position.z);this.previous.copy(this.position);this.velocity.set(0,0,0);this.previousVelocity.set(0,0,0);this.acceleration.set(0,0,0);this.airAcceleration.set(0,0,0);this.desiredDirection.set(0,0,0);this.previousSpeed=0;this.speed=0;this.braking=false;this.deceleration=0;this.opposedInput=false;this.grounded=true;this.crouch=0;this.eyeHeight=this.previousEyeHeight=this.profile.standingEyeHeight;this.landedAt=-100;this.jumps.reset(time);this.lastTakeoff=this.lastLanding=-Infinity;this.takeoff=null;this.activeInput={walk:false,crouch:false};this.groundContact=0;this.landingSpeed=0;this.landingPenaltyPending=false;this.lastLandingImpactSpeed=0;this.lastLandingTime=-Infinity;this.lastTime=time;this.groundNormal.set(0,1,0);this.supportHeight=position.y;
  if(!preserveHopStats)this.hops={jumps:0,chainedJumps:0,missedInputs:0,landings:0,peakSpeed:0,lastLandingInterval:null,lastInputTimingMs:null,timingMean:0,timingM2:0,timingCount:0,speedPreservation:null,events:[]};
 }
 clearJumpInput(){this.jumps.clear();}
 capturePracticePose(map:string,yaw:number,pitch:number,time=this.lastTime):MovementPracticePose {
  return{schema:1,map,physicsVersion:MOVEMENT_PHYSICS_VERSION,profile:this.profile.id,preset:this.profile.preset,capturedAt:time,position:plain(this.position),velocity:plain(this.velocity),yaw,pitch,crouch:this.crouch,grounded:this.grounded,takeoff:this.takeoff?{...this.takeoff,position:plain(this.takeoff.position),velocity:plain(this.takeoff.velocity)}:null};
 }
 /** Repositions a practice attempt without awarding a landing or jump event.
  * Inputs and chain timing are cleared; real velocity and the original airborne
  * budget resume. The caller resets sound/braking encounter trackers separately. */
 restorePracticePose(pose:MovementPracticePose,currentMap:string,time=this.lastTime,bounds:readonly number[]=[-256,-256,512,512]):MovementPracticeRestore {
  const fail=(reason:string):MovementPracticeRestore=>({ok:false,reason}),p=this.profile;
  if(!pose||pose.schema!==1||pose.map!==currentMap||pose.physicsVersion!==MOVEMENT_PHYSICS_VERSION||pose.profile!==p.id||pose.preset!==p.preset)return fail('다른 맵·물리 버전의 위치는 복원할 수 없습니다.');
  const finiteVec=(v:Vec3)=>!!v&&[v.x,v.y,v.z].every(n=>Number.isFinite(n)&&Math.abs(n)<=1000);
  if(!finiteVec(pose.position)||!finiteVec(pose.velocity)||![pose.yaw,pose.pitch,pose.crouch,pose.capturedAt,time].every(Number.isFinite)||Math.abs(pose.yaw)>1e9||Math.abs(pose.pitch)>1.55||pose.crouch<0||pose.crouch>1||pose.capturedAt<0||time<0||typeof pose.grounded!=='boolean'||Math.hypot(pose.velocity.x,pose.velocity.z)>100||pose.velocity.y< -55||pose.velocity.y>Math.max(20,p.jumpImpulse))return fail('저장한 위치나 속도 값이 유효하지 않습니다.');
  if(bounds.length<4||!bounds.slice(0,4).every(Number.isFinite)||bounds[2]<=0||bounds[3]<=0)return fail('맵 경계를 확인하지 못했습니다.');
  const position=new Vector3(pose.position.x,pose.position.y,pose.position.z),radius=p.radius,bodyHeight=pose.crouch>.5?1.35:1.85;
  if(position.x-radius<bounds[0]||position.x+radius>bounds[0]+bounds[2]||position.z-radius<bounds[1]||position.z+radius>bounds[1]+bounds[3]||position.y<-.01||position.y>64)return fail('맵 경계 밖의 위치는 복원할 수 없습니다.');
  this.collision.obstacles=this.obstacles;const support=this.collision.support(position,position.y+.05,p.maxSlopeCos);
  if(pose.grounded){if(!support.walkable||Math.abs(position.y-support.height)>.05)return fail('발을 지지하는 바닥이 없는 위치입니다.');position.y=support.height;}
  else if(position.y<=support.height+1e-6)return fail('공중 위치가 지지면 안쪽에 있습니다.');
  if(!this.collision.canOccupy(position,bodyHeight,radius))return fail('벽이나 천장 안쪽의 위치는 복원할 수 없습니다.');
  const takeoff=pose.takeoff;
  if(!pose.grounded){
   if(!takeoff||!['jump','fall'].includes(takeoff.kind)||!finiteVec(takeoff.position)||!finiteVec(takeoff.velocity)||![takeoff.time,takeoff.horizontalSpeed,takeoff.weaponRunSpeed].every(Number.isFinite)||takeoff.horizontalSpeed<0||takeoff.horizontalSpeed>100||takeoff.weaponRunSpeed<=0||takeoff.weaponRunSpeed>20||takeoff.time>pose.capturedAt+1e-6||takeoff.speedCap!==null&&(!Number.isFinite(takeoff.speedCap)||takeoff.speedCap<0||takeoff.speedCap>100))return fail('공중 이륙 상태를 확인할 수 없습니다.');
   if(p.airModel==='tactical'){
    const cap=Math.min(takeoff.horizontalSpeed+(p.airTakeoffAllowance??.75),takeoff.weaponRunSpeed*(p.airWeaponRunFactor??1.05),p.hopSpeedCap??Infinity,p.airSpeedLimit??Infinity);
    if(takeoff.speedCap===null||takeoff.speedCap>cap+1e-6||Math.hypot(pose.velocity.x,pose.velocity.z)>takeoff.speedCap+1e-6)return fail('저장된 공중 속도 예산이 유효하지 않습니다.');
   }
  }
  const normal=support.normal.clone(),supportHeight=support.height;
  this.reset(position,time,true);this.crouch=pose.crouch;this.eyeHeight=this.previousEyeHeight=p.standingEyeHeight+(p.crouchingEyeHeight-p.standingEyeHeight)*pose.crouch;
  this.velocity.set(pose.velocity.x,pose.grounded?0:pose.velocity.y,pose.velocity.z);this.previousVelocity.copy(this.velocity);this.speed=this.previousSpeed=Math.hypot(this.velocity.x,this.velocity.z);this.grounded=pose.grounded;this.groundNormal.copy(normal);this.supportHeight=supportHeight;
  this.takeoff=!pose.grounded&&takeoff?{...takeoff,time:Math.max(0,time-(pose.capturedAt-takeoff.time)),position:plain(takeoff.position),velocity:plain(takeoff.velocity)}:null;
  this.activeInput={walk:false,crouch:pose.crouch>.5};return{ok:true,yaw:pose.yaw,pitch:pose.pitch};
 }
 hopSnapshot():HopSnapshot{const h=this.hops;return{jumps:h.jumps,chainedJumps:h.chainedJumps,missedInputs:h.missedInputs,landings:h.landings,peakSpeed:h.peakSpeed,lastLandingInterval:h.lastLandingInterval,lastInputTimingMs:h.lastInputTimingMs,timingMeanMs:h.timingCount?h.timingMean:null,timingDeviationMs:h.timingCount>1?Math.sqrt(h.timingM2/(h.timingCount-1)):null,groundContactSeconds:this.groundContact,speedPreservation:h.speedPreservation,events:h.events.map(e=>({...e,position:plain(e.position)}))};}
 physicsSnapshot(){const takeoff=this.takeoff?{...this.takeoff,position:plain(this.takeoff.position),velocity:plain(this.takeoff.velocity)}:null;const speed=Math.hypot(this.velocity.x,this.velocity.z),p=this.profile;return{takeoff,profile:p.id,label:p.label,preset:p.preset,horizontalSpeed:speed,verticalSpeed:this.velocity.y,velocity:plain(this.velocity),velocityDirection:{x:speed>EPS?this.velocity.x/speed:0,y:0,z:speed>EPS?this.velocity.z/speed:0},acceleration:plain(this.acceleration),airAcceleration:plain(this.airAcceleration),wishDirection:plain(this.desiredDirection),groundNormal:plain(this.groundNormal),supportHeight:this.supportHeight,grounded:this.grounded,lastJumpAt:Number.isFinite(this.lastTakeoff)?this.lastTakeoff:null,lastLandingAt:Number.isFinite(this.lastLanding)?this.lastLanding:null,jumpTimingMs:this.hops.lastInputTimingMs,chainedJumps:this.hops.chainedJumps,landingRetention:this.hops.speedPreservation,effectiveJumpBufferMs:this.buffer*1000,landingWindowMs:p.landingWindow*1000,jumpSpamBlockedUntil:Number.isFinite(this.jumps.blockedUntil)?this.jumps.blockedUntil:null};}
 estimateReadyTime(input:InputState,yaw:number,dt=1/120,threshold=this.profile.accuracyVelocityThreshold){
  if(!this.grounded)return null;const v=this.velocity.clone(),p=this.profile,modifier=(input.walk?p.walkModifier:1)*(1+(p.crouchModifier-1)*this.crouch)*(input.forward<0?p.backwardModifier:1)*(Math.abs(input.strafe)>0?p.lateralModifier:1)*this.speedModifier,wish=wishMovement(input.forward,input.strafe,yaw,p.maxSpeed,modifier);
  if(wish.amount&&wish.x*v.x+wish.z*v.z>=0&&this.speed>threshold)return null;
  for(let n=0;n<240;n++){if(Math.hypot(v.x,v.z)<=threshold)return n*dt;solveGroundMovement(v,wish,p,dt);}return null;
 }
}
