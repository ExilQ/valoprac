import {describe,it,expect} from 'vitest';
import {BoxGeometry,CircleGeometry,IcosahedronGeometry,Mesh,MeshBasicMaterial,OctahedronGeometry,TetrahedronGeometry,Vector3} from 'three';
import {RangeRenderer} from '../engine/rendering/RangeRenderer';
import {SURFACES,SURFACE_PARTICLE_PROFILES,type SurfaceId} from '../config/surfaces';
import type {PenetrationSegment} from '../engine/collision/Ballistics';

function fixture(quality='high'){
 const geometries={'wood-chips':new BoxGeometry(.012,.004,.024),'metal-sparks':new OctahedronGeometry(.009),'masonry-dust':new IcosahedronGeometry(.01,0),'glass-shards':new TetrahedronGeometry(.014)};
 const r=Object.create(RangeRenderer.prototype) as Record<string,any>;
 Object.assign(r,{settings:{effectsQuality:quality},simulation:{time:2},surfaceImpactIndex:0,sparkIndex:0,surfaceImpacts:Array.from({length:96},()=>{const mesh=new Mesh(new CircleGeometry(.025,8),new MeshBasicMaterial());mesh.visible=false;return mesh;}),sparks:Array.from({length:32},()=>{const mesh=new Mesh(geometries['metal-sparks'],new MeshBasicMaterial());mesh.visible=false;return{mesh,velocity:new Vector3(),until:0};}),debrisGeometries:geometries,effectForward:new Vector3(0,0,1),effectNormal:new Vector3()});
 const apply=(segments:PenetrationSegment[])=>(r as any).penetrationEffects(segments);
 const dispose=()=>{for(const m of r.surfaceImpacts){m.geometry.dispose();m.material.dispose();}for(const p of r.sparks)p.mesh.material.dispose();for(const g of Object.values(geometries))g.dispose();};return{r,apply,dispose};
}
const segment=(material:SurfaceId,penetrated=false):PenetrationSegment=>({obstacle:0,material,entry:{x:2,y:1,z:-4},exit:{x:2,y:1,z:-4.4},entryNormal:{x:0,y:0,z:1},exitNormal:{x:0,y:0,z:-1},thickness:.4,resistance:1,cost:.4,damageBefore:1,damageAfter:.8,penetrated,inside:false});
describe('Physical surface events reach pooled renderer effects',()=>{
 it('selects four distinct debris shapes and material-dependent lifetimes',()=>{
  const selected=new Set<string>();for(const id of ['thinWood','thinMetal','concrete','glass'] as const){const{r,apply,dispose}=fixture();try{const s=segment(id),original=structuredClone(s);apply([s]);const p=r.sparks[0],profile=SURFACE_PARTICLE_PROFILES[SURFACES[id].particleProfile];expect(p.mesh.visible).toBe(true);expect(p.until).toBe(2+profile.lifetime);expect(p.mesh.material.color.getHex()).toBe(profile.color);expect(r.surfaceImpacts[0].material.color.getHex()).toBe(profile.decalColor);selected.add(p.mesh.geometry.type);expect(s).toEqual(original);}finally{dispose();}}
  expect(selected.size).toBe(4);
 });
 it('puts entry and exit decals on their own outward-facing planes',()=>{const{r,apply,dispose}=fixture();try{apply([segment('glass',true)]);expect(r.surfaceImpacts[0].position.z).toBeCloseTo(-3.996,10);expect(r.surfaceImpacts[1].position.z).toBeCloseTo(-4.404,10);expect(new Vector3(0,0,1).applyQuaternion(r.surfaceImpacts[1].quaternion).z).toBeCloseTo(-1,10);}finally{dispose();}});
 it('emits effects only at real authored boundaries of a partitioned trace',()=>{
  const{r,apply,dispose}=fixture();try{
   apply([{...segment('thinWood',true),entrySurface:false,exitSurface:false}]);expect(r.surfaceImpactIndex).toBe(0);expect(r.sparks.some((p:{mesh:Mesh})=>p.mesh.visible)).toBe(false);
   apply([{...segment('glass',true),entrySurface:false}]);expect(r.surfaceImpactIndex).toBe(1);expect(r.surfaceImpacts[0].position.z).toBeCloseTo(-4.404,10);
   apply([{...segment('concrete',true),exitSurface:false}]);expect(r.surfaceImpactIndex).toBe(2);expect(r.surfaceImpacts[1].position.z).toBeCloseTo(-3.996,10);
  }finally{dispose();}
 });
 it('keeps low effects bounded to twelve reusable decals without particles',()=>{const{r,apply,dispose}=fixture('low');try{const first=r.surfaceImpacts[0],s=segment('thinMetal');for(let i=0;i<100;i++)apply([s]);expect(r.surfaceImpacts).toHaveLength(96);expect(r.surfaceImpacts[0]).toBe(first);expect(r.surfaceImpacts.filter((x:Mesh)=>x.visible)).toHaveLength(12);expect(r.sparks.filter((x:{mesh:Mesh})=>x.mesh.visible)).toHaveLength(0);expect(r.sparks).toHaveLength(32);}finally{dispose();}});
});
