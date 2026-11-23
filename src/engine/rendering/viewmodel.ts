import type {WeaponId} from '../types';
// Fixed horizontal projection isolates weapon presentation from optical gameplay magnification.
// Original compact open posts; no center mask or opaque scope. Distances in meters.
export const VIEWMODEL_HFOV=72;
export const VIEWMODEL_ADS={x:0,y:-.16,z:-.80};
export function poseViewmodel(id:WeaponId,ads:number,kick:number,equip:number,reload:number,time:number,speed:number,swayX:number,swayY:number,out:{position:{set:(x:number,y:number,z:number)=>unknown};rotation:{set:(x:number,y:number,z:number)=>unknown}}){
 const b=id==='sheriff'?0:ads,bob=Math.sin(time*10)*Math.min(.006,speed*.0015)*(1-b);
 out.position.set(.24*(1-b)-swayX*(1-b),-.22+.06*b-swayY*(1-b)+bob-equip*.35,-.65-.15*b+kick*(id==='sheriff'?.075:.025));
 out.rotation.set(kick*(id==='sheriff'?.35:.035)*(1-b*.7)-reload*.2+equip*.7,0,-reload*.55);
}
