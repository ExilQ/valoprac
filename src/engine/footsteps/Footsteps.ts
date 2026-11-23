import {FOOTSTEP_BASELINE,type FootstepProfile} from '../../config/footsteps';
import type {FootstepSoundProfile,SurfaceId} from '../../config/surfaces';
export type FootstepMaterial=FootstepSoundProfile;
export const FOOTSTEP_MATERIALS:readonly FootstepMaterial[]=['concrete','steel','tile','wood'];
export interface FootstepEvent {id:number;timestamp:number;position:{x:number;y:number;z:number};radius:number;speed:number;material?:FootstepMaterial;surfaceId?:SurfaceId;}
export type FootstepState='stationary'|'walking'|'crouching'|'running'|'transition'|'slow'|'airborne'|'braking';
export interface FootstepMovement {previous:{x:number;y:number;z:number};position:{x:number;y:number;z:number};grounded:boolean;crouch:number;braking?:boolean;speed?:number;previousVelocity?:{x:number;z:number};velocity?:{x:number;z:number};acceleration?:{x:number;z:number};}
const EPS=1e-9;
export class Footsteps {
 footstepAccumulation=0;graceRemaining:number;stationaryTime=0;state:FootstepState='stationary';actualSpeed=0;lastAudibleAt=-100;totalEvents=0;eligibleDistance=0;
 recoveryRate=0;brakingRecoveryActive=false;recoveredByBraking=0;
 readonly journal:FootstepEvent[]=Array.from({length:64},()=>({id:0,timestamp:-100,position:{x:0,y:0,z:0},radius:0,speed:0}));
 onStep:((event:FootstepEvent)=>void)|null=null;
 private wasGrounded=true;private brakingUntil=-Infinity;private encounterStartEvent=0;
 constructor(public profile:FootstepProfile={...FOOTSTEP_BASELINE}){this.graceRemaining=profile.firstStepGraceDistance;}
 configure(profile:FootstepProfile){this.profile={...profile};this.footstepAccumulation=Math.min(this.footstepAccumulation,profile.threshold);this.graceRemaining=Math.min(this.graceRemaining,profile.firstStepGraceDistance);}
 // Called after collision resolution. Input selects labels/slow recovery, never distance or reset.
 step(m:FootstepMovement,walking:boolean,dt:number,time:number){
  if(!(dt>0)||!Number.isFinite(dt))return;
  const p=this.profile,dx=m.position.x-m.previous.x,dz=m.position.z-m.previous.z,distance=Math.hypot(dx,dz),speed=distance/dt;
  this.actualSpeed=speed;this.recoveryRate=0;this.brakingRecoveryActive=false;
  const oldSpeed=m.previousVelocity?Math.hypot(m.previousVelocity.x,m.previousVelocity.z):0,newSpeed=m.velocity?Math.hypot(m.velocity.x,m.velocity.z):speed;
  const power=m.previousVelocity&&m.acceleration?m.previousVelocity.x*m.acceleration.x+m.previousVelocity.z*m.acceleration.z:0;
  const actualBraking=m.braking===true&&oldSpeed>.08&&oldSpeed-newSpeed>.0001&&power<-.01;
  if(newSpeed>oldSpeed+.0001)this.brakingUntil=-Infinity;
  if(actualBraking&&speed<=p.audibleVelocity)this.brakingUntil=time+.12;
  const quiet=Math.max(speed,newSpeed)<=p.audibleVelocity,brakeWindow=quiet&&time<=this.brakingUntil+EPS;
  const quietFactor=Math.max(0,1-Math.max(speed,newSpeed)/Math.max(.001,p.audibleVelocity));
  const brakeRate=brakeWindow?(p.brakingDecay??1.4)*(.35+.65*quietFactor*quietFactor):0;
  const grounded=m.grounded&&this.wasGrounded;this.wasGrounded=m.grounded;
  if(!grounded){this.state='airborne';this.stationaryTime=0;this.brakingUntil=-Infinity;return;}
  if(speed<=p.stationaryVelocity){
   this.state='stationary';const previous=this.stationaryTime;this.stationaryTime+=dt;
   const decayTime=Math.max(0,this.stationaryTime-p.stationaryDelay)-Math.max(0,previous-p.stationaryDelay);
   const stationaryAmount=p.stationaryDecay*decayTime;
   if(brakeRate*dt>stationaryAmount){this.recoverBrake(brakeRate,dt);if(this.brakingRecoveryActive)this.state='braking';}
   else{this.footstepAccumulation=Math.max(0,this.footstepAccumulation-stationaryAmount);this.recoveryRate=dt>0?stationaryAmount/dt:0;}
   if(this.footstepAccumulation<EPS&&this.stationaryTime>=p.stationaryDelay){this.footstepAccumulation=0;this.graceRemaining=p.firstStepGraceDistance;}
   return;
  }
  this.stationaryTime=0;
  const eligible=speed>p.audibleVelocity;
  this.state=eligible?(walking||m.crouch>.5?'transition':'running'):m.crouch>.5?'crouching':walking?'walking':'slow';
  if(!eligible){
   if(walking||m.crouch>.5)this.footstepAccumulation=Math.max(0,Math.min(p.threshold,this.footstepAccumulation+distance*p.accumulationPerMeter*p.walkingAccumulationMultiplier-p.walkingDecay*dt));
   if(brakeRate>0){this.recoverBrake(brakeRate,dt);if(this.brakingRecoveryActive)this.state='braking';}
   return;
  }
  this.eligibleDistance+=distance;
  const grace=Math.min(distance,this.graceRemaining);this.graceRemaining-=grace;
  let remaining=distance-grace,travelled=grace;
  while(remaining>EPS){
   const needed=Math.max(0,(p.threshold-this.footstepAccumulation)/p.accumulationPerMeter);
   if(remaining+EPS<needed){this.footstepAccumulation+=remaining*p.accumulationPerMeter;break;}
   travelled+=needed;remaining=Math.max(0,remaining-needed);this.footstepAccumulation=0;
   const fraction=Math.min(1,travelled/distance),e=this.journal[this.totalEvents%this.journal.length];
   e.id=++this.totalEvents;e.timestamp=time-dt+dt*fraction;e.position.x=m.previous.x+dx*fraction;e.position.y=m.position.y;e.position.z=m.previous.z+dz*fraction;e.radius=p.hearingRadius;e.speed=speed;
   this.lastAudibleAt=e.timestamp;this.onStep?.(e);
  }
 }
 private recoverBrake(rate:number,dt:number){if(rate<=0)return;const before=this.footstepAccumulation;this.footstepAccumulation=Math.max(0,before-rate*dt);this.recoveredByBraking+=before-this.footstepAccumulation;this.recoveryRate=rate;this.brakingRecoveryActive=before>this.footstepAccumulation;}
 /** Start a new encounter without erasing the session's event counters. Old
  * sound rings are removed, and listeners remain attached to this instance. */
 resetEncounter(){this.footstepAccumulation=0;this.graceRemaining=this.profile.firstStepGraceDistance;this.stationaryTime=0;this.actualSpeed=0;this.state='stationary';this.recoveryRate=0;this.brakingRecoveryActive=false;this.brakingUntil=-Infinity;this.wasGrounded=true;this.lastAudibleAt=-100;this.encounterStartEvent=this.totalEvents;}
 get nextEligibleMeters(){return this.graceRemaining+Math.max(0,this.profile.threshold-this.footstepAccumulation)/this.profile.accumulationPerMeter;}
 recent(){return this.copyRecent(this.encounterStartEvent);}
 /** Session history is separate from the current life's audible indicators. */
 historyRecent(){return this.copyRecent(0);}
 private copyRecent(first:number){const n=Math.min(this.totalEvents,this.journal.length),result:FootstepEvent[]=[];for(let i=Math.max(first,this.totalEvents-n);i<this.totalEvents;i++){const e=this.journal[i%this.journal.length];if(e.id>0)result.push({...e,position:{...e.position}});}return result;}
}
