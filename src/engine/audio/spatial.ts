import type {Vec3} from '../types';
export interface ListenerPose {position:Vec3;yaw:number;pitch:number;}
/** SI world coordinates share the camera's -Z forward convention. The fallback
 * remains deterministic when a browser exposes stereo panning but no HRTF node. */
export function spatialCue(source:Vec3,listener:ListenerPose){
 const dx=source.x-listener.position.x,dy=source.y-listener.position.y,dz=source.z-listener.position.z;
 const distance=Math.hypot(dx,dy,dz),right=dx*Math.cos(listener.yaw)-dz*Math.sin(listener.yaw);
 return{distance,pan:distance>1e-8?Math.max(-1,Math.min(1,right/distance)):0,gain:9/Math.max(9,distance)};
}
export function listenerForward(yaw:number,pitch=0):Vec3{return{x:-Math.sin(yaw)*Math.cos(pitch),y:Math.sin(pitch),z:-Math.cos(yaw)*Math.cos(pitch)};}
