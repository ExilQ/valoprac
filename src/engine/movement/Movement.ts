import {Vector3} from 'three';
import {MOVEMENT,type MovementProfile} from '../../config/movement';
import type {InputState,Vec3} from '../types';
import {ENVIRONMENT,surfaceHeight,type Obstacle} from '../collision/environment';

export interface HopEvent {kind:'jump'|'chain'|'land'|'missed';time:number;speed:number;inputTimingMs:number|null;groundContactSeconds:number;position:Vec3;}
export interface HopSnapshot {jumps:number;chainedJumps:number;missedInputs:number;landings:number;peakSpeed:number;lastLandingInterval:number|null;lastInputTimingMs:number|null;timingMeanMs:number|null;timingDeviationMs:number|null;groundContactSeconds:number;speedPreservation:number|null;events:HopEvent[];}
const EPS=1e-9;
export class Movement {
 position=new Vector3(0,0,5);previous=new Vector3(0,0,5);velocity=new Vector3();
 previousVelocity=new Vector3();acceleration=new Vector3();desiredDirection=new Vector3();previousSpeed=0;braking=false;deceleration=0;opposedInput=false;
 speedModifier=1;grounded=true;crouch=0;eyeHeight=1.64;previousEyeHeight=1.64;speed=0;landedAt=-100;
 private jumpUntil=-Infinity;private jumpAt=-Infinity;private nextJumpAt=-Infinity;private jumpSignalLast=false;private lastTakeoff=-Infinity;private lastLanding=-Infinity;private landingSpeed=0;private groundContact=0;
 private hops={jumps:0,chainedJumps:0,missedInputs:0,landings:0,peakSpeed:0,lastLandingInterval:null as number|null,lastInputTimingMs:null as number|null,timingMean:0,timingM2:0,timingCount:0,speedPreservation:null as number|null,events:[] as HopEvent[]};
 constructor(public profile:MovementProfile={...MOVEMENT},public obstacles:Obstacle[]=ENVIRONMENT){}
 get accurate(){return this.grounded&&this.speed<=this.profile.accuracyVelocityThreshold;}
 private get buffer(){return Math.max(0,Math.min(.14,this.profile.jumpBufferSeconds??.08));}
 private bodyHeight(){return this.crouch>.5?1.35:1.85;}
 private support(x:number,z:number,maxY:number){let y=0;for(const o of this.obstacles){const b=o.box;if(x>=b.min.x&&x<=b.max.x&&z>=b.min.z&&z<=b.max.z){const h=surfaceHeight(o,x,z);if(h<=maxY+1e-6&&h>y)y=h;}}return y;}
 private canStand(){for(const o of this.obstacles){if(o.ramp)continue;const b=o.box;if(this.position.x+this.profile.radius>b.min.x&&this.position.x-this.profile.radius<b.max.x&&this.position.z+this.profile.radius>b.min.z&&this.position.z-this.profile.radius<b.max.z&&this.position.y+1.35<=b.min.y+EPS&&this.position.y+1.85>b.min.y)return false;}return true;}
 private hopEvent(kind:HopEvent['kind'],time:number,timing:number|null=null){const events=this.hops.events;events.push({kind,time,speed:Math.hypot(this.velocity.x,this.velocity.z),inputTimingMs:timing,groundContactSeconds:this.groundContact,position:{x:this.position.x,y:this.position.y,z:this.position.z}});if(events.length>64)events.shift();}
 private launch(time:number){
  if(!this.grounded||this.jumpUntil<time-EPS||time<this.nextJumpAt-EPS)return false;
  const chain=Number.isFinite(this.lastTakeoff)&&time-this.lastLanding<=this.buffer+1e-7,timing=Number.isFinite(this.lastLanding)?(this.jumpAt-this.lastLanding)*1000:null;
  this.velocity.y=this.profile.jumpImpulse;this.grounded=false;this.nextJumpAt=time+Math.max(0,this.profile.jumpCooldown??.08);this.lastTakeoff=time;this.jumpUntil=-Infinity;
  this.hops.jumps++;if(chain){this.hops.chainedJumps++;this.hops.lastInputTimingMs=timing;this.hops.speedPreservation=this.landingSpeed>1e-6?Math.hypot(this.velocity.x,this.velocity.z)/this.landingSpeed:null;if(timing!==null){const h=this.hops;h.timingCount++;const delta=timing-h.timingMean;h.timingMean+=delta/h.timingCount;h.timingM2+=delta*(timing-h.timingMean);}}
  this.hopEvent(chain?'chain':'jump',time,chain?timing:null);this.groundContact=0;return true;
 }
 step(input:InputState,yaw:number,dt:number,time:number){
  if(!(dt>0)||!Number.isFinite(dt)||!Number.isFinite(time))return;
  const p=this.profile;this.previous.copy(this.position);this.previousEyeHeight=this.eyeHeight;this.previousVelocity.copy(this.velocity);this.previousSpeed=Math.hypot(this.velocity.x,this.velocity.z);const wasGrounded=this.grounded;
  const jumpInput=input as InputState&{jumpHeld?:boolean;jumpPresses?:number};
  // BrowserInput supplies a press counter, while the boolean edge supports
  // deterministic callers. Holding a key is never a new landing request.
  const pressed=(jumpInput.jumpPresses??0)>0||input.jump&&!this.jumpSignalLast;this.jumpSignalLast=!!input.jump;
  if(pressed){this.jumpAt=time;this.jumpUntil=time+this.buffer;}
  if(this.jumpUntil<time-EPS&&Number.isFinite(this.jumpUntil)){this.hops.missedInputs++;this.hopEvent('missed',time);this.jumpUntil=-Infinity;}
  let crouchTarget=input.crouch?1:0;if(!crouchTarget&&this.crouch>.5&&!this.canStand())crouchTarget=1;
  this.crouch+=Math.sign(crouchTarget-this.crouch)*Math.min(Math.abs(crouchTarget-this.crouch),dt*8);this.eyeHeight=p.standingEyeHeight+(p.crouchingEyeHeight-p.standingEyeHeight)*this.crouch;
  let forward=input.forward,side=input.strafe;const len=Math.hypot(forward,side);if(len>1){forward/=len;side/=len;}
  const sin=Math.sin(yaw),cos=Math.cos(yaw),dx=side*cos-forward*sin,dz=-forward*cos-side*sin;this.desiredDirection.set(dx,0,dz);this.opposedInput=len>0&&dx*this.previousVelocity.x+dz*this.previousVelocity.z<-.05;
  const modifier=(input.walk?p.walkModifier:1)*(1+(p.crouchModifier-1)*this.crouch)*(forward<0?p.backwardModifier:1)*(Math.abs(side)>0?p.lateralModifier:1),targetSpeed=p.maxSpeed*modifier*this.speedModifier;
  const supportBefore=this.support(this.position.x,this.position.z,this.position.y+.01);if(this.grounded&&this.position.y-supportBefore>.08)this.grounded=false;
  // A buffered jump consumes ground contact before ground friction, preserving
  // actual incoming momentum rather than applying an automatic speed impulse.
  this.launch(time);
  if(this.grounded){
   if(len>0){const dot=dx*this.velocity.x+dz*this.velocity.z,acceleration=dot<0?p.reverseAcceleration:p.groundAcceleration,tx=dx*targetSpeed-this.velocity.x,tz=dz*targetSpeed-this.velocity.z,delta=Math.hypot(tx,tz),amount=Math.min(delta,acceleration*dt);if(delta>1e-9){this.velocity.x+=tx/delta*amount;this.velocity.z+=tz/delta*amount;}}
   else{const speed=Math.hypot(this.velocity.x,this.velocity.z),next=Math.max(0,speed-(p.groundDeceleration+p.friction*speed)*dt);if(speed>0){this.velocity.x*=next/speed;this.velocity.z*=next/speed;}}
  }else if(len>0){
   // Acceleration is bounded along the requested air direction. Turning the
   // camera cannot instantly rotate the existing horizontal velocity vector.
   const along=this.velocity.x*dx+this.velocity.z*dz,add=Math.min(p.airAcceleration*dt,Math.max(0,p.airMaxSpeed-along));this.velocity.x+=dx*add;this.velocity.z+=dz*add;
  }
  if(!this.grounded){const speed=Math.hypot(this.velocity.x,this.velocity.z),cap=Math.max(.1,p.hopSpeedCap??p.airMaxSpeed);if(speed>cap){this.velocity.x*=cap/speed;this.velocity.z*=cap/speed;}}
  if(!this.grounded)this.velocity.y-=p.gravity*dt;
  // Fixed-step displacement is subdivided for edited high-speed profiles.
  const steps=Math.max(1,Math.ceil(Math.max(Math.abs(this.velocity.x),Math.abs(this.velocity.z))*dt/(p.radius*.5)));
  for(let i=0;i<steps;i++){this.position.x+=this.velocity.x*dt/steps;this.resolve('x');this.position.z+=this.velocity.z*dt/steps;this.resolve('z');}
  const oldY=this.position.y;this.position.y+=this.velocity.y*dt;const floor=this.support(this.position.x,this.position.z,this.grounded?oldY+.3:oldY+.01);
  if(this.velocity.y<=0&&this.position.y<=floor+1e-6){
   const landed=!this.grounded;this.position.y=floor;this.velocity.y=0;this.grounded=true;
   if(landed){this.landedAt=time;this.hops.landings++;this.hops.lastLandingInterval=Number.isFinite(this.lastLanding)?time-this.lastLanding:null;this.lastLanding=time;this.landingSpeed=Math.hypot(this.velocity.x,this.velocity.z);this.groundContact=0;this.hopEvent('land',time);this.launch(time);}
  }else if(this.grounded){if(floor>=oldY-.3&&floor<=oldY+.3)this.position.y=floor;else this.grounded=false;}
  if(this.velocity.y>0){const height=this.bodyHeight();for(const o of this.obstacles){if(o.ramp)continue;const b=o.box,top=this.position.y+height;if(this.position.x+p.radius>b.min.x&&this.position.x-p.radius<b.max.x&&this.position.z+p.radius>b.min.z&&this.position.z-p.radius<b.max.z&&oldY+height<=b.min.y+EPS&&top>=b.min.y){this.position.y=b.min.y-height;this.velocity.y=0;}}}
  this.speed=Math.hypot(this.velocity.x,this.velocity.z);this.hops.peakSpeed=Math.max(this.hops.peakSpeed,this.speed);if(this.grounded)this.groundContact+=dt;
  this.acceleration.copy(this.velocity).sub(this.previousVelocity).multiplyScalar(1/dt);this.deceleration=Math.max(0,(this.previousSpeed-this.speed)/dt);
  const brakingPower=this.previousVelocity.x*this.acceleration.x+this.previousVelocity.z*this.acceleration.z;
  this.braking=wasGrounded&&this.grounded&&this.previousSpeed>.08&&this.previousSpeed-this.speed>.0001&&this.deceleration>.1&&brakingPower<-.01;
 }
 private resolve(axis:'x'|'z'){
  const other=axis==='x'?'z':'x',p=this.profile,bodyTop=this.position.y+this.bodyHeight();
  for(const o of this.obstacles){const {box}=o,stepTop=surfaceHeight(o,this.position.x,this.position.z);if(this.grounded&&stepTop<=this.position.y+.3)continue;if(o.ramp&&this.position.y>=stepTop-.3)continue;if(bodyTop<=box.min.y||this.position.y>=box.max.y)continue;
   if(this.position[other]+p.radius>box.min[other]&&this.position[other]-p.radius<box.max[other]&&this.position[axis]+p.radius>box.min[axis]&&this.position[axis]-p.radius<box.max[axis]){if(this.velocity[axis]>0)this.position[axis]=box.min[axis]-p.radius;else if(this.velocity[axis]<0)this.position[axis]=box.max[axis]+p.radius;this.velocity[axis]=0;}
  }
 }
 reset(position:Vec3={x:0,y:0,z:5},time=0,preserveHopStats=false){
  this.position.set(position.x,position.y,position.z);this.previous.copy(this.position);this.velocity.set(0,0,0);this.previousVelocity.set(0,0,0);this.acceleration.set(0,0,0);this.desiredDirection.set(0,0,0);this.previousSpeed=0;this.speed=0;this.braking=false;this.deceleration=0;this.opposedInput=false;this.grounded=true;this.crouch=0;this.eyeHeight=this.previousEyeHeight=this.profile.standingEyeHeight;this.landedAt=-100;this.jumpUntil=this.jumpAt=this.lastTakeoff=this.lastLanding=-Infinity;this.nextJumpAt=time;this.jumpSignalLast=false;this.groundContact=0;this.landingSpeed=0;
  if(!preserveHopStats)this.hops={jumps:0,chainedJumps:0,missedInputs:0,landings:0,peakSpeed:0,lastLandingInterval:null,lastInputTimingMs:null,timingMean:0,timingM2:0,timingCount:0,speedPreservation:null,events:[]};
 }
 clearJumpInput(){this.jumpUntil=this.jumpAt=-Infinity;this.jumpSignalLast=false;}
 hopSnapshot():HopSnapshot{const h=this.hops;return{jumps:h.jumps,chainedJumps:h.chainedJumps,missedInputs:h.missedInputs,landings:h.landings,peakSpeed:h.peakSpeed,lastLandingInterval:h.lastLandingInterval,lastInputTimingMs:h.lastInputTimingMs,timingMeanMs:h.timingCount?h.timingMean:null,timingDeviationMs:h.timingCount>1?Math.sqrt(h.timingM2/(h.timingCount-1)):null,groundContactSeconds:this.groundContact,speedPreservation:h.speedPreservation,events:h.events.map(e=>({...e,position:{...e.position}}))};}
 estimateReadyTime(input:InputState,yaw:number,dt=1/120,threshold=this.profile.accuracyVelocityThreshold){
  if(!this.grounded)return null;let x=this.velocity.x,z=this.velocity.z;const length=Math.hypot(input.forward,input.strafe);let dx=0,dz=0;
  if(length){const forward=input.forward/Math.max(1,length),side=input.strafe/Math.max(1,length);dx=side*Math.cos(yaw)-forward*Math.sin(yaw);dz=-forward*Math.cos(yaw)-side*Math.sin(yaw);}if(length&&dx*x+dz*z>=0&&this.speed>threshold)return null;
  for(let n=0;n<240;n++){const speed=Math.hypot(x,z);if(speed<=threshold)return n*dt;if(!length){const next=Math.max(0,speed-(this.profile.groundDeceleration+this.profile.friction*speed)*dt);x*=next/speed;z*=next/speed;}else{x+=dx*this.profile.reverseAcceleration*dt;z+=dz*this.profile.reverseAcceleration*dt;}}return null;
 }
}
