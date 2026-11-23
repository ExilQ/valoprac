import * as T from 'three';
import {VISUAL_MATERIAL_IDS,VISUAL_MATERIALS} from '../../config/materials';
import {SurfaceMaterialLibrary,writeWorldScaleUV} from './SurfaceMaterials';

/** Development-only inspection scene. Attach to a neutral-lit scene to compare
 * the same flat, curved and beveled forms at a fixed one-meter scale. No effect
 * on live level geometry, physics, camera or target visibility. */
export function createSurfaceShowcase(surfaces:SurfaceMaterialLibrary){
  const root=new T.Group(),geometries:T.BufferGeometry[]=[];root.name='VALOPRAC material reference gallery';
  VISUAL_MATERIAL_IDS.forEach((id,index)=>{
    const definition=VISUAL_MATERIALS[id],sample=new T.Group();sample.name=definition.label;sample.position.set((index%5-2)*2.1,0,-Math.floor(index/5)*2.3);sample.userData.visualMaterialId=id;
    const material=surfaces.material(id);
    const add=(geometry:T.BufferGeometry,x:number,y:number,z:number)=>{writeWorldScaleUV(geometry,definition.metersPerTile);geometries.push(geometry);const mesh=new T.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;sample.add(mesh);};
    add(new T.BoxGeometry(1.6,.08,1.7),0,.04,0);
    add(new T.BoxGeometry(.7,1,.12),-.4,.58,-.32);
    add(new T.SphereGeometry(.34,24,16),.4,.42,.15);
    add(new T.CylinderGeometry(.19,.19,.65,16),.4,.405,-.42);
    root.add(sample);
  });
  return {root,dispose(){for(const geometry of geometries)geometry.dispose();root.clear();}};
}
