import {describe,expect,it} from 'vitest';
import {Box3,BufferGeometry,DirectionalLight,Material,Mesh,MeshStandardMaterial,Raycaster,Scene,Texture,Vector3} from 'three';
import {SurfaceMaterialLibrary} from '../engine/rendering/SurfaceMaterials';
import {RangeRenderer} from '../engine/rendering/RangeRenderer';
import {obstacleFinishes} from '../engine/rendering/ObstacleFinishes';
import type {Obstacle} from '../engine/collision/environment';
import {levelFor} from '../engine/tactical/levels';
import {obstaclesFor} from '../engine/tactical/map';

describe('wall finishes in the batched environment',()=>{
  it.each([
    {map:'range',origin:[0,0,1.37],direction:[1,0,0],distance:12,top:6},
    {map:'tactical',origin:[.37,0,-20],direction:[0,0,-1],distance:2,top:3.6},
    {map:'complex',origin:[-.42,0,-44],direction:[0,0,-1],distance:1.5,top:6},
  ])('gives the wall, plinth and cornice one visible surface in $map',({map,origin,direction,distance,top})=>{
    const obstacles=obstaclesFor(map);
    const {scene,dispose}=renderEnvironment(map,obstacles);
    try{
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
    }finally{dispose();}
  });

  it('retains the blend and authored material of a glass obstacle',()=>{
    const glass:Obstacle={box:new Box3(new Vector3(-1,0,-5.06),new Vector3(1,3,-4.94)),color:0x9ac3cc,kind:'wall',material:'glass'};
    const secondPane={...glass,box:glass.box.clone().translate(new Vector3(0,0,-1.25))};
    const {scene,dispose}=renderEnvironment('wallbang',[glass,secondPane]);
    try{
      const ray=new Raycaster(new Vector3(.31,1.64,-4),new Vector3(0,0,-1),0,3);
      const hits=ray.intersectObjects(scene.children,true);
      expect(new Set(hits.map(hit=>hit.object)).size).toBe(2);
      for(const {object} of hits){
        const material=object instanceof Mesh?object.material:null;
        expect(material).toBeInstanceOf(MeshStandardMaterial);
        expect(material).toMatchObject({transparent:true,opacity:.32,depthWrite:false,userData:{visualMaterialId:'glass'}});
        expect(object.castShadow).toBe(false);
      }
      expect(scene.getObjectByName('flush obstacle cladding')).toBeUndefined();
    }finally{dispose();}
  });
});

describe('flush obstacle cladding',()=>{
  it('uses indexed front faces within 2 mm of the original box',()=>{
    const cover:Obstacle={box:new Box3(new Vector3(-1,0,-1),new Vector3(1,1.2,1)),color:0,kind:'cover'};
    const original=cover.box.clone();
    const geometry=obstacleFinishes([cover])!;
    try{
      const p=geometry.getAttribute('position'),n=geometry.getAttribute('normal');
      expect(p.count).toBe(60);
      expect(geometry.index?.count).toBe(90);
      const planarAxes=new Set<string>();
      for(let i=0;i<p.count;i++){
        const point=new Vector3().fromBufferAttribute(p,i);
        const normal=new Vector3().fromBufferAttribute(n,i);
        const closest=cover.box.clampPoint(point,new Vector3());
        expect(point.distanceTo(closest)).toBeCloseTo(.002,6);
        expect(point.sub(closest).normalize().dot(normal)).toBeCloseTo(1);
        planarAxes.add(normal.toArray().join(','));
      }
      expect([...planarAxes].sort()).toEqual(['-1,0,0','0,0,-1','0,0,1','0,1,0','1,0,0']);
      expect(cover.box).toEqual(original);
    }finally{geometry.dispose();}
  });

  it('leaves ramps and explicitly authored ballistic samples uncoated',()=>{
    const box=new Box3(new Vector3(-2,0,-2),new Vector3(2,3,2));
    expect(obstacleFinishes([
      {box,color:0,kind:'cover',ramp:{axis:'z',low:0,high:3,ascending:1}},
      {box,color:0,kind:'cover',material:'thinWood'},
      {box,color:0,kind:'wall',surfaceId:'glass'},
    ])).toBeNull();
  });
});

function renderEnvironment(map:string,obstacles:Obstacle[]){
  const scene=new Scene();
  const geometries=new Set<BufferGeometry>();
  const materials=new Set<Material>();
  const textures=new Set<Texture>();
  const materialLibrary=new SurfaceMaterialLibrary({quality:'low'});
  // Build the real environment and batches without a WebGL context.
  const renderer=Object.assign(Object.create(RangeRenderer.prototype),{
    scene,geometries,materials,textures,materialLibrary,
    simulation:{practiceMap:map,obstacles,level:levelFor(map)},
    size:new Vector3(),position:new Vector3(),sun:new DirectionalLight(),
    surfaceMaterials:[],archMaterials:new Map(),addSign(){},
  }) as {buildEnvironment():void;buildPolish():void;batchStaticArchitecture():void};
  renderer.buildEnvironment();
  renderer.buildPolish();
  renderer.batchStaticArchitecture();
  scene.updateMatrixWorld(true);
  return {scene,dispose(){
    for(const geometry of geometries)geometry.dispose();
    for(const material of materials)if(!material.userData.surfaceMaterialManaged)material.dispose();
    for(const texture of textures)texture.dispose();
    materialLibrary.dispose();
  }};
}
