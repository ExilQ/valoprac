import {Vector3} from 'three';
import type {Settings,WeaponId} from '../types';
import {SeededRandom} from '../simulation/random';

const RAD=Math.PI/180;
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
export const wrapAngle=(angle:number)=>Math.atan2(Math.sin(angle),Math.cos(angle));
export type DefenderSkill='beginner'|'normal'|'advanced'|'expert';
/** F4 report targets, deliberately separate from official game or human data.
 * Only an expert whose current physical crosshair already covers the newly
 * observed angle uses this shorter response; large corrections keep the normal
 * expert reaction and acceleration-limited acquisition. */
export const HELD_ANGLE_TIMING_CALIBRATION={
 id:'f4-expert-held-angle-v1',classification:'provisional-calibration',
 source:'VALOPRAC improvement report, 2026-10-29, F4',
 maximumAngleDegrees:3,reactionMultiplier:.49,minimumReactionSeconds:.125
} as const;
export const BOT_SKILL_PROFILES={
 beginner:{label:'입문',reaction:1.25,speed:.65,acceleration:.65,error:1.65,trackingDelay:.22,acquisition:.24,compensation:.66,tactics:.65},
 normal:{label:'보통',reaction:.72,speed:1,acceleration:1,error:1,trackingDelay:.14,acquisition:.18,compensation:1,tactics:1},
 advanced:{label:'고급',reaction:.62,speed:1.2,acceleration:1.2,error:.72,trackingDelay:.1,acquisition:.15,compensation:1.18,tactics:1.2},
 expert:{label:'전문',reaction:.55,speed:1.4,acceleration:1.35,error:.5,trackingDelay:.075,acquisition:.13,compensation:1.38,tactics:1.4}
} as const;
export interface BotControlProfile {
 skill:DefenderSkill;reaction:number;recognition:number;acquisition:number;trackingDelay:number;
 heldReaction:number|null;heldAngle:number;
 maxSpeed:number;maxAcceleration:number;initialError:number;motorNoise:number;
 compensationDelay:number;compensationGain:number;compensationSpeed:number;tactics:number;
}
type ControlSettings=Settings&Partial<{defenderSkill:DefenderSkill;defenderAimSpeed:number;defenderAimAcceleration:number;defenderStability:number;defenderFirstShotError:number;defenderRecoilControl:number;defenderTactics:number;}>;
/** Provisional training controls, not measured rank or human physiology data.
 * Accuracy changes continuous error amplitudes; it never rolls a hit chance. */
export function resolveBotProfile(settings:Settings,weapon:WeaponId):BotControlProfile{
 const s=settings as ControlSettings,skill=s.defenderSkill??(s.botDifficulty==='easy'?'beginner':s.botDifficulty==='hard'?'advanced':'normal'),p=BOT_SKILL_PROFILES[skill]??BOT_SKILL_PROFILES.normal;
 const familiarity=weapon==='operator'?.9:weapon==='sheriff'?.94:1;
 return {skill,reaction:Math.max(.15,clamp(s.defenderReaction??.42,.15,1.5)*p.reaction),recognition:.035,acquisition:p.acquisition,trackingDelay:p.trackingDelay,
  heldReaction:skill==='expert'?Math.max(HELD_ANGLE_TIMING_CALIBRATION.minimumReactionSeconds,clamp(s.defenderReaction??.42,.15,1.5)*HELD_ANGLE_TIMING_CALIBRATION.reactionMultiplier):null,
  heldAngle:HELD_ANGLE_TIMING_CALIBRATION.maximumAngleDegrees*RAD,
  maxSpeed:clamp(s.defenderAimSpeed??180,30,480)*p.speed*RAD,maxAcceleration:clamp(s.defenderAimAcceleration??1200,120,5000)*p.acceleration*RAD,
  initialError:clamp(s.defenderFirstShotError??.8,.12,4)*p.error*(1.1-.4*clamp(s.defenderAccuracy,.1,.98))*RAD,
  motorNoise:(.025+.14*(1-clamp(s.defenderStability??.7,.05,.98)))*p.error*RAD,
  compensationDelay:clamp(.18-(s.defenderRecoilControl??.6)*.08,.07,.2)/Math.sqrt(p.compensation),
  compensationGain:clamp((s.defenderRecoilControl??.6)*p.compensation*familiarity,.08,.9),
  compensationSpeed:clamp(8+(s.defenderRecoilControl??.6)*14,8,24)*p.compensation*RAD,
  tactics:clamp((s.defenderTactics??.55)*p.tactics,.08,.96)};
}
export interface AimMotorSnapshot {yaw:number;pitch:number;desiredYaw:number;desiredPitch:number;yawVelocity:number;pitchVelocity:number;angularSpeed:number;angularAcceleration:number;initialError:number;correction:number;compensationPitch:number;compensationYaw:number;}

/** Acceleration-limited angular controller. Correlated bounded variation is
 * refreshed on a simulation-time schedule and smoothly followed, not rerolled
 * independently for each bullet or each render frame. */
export class BotAimMotor {
 yaw:number;pitch=0;yawVelocity=0;pitchVelocity=0;desiredYaw:number;desiredPitch=0;
 compensationPitch=0;compensationYaw=0;angularSpeed=0;angularAcceleration=0;peakSpeed=0;peakAcceleration=0;
 private initialYaw=0;private initialPitch=0;private began=-100;private nextNoise=0;
 private noiseYaw=0;private noisePitch=0;private noiseGoalYaw=0;private noiseGoalPitch=0;
 constructor(yaw:number,private rng:SeededRandom){this.yaw=wrapAngle(yaw);this.desiredYaw=this.yaw;}
 begin(time:number,profile:BotControlProfile){this.began=time;this.initialYaw=this.rng.range(-1,1)*profile.initialError;this.initialPitch=this.rng.range(-.7,.7)*profile.initialError;}
 step(dt:number,time:number,yaw:number,pitch:number,profile:BotControlProfile,spray=0){
  if(!(dt>0))return;
  if(time-this.nextNoise>.32)this.nextNoise=time;
  while(time+1e-9>=this.nextNoise){this.nextNoise+=.16;const amplitude=profile.motorNoise*(1+Math.min(2,Math.max(0,spray))*.65);this.noiseGoalYaw=this.rng.range(-1,1)*amplitude;this.noiseGoalPitch=this.rng.range(-1,1)*amplitude;}
  const smoothing=1-Math.exp(-dt*9);this.noiseYaw+=(this.noiseGoalYaw-this.noiseYaw)*smoothing;this.noisePitch+=(this.noiseGoalPitch-this.noisePitch)*smoothing;
  const initialDecay=Math.exp(-Math.max(0,time-this.began-.32)*7);
  this.desiredYaw=wrapAngle(yaw+this.initialYaw*initialDecay+this.noiseYaw);this.desiredPitch=clamp(pitch+this.initialPitch*initialDecay+this.noisePitch,-1.45,1.45);
  const x=wrapAngle(this.desiredYaw-this.yaw),y=this.desiredPitch-this.pitch,error=Math.hypot(x,y),speed=Math.min(profile.maxSpeed,Math.sqrt(2*profile.maxAcceleration*error),error*12);
  const vx=error>1e-10?x/error*speed:0,vy=error>1e-10?y/error*speed:0,ax=vx-this.yawVelocity,ay=vy-this.pitchVelocity,change=Math.hypot(ax,ay),amount=Math.min(change,profile.maxAcceleration*dt),oldX=this.yawVelocity,oldY=this.pitchVelocity;
  if(change>1e-10){this.yawVelocity+=ax/change*amount;this.pitchVelocity+=ay/change*amount;}
  const velocity=Math.hypot(this.yawVelocity,this.pitchVelocity);if(velocity>profile.maxSpeed){this.yawVelocity*=profile.maxSpeed/velocity;this.pitchVelocity*=profile.maxSpeed/velocity;}
  this.yaw=wrapAngle(this.yaw+this.yawVelocity*dt);this.pitch=clamp(this.pitch+this.pitchVelocity*dt,-1.45,1.45);
  this.angularSpeed=Math.hypot(this.yawVelocity,this.pitchVelocity);this.angularAcceleration=Math.hypot(this.yawVelocity-oldX,this.pitchVelocity-oldY)/dt;
  this.peakSpeed=Math.max(this.peakSpeed,this.angularSpeed);this.peakAcceleration=Math.max(this.peakAcceleration,this.angularAcceleration);
 }
 compensate(dt:number,estimatedPitch:number,estimatedYaw:number,profile:BotControlProfile){
  const x=-estimatedYaw*RAD*profile.compensationGain-this.compensationYaw,y=-estimatedPitch*RAD*profile.compensationGain-this.compensationPitch,length=Math.hypot(x,y),step=Math.min(length,profile.compensationSpeed*dt);
  if(length>1e-10){this.compensationYaw+=x/length*step;this.compensationPitch+=y/length*step;}
 }
 error(yaw:number,pitch:number){return Math.hypot(wrapAngle(yaw-this.yaw),pitch-this.pitch);}
 direction(out:Vector3,recoilPitch=0,recoilYaw=0){const y=this.yaw+this.compensationYaw+recoilYaw*RAD,p=this.pitch+this.compensationPitch+recoilPitch*RAD;return out.set(-Math.sin(y)*Math.cos(p),Math.sin(p),-Math.cos(y)*Math.cos(p));}
 snapshot():AimMotorSnapshot{return{yaw:this.yaw,pitch:this.pitch,desiredYaw:this.desiredYaw,desiredPitch:this.desiredPitch,yawVelocity:this.yawVelocity,pitchVelocity:this.pitchVelocity,angularSpeed:this.angularSpeed,angularAcceleration:this.angularAcceleration,initialError:Math.hypot(this.initialYaw,this.initialPitch),correction:Math.hypot(wrapAngle(this.desiredYaw-this.yaw),this.desiredPitch-this.pitch),compensationPitch:this.compensationPitch,compensationYaw:this.compensationYaw};}
}
