import {VALORANT_AIR_STEERING,VALORANT_BUNNY_HOP} from '../../config/movement';
import type {Vector3} from 'three';
import type {MovementPhysicsProfile} from '../../config/movement';

export interface WishMovement {x:number;z:number;amount:number;speed:number;}
/** Camera pitch is deliberately absent: only the horizontal camera basis
 * affects a movement request. Fractional tick intent remains fractional. */
export function wishMovement(forward:number,side:number,yaw:number,maxSpeed:number,modifier:number):WishMovement{
 const length=Math.hypot(forward,side),amount=Math.min(1,length),normal=length>0?1/length:0;
 forward*=normal;side*=normal;const sin=Math.sin(yaw),cos=Math.cos(yaw);
 return{x:side*cos-forward*sin,z:-forward*cos-side*sin,amount,speed:maxSpeed*modifier*amount};
}
export function friction(v:Vector3,dt:number,coefficient:number,stopSpeed=0,constant=0){
 const speed=Math.hypot(v.x,v.z);if(speed<=1e-12)return;
 const next=Math.max(0,speed-(Math.max(speed,stopSpeed)*coefficient+constant)*dt);v.x*=next/speed;v.z*=next/speed;
}
export function solveGroundMovement(v:Vector3,w:WishMovement,p:MovementPhysicsProfile,dt:number){
 if(p.groundModel==='source'){
  // The trainer's walk/crouch modifiers reduce wish speed. Scale stop-speed
  // with that request so its minimum friction cannot overpower every legal
  // low-speed acceleration tick. Neutral braking keeps the full stop scale.
  const stopScale=w.amount>0?Math.min(1,w.speed/p.maxSpeed):1;
  friction(v,dt,p.friction,p.groundStopSpeed*stopScale);
  if(w.amount>0){const current=v.x*w.x+v.z*w.z,add=Math.min(p.groundAcceleration*w.speed*dt,Math.max(0,w.speed-current));v.x+=w.x*add;v.z+=w.z*add;const speed=Math.hypot(v.x,v.z);if(speed>w.speed&&current>=0){v.x*=w.speed/speed;v.z*=w.speed/speed;}}
  return;
 }
 if(w.amount<=0){friction(v,dt,p.friction,0,p.groundDeceleration);return;}
 // A short press within a tick receives only its fraction of the impulse.
 if(w.amount<1)friction(v,dt*(1-w.amount),p.friction,0,p.groundDeceleration);
 if(p.counterFriction!==undefined&&p.counterDeceleration!==undefined&&w.x*v.x+w.z*v.z<0){
  // reference-v11 counter-strafe: brake the current motion (fitted to Riot's
  // timings), then any part of the input across the old motion accelerates.
  const speed=Math.hypot(v.x,v.z),ux=v.x/speed,uz=v.z/speed;
  // braking-v12: counter-strafing never brakes less than releasing the key.
  const weaker=p.overMaxBraking&&p.friction*speed+p.groundDeceleration>p.counterFriction*speed+p.counterDeceleration;
  friction(v,dt*w.amount,weaker?p.friction:p.counterFriction,0,weaker?p.groundDeceleration:p.counterDeceleration);
  const across=w.x*(-uz)+w.z*ux;if(Math.abs(across)>1e-9){const add=Math.min(p.groundAcceleration*dt*w.amount*Math.abs(across),w.speed*Math.abs(across));v.x+=-uz*Math.sign(across)*add;v.z+=ux*Math.sign(across)*add;}
  return;
 }
 if(p.overMaxBraking){
  // braking-v12 (Unreal CalcVelocity): faster than the wished speed, brake as
  // when releasing the keys, never below that speed while still moving its way.
  const speed=Math.hypot(v.x,v.z);
  if(speed>w.speed+1e-9&&w.x*v.x+w.z*v.z>0){
   const ox=v.x/speed,oz=v.z/speed;friction(v,dt,p.friction,0,p.groundDeceleration);
   const braked=Math.hypot(v.x,v.z);
   if(braked<=w.speed){v.x=ox*w.speed;v.z=oz*w.speed;}
   else{
    // Still above the wished speed: input only turns the motion, clamped to
    // the current speed (Unreal clamps input acceleration to it).
    const nx=v.x+w.x*p.groundAcceleration*dt*w.amount,nz=v.z+w.z*p.groundAcceleration*dt*w.amount,length=Math.hypot(nx,nz);
    if(length>1e-12){v.x=nx/length*braked;v.z=nz/length*braked;}
    return;
   }
  }
 }
 const dot=w.x*v.x+w.z*v.z,acceleration=dot<0?p.reverseAcceleration:p.groundAcceleration,tx=w.x*w.speed-v.x,tz=w.z*w.speed-v.z,length=Math.hypot(tx,tz),amount=Math.min(length,acceleration*dt*w.amount);
 if(length>1e-12){v.x+=tx/length*amount;v.z+=tz/length*amount;}
}
/** Steer the existing horizontal momentum with a bounded lateral acceleration
 * expressed as a turn rate. Only the component along the velocity adds speed
 * or brakes. Thus a sideways input can curve a run at its speed cap. */
export function steerTacticalAir(v:Vector3,w:WishMovement,p:MovementPhysicsProfile,dt:number,out:Vector3,takeoffCap:number|null,diagonalStrafe=0,runSpeed=0,capScale=1){
 const beforeX=v.x,beforeZ=v.z,speed=Math.hypot(beforeX,beforeZ);
 // capScale (consistency-v9): the profile's rifle-based caps scale with the
 // takeoff weapon's run speed, so a faster weapon is not cut to rifle speed.
 const standardCap=Math.min(takeoffCap??Infinity,(p.airSpeedLimit??Infinity)*capScale,(p.hopSpeedCap??Infinity)*capScale);
 const cap=runSpeed>0?(takeoffCap??standardCap):standardCap;
 if(w.amount>0){
  const wishSpeed=Math.min(p.airMaxSpeed*w.amount,w.speed),impulse=p.airAcceleration*w.amount*dt;
  if(speed<1e-9){
   const next=Math.min(impulse,wishSpeed,cap);v.x=w.x*next;v.z=w.z*next;
  }else{
   const dot=(beforeX*w.x+beforeZ*w.z)/speed,cross=(beforeX*w.z-beforeZ*w.x)/speed;
   const reverse=dot<=Math.cos((p.reverseAirThresholdDegrees??150)*Math.PI/180)+1e-12;
   const response=reverse?(p.reverseAirSteeringMultiplier??.5):1;
   const projection=dot*speed;
   const throttle=Math.min(impulse*response,Math.max(0,wishSpeed-projection))*dot;
   // The small extra speed requires a forward diagonal cut into the
   // current heading. Steeper turns and straight travel receive no bonus.
   const gain=runSpeed*VALORANT_BUNNY_HOP.diagonalAcceleration*dt*Math.max(0,2*diagonalStrafe*cross*Math.max(0,dot));
   const ordinaryLimit=Math.min(standardCap,runSpeed*(p.airWeaponRunFactor??1.05));
   const ordinary=runSpeed>0?Math.min(throttle,Math.max(0,ordinaryLimit-speed)):throttle;
   const next=Math.min(cap,Math.max(0,speed+ordinary+gain));
   const angle=Math.atan2(cross,dot),limit=VALORANT_AIR_STEERING.maxTurnRate*w.amount*response*dt*Math.abs(cross);
   const turn=Math.sign(angle)*Math.min(limit,Math.abs(angle)),cos=Math.cos(turn),sin=Math.sin(turn);
   v.x=(beforeX*cos-beforeZ*sin)*(next/speed);v.z=(beforeX*sin+beforeZ*cos)*(next/speed);
  }
 }
 limitContactSpeed(v,cap);
 out.set((v.x-beforeX)/dt,0,(v.z-beforeZ)/dt);
}

/** A takeoff budget restricts tactical air steering only. Callers without a
 * takeoff (unit probes / ledge fallback) retain the profile's explicit cap. */
export function solveAirMovement(v:Vector3,w:WishMovement,p:MovementPhysicsProfile,dt:number,out:Vector3,airSpeedCap:number|null=null){
 const beforeX=v.x,beforeZ=v.z;
 if(w.amount>0){
  const current=v.x*w.x+v.z*w.z;
  // Wish speed already includes the fraction of a short input pulse. Respect
  // walk/crouch/weapon/ADS modifiers without multiplying that fraction twice.
  const limit=p.airModel==='projection'?Math.min(w.speed,p.airWishSpeedCap):Math.min(p.airMaxSpeed*w.amount,w.speed);
  const speed=Math.hypot(v.x,v.z),reverse=p.airModel==='tactical'&&speed>1e-9&&current/speed<=Math.cos((p.reverseAirThresholdDegrees??150)*Math.PI/180)+1e-12;
  const steering=reverse?(p.reverseAirSteeringMultiplier??.5):1;
  const requested=p.airModel==='projection'?p.airAcceleration*w.speed*dt:p.airAcceleration*w.amount*dt*steering;
  const add=Math.min(requested,Math.max(0,limit-current));v.x+=w.x*add;v.z+=w.z*add;
 }
 // Tactical air control has an explicit small horizontal allowance. Source
 // presets constrain contact/takeoff speed instead of rotating/clamping each
 // airborne velocity vector, retaining projection-based strafe behavior.
 if(p.airSpeedLimit!==null){const cap=Math.min(p.hopSpeedCap??p.airSpeedLimit,airSpeedCap??Infinity),speed=Math.hypot(v.x,v.z);if(speed>cap){v.x*=cap/speed;v.z*=cap/speed;}}
 out.set((v.x-beforeX)/dt,0,(v.z-beforeZ)/dt);
}
export function limitContactSpeed(v:Vector3,limit:number|null){const speed=Math.hypot(v.x,v.z);if(limit!==null&&speed>limit&&speed>0){v.x*=limit/speed;v.z*=limit/speed;}}
export function landingRetention(p:MovementPhysicsProfile,impactVelocity:number){return Math.max(.5,1-p.landingFriction-Math.max(0,impactVelocity)*p.landingImpactPenalty);}
