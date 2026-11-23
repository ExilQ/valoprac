import {BufferGeometry,Float32BufferAttribute,type Mesh,type Color} from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Batch authored architecture after normalizing the primitive formats. Rounded
 * boxes are non-indexed; box trim is indexed; ramp faces have no UV channel.
 * Normalize temporary copies so every material batch keeps identical world-space
 * surfaces, instead of silently falling back to hundreds of separate draws. */
export function mergeStaticArchitecture(meshes:readonly Mesh[],space:'world'|'local'='world',vertexTints=false):BufferGeometry|null {
  const copies:BufferGeometry[]=[];
  try{
    for(const mesh of meshes){
      const source=mesh.geometry;
      const copy=source.index?source.toNonIndexed():source.clone();
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
    return mergeGeometries(copies,false);
  }finally{for(const copy of copies)copy.dispose();}
}
