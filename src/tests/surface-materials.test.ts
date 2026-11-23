import {describe,expect,it,vi} from 'vitest';
import {BufferGeometry,Color,Float32BufferAttribute,LinearMipmapLinearFilter,Material,Matrix4,Mesh,MeshStandardMaterial,NoColorSpace,RepeatWrapping,RGFormat,SRGBColorSpace} from 'three';
import {VISUAL_MATERIAL_IDS,VISUAL_MATERIALS} from '../config/materials';
import {generateSurfacePixels} from '../engine/rendering/ProceduralSurfaces';
import {applyWorldScaleUV,SurfaceMaterialLibrary,writeWorldScaleUV} from '../engine/rendering/SurfaceMaterials';
import {characterPartSourceGeometry} from '../engine/rendering/CharacterGeometry';
import {tacticalArchitecture} from '../engine/rendering/TacticalArchitecture';
import {COMPLEX_OBSTACLES} from '../engine/tactical/complex';

function checksum(bytes:Uint8Array){let h=2166136261;for(const byte of bytes)h=Math.imul(h^byte,16777619);return h>>>0;}

describe('Original deterministic surface maps',()=>{
  it('authors fifteen distinct families without global randomness or external images',()=>{
    expect(VISUAL_MATERIAL_IDS).toHaveLength(15);
    const random=vi.spyOn(Math,'random').mockImplementation(()=>{throw new Error('Surface generation must be deterministic');});
    try{
      const signatures=new Set<string>();
      for(const id of VISUAL_MATERIAL_IDS){
        const first=generateSurfacePixels(id,32),again=generateSurfacePixels(id,32);
        expect(first.base.every((byte,i)=>byte===again.base[i])).toBe(true);
        expect(first.roughness!.every((byte,i)=>byte===again.roughness![i])).toBe(true);
        expect(first.normal!.every((byte,i)=>byte===again.normal![i])).toBe(true);
        expect(first.base).not.toBe(again.base);
        expect(first.base).not.toBe(first.roughness);
        expect(checksum(first.base)).not.toBe(checksum(first.roughness!));
        expect(first.base.length).toBe(32*32*4);
        expect(first.roughness!.length).toBe(32*32*2);
        expect([...first.base].filter((_,i)=>i%4===3).every(v=>v===255)).toBe(true);
        signatures.add([checksum(first.base),checksum(first.roughness!),checksum(first.normal!)].join(':'));
        let maxDeviation=0,minZ=1;
        for(let i=0;i<first.normal!.length;i+=4){
          const x=first.normal![i]/255*2-1,y=first.normal![i+1]/255*2-1,z=first.normal![i+2]/255*2-1;
          maxDeviation=Math.max(maxDeviation,Math.abs(Math.hypot(x,y,z)-1));
          minZ=Math.min(minZ,z);
        }
        expect(maxDeviation).toBeLessThan(.05);
        expect(minZ).toBeGreaterThan(.75);
      }
      expect(signatures.size).toBe(15);
    }finally{random.mockRestore();}
  });

  it('omits unused channels without changing base color and keeps linear roughness in green',()=>{
    const complete=generateSurfacePixels('raw-concrete',64);
    const medium=generateSurfacePixels('raw-concrete',64,{roughness:true,normal:false});
    const low=generateSurfacePixels('raw-concrete',64,{roughness:false,normal:false});
    expect(low.base).toEqual(complete.base);
    expect(medium.base).toEqual(complete.base);
    expect(medium.roughness).toEqual(complete.roughness);
    expect(low.roughness).toBeNull();
    expect(medium.normal).toBeNull();
    expect(low.normal).toBeNull();
    const texels=complete.roughness!;
    expect(texels[0]).toBe(0);
    expect(texels[1]).toBeGreaterThan(200);
    expect(texels.filter((_,index)=>index%2===0).every(value=>value===0)).toBe(true);
  });

  it('rejects texture dimensions outside the bounded mipmapped sizes',()=>{
    for(const size of [0,15,31,257,512,NaN])expect(()=>generateSurfacePixels('stone',size)).toThrow(RangeError);
  });
});

describe('Renderer-owned shared PBR materials',()=>{
  it('reuses exact variants and family maps while retaining physical finish distinctions',()=>{
    const library=new SurfaceMaterialLibrary({quality:'high',anisotropy:2});
    try{
      const steel=library.material('steel',0x567890),same=library.material('steel',{tint:new Color(0x567890)}),otherTint=library.material('steel',0x111111);
      expect(same).toBe(steel);expect(otherTint).not.toBe(steel);
      expect(otherTint.map).toBe(steel.map);expect(otherTint.roughnessMap).toBe(steel.roughnessMap);expect(otherTint.normalMap).toBe(steel.normalMap);
      expect(otherTint.userData.materialSignature).toBe(steel.userData.materialSignature);
      expect(steel).toBeInstanceOf(MeshStandardMaterial);
      expect(steel.map?.colorSpace).toBe(SRGBColorSpace);expect(steel.roughnessMap?.colorSpace).toBe(NoColorSpace);expect(steel.roughnessMap?.format).toBe(RGFormat);expect(steel.normalMap?.colorSpace).toBe(NoColorSpace);
      expect(steel.map?.wrapS).toBe(RepeatWrapping);expect(steel.map?.wrapT).toBe(RepeatWrapping);expect(steel.map?.minFilter).toBe(LinearMipmapLinearFilter);expect(steel.map?.generateMipmaps).toBe(true);expect(steel.map?.anisotropy).toBe(2);
      const plastic=library.material('plastic'),fabric=library.material('fabric'),rubber=library.material('rubber'),glass=library.material('glass');
      expect(steel.metalness).toBeGreaterThan(.9);expect(plastic.metalness).toBe(0);expect(fabric.roughness).toBeGreaterThan(.95);expect(rubber.roughness).toBeGreaterThan(plastic.roughness);
      expect(glass.transparent).toBe(false);expect(glass.opacity).toBe(1);expect(glass.type).toBe('MeshStandardMaterial');
      expect(library.stats()).toMatchObject({materialCount:6,textureSets:5,textureCount:15});
      expect(library.material('steel',{tint:0x567890,vertexColors:true})).not.toBe(steel);
      expect(steel.userData.visualMaterialId).toBe('steel');
    }finally{library.dispose();}
  });

  it('rebinds live variants across presets and disposes old textures exactly once',()=>{
    const library=new SurfaceMaterialLibrary({quality:'high'}),surface=library.material('raw-concrete'),second=library.material('raw-concrete',0xabcdef);
    const old=[surface.map!,surface.roughnessMap!,surface.normalMap!],disposals=old.map(texture=>{const dispose=vi.fn();texture.addEventListener('dispose',dispose);return dispose;});
    library.setQuality('low');
    expect(surface).toBe(library.material('raw-concrete'));expect(surface.map).toBe(second.map);expect(surface.map).not.toBe(old[0]);
    expect(surface.map!.image.width).toBe(32);expect(surface.roughnessMap).toBeNull();expect(surface.normalMap).toBeNull();
    expect(surface.roughness).toBe(VISUAL_MATERIALS['raw-concrete'].roughness);expect(surface.metalness).toBe(0);
    for(const dispose of disposals)expect(dispose).toHaveBeenCalledTimes(1);
    const lowMap=surface.map,lowDispose=vi.fn();lowMap!.addEventListener('dispose',lowDispose);
    library.setQuality('low');expect(surface.map).toBe(lowMap);expect(lowDispose).not.toHaveBeenCalled();
    library.setQuality('medium');expect(surface.map!.image.width).toBe(64);expect(surface.roughnessMap).not.toBeNull();expect(surface.normalMap).toBeNull();expect(lowDispose).toHaveBeenCalledTimes(1);
    const materialDispose=vi.fn(),textureDispose=vi.fn();surface.addEventListener('dispose',materialDispose);surface.map!.addEventListener('dispose',textureDispose);
    library.dispose();library.dispose();expect(materialDispose).toHaveBeenCalledTimes(1);expect(textureDispose).toHaveBeenCalledTimes(1);
    expect(library.stats()).toMatchObject({materialCount:0,textureSets:0,textureCount:0,estimatedTextureBytes:0,disposed:true});
    expect(()=>library.material('stone')).toThrow(/disposed/);
  });

  it('keeps the complete Ultra texture library below sixteen MiB and drops historical presets',()=>{
    const library=new SurfaceMaterialLibrary({quality:'ultra'});
    try{
      for(const id of VISUAL_MATERIAL_IDS)library.material(id);
      expect(library.stats()).toMatchObject({materialCount:15,textureSets:15,textureCount:45});
      expect(library.stats().estimatedTextureBytes).toBeLessThan(16*1024*1024);
      library.setQuality('low');expect(library.stats()).toMatchObject({materialCount:15,textureSets:15,textureCount:15});
      expect(library.stats().estimatedTextureBytes).toBeLessThan(100*1024);
      for(const id of VISUAL_MATERIAL_IDS){const material=library.material(id);expect(material.map).not.toBeNull();expect(material.color.getHex()).toBe(VISUAL_MATERIALS[id].color);}
    }finally{library.dispose();}
  },20000);

  it('bounds variant creation without evicting materials already referenced by meshes',()=>{
    const library=new SurfaceMaterialLibrary({quality:'low',maxVariants:2});
    try{
      const first=library.material('steel'),second=library.material('plastic');
      expect(()=>library.material('rubber')).toThrow(/budget/);
      expect(library.material('steel')).toBe(first);expect(library.material('plastic')).toBe(second);
      expect(library.stats().materialCount).toBe(2);
    }finally{library.dispose();}
  });

  it('keeps explicit alpha glass independent from opaque optical coatings through quality changes',()=>{
    const library=new SurfaceMaterialLibrary({quality:'high'});
    try{
      const opaque=library.material('glass'),sheet=library.material('glass',{transparent:true,opacity:.32,depthWrite:false});
      expect(opaque).not.toBe(sheet);expect(opaque.transparent).toBe(false);expect(opaque.opacity).toBe(1);expect(opaque.depthWrite).toBe(true);
      expect(sheet.transparent).toBe(true);expect(sheet.opacity).toBe(.32);expect(sheet.depthWrite).toBe(false);expect(sheet.map).toBe(opaque.map);expect(sheet.type).toBe('MeshStandardMaterial');
      expect(sheet.userData.materialSignature).not.toBe(opaque.userData.materialSignature);
      const map=sheet.map;library.setQuality('low');
      expect(sheet.map).not.toBe(map);expect(sheet.map).toBe(opaque.map);expect(sheet.normalMap).toBeNull();
      expect(sheet.transparent).toBe(true);expect(sheet.opacity).toBe(.32);expect(sheet.depthWrite).toBe(false);
      expect(opaque.transparent).toBe(false);expect(opaque.opacity).toBe(1);expect(opaque.depthWrite).toBe(true);
      expect(library.material('glass',{transparent:true,opacity:.32,depthWrite:false})).toBe(sheet);
    }finally{library.dispose();}
  });

  it('retains managed palette batches when a live architectural scene changes quality',()=>{
    const library=new SurfaceMaterialLibrary({quality:'high'}),geometries=new Set<BufferGeometry>(),materials=new Set<Material>();
    const root=tacticalArchitecture('complex',COMPLEX_OBSTACLES,g=>{geometries.add(g);return g;},m=>{materials.add(m);return m;},t=>t,library);
    const batches:Mesh[]=[];root.traverse(node=>{if(node instanceof Mesh&&node.material instanceof MeshStandardMaterial&&node.material.userData.surfaceMaterialManaged)batches.push(node);});
    try{
      expect(batches.length).toBeGreaterThan(5);
      const before=batches.map(mesh=>({material:mesh.material as MeshStandardMaterial,map:(mesh.material as MeshStandardMaterial).map}));
      expect(before.every(({material})=>material.vertexColors)).toBe(true);
      library.setQuality('low');
      batches.forEach((mesh,i)=>{
        const material=mesh.material as MeshStandardMaterial;
        expect(material).toBe(before[i].material);expect(material.map).not.toBe(before[i].map);
        expect(material.map!.image.width).toBe(32);expect(material.normalMap).toBeNull();
        expect([...mesh.geometry.getAttribute('uv').array].every(Number.isFinite)).toBe(true);
      });
    }finally{for(const geometry of geometries)geometry.dispose();for(const material of materials)if(!material.userData.surfaceMaterialManaged)material.dispose();library.dispose();}
  });
});

describe('Meter-scale UVs preserve canonical geometry',()=>{
  it('maintains a common texel density under object scale and translations',()=>{
    const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute([0,0,0,2,0,0,0,4,0,2,4,0],3));geometry.setAttribute('normal',new Float32BufferAttribute([0,0,1,0,0,1,0,0,1,0,0,1],3));geometry.setIndex([0,1,2,1,3,2]);
    const original=Array.from(geometry.getAttribute('position').array),indices=Array.from(geometry.index!.array);
    const copy=applyWorldScaleUV(geometry,2,new Matrix4().makeScale(2,2,2));
    try{
      expect(copy).not.toBe(geometry);expect(geometry.getAttribute('uv')).toBeUndefined();
      expect(Array.from(copy.getAttribute('position').array)).toEqual(original);expect(Array.from(copy.index!.array)).toEqual(indices);
      expect(Array.from(copy.getAttribute('uv').array)).toEqual([0,0,2,0,0,4,2,4]);
      expect(writeWorldScaleUV(copy,2,new Matrix4().makeTranslation(10,6,0))).toBe(copy);
      expect(Array.from(copy.getAttribute('uv').array)).toEqual([5,3,6,3,5,5,6,5]);
      expect(Array.from(copy.getAttribute('position').array)).toEqual(original);
      for(const scale of [0,-1,NaN,Infinity])expect(()=>applyWorldScaleUV(geometry,scale)).toThrow(RangeError);
    }finally{geometry.dispose();copy.dispose();}
  });

  it('never writes UVs into shared shooting meshes or changes hit regions',()=>{
    const source=characterPartSourceGeometry(1),positions=Array.from(source.getAttribute('position').array),regions=JSON.stringify(source.userData.hitRegions),originalUV=source.getAttribute('uv');
    const renderGeometry=applyWorldScaleUV(source,.16);
    try{
      expect(source.getAttribute('uv')).toBe(originalUV);expect(Array.from(source.getAttribute('position').array)).toEqual(positions);
      expect(Array.from(renderGeometry.getAttribute('position').array)).toEqual(positions);expect(JSON.stringify(renderGeometry.userData.hitRegions)).toBe(regions);
      expect(renderGeometry.getAttribute('uv').count).toBe(source.getAttribute('position').count);
    }finally{renderGeometry.dispose();}
  });
});
