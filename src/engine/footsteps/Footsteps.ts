import {FOOTSTEP_BASELINE,type FootstepProfile} from '../../config/footsteps';
export type FootstepMaterial='concrete'|'steel'|'tile'|'wood';
export const FOOTSTEP_MATERIALS:readonly FootstepMaterial[]=['concrete','steel','tile','wood'];
export interface FootstepEvent {id:number;timestamp:number;position:{x:number;y:number;z:number};radius:number;speed:number;material?:FootstepMaterial;}
export type FootstepState='stationary'|'walking'|'crouching'|'running'|'transition'|'slow'|'airborne';
export interface FootstepMovement {previous:{x:number;y:number;z:number};position:{x:number;y:number;z:number};grounded:boolean;crouch:number;}
const EPS=1e-9;
export class Footsteps {
 footstepAccumulation=0;graceRemaining:number;stationaryTime=0;state:FootstepState='stationary';actualSpeed=0;lastAudibleAt=-100;totalEvents=0;eligibleDistance=0;
 readonly journal:FootstepEvent[]=Array.from({length:64},()=>({id:0,timestamp:-100,position:{x:0,y:0,z:0},radius:0,speed:0}));
 onStep:((event:FootstepEvent)=>void)|null=null;
 private wasGrounded=true;
 constructor(public profile:FootstepProfile={...FOOTSTEP_BASELINE}){this.graceRemaining=profile.firstStepGraceDistance;}
 configure(profile:FootstepProfile){this.profile={...profile};this.footstepAccumulation=Math.min(this.footstepAccumulation,profile.threshold);this.graceRemaining=Math.min(this.graceRemaining,profile.firstStepGraceDistance);}
 // Called after collision resolution. Input selects labels/slow recovery, never distance or reset.
 step(m:FootstepMovement,walking:boolean,dt:number,time:number){
  if(!(dt>0)||!Number.isFinite(dt))return;
  const p=this.profile,dx=m.position.x-m.previous.x,dz=m.position.z-m.previous.z,distance=Math.hypot(dx,dz),speed=distance/dt;
  this.actualSpeed=speed;
  const grounded=m.grounded&&this.wasGrounded;this.wasGrounded=m.grounded;
  if(!grounded){this.state='airborne';this.stationaryTime=0;return;}
  if(speed<=p.stationaryVelocity){
   this.state='stationary';const previous=this.stationaryTime;this.stationaryTime+=dt;
   const decayTime=Math.max(0,this.stationaryTime-p.stationaryDelay)-Math.max(0,previous-p.stationaryDelay);
   this.footstepAccumulation=Math.max(0,this.footstepAccumulation-p.stationaryDecay*decayTime);
   if(this.footstepAccumulation<EPS&&this.stationaryTime>=p.stationaryDelay){this.footstepAccumulation=0;this.graceRemaining=p.firstStepGraceDistance;}
   return;
  }
  this.stationaryTime=0;
  const eligible=speed>p.audibleVelocity;
  this.state=eligible?(walking||m.crouch>.5?'transition':'running'):m.crouch>.5?'crouching':walking?'walking':'slow';
  if(!eligible){
   if(walking||m.crouch>.5)this.footstepAccumulation=Math.max(0,Math.min(p.threshold,this.footstepAccumulation+distance*p.accumulationPerMeter*p.walkingAccumulationMultiplier-p.walkingDecay*dt));
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
 get nextEligibleMeters(){return this.graceRemaining+Math.max(0,this.profile.threshold-this.footstepAccumulation)/this.profile.accumulationPerMeter;}
 recent(){const n=Math.min(this.totalEvents,this.journal.length),result:FootstepEvent[]=[];for(let i=this.totalEvents-n;i<this.totalEvents;i++){const e=this.journal[i%this.journal.length];result.push({...e,position:{...e.position}});}return result;}
}
