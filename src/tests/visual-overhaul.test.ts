import {describe,it,expect} from 'vitest';
import {Box3,BufferGeometry,Material,Mesh,SkinnedMesh,Vector3,Raycaster,Ray,PerspectiveCamera} from 'three';
import {createWeaponView} from '../engine/rendering/WeaponView';
import {poseViewmodel,VIEWMODEL_HFOV} from '../engine/rendering/viewmodel';
import {characterPartGeometry} from '../engine/rendering/CharacterGeometry';
import {Target} from '../engine/targets/Target';
import {SeededRandom} from '../engine/simulation/random';
import type {WeaponId} from '../engine/types';

function weapon(id:WeaponId){
 const geometries=new Set<BufferGeometry>(),materials=new Set<Material>();
 const visual=createWeaponView(id,g=>{geometries.add(g);return g;},m=>{materials.add(m);return m;});
 return {visual,geometries,materials,dispose(){visual.root.traverse(o=>{if(o instanceof SkinnedMesh)o.skeleton.dispose();});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();}};
}
const bounds=(mesh:Mesh)=>{mesh.geometry.computeBoundingBox();return mesh.geometry.boundingBox!.getSize(new Vector3());};

describe('Authored viewmodels: proportions, rig safety and resource ownership (CPU checks)',()=>{
 for(const id of ['rifleA','rifleB','sheriff'] as const)it(`${id}: finite authored geometry with completely registered render resources`,()=>{
  const w=weapon(id);let meshCount=0,skinnedCount=0;
  try{
   w.visual.root.traverse(o=>{
    if(!(o instanceof Mesh))return;meshCount++;expect(w.geometries.has(o.geometry)).toBe(true);
    for(const m of Array.isArray(o.material)?o.material:[o.material])expect(w.materials.has(m)).toBe(true);
    const positions=o.geometry.getAttribute('position');expect(positions.count).toBeGreaterThan(0);
    for(const value of positions.array)expect(Number.isFinite(value)).toBe(true);
    if(o instanceof SkinnedMesh){
     skinnedCount++;expect(o.skeleton.bones.length).toBeGreaterThanOrEqual(13);
     expect(o.geometry.groups).toHaveLength(2);
     expect(o.geometry.groups[0].start).toBe(0);
     expect(o.geometry.groups[0].start+o.geometry.groups[0].count).toBe(o.geometry.groups[1].start);
     expect(o.geometry.groups.reduce((sum:number,group:{count:number})=>sum+group.count,0)).toBe(o.geometry.index!.count);
     const weights=o.geometry.getAttribute('skinWeight'),indices=o.geometry.getAttribute('skinIndex');
     expect(weights.count).toBe(positions.count);expect(indices.count).toBe(positions.count);
     for(let i=0;i<weights.count;i++){
      expect(weights.getX(i)+weights.getY(i)+weights.getZ(i)+weights.getW(i)).toBeCloseTo(1,6);
      expect(indices.getX(i)).toBeLessThan(o.skeleton.bones.length);
     }
    }
   });
   expect(meshCount).toBeGreaterThan(10);expect(meshCount).toBeLessThanOrEqual(24);expect(skinnedCount).toBe(2);
   const receiver=w.visual.root.getObjectByName('receiver') as Mesh,barrel=w.visual.root.getObjectByName('barrel') as Mesh;
   expect(receiver).toBeInstanceOf(Mesh);expect(barrel).toBeInstanceOf(Mesh);
   const r=bounds(receiver);expect(r.x).toBeLessThan(.07);expect(r.z/r.x).toBeGreaterThan(id==='sheriff'?2.5:4);
   // Returning to idle removes reload offsets; animation never allocates replacement meshes.
   const resources=[w.geometries.size,w.materials.size],rigs:SkinnedMesh[]=[];
   w.visual.root.traverse(o=>{if(o instanceof SkinnedMesh)rigs.push(o);});
   const initial=rigs.map(r=>r.skeleton.bones[0].position.toArray());
   for(let frame=0;frame<120;frame++){const reload=Math.sin(frame/120*Math.PI);w.visual.animate?.(frame/60,4,reload,.5,frame/120);w.visual.root.updateMatrixWorld(true);for(const rig of rigs){rig.skeleton.update();for(const value of rig.skeleton.boneMatrices)expect(Number.isFinite(value)).toBe(true);}}
   w.visual.animate?.(3,0,0,0,1);
   expect(rigs.map(r=>r.skeleton.bones[0].position.toArray())).toEqual(initial);
   expect([w.geometries.size,w.materials.size]).toEqual(resources);
  }finally{w.dispose();}
 });
 for(const id of ['rifleA','rifleB','sheriff'] as const)it(`${id}: keeps static weapon submission within a bounded draw-call budget`,()=>{
  const w=weapon(id);try{
   let staticDraws=0,batches=0;
   w.visual.root.traverse(o=>{if(o instanceof Mesh&&!(o instanceof SkinnedMesh)){staticDraws+=Array.isArray(o.material)?o.geometry.groups.length:1;if(o.name==='batched static detail')batches++;}});
   expect(staticDraws).toBeLessThanOrEqual(22);expect(batches).toBeGreaterThanOrEqual(4);
  }finally{w.dispose();}
 });
 it('keeps an open revolver frame around the separate fluted cylinder',()=>{const w=weapon('sheriff');try{const frame=w.visual.root.getObjectByName('receiver') as Mesh;frame.updateMatrixWorld(true);const ray=new Raycaster(new Vector3(1,0,.018),new Vector3(-1,0,0));expect(ray.intersectObject(frame)).toHaveLength(0);ray.set(new Vector3(1,.05,.018),new Vector3(-1,0,0));expect(ray.intersectObject(frame).length).toBeGreaterThan(0);}finally{w.dispose();}});
 it('authors distinct rifle receiver/stock topology and a Phantom-only suppressor',()=>{
  const vandal=weapon('rifleA'),phantom=weapon('rifleB');
  try{
   for(const part of ['receiver','stock']){
    const a=vandal.visual.root.getObjectByName(part) as Mesh,b=phantom.visual.root.getObjectByName(part) as Mesh;
    expect(Array.from(a.geometry.getAttribute('position').array)).not.toEqual(Array.from(b.geometry.getAttribute('position').array));
   }
   expect(vandal.visual.root.getObjectByName('suppressor')).toBeUndefined();expect(phantom.visual.root.getObjectByName('suppressor')).toBeInstanceOf(Mesh);
  }finally{vandal.dispose();phantom.dispose();}
 });
 for(const id of ['rifleA','rifleB'] as const)for(const [width,height] of [[1366,768],[1920,1080],[2560,1440],[3440,1440]])it(`${id}: centered target head stays clear in ADS at ${width}×${height}`,()=>{
  const w=weapon(id),aspect=width/height,camera=new PerspectiveCamera(2*Math.atan(Math.tan(VIEWMODEL_HFOV*Math.PI/360)/aspect)*180/Math.PI,aspect,.03,4),caster=new Raycaster();camera.add(w.visual.root);w.visual.sights.visible=true;w.visual.muzzle.visible=false;
  try{
   for(const kick of [0,.5,1]){
    poseViewmodel(id,1,kick,0,0,2,5,.02,.02,w.visual.root);w.visual.animate?.(2,5,0,kick,1);camera.updateMatrixWorld(true);
    for(const distance of [5,20,35])for(const x of [-.1,0,.1])for(const y of [-.1,0,.1]){
     caster.set(new Vector3(),new Vector3(x,y,-distance).normalize());
     expect(caster.intersectObject(w.visual.root,true),`blocked head ray ${distance}m (${x},${y})`).toHaveLength(0);
    }
   }
  }finally{w.dispose();}
 });
});

describe('Character visual geometry preserves the authoritative hit rig',()=>{
 it('connects the sleeves to the shoulders without retaining the old broad arm envelope',()=>{
  const target=new Target(0,'stationary',new SeededRandom(57));target.spawn(0,-10,0);
  const geometries=target.parts.map((_,i)=>characterPartGeometry(i));
  try{
   const partBounds=geometries.map((geometry,i)=>{geometry.computeBoundingBox();return geometry.boundingBox!.clone().applyMatrix4(target.parts[i].node.matrixWorld.clone().scale(target.parts[i].size));});
   const torso=partBounds[1];
   expect(partBounds[3].max.x).toBeGreaterThan(torso.min.x);
   expect(partBounds[5].min.x).toBeLessThan(torso.max.x);
   // The upper sleeve slopes toward its shoulder while the elbow stays in line
   // with the forearm. Measure the mating rings, not the whole sleeve bounds.
   const ringCenter=(partIndex:number,end:'min'|'max')=>{
    const geometry=geometries[partIndex],part=target.parts[partIndex];
    const y=geometry.boundingBox![end].y,vertices=geometry.getAttribute('position');
    const bounds=new Box3(),point=new Vector3(),matrix=part.node.matrixWorld.clone().scale(part.size);
    for(let i=0;i<vertices.count;i++)if(Math.abs(vertices.getY(i)-y)<1e-6)
     bounds.expandByPoint(point.fromBufferAttribute(vertices,i).applyMatrix4(matrix));
    expect(bounds.isEmpty()).toBe(false);
    return bounds.getCenter(point);
   };
   for(const [upper,lower] of [[3,4],[5,6]]){
    const upperElbow=ringCenter(upper,'min'),lowerElbow=ringCenter(lower,'max');
    expect(Math.abs(upperElbow.x-lowerElbow.x)).toBeLessThan(.005);
    expect(lowerElbow.y-upperElbow.y).toBeGreaterThan(0);
   }
   const width=partBounds.reduce((box,part)=>box.union(part),new Box3()).getSize(new Vector3()).x;
   expect(width).toBeLessThan(.75);
  }finally{geometries.forEach(g=>g.dispose());}
 });

 it('keeps eleven colored parts finite, human-scaled and bound to current articulated transforms',()=>{
  const target=new Target(0,'crouch',new SeededRandom(57));target.spawn(0,-10,0);
  const geometries=target.parts.map((_,i)=>characterPartGeometry(i));
  try{
   for(const pose of [{time:0,crouch:0,vx:0},{time:.5,crouch:0,vx:5},{time:1,crouch:1,vx:0}]){
    target.crouch=pose.crouch;target.velocity.x=pose.vx;target.updatePose(pose.time);
    const before=target.parts.map(p=>({world:p.node.matrixWorld.toArray(),inverse:p.inverse.toArray(),size:p.size.toArray()}));
    const head=target.headPosition(new Vector3()),ray=new Ray(new Vector3(head.x,head.y,0),new Vector3(0,0,-1)),hitBefore=target.intersect(ray,new Vector3())?.zone;
    const combined=new Box3();
    for(let i=0;i<geometries.length;i++){
     const geometry=geometries[i],positions=geometry.getAttribute('position'),colors=geometry.getAttribute('color');expect(colors.count).toBe(positions.count);
     for(const value of positions.array)expect(Number.isFinite(value)).toBe(true);
     const transform=target.parts[i].node.matrixWorld.clone().scale(target.parts[i].size);geometry.computeBoundingBox();combined.union(geometry.boundingBox!.clone().applyMatrix4(transform));
    }
    expect(combined.isEmpty()).toBe(false);const size=combined.getSize(new Vector3());expect(size.x).toBeLessThan(.75);expect(size.y).toBeGreaterThan(1);expect(size.y).toBeLessThan(1.95);
    expect(target.parts.map(p=>({world:p.node.matrixWorld.toArray(),inverse:p.inverse.toArray(),size:p.size.toArray()}))).toEqual(before);
    expect(target.intersect(ray,new Vector3())?.zone).toBe(hitBefore);expect(hitBefore).toBe('head');
   }
  }finally{geometries.forEach(g=>g.dispose());}
 });
});
