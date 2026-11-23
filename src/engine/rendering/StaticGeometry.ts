import {BufferGeometry,Float32BufferAttribute,BufferAttribute,Material,type Texture,type Mesh,type Color,type JSONMeta,type TextureJSON} from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {VISUAL_MATERIALS,type VisualMaterialId} from '../../config/materials';

const textureIdentities=new WeakMap<Texture,number>();let nextTextureIdentity=1;
function textureState(texture:Texture){
  let identity=textureIdentities.get(texture);if(identity===undefined){identity=nextTextureIdentity++;textureIdentities.set(texture,identity);}
  return [identity,texture.channel,texture.mapping,texture.wrapS,texture.wrapT,texture.magFilter,texture.minFilter,texture.anisotropy,texture.colorSpace,texture.flipY,texture.offset.toArray(),texture.repeat.toArray(),texture.center.toArray(),texture.rotation,texture.matrixAutoUpdate,texture.matrix.toArray()];
}

/** Conservative palette batching: immutable untextured finishes, or managed
 * texture families with identical texture objects and sampling transforms.
 * Constant linear color is the only shading state moved into vertex colors. */
export function colorBatchSignature(material:Material):string|null {
  if(!['MeshStandardMaterial','MeshBasicMaterial'].includes(material.type)||material.transparent||material.clippingPlanes?.length||material.onBeforeCompile!==Material.prototype.onBeforeCompile||material.customProgramCacheKey!==Material.prototype.customProgramCacheKey)return null;
  const record=material as unknown as Record<string,unknown>,maps=Object.keys(material).filter(key=>/map$/i.test(key)&&!!record[key]).sort();
  const family=material.userData.visualMaterialId as VisualMaterialId|undefined;
  const managed=material.type==='MeshStandardMaterial'&&material.userData.surfaceMaterialManaged===true&&!!family&&Object.hasOwn(VISUAL_MATERIALS,family);
  if(maps.length&&!managed)return null;
  const textureStates:Record<string,unknown>={},meta:JSONMeta={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}};
  for(const key of maps){
    const map=record[key] as Texture;if(!map.isTexture)return null;
    textureStates[key]=textureState(map);
    // Material.toJSON needs only texture UUIDs. Preseeding its metadata avoids
    // copying procedural image buffers while computing every batch signature.
    meta.textures[map.uuid]={uuid:map.uuid} as TextureJSON;
  }
  const state=material.toJSON(meta) as unknown as Record<string,unknown>;
  for(const key of ['metadata','uuid','name','color','userData'])delete state[key];
  for(const key of maps)state[key]=textureStates[key];
  if(managed)state.surfaceMaterialFamily=family;
  return JSON.stringify(Object.fromEntries(Object.keys(state).sort().map(key=>[key,state[key]])));
}

/**
 * Batch immutable surfaces with their authored normals, tint and UVs intact.
 * Retain vertex reuse when the complete index stream costs less than expanding
 * the same triangles into repeated attributes.
 */
export function mergeStaticArchitecture(meshes:readonly Mesh[],space:'world'|'local'='world',vertexTints=false):BufferGeometry|null {
  if(!meshes.length)return null;
  const copies:BufferGeometry[]=[];
  try{
    for(const mesh of meshes){
      const source=mesh.geometry;
      const copy=source.index&&!source.getAttribute('normal')?source.toNonIndexed():source.clone();
      copies.push(copy);
      for(const name of Object.keys(copy.attributes))if(!['position','normal','uv',...(vertexTints?['color']:[])].includes(name))copy.deleteAttribute(name);
      if(!copy.getAttribute('normal'))copy.computeVertexNormals();
      if(!copy.getAttribute('uv'))copy.setAttribute('uv',new Float32BufferAttribute(new Float32Array(copy.getAttribute('position').count*2),2));
      if(vertexTints){
        const count=copy.getAttribute('position').count,existing=copy.getAttribute('color'),values=new Float32Array(count*3);
        const material=Array.isArray(mesh.material)?mesh.material[0]:mesh.material,color=(material as typeof material&{color?:Color}).color;
        for(let i=0;i<count;i++){values[i*3]=(existing?existing.getX(i):1)*(color?.r??1);values[i*3+1]=(existing?existing.getY(i):1)*(color?.g??1);values[i*3+2]=(existing?existing.getZ(i):1)*(color?.b??1);}
        copy.setAttribute('color',new Float32BufferAttribute(values,3));
      }
      if(space==='local')mesh.updateMatrix();
      copy.applyMatrix4(space==='local'?mesh.matrix:mesh.matrixWorld);
    }
    const vertexCount=copies.reduce((sum,copy)=>sum+copy.getAttribute('position').count,0);
    const indexBytes=vertexCount>65535?4:2;
    let expandedBytes=0,indexedBytes=0;
    for(const copy of copies){
      const count=copy.getAttribute('position').count;
      const corners=copy.index?.count??count;
      const stride=Object.values(copy.attributes).reduce((sum,attribute)=>sum+attribute.itemSize*attribute.array.BYTES_PER_ELEMENT,0);
      expandedBytes+=corners*stride;
      indexedBytes+=count*stride+corners*indexBytes;
    }
    const keepIndices=indexedBytes<expandedBytes;
    for(let i=0;i<copies.length;i++){
      const copy=copies[i];
      if(keepIndices&&!copy.index){
        const count=copy.getAttribute('position').count;
        const index=new BufferAttribute(count>65535?new Uint32Array(count):new Uint16Array(count),1);
        for(let n=0;n<count;n++)index.setX(n,n);
        copy.setIndex(index);
      }else if(!keepIndices&&copy.index){
        copies[i]=copy.toNonIndexed();
        copy.dispose();
      }
    }
    return mergeGeometries(copies,false);
  }finally{for(const copy of copies)copy.dispose();}
}
