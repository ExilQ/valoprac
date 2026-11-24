import type {Vec3} from '../../engine/types';

/** Four-second tracks fit within the existing scenario byte and array limits.
 * Offsets are centimetres and crouch is an integer percentage. */
export const MOTION_HZ=10;
export const MOTION_MAX_SECONDS=4;
export const MOTION_MIN_SECONDS=1;
export const MOTION_MAX_POINTS=MOTION_MAX_SECONDS*MOTION_HZ+1;
export type MotionPoint=[x:number,y:number,z:number,crouch:number];
export interface RecordedMotion {
 source:'replay'|'authored';
 turns:0|1|2|3;
 mirror:boolean;
 points:MotionPoint[];
}
interface MotionPose extends Vec3 {crouch:number}

export function motionDuration(motion:RecordedMotion) {
 return (motion.points.length-1)/MOTION_HZ;
}
export function motionPoint(anchor:Vec3,motion:RecordedMotion,point:MotionPoint):MotionPose {
 const [x,y,z,crouch]=point,side=motion.mirror?-x:x;
 let dx=side,dz=z;
 switch(motion.turns){
  case 1:dx=-z;dz=side;break;
  case 2:dx=-side;dz=-z;break;
  case 3:dx=z;dz=-side;break;
 }
 return {x:anchor.x+dx/100,y:anchor.y+y/100,z:anchor.z+dz/100,crouch:crouch/100};
}
export function motionPose(anchor:Vec3,motion:RecordedMotion,seconds:number):MotionPose {
 const coordinate=Math.max(0,Math.min(motion.points.length-1,seconds*MOTION_HZ));
 const index=Math.floor(coordinate),fraction=coordinate-index;
 const a=motion.points[index],b=motion.points[Math.min(index+1,motion.points.length-1)];
 return motionPoint(anchor,motion,[
  a[0]+(b[0]-a[0])*fraction,a[1]+(b[1]-a[1])*fraction,a[2]+(b[2]-a[2])*fraction,a[3]+(b[3]-a[3])*fraction,
 ]);
}

export function withoutRecordedMotion<T extends {bots:{motion?:RecordedMotion}[]}>(scenario:T):T {
 return {...scenario,bots:scenario.bots.map(({motion,...bot})=>bot)};
}
