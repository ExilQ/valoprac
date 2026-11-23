import {describe,expect,it} from 'vitest';
import {BufferGeometry,DirectionalLight,Material,Mesh,Raycaster,Scene,Texture,Vector3} from 'three';
import {SurfaceMaterialLibrary} from '../engine/rendering/SurfaceMaterials';
import {RangeRenderer} from '../engine/rendering/RangeRenderer';
import {levelFor} from '../engine/tactical/levels';
import {obstaclesFor} from '../engine/tactical/map';

describe('wall finishes in the batched environment',()=>{
  it.each([
    {map:'range',origin:[0,0,1.37],direction:[1,0,0],distance:12,top:6},
    {map:'tactical',origin:[.37,0,-20],direction:[0,0,-1],distance:2,top:3.6},
    {map:'complex',origin:[-.42,0,-44],direction:[0,0,-1],distance:1.5,top:6},
  ])('gives the wall, plinth and cornice one visible surface in $map',({map,origin,direction,distance,top})=>{
    const obstacles=obstaclesFor(map);
    const scene=new Scene();
    const geometries=new Set<BufferGeometry>();
    const materials=new Set<Material>();
    const textures=new Set<Texture>();
    // Build the real environment and batches without a WebGL context.
    const renderer=Object.assign(Object.create(RangeRenderer.prototype),{
      scene,geometries,materials,textures,materialLibrary:new SurfaceMaterialLibrary({quality:'low'}),
      simulation:{practiceMap:map,obstacles,level:levelFor(map)},
      size:new Vector3(),position:new Vector3(),sun:new DirectionalLight(),
      surfaceMaterials:[],archMaterials:new Map(),addSign(){},
    }) as {buildEnvironment():void;buildPolish():void;batchStaticArchitecture():void};
    try{
      renderer.buildEnvironment();
      renderer.buildPolish();
      renderer.batchStaticArchitecture();
      scene.updateMatrixWorld(true);
      const finishes=[.13,1.64,top-.09].map(height=>{
        const start=new Vector3().fromArray(origin);
        start.y=height;
        const ray=new Raycaster(start,new Vector3().fromArray(direction),distance-1e-4,distance+1e-4);
        const hits=ray.intersectObjects(scene.children,true);
        expect(hits, `height ${height}`).toHaveLength(1);
        expect(hits[0].distance).toBeCloseTo(distance,5);
        const {object,face}=hits[0];
        if(!(object instanceof Mesh)||!face)throw new Error('Expected a wall triangle');
        const color=object.geometry.getAttribute('color');
        const vertices=[face.a,face.b,face.c].map(index=>new Vector3().fromBufferAttribute(color,index).toArray());
        expect(vertices).toEqual([vertices[0],vertices[0],vertices[0]]);
        return vertices[0];
      });
      expect(new Set(finishes.map(color=>color.join(','))).size).toBe(3);
    }finally{
      for(const geometry of geometries)geometry.dispose();
      for(const material of materials)material.dispose();
      for(const texture of textures)texture.dispose();
    }
  });
});
