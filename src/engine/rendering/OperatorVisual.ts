import * as T from 'three';
import type {WeaponVisual} from './WeaponView';
import {mergeStaticArchitecture} from './StaticGeometry';
import {SurfaceMaterialLibrary,writeWorldScaleUV} from './SurfaceMaterials';
import {VISUAL_MATERIALS,type VisualMaterialId} from '../../config/materials';
export function createOperatorVisual(geometry:(g:T.BufferGeometry)=>T.BufferGeometry,material:(m:T.Material)=>T.Material,armsFactory:(p:T.Group,s:boolean,g:typeof geometry,m:typeof material,surfaces:SurfaceMaterialLibrary)=>{animate:(...args:number[])=>void;animateBolt?:(phase:number)=>void;dispose:()=>void},surfaceLibrary?:SurfaceMaterialLibrary):WeaponVisual{
 const surfaces=surfaceLibrary??new SurfaceMaterialLibrary();
 const root=new T.Group(),sights=new T.Group(),magazine=new T.Group(),cylinder=new T.Group(),hammer=new T.Group(),bolt=new T.Group();root.add(sights,magazine,cylinder,hammer,bolt);root.name='original VALOPRAC precision bolt rifle';bolt.name='articulated bolt assembly';
 const mat=(family:VisualMaterialId,color:number,roughness?:number,metalness?:number)=>material(surfaces.material(family,{tint:color,roughness,metalness})) as T.MeshStandardMaterial;
 const steel=mat('steel',0x43545c,.32),edge=mat('brushed-metal',0x869499,.28),polymer=mat('plastic',0x30444b,.85),rubber=mat('rubber',0x1c2c33,.96),glass=mat('glass',0x385d68,.2),accent=mat('painted-metal',0xa59575,.5,.5);
 const mesh=(g:T.BufferGeometry,m:T.Material,p:T.Group=root)=>{const family=m.userData.visualMaterialId as VisualMaterialId|undefined;if(family)writeWorldScaleUV(g,VISUAL_MATERIALS[family].metersPerTile);const o=new T.Mesh(geometry(g),m);p.add(o);return o;};
 const profile=(pts:[number,number][],w:number,m:T.Material,p:T.Group=root,holes:[number,number][][]=[])=>{const sh=new T.Shape();pts.forEach(([z,y],i)=>i?sh.lineTo(-z,y):sh.moveTo(-z,y));sh.closePath();for(const points of holes){const hole=new T.Path();points.forEach(([z,y],i)=>i?hole.lineTo(-z,y):hole.moveTo(-z,y));hole.closePath();sh.holes.push(hole);}const g=new T.ExtrudeGeometry(sh,{depth:w-.004,bevelEnabled:true,bevelSize:.002,bevelThickness:.002,bevelSegments:1,steps:1});g.translate(0,0,-(w-.004)/2);g.rotateY(Math.PI/2);return mesh(g,m,p);};
 const tube=(r:number,len:number,x:number,y:number,z:number,m:T.Material,p:T.Group=root,n=16)=>{const o=mesh(new T.CylinderGeometry(r,r,len,n),m,p);o.rotation.x=Math.PI/2;o.position.set(x,y,z);return o;};
 // Varying octagonal sections make a coherent machined action, with narrow
 // chamfered top shoulders instead of a broad flat extruded receiver slab.
 const receiverVertices:number[]=[],receiverIndices:number[]=[];
 for(const [z,width,top,bottom] of [[-.215,.043,.027,-.026],[-.14,.052,.036,-.033],[.105,.05,.036,-.034],[.158,.039,.018,-.028]]){
  const half=width/2,bevel=.006;for(const [x,y] of [[-half+bevel,top],[half-bevel,top],[half,top-bevel],[half,bottom+bevel],[half-bevel,bottom],[-half+bevel,bottom],[-half,bottom+bevel],[-half,top-bevel]])receiverVertices.push(x,y,z);
 }
 for(let section=0;section<3;section++)for(let side=0;side<8;side++){const a=section*8+side,b=section*8+(side+1)%8;receiverIndices.push(a,a+8,b,b,a+8,b+8);}
 for(let i=1;i<7;i++){receiverIndices.push(0,i,i+1);receiverIndices.push(24,25+i,24+i);}
 const action=new T.BufferGeometry();action.setAttribute('position',new T.Float32BufferAttribute(receiverVertices,3));action.setIndex(receiverIndices);const facetedAction=action.toNonIndexed();action.dispose();facetedAction.computeVertexNormals();mesh(facetedAction,steel).name='receiver';
 profile([[-.44,.009],[-.22,.024],[-.185,.008],[-.19,-.024],[-.39,-.022]],.043,polymer);
 tube(.0115,.4,0,.009,-.61,steel).name='barrel';tube(.016,.05,0,.009,-.824,rubber);tube(.009,.006,0,.009,-.852,edge);
 // Open chassis stock: the cheek rail and diagonal lower strut have a real
 // negative-space window, not a large opaque butt-side panel near the camera.
 profile([[.16,.02],[.318,.018],[.367,-.002],[.365,-.09],[.342,-.091],[.309,-.047],[.173,-.042]],.04,polymer,root,[[[.19,.003],[.307,.002],[.347,-.016],[.347,-.065],[.337,-.065],[.306,-.029],[.19,-.027]]]).name='stock';
 profile([[.349,.004],[.369,-.001],[.37,-.093],[.348,-.093]],.044,rubber);profile([[.07,-.03],[.112,-.035],[.145,-.131],[.126,-.147],[.087,-.137],[.059,-.071]],.037,polymer);
 magazine.position.set(0,-.06,-.01);profile([[-.054,.014],[.014,.014],[.015,-.095],[-.047,-.098]],.041,rubber,magazine);
 const guard=new T.CatmullRomCurve3([new T.Vector3(0,-.049,.063),new T.Vector3(0,-.09,.045),new T.Vector3(0,-.093,-.023),new T.Vector3(0,-.045,-.04)]);mesh(new T.TubeGeometry(guard,12,.003,6,false),steel);
 profile([[-.005,-.05],[.003,-.074],[.012,-.079],[.006,-.046]],.007,rubber);
 // A 34mm central tube, tapered objective and ocular transitions, low split
 // rings and recessed coated lenses replace the old stack of thick cylinders.
 const scopeY=.09,taper=(front:number,rear:number,length:number,z:number,m:T.Material)=>{const o=mesh(new T.CylinderGeometry(rear,front,length,24),m,sights);o.rotation.x=Math.PI/2;o.position.set(0,scopeY,z);return o;};
 tube(.017,.23,0,scopeY,-.04,steel,sights,24);taper(.032,.017,.08,-.205,polymer);tube(.032,.013,0,scopeY,-.251,rubber,sights,24);tube(.028,.004,0,scopeY,-.254,glass,sights,24);
 taper(.017,.023,.045,.08,steel);tube(.024,.035,0,scopeY,.12,rubber,sights,24);tube(.02,.004,0,scopeY,.132,glass,sights,24);
 for(const z of [-.12,.035]){tube(.0205,.011,0,scopeY,z,edge,sights,24);const mount=mesh(new T.BoxGeometry(.026,.033,.021),steel,sights);mount.position.set(0,.055,z);}
 const turret=mesh(new T.CylinderGeometry(.012,.012,.021,16),rubber,sights);turret.position.set(0,.115,-.025);const wind=mesh(new T.CylinderGeometry(.01,.01,.018,12),rubber,sights);wind.rotation.z=Math.PI/2;wind.position.set(.022,scopeY,-.025);
 tube(.014,.13,.027,.019,.044,edge,bolt);const handle=mesh(new T.CylinderGeometry(.006,.006,.05,10),steel,bolt);handle.rotation.z=-.7;handle.position.set(.056,-.002,.105);const knob=mesh(new T.SphereGeometry(.012,12,8),rubber,bolt);knob.position.set(.075,-.02,.105);
 const actionSlot=mesh(new T.BoxGeometry(.0016,.015,.095),rubber);actionSlot.position.set(.0254,.004,-.015);
 for(const x of [-.0262,.0262])for(const z of [-.105,.073]){const pin=mesh(new T.CylinderGeometry(.0025,.0025,.0016,8),edge);pin.rotation.z=Math.PI/2;pin.position.set(x,-.01,z);}
 for(const z of [-.39,-.34,-.29])for(const x of [-.022,.022]){const slot=mesh(new T.BoxGeometry(.002,.009,.024),rubber);slot.position.set(x,-.002,z);}
 const arms=armsFactory(root,false,geometry,material,surfaces);const muzzle=mesh(new T.ConeGeometry(.025,.12,6),material(new T.MeshBasicMaterial({color:0xffd1a3,transparent:true,opacity:.7,depthWrite:false})));muzzle.rotation.x=-Math.PI/2;muzzle.position.set(0,.009,-.9);muzzle.visible=false;muzzle.name='muzzle flash';
 // Keep the optic, detachable magazine and cycling bolt articulated. Every
 // other unlabelled detail can share one local-space submission per material.
 for(const parent of [root,sights,magazine,bolt]){
  const batches=new Map<T.Material,T.Mesh[]>();
  for(const child of parent.children){if(!(child instanceof T.Mesh)||child instanceof T.SkinnedMesh||child.name)continue;const surface=child.material;if(Array.isArray(surface)||!(surface instanceof T.MeshStandardMaterial))continue;const parts=batches.get(surface)??[];parts.push(child);batches.set(surface,parts);}
  for(const [surface,parts] of batches){if(parts.length<2)continue;const merged=mergeStaticArchitecture(parts,'local');if(!merged)continue;const batch=new T.Mesh(geometry(merged),surface);batch.name='batched static detail';parent.add(batch);for(const part of parts){parent.remove(part);part.geometry.dispose();}}
 }
 const smooth=(a:number,b:number,p:number)=>{const t=T.MathUtils.clamp((p-a)/(b-a),0,1);return t*t*(3-2*t);};
 return {root,sights,magazine,cylinder,hammer,muzzle,accent,animate:(...args)=>arms.animate(...args),animateBolt:(phase)=>{const p=T.MathUtils.clamp(phase,0,1),pull=smooth(.17,.42,p)*(1-smooth(.58,.85,p)),lift=smooth(.04,.17,p)*(1-smooth(.85,.98,p));bolt.position.z=pull*.075;bolt.rotation.z=lift*.6;arms.animateBolt?.(p);},dispose:()=>{arms.dispose();if(!surfaceLibrary)surfaces.dispose();}};
}
