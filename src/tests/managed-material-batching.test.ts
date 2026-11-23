import {describe,it,expect,vi} from 'vitest';
import {BoxGeometry,BufferGeometry,DoubleSide,Material,Mesh,MeshStandardMaterial,Plane,Raycaster,Vector3} from 'three';
import {SurfaceMaterialLibrary,writeWorldScaleUV} from '../engine/rendering/SurfaceMaterials';
import {colorBatchSignature,mergeStaticArchitecture} from '../engine/rendering/StaticGeometry';
import {tacticalArchitecture} from '../engine/rendering/TacticalArchitecture';
import {PEEK_ZONES,COMPLEX_OBSTACLES} from '../engine/tactical/complex';
import {baseGroundSurface} from '../engine/footsteps/surfaceSelection';
import {SURFACES} from '../config/surfaces';

describe('Managed textured palette batching',()=>{
  it('groups constant tint only while preserving all PBR, identity and sampler differences',()=>{
    const library=new SurfaceMaterialLibrary({quality:'high'}),clones:MeshStandardMaterial[]=[];
    try{
      const a=library.material('steel',0x7298aa),b=library.material('steel',0x998877),signature=colorBatchSignature(a);
      expect(signature).not.toBeNull();expect(colorBatchSignature(b)).toBe(signature);
      // Identical image bytes do not establish shared texture identity.
      const other=b.clone();clones.push(other);other.map=b.map!.clone();other.map.uuid=b.map!.uuid;
      expect(colorBatchSignature(other)).not.toBe(signature);other.map.dispose();
      for(const edit of [(m:MeshStandardMaterial)=>m.roughness=.7,(m:MeshStandardMaterial)=>m.metalness=.2,(m:MeshStandardMaterial)=>m.normalScale.set(.4,.4),(m:MeshStandardMaterial)=>m.side=DoubleSide,(m:MeshStandardMaterial)=>m.depthWrite=false,(m:MeshStandardMaterial)=>m.polygonOffset=true,(m:MeshStandardMaterial)=>m.polygonOffsetFactor=-1,(m:MeshStandardMaterial)=>m.emissive.set(0x333333),(m:MeshStandardMaterial)=>m.emissiveIntensity=2,(m:MeshStandardMaterial)=>m.vertexColors=true,(m:MeshStandardMaterial)=>m.userData.visualMaterialId='aluminum']){
        const changed=b.clone();clones.push(changed);edit(changed);expect(colorBatchSignature(changed)).not.toBe(signature);
      }
      const imageJSON=vi.spyOn(a.map!.source,'toJSON').mockImplementation(()=>{throw Error('Batch signatures must not serialize texture image bytes');});
      expect(colorBatchSignature(a)).toBe(signature);expect(imageJSON).not.toHaveBeenCalled();imageJSON.mockRestore();
      a.map!.repeat.set(2,3);expect(colorBatchSignature(a)).not.toBe(signature);expect(colorBatchSignature(a)).toBe(colorBatchSignature(b));
      const repeated=colorBatchSignature(a);a.map!.matrixAutoUpdate=false;a.map!.matrix.makeScale(4,5);expect(colorBatchSignature(a)).not.toBe(repeated);
    }finally{for(const clone of clones)clone.dispose();library.dispose();}
  });

  it('rejects alpha sheets, custom shaders, clipping and unmanaged texture ownership',()=>{
    const library=new SurfaceMaterialLibrary({quality:'low'}),clones:MeshStandardMaterial[]=[];
    try{
      const source=library.material('glass');
      expect(colorBatchSignature(library.material('glass',{transparent:true,opacity:.32,depthWrite:false}))).toBeNull();
      for(const edit of [(m:MeshStandardMaterial)=>m.onBeforeCompile=()=>{},(m:MeshStandardMaterial)=>m.customProgramCacheKey=()=> 'custom',(m:MeshStandardMaterial)=>m.clippingPlanes=[new Plane(new Vector3(0,1,0),0)],(m:MeshStandardMaterial)=>m.userData.surfaceMaterialManaged=false]){
        const changed=source.clone();clones.push(changed);edit(changed);expect(colorBatchSignature(changed)).toBeNull();
      }
      const unmanaged=new MeshStandardMaterial({map:source.map});clones.push(unmanaged);expect(colorBatchSignature(unmanaged)).toBeNull();
    }finally{for(const clone of clones)clone.dispose();library.dispose();}
  });

  it('preserves source UVs and linear textured tint when merging world-space geometry',()=>{
    const library=new SurfaceMaterialLibrary({quality:'high'}),a=new Mesh(writeWorldScaleUV(new BoxGeometry(1,2,3),.5),library.material('painted-metal',0xa97755)),b=new Mesh(writeWorldScaleUV(new BoxGeometry(2,1,2),.5),library.material('painted-metal',0x558899));
    b.position.set(4,1,-2);a.updateMatrixWorld(true);b.updateMatrixWorld(true);
    const before=a.geometry.getAttribute('uv').array.slice(),merged=mergeStaticArchitecture([a,b],'world',true)!,aCount=a.geometry.index!.count;
    try{
      expect(colorBatchSignature(a.material)).toBe(colorBatchSignature(b.material));
      const uv=merged.getAttribute('uv'),colors=merged.getAttribute('color'),sourceUV=a.geometry.getAttribute('uv');
      for(let i=0;i<aCount;i++){
        const sourceIndex=a.geometry.index!.getX(i),batchIndex=merged.index?.getX(i)??i;expect(uv.getX(batchIndex)).toBe(sourceUV.getX(sourceIndex));expect(uv.getY(batchIndex)).toBe(sourceUV.getY(sourceIndex));
        for(const component of [0,1,2]){
          const baseTexel=[.85,.92,.97][component],sourceLinear=a.material.color.toArray()[component];
          expect(baseTexel*colors.getComponent(batchIndex,component)).toBeCloseTo(baseTexel*sourceLinear,6);
        }
      }
      expect(colors.getX(merged.index?.getX(aCount)??aCount)).toBeCloseTo(b.material.color.r,6);expect(a.geometry.getAttribute('uv').array).toEqual(before);
      const palette=library.material('painted-metal',{tint:0xffffff,vertexColors:true}),paletteSignature=colorBatchSignature(palette),old=palette.map;
      library.setQuality('low');expect(palette.map).not.toBe(old);expect(palette.normalMap).toBeNull();expect(colorBatchSignature(palette)).not.toBe(paletteSignature);
      expect(colorBatchSignature(a.material)).toBe(colorBatchSignature(b.material));expect(merged.getAttribute('uv')).toBe(uv);
    }finally{merged.dispose();a.geometry.dispose();b.geometry.dispose();library.dispose();}
  });
});

describe('Physical bay floors and visual finish agree',()=>{
  it('covers each exact physical bay footprint with a flush floor of its contact material',()=>{
    const library=new SurfaceMaterialLibrary({quality:'low'}),geometries=new Set<BufferGeometry>(),materials=new Set<Material>(),before=COMPLEX_OBSTACLES.map(o=>[o.box.min.toArray(),o.box.max.toArray()]);
    const root=tacticalArchitecture('complex',COMPLEX_OBSTACLES,g=>{geometries.add(g);return g;},m=>{materials.add(m);return m;},t=>t,library);root.updateMatrixWorld(true);
    try{
      const finishes=root.children.flatMap(child=>child.userData.floorFinishes??[]);expect(finishes).toHaveLength(8);
      for(const zone of PEEK_ZONES){
        const id=baseGroundSurface('complex',zone.center),finish=finishes.find(item=>item.zoneId===zone.id);
        expect(finish).toMatchObject({surfaceId:id,visualMaterialId:SURFACES[id].visualMaterialId,bounds:zone.bounds,top:.004});
        const [x,z,w,d]=zone.bounds!;
        for(const [px,pz] of [[x+.12,z+.12],[x+w-.12,z+d-.12],[zone.center.x,zone.center.z]]){
          const hits=new Raycaster(new Vector3(px,.08,pz),new Vector3(0,-1,0),0,.09).intersectObject(root,true);
          const floor=hits.find(hit=>Math.abs(hit.point.y-.004)<1e-5);expect(floor,`${zone.id} floor at ${px}, ${pz}`).toBeDefined();
          expect(((floor!.object as Mesh).material as MeshStandardMaterial).userData.visualMaterialId).toBe(SURFACES[id].visualMaterialId);
        }
      }
      expect(COMPLEX_OBSTACLES.map(o=>[o.box.min.toArray(),o.box.max.toArray()])).toEqual(before);
    }finally{for(const geometry of geometries)geometry.dispose();for(const material of materials)if(!material.userData.surfaceMaterialManaged)material.dispose();library.dispose();}
  });
});
