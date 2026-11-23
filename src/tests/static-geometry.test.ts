import {describe,it,expect,vi} from 'vitest';
import {Box3,BoxGeometry,BufferGeometry,Float32BufferAttribute,Mesh,MeshStandardMaterial,Group,Vector3} from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {mergeStaticArchitecture} from '../engine/rendering/StaticGeometry';

describe('Architecture batching across authored primitive formats',()=>{
 it('keeps local detail positions stable when an animated parent moves after batching',()=>{
  const group=new Group();group.position.set(0,-.06,-.01);group.rotation.z=.2;
  const material=new MeshStandardMaterial(),geometry=new BoxGeometry(.02,.03,.04);
  const originals=[new Mesh(geometry,material),new Mesh(geometry,material)];
  originals[0].position.set(.025,-.08,.03);originals[0].rotation.x=.4;originals[1].position.set(-.025,-.1,-.03);
  group.add(...originals);group.updateMatrixWorld(true);
  const merged=mergeStaticArchitecture(originals,'local')!,batch=new Mesh(merged,material);
  group.add(batch);
  try{
   for(const offset of [0,.18]){
    group.position.y=-.06-offset;group.rotation.z=.2+offset;group.updateMatrixWorld(true);
    const expected=originals.reduce((box,mesh)=>box.union(new Box3().setFromObject(mesh,true)),new Box3()),actual=new Box3().setFromObject(batch,true);
    expect(actual.min.distanceTo(expected.min)).toBeLessThan(1e-7);expect(actual.max.distanceTo(expected.max)).toBeLessThan(1e-7);
   }
  }finally{merged.dispose();geometry.dispose();material.dispose();}
 });

 it('batches indexed trim, non-indexed bevels and UV-less ramp faces with unchanged world-space surfaces',()=>{
  const ramp=new BufferGeometry().setAttribute('position',new Float32BufferAttribute([-1,0,-1, 1,0,-1, 1,1,1, -1,0,-1, 1,1,1, -1,1,1],3));
  const geometries=[new BoxGeometry(2,.1,.2),new RoundedBoxGeometry(2,3,.5,1,.035),ramp];
  const material=new MeshStandardMaterial(),meshes=geometries.map(g=>new Mesh(g,material));
  meshes[0].position.set(-3,.5,-7);meshes[0].rotation.y=.3;
  meshes[1].position.set(2,1.5,-4);meshes[1].scale.set(1,1,.8);
  meshes[2].position.set(1,0,-2);meshes[2].rotation.y=-.7;
  meshes.forEach(mesh=>mesh.updateMatrixWorld(true));
  const originals=geometries.map(g=>Array.from(g.getAttribute('position').array));
  const bounds=meshes.reduce((box,mesh)=>box.union(new Box3().setFromObject(mesh)),new Box3());
  const vertices=geometries.reduce((sum,g)=>sum+(g.index?.count??g.getAttribute('position').count),0);
  const errors=vi.spyOn(console,'error').mockImplementation(()=>{});
  let merged:BufferGeometry|null=null;
  try{
   merged=mergeStaticArchitecture(meshes);expect(merged).not.toBeNull();expect(errors).not.toHaveBeenCalled();
   merged!.computeBoundingBox();
   expect(merged!.boundingBox!.min.distanceTo(bounds.min)).toBeLessThan(1e-6);
   expect(merged!.boundingBox!.max.distanceTo(bounds.max)).toBeLessThan(1e-6);
   expect(merged!.getAttribute('position').count).toBe(vertices);
   for(const name of ['position','normal','uv']){
    const attribute=merged!.getAttribute(name);expect(attribute.count).toBe(vertices);
    expect(Array.from(attribute.array).every(Number.isFinite)).toBe(true);
   }
   expect(geometries.map(g=>Array.from(g.getAttribute('position').array))).toEqual(originals);
   expect(geometries[0].index).not.toBeNull();expect(ramp.getAttribute('uv')).toBeUndefined();
  }finally{errors.mockRestore();merged?.dispose();geometries.forEach(g=>g.dispose());material.dispose();}
 });
});
