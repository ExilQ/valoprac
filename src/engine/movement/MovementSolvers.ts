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
 const dot=w.x*v.x+w.z*v.z,acceleration=dot<0?p.reverseAcceleration:p.groundAcceleration,tx=w.x*w.speed-v.x,tz=w.z*w.speed-v.z,length=Math.hypot(tx,tz),amount=Math.min(length,acceleration*dt*w.amount);
 if(length>1e-12){v.x+=tx/length*amount;v.z+=tz/length*amount;}
}
export function solveAirMovement(v:Vector3,w:WishMovement,p:MovementPhysicsProfile,dt:number,out:Vector3){
 const beforeX=v.x,beforeZ=v.z;
 if(w.amount>0){
  const current=v.x*w.x+v.z*w.z;
  // Wish speed already includes the fraction of a short input pulse. Respect
  // walk/crouch/weapon/ADS modifiers without multiplying that fraction twice.
  const limit=p.airModel==='projection'?Math.min(w.speed,p.airWishSpeedCap):Math.min(p.airMaxSpeed*w.amount,w.speed);
  const requested=p.airModel==='projection'?p.airAcceleration*w.speed*dt:p.airAcceleration*w.amount*dt;
  const add=Math.min(requested,Math.max(0,limit-current));v.x+=w.x*add;v.z+=w.z*add;
 }
 // Tactical air control has an explicit small horizontal allowance. Source
 // presets constrain contact/takeoff speed instead of rotating/clamping each
 // airborne velocity vector, retaining projection-based strafe behavior.
 if(p.airSpeedLimit!==null){const cap=p.hopSpeedCap??p.airSpeedLimit,speed=Math.hypot(v.x,v.z);if(speed>cap){v.x*=cap/speed;v.z*=cap/speed;}}
 out.set((v.x-beforeX)/dt,0,(v.z-beforeZ)/dt);
}
export function limitContactSpeed(v:Vector3,limit:number|null){const speed=Math.hypot(v.x,v.z);if(limit!==null&&speed>limit&&speed>0){v.x*=limit/speed;v.z*=limit/speed;}}
export function landingRetention(p:MovementPhysicsProfile,impactVelocity:number){return Math.max(.5,1-p.landingFriction-Math.max(0,impactVelocity)*p.landingImpactPenalty);}
