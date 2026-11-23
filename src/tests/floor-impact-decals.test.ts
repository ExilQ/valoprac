import {describe,it,expect,vi} from 'vitest';
import {BoxGeometry,Color,Matrix4,Mesh,MeshBasicMaterial,OctahedronGeometry,PerspectiveCamera,Scene,Vector3} from 'three';
import {floorImpactSurface,floorImpactSurfaceAt} from '../engine/collision/floorImpact';
import {RangeRenderer} from '../engine/rendering/RangeRenderer';
import {TrainingAudio} from '../engine/audio/Audio';
import {PEEK_ZONES} from '../engine/tactical/complex';
import {SURFACES,SURFACE_PARTICLE_PROFILES} from '../config/surfaces';

function renderer(quality='low'){
 const r=Object.create(RangeRenderer.prototype) as Record<string,any>;
 const debris={'wood-chips':new BoxGeometry(.012,.004,.024),'metal-sparks':new OctahedronGeometry(.009),'masonry-dust':new BoxGeometry(.01,.01,.01),'glass-shards':new BoxGeometry(.008,.015,.004)};
 Object.assign(r,{settings:{effectsQuality:quality},simulation:{time:2,practiceMap:'range',rules:'materials-v3',movement:{eyeHeight:1.6}},scene:new Scene(),geometries:new Set(),materials:new Set(),surfaceImpacts:[],impacts:[],tracers:[],surfaceImpactIndex:0,sparkIndex:0,tracerIndex:0,impactIndex:0,effectForward:new Vector3(0,0,1),effectNormal:new Vector3(),effectUp:new Vector3(0,1,0),decalsDirty:true,debrisGeometries:debris,camera:new PerspectiveCamera(),sparks:Array.from({length:32},()=>{const mesh=new Mesh(debris['metal-sparks'],new MeshBasicMaterial());mesh.visible=false;return{mesh,velocity:new Vector3(),until:0};})});
 r.buildImpacts();
 return{r,dispose(){r.decalBatch.dispose();for(const g of r.geometries)g.dispose();for(const m of r.materials)m.dispose();for(const p of r.sparks)p.mesh.material.dispose();for(const g of Object.values(debris))g.dispose();}};
}

describe('Structural floor effects select the authored finish without changing ballistics',()=>{
 it('keeps current range mat and surrounding concrete distinct, with legacy sound semantics',()=>{
  expect(floorImpactSurfaceAt('range',{x:0,y:0,z:5})).toBe('rubber');
  expect(floorImpactSurfaceAt('range',{x:12,y:0,z:5})).toBe('rawConcrete');
  expect(floorImpactSurfaceAt('range',{x:0,y:0,z:5},'legacy-v2')).toBe('concrete');
  expect(floorImpactSurfaceAt('tower',{x:0,y:0,z:0})).toBe('rawConcrete');
 });
 it('uses bay bounds rather than the legacy wider recognition strip or a neighboring elevated support',()=>{
  const wooden=PEEK_ZONES.find(z=>z.material==='wood')!,b=wooden.bounds!;
  expect(floorImpactSurfaceAt('complex',{x:wooden.center.x,y:0,z:wooden.center.z})).toBe('thickWood');
  expect(floorImpactSurfaceAt('complex',{x:wooden.center.x,y:0,z:Math.sign(wooden.center.z)*7.5})).toBe('rawConcrete');
  expect(floorImpactSurfaceAt('complex',{x:wooden.center.x,y:0,z:Math.sign(wooden.center.z)*7.5},'legacy-v2')).toBe('thickWood');
  // A floor impact is a point: the adjoining steel bay owns this side of the seam.
  expect(floorImpactSurfaceAt('complex',{x:b[0]-0.01,y:0,z:wooden.center.z})).toBe('steel');
  expect(floorImpactSurfaceAt('complex',{x:wooden.center.x,y:1.2,z:wooden.center.z})).toBeNull();
 });
 it('requires a real floor stop and rejects invalid coordinates without mutating the shot',()=>{
  const shot={hit:'wall' as const,penetrationStop:'floor' as const,impact:{x:0,y:0,z:5}},copy=structuredClone(shot);
  expect(floorImpactSurface('range',shot)).toBe('rubber');expect(shot).toEqual(copy);
  expect(floorImpactSurface('range',{...shot,hit:'miss'})).toBeNull();
  expect(floorImpactSurface('range',{...shot,penetrationStop:undefined})).toBeNull();
  for(const impact of [{x:NaN,y:0,z:5},{x:0,y:Infinity,z:5},{x:0,y:0,z:-Infinity},{x:0,y:.001,z:5}])expect(floorImpactSurface('range',{...shot,impact})).toBeNull();
 });
});

describe('Pooled decals submit one bounded instance batch',()=>{
 it('copies each visible marker transform and physical color without drawing hidden pool slots',()=>{
  const{r,dispose}=renderer();try{
   r.placeSurfaceImpact('thickWood',{x:1,y:0,z:2},{x:0,y:1,z:0},false,0,.008);
   r.placeSurfaceImpact('steel',{x:2,y:1,z:-4},{x:0,y:0,z:-1},true,.4);
   r.updateSurfaceDecals();expect(r.decalBatch.count).toBe(2);expect(r.scene.children.filter((o:{isInstancedMesh?:boolean})=>o.isInstancedMesh)).toHaveLength(1);
   expect(r.surfaceImpacts.every((m:Mesh)=>m.parent===null)).toBe(true);
   const actual=new Matrix4(),color=new Color();
   for(let i=0;i<2;i++){r.decalBatch.getMatrixAt(i,actual);for(let j=0;j<16;j++)expect(actual.elements[j]).toBeCloseTo(r.surfaceImpacts[i].matrix.elements[j],6);r.decalBatch.getColorAt(i,color);expect(color.r).toBeCloseTo(r.surfaceImpacts[i].material.color.r,6);expect(color.g).toBeCloseTo(r.surfaceImpacts[i].material.color.g,6);expect(color.b).toBeCloseTo(r.surfaceImpacts[i].material.color.b,6);}
   const version=r.decalBatch.instanceMatrix.version;r.updateSurfaceDecals();expect(r.decalBatch.instanceMatrix.version).toBe(version);
   r.surfaceImpacts.forEach((m:Mesh)=>m.visible=false);r.decalsDirty=true;r.updateSurfaceDecals();expect(r.decalBatch.count).toBe(0);
  }finally{dispose();}
 });
 it('reuses twelve low-preset slots after hundreds of impacts and compacts removed markers',()=>{
  const{r,dispose}=renderer();try{const first=r.surfaceImpacts[0];for(let i=0;i<500;i++)r.placeSurfaceImpact('concrete',{x:i,y:0,z:0},{x:0,y:1,z:0},false);r.updateSurfaceDecals();expect(r.surfaceImpacts[0]).toBe(first);expect(r.surfaceImpacts).toHaveLength(96);expect(r.decalBatch.count).toBe(12);expect(r.sparks.some((p:{mesh:Mesh})=>p.mesh.visible)).toBe(false);r.surfaceImpacts[1].visible=false;r.decalsDirty=true;r.updateSurfaceDecals();expect(r.decalBatch.count).toBe(11);}finally{dispose();}
 });
 it('does not add unrelated metal sparks over a material-specific floor impact',()=>{
  const{r,dispose}=renderer('high');try{const shot={weapon:'sheriff',hit:'wall',penetrationStop:'floor',impact:{x:0,y:0,z:5},position:{x:0,y:0,z:5},magazineShot:0};r.addShot(shot);const profile=SURFACE_PARTICLE_PROFILES[SURFACES.rubber.particleProfile],visible=r.sparks.filter((p:{mesh:Mesh})=>p.mesh.visible);expect(visible).toHaveLength(Math.min(profile.count,3));for(const p of visible){expect(p.mesh.geometry).toBe(r.debrisGeometries[SURFACES.rubber.particleProfile]);expect(p.mesh.material.color.getHex()).toBe(profile.color);}}finally{dispose();}
 });
});

describe('Floor sound uses the existing positional timestamped impact path',()=>{
 it('shares cached impact families and forwards emitter, timing and position without mutation',()=>{
  const audio=Object.create(TrainingAudio.prototype) as Record<string,any>,wood={},metal={};
  audio.buffers=new Map([['impact:wood:false',wood],['impact:metal:false',metal]]);audio.playBuffer=vi.fn();
  const point={x:1,y:0,z:2},copy={...point};audio.surfaceImpact('thinWood',point,3,.5,'enemy-floor:7');
  expect(audio.playBuffer).toHaveBeenLastCalledWith(wood,'feedback',3,.19,point,'enemy-floor:7');
  audio.surfaceImpact('thickWood',point,4);expect(audio.playBuffer).toHaveBeenLastCalledWith(wood,'feedback',4,.38,point,'player-floor-impact');
  audio.surfaceImpact('steel',point,5);expect(audio.playBuffer).toHaveBeenLastCalledWith(metal,'feedback',5,.38,point,'player-floor-impact');expect(point).toEqual(copy);
 });
});
