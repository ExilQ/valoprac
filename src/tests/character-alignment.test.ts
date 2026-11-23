import {describe,it,expect} from 'vitest';
import {BufferGeometry,FrontSide,Matrix4,Mesh,MeshBasicMaterial,Ray,Raycaster,Vector3,type Intersection} from 'three';
import {PREVIOUS_FIELD_GEOMETRY} from '../engine/targets/characterProfile';
import {Target} from '../engine/targets/Target';
import {SeededRandom} from '../engine/simulation/random';
import {characterPartGeometry,characterPartSourceGeometry,type CharacterHitRegion} from '../engine/rendering/CharacterGeometry';
import {characterPartShape} from '../engine/targets/CharacterShape';

/** Reference uses Three.Mesh.raycast on the independent renderer-owned clones,
 * not the optimized shooting BVH or old analytic hitbox primitives. */
function visualReference(target:Target){
 const material=new MeshBasicMaterial({side:FrontSide}),geometries:BufferGeometry[]=[],meshes:Mesh[]=[];
 for(const [i,p] of target.parts.entries()){
  const geometry=characterPartGeometry(i,target.characterGeometry),mesh=new Mesh(geometry,material);geometries.push(geometry);mesh.matrixAutoUpdate=false;mesh.matrixWorld.copy(p.node.matrixWorld).scale(p.size);meshes.push(mesh);
 }
 const caster=new Raycaster(),hits:Intersection[]=[];
 return{meshes,cast(ray:Ray){caster.set(ray.origin,ray.direction);hits.length=0;caster.intersectObjects(meshes,false,hits);if(!hits.length)return null;const hit=hits[0],regions=hit.object instanceof Mesh?hit.object.geometry.userData.hitRegions as CharacterHitRegion[]:[];const vertex=hit.faceIndex!*3,region=regions.find(r=>vertex>=r.start&&vertex<r.start+r.count)!;return{distance:hit.distance,point:hit.point,zone:region.zone};},dispose(){for(const g of geometries)g.dispose();material.dispose();}};
}
const output=new Vector3();
function equalHit(target:Target,reference:ReturnType<typeof visualReference>,ray:Ray,label:string){
 const expected=reference.cast(ray),actual=target.intersect(ray,output);
 expect(!!actual,label).toBe(!!expected);if(expected&&actual){expect(actual.zone,label).toBe(expected.zone);expect(actual.distance,label).toBeCloseTo(expected.distance,6);expect(output.distanceTo(expected.point),label).toBeLessThan(1e-6);}return actual?.zone??'miss';
}

describe('Rendered target surfaces are the authoritative shooting surfaces',()=>{
 it('uses the exact same finite canonical vertices for rendering and cached collision, with explicit neck/body classification',()=>{
  for(let i=0;i<11;i++){
   const render=characterPartGeometry(i),source=characterPartSourceGeometry(i),shape=characterPartShape(i);
   try{expect(render).not.toBe(source);expect(shape.geometry).toBe(source);expect(Array.from(render.getAttribute('position').array)).toEqual(Array.from(source.getAttribute('position').array));expect(render.index?.array).toEqual(source.index?.array);expect(shape.bounds.isEmpty()).toBe(false);for(const n of source.getAttribute('position').array)expect(Number.isFinite(n)).toBe(true);}finally{render.dispose();}
  }
  const helmets=characterPartSourceGeometry(0);
  const finish=helmets.getAttribute('characterFinish');
  let minRoughness=1,maxRoughness=0;
  for(let i=0;i<finish.count;i++){minRoughness=Math.min(minRoughness,finish.getX(i));maxRoughness=Math.max(maxRoughness,finish.getX(i));}
  expect(finish.normalized).toBe(true);
  expect(minRoughness).toBeLessThan(.30);
  expect(maxRoughness).toBeGreaterThan(.75);
  expect((helmets.userData.hitRegions as CharacterHitRegion[]).map(r=>r.zone)).toContain('torso');
 });

 it('has no front/side/diagonal silhouette false positives or false negatives while standing, crouching, strafing, rotated or scaled',()=>{
  let samples=0,hits=0;
  for(const pose of[{time:0,crouch:0,speed:0,yaw:0,scale:1},{time:.31,crouch:0,speed:5.4,yaw:0,scale:1},{time:.7,crouch:1,speed:0,yaw:0,scale:1},{time:.4,crouch:.5,speed:3,yaw:Math.PI/2,scale:1},{time:.5,crouch:0,speed:5,yaw:Math.PI/4,scale:.5},{time:.7,crouch:1,speed:0,yaw:-Math.PI/4,scale:2}]){
   const t=new Target(0,'stationary',new SeededRandom(1));t.scale=pose.scale;t.spawn(0,0,0);t.crouch=pose.crouch;t.velocity.x=pose.speed;t.updatePose(pose.time);t.root.rotation.y=pose.yaw;t.root.updateMatrixWorld(true);const reference=visualReference(t);
   try{for(let y=.025;y<1.95;y+=.03)for(let x=-.47;x<.48;x+=.03){const ray=new Ray(new Vector3(x*pose.scale,y*pose.scale,4*pose.scale),new Vector3(0,0,-1));const zone=equalHit(t,reference,ray,JSON.stringify({pose,x,y}));samples++;if(zone!=='miss')hits++;}}finally{reference.dispose();}
  }
  expect(hits).toBeGreaterThan(1000);console.info(JSON.stringify({benchmark:'target-visual-alignment',method:'Independent Three.Mesh.raycast versus shared-surface shooting BVH',sampledRays:samples,visibleSurfaceHits:hits,falsePositive:0,falseNegative:0,poses:['standing','strafe','crouch','rotation90','rotation45-scale0.5','rotation-45-scale2']}));
 },20000);

 it('matches the exact visible head silhouette at 5mm sample spacing from front and side',()=>{
  const t=new Target(0,'stationary',new SeededRandom(1));t.spawn(0,0,0);const reference=visualReference(t);let head=0,empty=0;
  try{for(const side of[false,true])for(let y=1.46;y<1.88;y+=.005)for(let x=-.185;x<.186;x+=.005){const ray=side?new Ray(new Vector3(4,y,x),new Vector3(-1,0,0)):new Ray(new Vector3(x,y,4),new Vector3(0,0,-1));const hit=equalHit(t,reference,ray,`${side?'side':'front'} ${x},${y}`);if(hit==='head')head++;if(hit==='miss')empty++;}expect(head).toBeGreaterThan(3000);expect(empty).toBeGreaterThan(1000);}finally{reference.dispose();}
 },20000);

 it('rejects the historical invisible head margin and admits the visible neck and glove tips',()=>{
  const t=new Target(0,'stationary',new SeededRandom(1));t.spawn(0,0,0);
  const front=(x:number,y:number)=>t.intersect(new Ray(new Vector3(x,y,4),new Vector3(0,0,-1)),output)?.zone??'miss';
  expect(front(.16,1.68)).toBe('miss');expect(front(-.16,1.68)).toBe('miss');expect(front(0,1.68)).toBe('head');expect(front(0,1.48)).toBe('torso');// Each flexed wrist raises the glove to a different height.
  expect(front(-.289,.755)).toBe('arm');expect(front(.289,.775)).toBe('arm');
  const previous=new Target(0,'stationary',new SeededRandom(1),PREVIOUS_FIELD_GEOMETRY);previous.spawn(0,0,0);
  for(const x of [-.289,.289]){
   const ray=new Ray(new Vector3(x,.72,4),new Vector3(0,0,-1));
   expect(previous.intersect(ray,output)?.zone).toBe('arm');
   expect(t.intersect(ray,output)).toBeNull();
  }
 });

 it('keeps repeated exact-surface casting finite with a shared bounded hierarchy',()=>{
  const target=new Target(0,'stationary',new SeededRandom(1));target.spawn(0,0,0);const reference=visualReference(target);
  const rays=Array.from({length:40},(_,i)=>new Ray(new Vector3((i%8-3.5)*.06,.73+Math.floor(i/8)*.24,4),new Vector3(0,0,-1)));
  const expected=rays.map(ray=>reference.cast(ray)?.zone??'miss');reference.dispose();let hits=0;
  const start=performance.now();for(let i=0;i<20000;i++){const result=target.intersect(rays[i%rays.length],output);expect(result?.zone??'miss').toBe(expected[i%rays.length]);if(result){hits++;expect(Number.isFinite(result.distance)).toBe(true);}}
  const elapsed=performance.now()-start,shapes=target.parts.map((_,i)=>characterPartShape(i));
  expect(hits).toBeGreaterThan(1000);console.info(JSON.stringify({benchmark:'target-surface-cpu',casts:20000,triangles:shapes.reduce((n,s)=>n+s.triangleCount,0),bvhNodes:shapes.reduce((n,s)=>n+s.bvhNodes,0),elapsedMilliseconds:elapsed,meanMicroseconds:elapsed*1000/20000,gpuTested:false,inputLatencyMeasured:false}));
 },15000);

 it('accepts completed-render model matrices without reading a later rig transform',()=>{
  const t=new Target(0,'stationary',new SeededRandom(1));t.spawn(0,0,0);const captured=t.parts.map(p=>p.node.matrixWorld.clone().scale(p.size)),ray=new Ray(new Vector3(0,1.68,4),new Vector3(0,0,-1));
  const before=t.intersect(ray,new Vector3())!;const distance=before.distance;t.position.x=1;t.updatePose(1);expect(t.intersect(ray,new Vector3())).toBeNull();expect(t.intersect(ray,new Vector3(),captured)?.zone).toBe('head');expect(t.intersect(ray,new Vector3(),captured)?.distance).toBeCloseTo(distance,7);expect(captured.every(m=>m instanceof Matrix4)).toBe(true);
 });
});
