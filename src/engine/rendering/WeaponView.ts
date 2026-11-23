import * as T from 'three';
import type { WeaponId } from '../types';
export interface WeaponVisual {root:T.Group;sights:T.Group;magazine:T.Group;cylinder:T.Group;hammer:T.Group;muzzle:T.Mesh;accent:T.MeshStandardMaterial}
// Original model kit built from chamfered receivers, machined cylinders and layered panels.
export function createWeaponView(id:WeaponId,geometry:(g:T.BufferGeometry)=>T.BufferGeometry,material:(m:T.Material)=>T.Material):WeaponVisual{
  const root=new T.Group(),sights=new T.Group(),magazine=new T.Group(),cylinder=new T.Group(),hammer=new T.Group();
  const sheriff=id==='sheriff',phantom=id==='rifleB';
  const mat=(color:number,roughness:number,metalness:number)=>material(new T.MeshStandardMaterial({color,roughness,metalness})) as T.MeshStandardMaterial;
  const steel=mat(sheriff?0xdde7e9:phantom?0x243c54:0x20252e,0.28,0.72),dark=mat(0x0c131b,0.55,0.3),grip=mat(0x182228,0.9,0.05),trim=mat(sheriff?0x7192ae:phantom?0x7398cb:0xbba566,0.24,0.8);
  const accent=mat(sheriff?0x62caff:phantom?0x89baff:0xf0c977,0.24,0.5);accent.emissive.set(sheriff?0x168de3:phantom?0x174a85:0x5e3f0d);accent.emissiveIntensity=0.65;
  const box=(w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material,parent:T.Group=root)=>{
    const shape=new T.Shape();shape.moveTo(-w/2,-h/2);shape.lineTo(w/2,-h/2);shape.lineTo(w/2,h/2);shape.lineTo(-w/2,h/2);shape.closePath();
    const bevel=Math.min(w,h,d)*0.12;const g=geometry(new T.ExtrudeGeometry(shape,{depth:d-2*bevel,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:bevel,bevelThickness:bevel}));g.center();
    const mesh=new T.Mesh(g,m);mesh.position.set(x,y,z);mesh.castShadow=false;mesh.receiveShadow=false;parent.add(mesh);return mesh;
  };
  const tube=(radius:number,length:number,x:number,y:number,z:number,m:T.Material,parent:T.Group=root,segments=16)=>{const mesh=new T.Mesh(geometry(new T.CylinderGeometry(radius,radius,length,segments)),m);mesh.rotation.x=Math.PI/2;mesh.position.set(x,y,z);parent.add(mesh);return mesh;};
  root.add(magazine,cylinder,hammer,sights);
  if(sheriff){
    box(0.072,0.072,0.25,0,0.025,-0.12,steel);box(0.055,0.025,0.23,0,0.071,-0.13,dark);
    tube(0.024,0.26,0,0.015,-0.25,steel);tube(0.018,0.015,0,0.015,-0.39,dark);
    cylinder.position.set(0,-0.002,0.018);tube(0.049,0.092,0,0,0,steel,cylinder,24);
    for(let i=0;i<6;i++){const a=i*Math.PI/3;tube(0.01,0.095,Math.sin(a)*0.035,Math.cos(a)*0.035,0,dark,cylinder,8);tube(0.007,0.005,Math.sin(a)*0.035,Math.cos(a)*0.035,0.05,accent,cylinder,8);}
    const handle=box(0.066,0.15,0.075,0,-0.115,0.06,grip);handle.rotation.x=-0.24;box(0.071,0.024,0.079,0,-0.189,0.075,steel);
    box(0.016,0.031,0.035,0,0.064,0.082,dark,hammer);box(0.008,0.024,0.014,0,0.087,-0.23,accent);
    box(0.075,0.008,0.025,0,-0.061,-0.04,trim);box(0.008,0.063,0.025,-0.04,-0.03,-0.04,trim);box(0.008,0.063,0.025,0.04,-0.03,-0.04,trim);
  }else{
    box(0.08,0.086,0.27,0,0,0,steel);box(0.072,0.06,0.25,0,0,-0.25,steel);
    tube(phantom?0.033:0.019,phantom?0.21:0.22,0,0.008,-0.47,phantom?dark:steel);tube(phantom?0.024:0.012,0.016,0,0.008,-0.585,dark);
    box(0.074,0.014,0.44,0,0.055,-0.09,dark);
    for(let z=-0.3;z<0.15;z+=0.032)box(0.079,0.006,0.012,0,0.065,z,trim);
    box(0.077,0.095,0.19,0,-0.02,0.22,steel);box(0.095,0.12,0.024,0,-0.035,0.32,grip);
    const handle=box(0.06,0.12,0.066,0,-0.099,0.07,grip);handle.rotation.x=-0.28;
    magazine.position.set(0,-0.06,-0.01);const mag=box(0.058,0.14,0.082,0,-0.066,0,dark,magazine);mag.rotation.x=phantom?0:-0.15;box(0.064,0.017,0.091,0,-0.143,0.012,trim,magazine);
    box(0.015,0.022,0.035,-0.051,0.016,0.058,steel);box(0.012,0.023,0.034,0.046,0.02,-0.015,dark);
    for(const x of [-0.044,0.044]){box(0.008,0.025,0.13,x,0.009,-0.075,trim);for(let z=-0.32;z<-0.15;z+=0.035)box(0.006,0.012,0.02,x,0.015,z,dark);box(0.006,0.012,0.085,x,-0.015,-0.23,accent);}
    // Two slim open posts define the sight plane while the receiver stays below the aim line.
    for(const x of [-.045,.045]){box(.006,.032,.012,x,.144,-.34,dark,sights);box(.006,.026,.012,x,.147,.10,dark,sights);}
    for(const x of [-.045,.045])box(.006,.006,.012,x,.159,-.34,accent,sights);
  }
  // Original gloved support hand and sleeve; animation follows the weapon state.
  box(0.09,0.06,0.13,-0.025,-0.1,sheriff?0.08:-0.19,grip);const sleeve=box(0.11,0.08,0.2,-0.05,-0.16,sheriff?0.16:-0.08,mat(0x40566b,0.92,0));sleeve.rotation.x=-0.25;
  const flash=material(new T.MeshBasicMaterial({color:sheriff?0x9deaff:0xffdca1,transparent:true,opacity:0.72,depthWrite:false}));
  const muzzle=new T.Mesh(geometry(new T.ConeGeometry(0.025,sheriff?0.08:0.1,6)),flash);muzzle.rotation.x=-Math.PI/2;muzzle.position.set(0,sheriff?0.015:0.008,sheriff?-0.42:-0.62);muzzle.visible=false;root.add(muzzle);
  return {root,sights,magazine,cylinder,hammer,muzzle,accent};
}
