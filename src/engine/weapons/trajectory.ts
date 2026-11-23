import type {Vector3} from 'three';
const DEG=Math.PI/180;
// Spread values are half-cone angles in degrees, sampled uniformly on the tangent disc.
// Keep the camera/recoil center exact at every pitch, rather than adding Euler offsets.
export function spreadDirection(yaw:number,pitch:number,xDegrees:number,yDegrees:number,out:Vector3){
 const sy=Math.sin(yaw),cy=Math.cos(yaw),sp=Math.sin(pitch),cp=Math.cos(pitch),x=Math.tan(xDegrees*DEG),y=Math.tan(yDegrees*DEG);
 return out.set(-sy*cp+cy*x+sy*sp*y,sp+cp*y,-cy*cp-sy*x+cy*sp*y).normalize();
}
