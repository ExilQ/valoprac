import type {WeaponId} from '../types';
// A dedicated viewmodel camera keeps weapon projection stable during optical ADS.
export const VIEWMODEL_HFOV=72;
export const VIEWMODEL_ADS={x:0,y:-.16,z:-.80};
export function poseViewmodel(id:WeaponId,ads:number,kick:number,equip:number,reload:number,time:number,speed:number,swayX:number,swayY:number,out:{position:{set:(x:number,y:number,z:number)=>unknown};rotation:{set:(x:number,y:number,z:number)=>unknown}}){
 const b=id==='sheriff'?0:ads,lower=equip*equip*(3-2*equip);
 // Small pace-coupled motion, damped toward zero at the sight plane. Cosmetic only.
 const pace=time*(5+Math.min(speed,5)*1.25),bob=Math.sin(pace)*Math.min(.0035,speed*.0008)*(1-b);
 out.position.set(.225*(1-b)-swayX*.55*(1-b),-.22+.06*b-swayY*.55*(1-b)+bob-lower*.3,-.65-.15*b+kick*(id==='sheriff'?.068:.023));
 out.rotation.set(kick*(id==='sheriff'?.29:.03)*(1-b*.7)-reload*.17+lower*.65,0,-reload*.44);
}
