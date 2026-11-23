import * as T from 'three';
import {VISUAL_MATERIALS,type VisualMaterialId} from '../../config/materials';
import type {Quality} from '../types';
import {generateSurfacePixels} from './ProceduralSurfaces';
export type {VisualMaterialId} from '../../config/materials';

export const SURFACE_QUALITY:Readonly<Record<Quality,{size:number;normal:boolean;roughness:boolean;anisotropy:number}>>={
  low:{size:32,normal:false,roughness:false,anisotropy:1},
  medium:{size:64,normal:false,roughness:true,anisotropy:2},
  high:{size:128,normal:true,roughness:true,anisotropy:4},
  ultra:{size:256,normal:true,roughness:true,anisotropy:8},
};
export interface SurfaceMaterialOptions {
  tint?:T.ColorRepresentation;
  vertexColors?:boolean;
  roughness?:number;
  metalness?:number;
  normalStrength?:number;
  emissive?:T.ColorRepresentation;
  emissiveIntensity?:number;
  polygonOffset?:boolean;
  polygonOffsetFactor?:number;
  polygonOffsetUnits?:number;
  depthWrite?:boolean;
  /** Explicit sheet glass only; architectural coatings and optics stay opaque. */
  transparent?:boolean;
  opacity?:number;
}
interface TextureSet {base:T.DataTexture;roughness:T.DataTexture|null;normal:T.DataTexture|null;bytes:number;}
interface CachedMaterial {id:VisualMaterialId;value:T.MeshStandardMaterial;normalStrength:number;}

/** Renderer-scoped ownership. Texture sets are shared per family; tint variants
 * share programs and maps. Quality changes rebind existing materials, then free
 * the previous maps, so changing presets does not grow a historical cache. */
export class SurfaceMaterialLibrary {
  private quality:Quality;
  private readonly anisotropy:number;
  private readonly maxVariants:number;
  private readonly scalarLow:boolean;
  private readonly textures=new Map<VisualMaterialId,TextureSet>();
  private readonly materials=new Map<string,CachedMaterial>();
  private disposed=false;
  constructor(options:{quality?:Quality;anisotropy?:number;maxVariants?:number;scalarLow?:boolean}={}){
    this.quality=options.quality??'high';this.anisotropy=Math.max(1,options.anisotropy??4);this.maxVariants=options.maxVariants??256;this.scalarLow=options.scalarLow??false;
  }
  material(id:VisualMaterialId,tintOrOptions:T.ColorRepresentation|SurfaceMaterialOptions={}):T.MeshStandardMaterial {
    if(this.disposed)throw new Error('SurfaceMaterialLibrary has been disposed');
    const d=VISUAL_MATERIALS[id];if(!d)throw new RangeError(`Unknown visual material: ${id}`);
    const o:SurfaceMaterialOptions=typeof tintOrOptions==='object'&&!(tintOrOptions instanceof T.Color)?tintOrOptions:{tint:tintOrOptions as T.ColorRepresentation};
    const color=new T.Color(o.tint??d.color),emissive=new T.Color(o.emissive??0),roughness=T.MathUtils.clamp(o.roughness??d.roughness,0,1),metalness=T.MathUtils.clamp(o.metalness??d.metalness,0,1),normalStrength=o.normalStrength??d.normalStrength;
    const opacity=T.MathUtils.clamp(o.opacity??1,0,1);
    const key=JSON.stringify([id,color.getHex(),!!o.vertexColors,roughness,metalness,normalStrength,emissive.getHex(),o.emissiveIntensity??1,!!o.polygonOffset,o.polygonOffsetFactor??0,o.polygonOffsetUnits??0,o.depthWrite??true,!!o.transparent,opacity]);
    const cached=this.materials.get(key);if(cached)return cached.value;
    if(this.materials.size>=this.maxVariants)throw new RangeError(`Surface material variant budget (${this.maxVariants}) exceeded`);
    const value=new T.MeshStandardMaterial({color,roughness,metalness,vertexColors:!!o.vertexColors,emissive,emissiveIntensity:o.emissiveIntensity??1,polygonOffset:!!o.polygonOffset,polygonOffsetFactor:o.polygonOffsetFactor??0,polygonOffsetUnits:o.polygonOffsetUnits??0,depthWrite:o.depthWrite??true,transparent:!!o.transparent,opacity});
    value.name=`VALOPRAC ${id}`;value.userData.visualMaterialId=id;value.userData.materialFamily=id;value.userData.surfaceMaterialManaged=true;
    // Default glass is an opaque coating/optic finish. Explicit physical sheet
    // glass can opt into standard alpha blending without transmission passes.
    const entry={id,value,normalStrength};this.bind(entry);this.materials.set(key,entry);return value;
  }
  setQuality(quality:Quality){
    if(this.disposed||this.quality===quality)return;
    const old=[...this.textures.values()];this.textures.clear();this.quality=quality;
    for(const entry of this.materials.values())this.bind(entry);
    for(const maps of old)this.disposeTextures(maps);
  }
  private bind(entry:CachedMaterial){
    const maps=this.scalarLow&&this.quality==='low'?null:this.textureSet(entry.id),m=entry.value;
    m.map=maps?.base??null;m.roughnessMap=maps?.roughness??null;m.normalMap=maps?.normal??null;m.normalScale.setScalar(entry.normalStrength);
    m.userData.materialSignature=JSON.stringify([entry.id,this.quality,m.roughness,m.metalness,entry.normalStrength,m.vertexColors,m.transparent,m.opacity,m.depthWrite,m.polygonOffset,m.polygonOffsetFactor,m.polygonOffsetUnits,m.emissive.getHex(),m.emissiveIntensity,m.side]);m.needsUpdate=true;
  }
  private textureSet(id:VisualMaterialId){
    const cached=this.textures.get(id);if(cached)return cached;
    const q=SURFACE_QUALITY[this.quality],pixels=generateSurfacePixels(id,q.size);
    const create=(data:Uint8Array,colorSpace:T.ColorSpace,channel:string)=>{
      const texture=new T.DataTexture(data,q.size,q.size,T.RGBAFormat,T.UnsignedByteType);
      texture.name=`VALOPRAC ${id} ${channel} ${q.size}`;texture.colorSpace=colorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.anisotropy=Math.min(q.anisotropy,this.anisotropy);texture.needsUpdate=true;return texture;
    };
    const base=create(pixels.base,T.SRGBColorSpace,'base'),roughness=q.roughness?create(pixels.roughness,T.NoColorSpace,'roughness'):null,normal=q.normal?create(pixels.normal,T.NoColorSpace,'normal'):null;
    const maps={base,roughness,normal,bytes:Math.ceil(q.size*q.size*4*(1+Number(q.roughness)+Number(q.normal))*4/3)};
    this.textures.set(id,maps);return maps;
  }
  stats(){return {quality:this.quality,scalarLowFallback:this.scalarLow&&this.quality==='low',materialCount:this.materials.size,textureSets:this.textures.size,textureCount:[...this.textures.values()].reduce((n,t)=>n+1+Number(!!t.roughness)+Number(!!t.normal),0),estimatedTextureBytes:[...this.textures.values()].reduce((n,t)=>n+t.bytes,0),maxMaterialVariants:this.maxVariants,disposed:this.disposed};}
  private disposeTextures(maps:TextureSet){maps.base.dispose();maps.roughness?.dispose();maps.normal?.dispose();}
  dispose(){if(this.disposed)return;for(const entry of this.materials.values())entry.value.dispose();for(const maps of this.textures.values())this.disposeTextures(maps);this.materials.clear();this.textures.clear();this.disposed=true;}
}

/** Only call for renderer-owned geometry. The transform defines meter space;
 * changing UVs never changes vertex positions, normals, indices or collisions. */
export function writeWorldScaleUV(geometry:T.BufferGeometry,metersPerTile=1,transform?:T.Matrix4):T.BufferGeometry {
  if(!(metersPerTile>0&&Number.isFinite(metersPerTile)))throw new RangeError('metersPerTile must be positive');
  const positions=geometry.getAttribute('position'),normals=geometry.getAttribute('normal');if(!positions)return geometry;
  const uv=new Float32Array(positions.count*2),p=new T.Vector3(),n=new T.Vector3(),normalMatrix=transform?new T.Matrix3().getNormalMatrix(transform):null;
  for(let i=0;i<positions.count;i++){
    p.fromBufferAttribute(positions,i);if(transform)p.applyMatrix4(transform);
    if(normals)n.fromBufferAttribute(normals,i);else n.set(0,1,0);
    if(normalMatrix)n.applyMatrix3(normalMatrix).normalize();
    const ax=Math.abs(n.x),ay=Math.abs(n.y),az=Math.abs(n.z);
    if(ay>=ax&&ay>=az){uv[i*2]=p.x/metersPerTile;uv[i*2+1]=p.z/metersPerTile;}
    else if(ax>=az){uv[i*2]=p.z/metersPerTile;uv[i*2+1]=p.y/metersPerTile;}
    else {uv[i*2]=p.x/metersPerTile;uv[i*2+1]=p.y/metersPerTile;}
  }
  geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.userData.surfaceMetersPerTile=metersPerTile;return geometry;
}
/** Safe default for immutable/shared geometry, including canonical hit meshes. */
export function applyWorldScaleUV(geometry:T.BufferGeometry,metersPerTile=1,transform?:T.Matrix4){return writeWorldScaleUV(geometry.clone(),metersPerTile,transform);}
