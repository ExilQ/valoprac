import type {WeaponId} from '../types';
// A dedicated viewmodel camera keeps weapon projection stable during optical ADS.
export const VIEWMODEL_HFOV=72;
export const VIEWMODEL_ADS={x:0,y:-.16,z:-.80};
/** Knife arm placement (fist centre at rest) in the viewmodel camera. */
export const KNIFE_VIEW_ROOT={x:.17,y:-.15,z:-.46} as const;
export function poseViewmodel(id:WeaponId,ads:number,kick:number,equip:number,reload:number,time:number,speed:number,swayX:number,swayY:number,out:{position:{set:(x:number,y:number,z:number)=>unknown};rotation:{set:(x:number,y:number,z:number)=>unknown}}){
 const b=id==='sheriff'?0:ads,lower=equip*equip*(3-2*equip);
 // Small pace-coupled motion, damped toward zero at the sight plane. Cosmetic only.
 const pace=time*(5+Math.min(speed,5)*1.25),bob=Math.sin(pace)*Math.min(.0035,speed*.0008)*(1-b);
 if(id==='knife'){
  // Held low and to the right so the blade never crosses the crosshair at
  // rest. The draw motion and run pumping live in KnifeView.animate.
  out.position.set(KNIFE_VIEW_ROOT.x-swayX*.6,KNIFE_VIEW_ROOT.y-swayY*.6,KNIFE_VIEW_ROOT.z);
  out.rotation.set(0,0,0);return;
 }
 if(id==='operator'){
  // The long precision rifle is shouldered farther from the projection plane.
  // Its stock stays outside the camera near field without scaling the mesh or
  // changing the gameplay camera, zoom, trajectory or authored hand anatomy.
  out.position.set(.215*(1-b)-swayX*.45*(1-b),-.23+.055*b-swayY*.45*(1-b)+bob-lower*.3,-.86-.08*b+kick*.028);
  out.rotation.set(kick*.044-reload*.15+lower*.65,0,-reload*.35);return;
 }
 out.position.set(.225*(1-b)-swayX*.55*(1-b),-.22+.06*b-swayY*.55*(1-b)+bob-lower*.3,-.65-.15*b+kick*(id==='sheriff'?.068:.023));
 out.rotation.set(kick*(id==='sheriff'?.29:.03)*(1-b*.7)-reload*.17+lower*.65,0,-reload*.44);
}
