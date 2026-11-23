import {describe,it,expect,vi} from 'vitest';
import {BatchedMesh,BoxGeometry,BufferGeometry,DynamicDrawUsage,InstancedMesh,Matrix4,MeshStandardMaterial,PerspectiveCamera,Quaternion,Scene,Vector3,type Material} from 'three';
import {createCharacterBatches,type CharacterBatches} from '../engine/rendering/CharacterBatches';
import {characterPartGeometry,characterPartSourceGeometry} from '../engine/rendering/CharacterGeometry';
import {Target} from '../engine/targets/Target';
import {SeededRandom} from '../engine/simulation/random';

function fixture(multiDraw:boolean,count=4){
  const geometries=Array.from({length:11},(_,i)=>characterPartGeometry(i));
  const materials=Array.from({length:3},()=>new MeshStandardMaterial({vertexColors:true}));
  const perPart=geometries.map((_,i)=>materials[i===0?0:i<7?1:2]);
  const batches=createCharacterBatches(geometries,perPart,count,multiDraw);
  return{batches,geometries,materials,perPart,dispose(){batches.dispose();for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();}};
}
function slot(batches:CharacterBatches,perPart:Material[],targetId:number,partId:number){
  if(batches.backend==='instanced')return{object:batches.objects[partId] as InstancedMesh,instanceId:targetId};
  const object=batches.objects.find(object=>object.material===perPart[partId]) as BatchedMesh;
  const groupParts=perPart.flatMap((material,i)=>material===perPart[partId]?[i]:[]);
  return{object,instanceId:targetId*groupParts.length+groupParts.indexOf(partId)};
}
function expectFloat32Matrix(actual:Matrix4,expected:Matrix4){
  // Both Three backends upload float32 matrices. Compare exactly at GPU precision.
  expect(actual.elements).toEqual(Array.from(new Float32Array(expected.elements)));
}

describe('Articulated character material batches',()=>{
  it('uses three material identities with exactly reserved geometry and instance capacity',()=>{
    const f=fixture(true,72);
    try{
      expect(f.batches.getStats()).toEqual({backend:'batched',targetCount:72,partCount:11,batchCount:3,instanceCount:792,instanceCapacity:792});
      for(const object of f.batches.objects){
        expect(object).toBeInstanceOf(BatchedMesh);const batch=object as BatchedMesh;
        const parts=f.perPart.flatMap((material,i)=>material===batch.material?[i]:[]);
        expect(batch.instanceCount).toBe(72*parts.length);expect(batch.maxInstanceCount).toBe(batch.instanceCount);
        expect(batch.unusedVertexCount).toBe(0);expect(batch.geometry.index).toBeNull();
        expect(batch.geometry.getAttribute('position').count).toBe(parts.reduce((count,i)=>count+f.geometries[i].getAttribute('position').count,0));
        expect(batch.frustumCulled).toBe(false);expect(batch.perObjectFrustumCulled).toBe(false);expect(batch.sortObjects).toBe(false);
        expect(()=>batch.addInstance(0)).toThrow('Maximum item count');
      }
    }finally{f.dispose();}
  });

  it('keeps different material identities in different batches even when their PBR properties match',()=>{
    const geometries=[new BoxGeometry(),new BoxGeometry()],materials=[new MeshStandardMaterial(),new MeshStandardMaterial()];
    const batches=createCharacterBatches(geometries,materials,1,true);
    try{expect(batches.objects).toHaveLength(2);expect(batches.objects.map(object=>object.material)).toEqual(materials);}
    finally{batches.dispose();for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();}
  });

  it('copies indexed geometry without changing canonical vertices or triangle order',()=>{
    const geometries=[new BoxGeometry(1,2,3),new BoxGeometry(3,1,2)],material=new MeshStandardMaterial();geometries[1].translate(5,-2,3);
    const before=geometries.map(geometry=>({positions:geometry.getAttribute('position').array.slice(),indices:geometry.index!.array.slice()}));
    const batches=createCharacterBatches(geometries,[material,material],3,true),batch=batches.objects[0] as BatchedMesh;
    try{for(let partId=0;partId<2;partId++){
      const range=batch.getGeometryRangeAt(batch.getGeometryIdAt(partId))!;
      expect(batch.geometry.getAttribute('position').array.slice(range.vertexStart*3,(range.vertexStart+range.vertexCount)*3)).toEqual(before[partId].positions);
      for(let i=0;i<range.indexCount;i++)expect(batch.geometry.index!.getX(range.indexStart+i)-range.vertexStart).toBe(before[partId].indices[i]);
      expect(geometries[partId].getAttribute('position').array).toEqual(before[partId].positions);expect(geometries[partId].index!.array).toEqual(before[partId].indices);
    }}finally{batches.dispose();for(const geometry of geometries)geometry.dispose();material.dispose();}
  });

  for(const multiDraw of [true,false])describe(multiDraw?'WEBGL_multi_draw backend':'InstancedMesh fallback',()=>{
    it('reads back the exact articulated matrices for independent targets and preserves canonical geometry',()=>{
      const f=fixture(multiDraw),expected=new Matrix4(),actual=new Matrix4();
      try{for(let targetId=0;targetId<4;targetId++){
        const target=new Target(targetId,'stationary',new SeededRandom(21+targetId));target.scale=.75+targetId*.5;target.spawn(targetId*3,0,-targetId*2);target.crouch=targetId%2;target.velocity.x=targetId*1.3;target.updatePose(targetId*.17);target.root.rotation.y=targetId*.7;target.root.updateMatrixWorld(true);
        for(let partId=0;partId<11;partId++){
          const part=target.parts[partId];expected.copy(part.node.matrixWorld).scale(part.size);expected.elements[12]+=.127;expected.elements[14]-=.043;
          if(targetId===3){expected.elements[13]-=.425;expected.scale(new Vector3(.775,.775,.775));}
          const before=expected.clone();f.batches.setPartMatrix(targetId,partId,expected,true);expect(expected.equals(before)).toBe(true);
          f.batches.getPartMatrix(targetId,partId,actual);expectFloat32Matrix(actual,expected);f.batches.commit();
          const {object,instanceId}=slot(f.batches,f.perPart,targetId,partId);object.getMatrixAt(instanceId,actual);expectFloat32Matrix(actual,expected);
          if(object instanceof BatchedMesh){
            expect(object.getVisibleAt(instanceId)).toBe(true);
            const range=object.getGeometryRangeAt(object.getGeometryIdAt(instanceId))!,source=characterPartSourceGeometry(partId).getAttribute('position');
            expect(object.geometry.getAttribute('position').array.slice(range.vertexStart*3,(range.vertexStart+range.vertexCount)*3)).toEqual(source.array);
          }else expect(object.geometry).toBe(f.geometries[partId]);
          expect(f.geometries[partId].getAttribute('position').array).toEqual(characterPartSourceGeometry(partId).getAttribute('position').array);
        }
      }f.batches.commit();}finally{f.dispose();}
    });

    it('starts hidden and toggles one part without changing another target or the supplied matrix',()=>{
      const f=fixture(multiDraw,2),matrix=new Matrix4().compose(new Vector3(3,2,-8),new Quaternion().setFromAxisAngle(new Vector3(0,1,0),.3),new Vector3(.3,.5,.2)),actual=new Matrix4();
      const secondMatrix=matrix.clone();secondMatrix.elements[12]+=4;
      const first=slot(f.batches,f.perPart,0,4),second=slot(f.batches,f.perPart,1,4);
      try{
        for(let targetId=0;targetId<2;targetId++)for(let partId=0;partId<11;partId++){
          const {object,instanceId}=slot(f.batches,f.perPart,targetId,partId);
          if(object instanceof BatchedMesh)expect(object.getVisibleAt(instanceId)).toBe(false);
          else expect(object.count).toBe(0);
        }
        f.batches.setPartMatrix(0,4,matrix,true);f.batches.setPartMatrix(1,4,secondMatrix,true);f.batches.commit();
        const before=matrix.clone();f.batches.setPartMatrix(0,4,matrix,false);expect(matrix.equals(before)).toBe(true);
        f.batches.getPartMatrix(1,4,actual);expectFloat32Matrix(actual,secondMatrix);
        f.batches.getPartMatrix(0,4,actual);expectFloat32Matrix(actual,matrix);f.batches.commit();
        if(first.object instanceof BatchedMesh){expect(first.object.getVisibleAt(first.instanceId)).toBe(false);first.object.getMatrixAt(first.instanceId,actual);expectFloat32Matrix(actual,matrix);}
        else{expect(first.object.count).toBe(1);first.object.getMatrixAt(0,actual);expectFloat32Matrix(actual,secondMatrix);}
        f.batches.setPartMatrix(0,4,matrix,true);f.batches.commit();first.object.getMatrixAt(first.instanceId,actual);expectFloat32Matrix(actual,matrix);
        second.object.getMatrixAt(second.instanceId,actual);expectFloat32Matrix(actual,secondMatrix);
        if(first.object instanceof BatchedMesh){
          first.object.onBeforeRender(null as never,new Scene(),new PerspectiveCamera(),first.object.geometry,first.object.material,null as never);
          expect(first.object.getVisibleAt(first.instanceId)).toBe(true);
        }
        f.batches.setShadow(true);expect(f.batches.objects.every(object=>object.castShadow)).toBe(true);
        f.batches.setShadow(false);expect(f.batches.objects.every(object=>!object.castShadow)).toBe(true);
      }finally{f.dispose();}
    });

    it('disposes only owned GPU resources once, leaving caller geometry and materials intact',()=>{
      const f=fixture(multiDraw),sourceDisposals=f.geometries.map(geometry=>vi.spyOn(geometry,'dispose')),materialDisposals=f.materials.map(material=>vi.spyOn(material,'dispose'));
      const objectDisposals=f.batches.objects.map(object=>vi.spyOn(object,'dispose'));
      const mergedDisposals=multiDraw?f.batches.objects.map(object=>vi.spyOn(object.geometry,'dispose')):[];
      // Confirm texture disposal too, using the actual Three-owned resource fields.
      const textureDisposals=multiDraw?f.batches.objects.flatMap(object=>{
        const internal=object as unknown as {_matricesTexture:{dispose():void};_indirectTexture:{dispose():void}};
        return[vi.spyOn(internal._matricesTexture,'dispose'),vi.spyOn(internal._indirectTexture,'dispose')];
      }):[];
      try{
        f.batches.dispose();f.batches.dispose();
        for(const spy of [...objectDisposals,...mergedDisposals,...textureDisposals])expect(spy).toHaveBeenCalledTimes(1);
        for(const spy of [...sourceDisposals,...materialDisposals])expect(spy).not.toHaveBeenCalled();
        expect(()=>f.batches.setPartMatrix(0,0,new Matrix4(),true)).toThrow('disposed');
      }finally{for(const spy of [...sourceDisposals,...materialDisposals])spy.mockRestore();f.dispose();}
    });

    it('handles no targets without allocating mesh resources and rejects invalid slots',()=>{
      const f=fixture(multiDraw,0);
      try{
        expect(f.batches.objects).toEqual([]);expect(f.batches.getStats()).toMatchObject({targetCount:0,partCount:11,batchCount:0,instanceCount:0,instanceCapacity:0});
        expect(()=>f.batches.commit()).not.toThrow();expect(()=>f.batches.setShadow(true)).not.toThrow();expect(()=>f.batches.setPartMatrix(0,0,new Matrix4(),true)).toThrow('Invalid character target');
      }finally{f.dispose();}
      const active=fixture(multiDraw,2);
      try{for(const [target,part] of [[-1,0],[2,0],[.5,0],[0,-1],[0,11],[0,.5]])expect(()=>active.batches.setPartMatrix(target,part,new Matrix4(),true)).toThrow(RangeError);}
      finally{active.dispose();}
    });
  });

  it('uses eleven dynamic instanced draws without WEBGL_multi_draw and commits dirty attributes once',()=>{
    const f=fixture(false,72);
    try{
      expect(f.batches.objects).toHaveLength(11);expect(f.batches.getStats()).toMatchObject({backend:'instanced',batchCount:11,instanceCount:792,instanceCapacity:792});
      for(const object of f.batches.objects){expect(object).toBeInstanceOf(InstancedMesh);const batch=object as InstancedMesh;expect(batch.count).toBe(0);expect(batch.instanceMatrix.count).toBe(72);expect(batch.instanceMatrix.usage).toBe(DynamicDrawUsage);}
      f.batches.commit();const batch=f.batches.objects[4] as InstancedMesh,version=batch.instanceMatrix.version;
      f.batches.setPartMatrix(0,4,new Matrix4(),true);expect(batch.instanceMatrix.version).toBe(version);f.batches.commit();expect(batch.instanceMatrix.version).toBe(version+1);f.batches.commit();expect(batch.instanceMatrix.version).toBe(version+1);
    }finally{f.dispose();}
  });

  it('compacts only visible fallback targets without losing stable target transforms',()=>{
    const f=fixture(false,72),a=new Matrix4().makeTranslation(2,3,4),b=new Matrix4().makeTranslation(7,8,9),actual=new Matrix4();
    try{
      f.batches.setPartMatrix(71,4,b,true);f.batches.setPartMatrix(3,4,a,true);f.batches.commit();
      const batch=f.batches.objects[4] as InstancedMesh;expect(batch.count).toBe(2);
      batch.getMatrixAt(0,actual);expectFloat32Matrix(actual,a);batch.getMatrixAt(1,actual);expectFloat32Matrix(actual,b);
      f.batches.setPartMatrix(3,4,a,false);f.batches.commit();expect(batch.count).toBe(1);batch.getMatrixAt(0,actual);expectFloat32Matrix(actual,b);
      f.batches.getPartMatrix(3,4,actual);expectFloat32Matrix(actual,a);f.batches.getPartMatrix(71,4,actual);expectFloat32Matrix(actual,b);
      f.batches.setPartMatrix(71,4,b,false);f.batches.commit();expect(batch.count).toBe(0);
      f.batches.setPartMatrix(3,4,a,true);f.batches.commit();expect(batch.count).toBe(1);batch.getMatrixAt(0,actual);expectFloat32Matrix(actual,a);
      expect((f.batches.objects[5] as InstancedMesh).count).toBe(0);
    }finally{f.dispose();}
  });

  it('rejects invalid capacity or part/material mismatch before creating resources',()=>{
    const geometry=new BufferGeometry(),material=new MeshStandardMaterial();
    try{
      for(const count of [-1,.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])expect(()=>createCharacterBatches([geometry],[material],count,true)).toThrow(RangeError);
      expect(()=>createCharacterBatches([geometry],[],1,true)).toThrow('one material per geometry');
    }finally{geometry.dispose();material.dispose();}
  });
});
