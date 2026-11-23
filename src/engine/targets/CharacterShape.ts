import {Box3,Ray,Vector3,type BufferGeometry} from 'three';
import type {HitZone} from '../types';
import {FIELD_CHARACTER_GEOMETRY,type CharacterGeometryVersion} from './characterProfile';
import {characterPartSourceGeometry,type CharacterHitRegion} from '../rendering/CharacterGeometry';

interface Node {bounds:Box3;left:Node|null;right:Node|null;triangles:number[]|null;}
export interface CharacterShape {geometry:BufferGeometry;bounds:Box3;triangleZones:readonly HitZone[];tree:Node;triangleCount:number;bvhNodes:number;bvhLeaves:number;}
const SHAPES=new Map<CharacterGeometryVersion,CharacterShape[]>(),stack:Node[]=[];
const a=new Vector3(),b=new Vector3(),c=new Vector3(),candidate=new Vector3(),boxHit=new Vector3();

/** Static normalized-space hierarchy shared by every bot instance. Only posed
 * part matrices vary at runtime; no triangle geometry is copied per shot. */
export function characterPartShape(index:number,version:CharacterGeometryVersion=FIELD_CHARACTER_GEOMETRY):CharacterShape {
 const shapes=SHAPES.get(version)??[];
 const cached=shapes[index];
 if(cached)return cached;
 const geometry=characterPartSourceGeometry(index,version),position=geometry.getAttribute('position'),indices=geometry.index;
 const count=(indices?.count??position.count)/3;
 const regions=geometry.userData.hitRegions as CharacterHitRegion[],triangleZones:HitZone[]=[],bounds:Box3[]=[],centers:Vector3[]=[];
 let region=0,bvhNodes=0,bvhLeaves=0;
 for(let t=0;t<count;t++){
  while(region+1<regions.length&&t*3>=regions[region].start+regions[region].count)region++;
  triangleZones.push(regions[region].zone);
  const box=new Box3();for(let corner=0;corner<3;corner++){const i=t*3+corner;box.expandByPoint(a.fromBufferAttribute(position,indices?indices.getX(i):i));}bounds.push(box);centers.push(box.getCenter(new Vector3()));
 }
 const build=(triangles:number[]):Node=>{
  bvhNodes++;const box=new Box3(),centerBox=new Box3();for(const t of triangles){box.union(bounds[t]);centerBox.expandByPoint(centers[t]);}
  if(triangles.length<=10){bvhLeaves++;return {bounds:box,left:null,right:null,triangles};}
  const span=centerBox.getSize(new Vector3()),axis=span.x>=span.y&&span.x>=span.z?'x':span.y>=span.z?'y':'z';
  triangles.sort((x,y)=>centers[x][axis]-centers[y][axis]);const half=Math.floor(triangles.length/2);
  return{bounds:box,left:build(triangles.slice(0,half)),right:build(triangles.slice(half)),triangles:null};
 };
 const tree=build(Array.from({length:count},(_,i)=>i));
 SHAPES.set(version,shapes);
 return shapes[index]={geometry,bounds:tree.bounds,triangleZones,tree,triangleCount:count,bvhNodes,bvhLeaves};
}

const result:{zone:HitZone;distance:number;triangle:number}={zone:'miss',distance:Infinity,triangle:-1};
/** Front-face surface casting matches Three.js' default FrontSide materials,
 * including the authored head outline, gloves, neckline and clothing details. */
export function intersectCharacterPart(ray:Ray,index:number,out:Vector3,version:CharacterGeometryVersion=FIELD_CHARACTER_GEOMETRY){
 const shape=characterPartShape(index,version),position=shape.geometry.getAttribute('position'),indices=shape.geometry.index;let nearest=Infinity,triangle=-1;
 stack.length=0;stack.push(shape.tree);
 while(stack.length){
  const node=stack.pop()!;if(!ray.intersectBox(node.bounds,boxHit))continue;
  if(node.triangles){for(const t of node.triangles){
   const i=t*3;
   a.fromBufferAttribute(position,indices?indices.getX(i):i);
   b.fromBufferAttribute(position,indices?indices.getX(i+1):i+1);
   c.fromBufferAttribute(position,indices?indices.getX(i+2):i+2);
   if(!ray.intersectTriangle(a,b,c,true,candidate))continue;const d=ray.origin.distanceToSquared(candidate);
   if(d<nearest){nearest=d;triangle=t;out.copy(candidate);}
  }}else{stack.push(node.left!,node.right!);}
 }
 if(triangle<0)return null;
 result.zone=shape.triangleZones[triangle];result.distance=Math.sqrt(nearest);result.triangle=triangle;return result;
}
