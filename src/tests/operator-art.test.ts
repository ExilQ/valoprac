import {describe,it,expect} from 'vitest';
import {Box3,BufferGeometry,Material,Mesh,Raycaster,SkinnedMesh,Vector3} from 'three';
import {createWeaponView} from '../engine/rendering/WeaponView';
import {tacticalArchitecture,updateTacticalArchitecture} from '../engine/rendering/TacticalArchitecture';
import {COMPLEX_OBSTACLES,PEEK_ZONES} from '../engine/tactical/complex';

describe('Operator original viewmodel and tactical architecture',()=>{
 it('batches static optic/receiver details without baking the bolt, magazine or skin rig',()=>{
  const geometries=new Set<BufferGeometry>(),materials=new Set<Material>();
  const v=createWeaponView('operator',g=>{geometries.add(g);return g;},m=>{materials.add(m);return m;});
  try{
   let staticDraws=0,skins=0;
   v.root.traverse(o=>{if(!(o instanceof Mesh))return;expect(geometries.has(o.geometry)).toBe(true);for(const m of Array.isArray(o.material)?o.material:[o.material])expect(materials.has(m)).toBe(true);for(const n of o.geometry.getAttribute('position').array)expect(Number.isFinite(n)).toBe(true);if(o instanceof SkinnedMesh)skins++;else staticDraws++;});
   expect(staticDraws).toBeLessThanOrEqual(22);expect(skins).toBe(2);
   const receiver=v.root.getObjectByName('receiver') as Mesh,barrel=v.root.getObjectByName('barrel') as Mesh;
   receiver.geometry.computeBoundingBox();barrel.geometry.computeBoundingBox();
   const size=receiver.geometry.boundingBox!.getSize(new Vector3());expect(size.x).toBeLessThan(.065);expect(size.z/size.x).toBeGreaterThan(6);
   expect(barrel.geometry.boundingBox!.getSize(new Vector3()).y).toBeGreaterThan(.39);
   // Both exterior-facing chamfers and a genuine stock window matter from the
   // real hip camera; a thinner texture on a solid slab would fail these rays.
   v.root.updateMatrixWorld(true);
   expect(new Raycaster(new Vector3(0,1,0),new Vector3(0,-1,0)).intersectObject(receiver).length).toBeGreaterThan(0);
   const stock=v.root.getObjectByName('stock') as Mesh;
   expect(new Raycaster(new Vector3(1,-.012,.25),new Vector3(-1,0,0)).intersectObject(stock)).toHaveLength(0);
   const bolt=v.root.getObjectByName('articulated bolt assembly')!;
   expect(bolt.parent).toBe(v.root);expect(v.magazine.parent).toBe(v.root);
   const rig=v.root.getObjectByName('dominant arm · articulated glove') as SkinnedMesh,wrist=rig.skeleton.bones[1],rest=wrist.position.clone();
   v.animateBolt?.(.5);v.animate?.(0,0,0,0,0);v.root.updateMatrixWorld(true);rig.skeleton.update();
   expect(bolt.position.z).toBeCloseTo(.075,5);expect(bolt.rotation.z).toBeCloseTo(.6,5);expect(wrist.position.z-rest.z).toBeGreaterThan(.06);
   for(const value of rig.skeleton.boneMatrices)expect(Number.isFinite(value)).toBe(true);
   v.animateBolt?.(0);v.animate?.(0,0,0,0,0);expect(wrist.position.distanceTo(rest)).toBe(0);expect(bolt.position.z).toBe(0);expect(bolt.rotation.z).toBe(0);
  }finally{v.dispose?.();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();}
 });

 it('keeps all eight entry apertures open in visual geometry at standing head height',()=>{
  const geometries=new Set<BufferGeometry>(),materials=new Set<Material>(),textures:{dispose():void}[]=[];
  const snapshots=COMPLEX_OBSTACLES.map(o=>[o.box.min.toArray(),o.box.max.toArray()]);
  const art=tacticalArchitecture('complex',COMPLEX_OBSTACLES,g=>{geometries.add(g);return g;},m=>{materials.add(m);return m;},t=>{textures.push(t);return t;});
  try{
   for(const zone of PEEK_ZONES){const sign=Math.sign(zone.center.z);for(const dx of[-1.2,-.7,0,.7,1.2]){const caster=new Raycaster(new Vector3(zone.center.x-6+dx,1.64,sign*7),new Vector3(0,0,sign),0,2);expect(caster.intersectObject(art,true),`${zone.id} front ${dx}`).toHaveLength(0);const rear=new Raycaster(new Vector3(zone.exit.x+dx,zone.id==='F'?3.8:1.64,sign*37),new Vector3(0,0,sign),0,2);expect(rear.intersectObject(art,true),`${zone.id} rear ${dx}`).toHaveLength(0);}}
   // Presets only hide optional finishes; the architecture and collider data
   // remain identical, including every cover edge and physical door aperture.
   const essentials=art.children.filter(o=>o.userData.artDetail===0),bounds=essentials.map(o=>new Box3().setFromObject(o).getSize(new Vector3()).toArray());
   updateTacticalArchitecture(art,new Vector3(0,0,0),'low');expect(essentials.every(o=>o.visible)).toBe(true);expect(art.children.filter(o=>o.userData.artDetail===1).every(o=>!o.visible)).toBe(true);
   updateTacticalArchitecture(art,new Vector3(0,0,0),'ultra');expect(essentials.map(o=>new Box3().setFromObject(o).getSize(new Vector3()).toArray())).toEqual(bounds);
   expect(COMPLEX_OBSTACLES.map(o=>[o.box.min.toArray(),o.box.max.toArray()])).toEqual(snapshots);
  }finally{for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();}
 });
});
