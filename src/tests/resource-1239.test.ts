import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {createCharacterBatches} from '../engine/rendering/CharacterBatches';

describe('12.39 character transforms upload only when they change',()=>{
 it('commits nothing and reports no movement for repeated identical poses, so the shadow map is not redrawn',()=>{
  const geometries=[new THREE.BoxGeometry(),new THREE.BoxGeometry()],materials=[new THREE.MeshBasicMaterial(),new THREE.MeshBasicMaterial()];
  const batches=createCharacterBatches(geometries,materials,3,false),object=batches.objects[0] as THREE.InstancedMesh;
  const pose=(x:number)=>new THREE.Matrix4().makeTranslation(x,1,-4);
  const all=(x:number,visible=true)=>{for(let t=0;t<3;t++)for(let p=0;p<2;p++)batches.setPartMatrix(t,p,pose(x+t),visible);};
  all(0);expect(batches.commit()).toBe(true);const version=object.instanceMatrix.version;
  for(let frame=0;frame<10;frame++){all(0);expect(batches.commit()).toBe(false);}
  expect(object.instanceMatrix.version).toBe(version);
  batches.setPartMatrix(1,0,pose(5),true);expect(batches.commit()).toBe(true);expect(object.instanceMatrix.version).toBeGreaterThan(version);
  batches.setPartMatrix(1,0,pose(5),false);expect(batches.commit()).toBe(true);expect(object.count).toBe(2);
  batches.setPartMatrix(1,0,pose(5),false);expect(batches.commit()).toBe(false);
  batches.dispose();
 });
});
