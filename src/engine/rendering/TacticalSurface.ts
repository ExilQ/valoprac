import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';
import { PENETRATION_MATERIALS } from '../../config/penetration';
import { surfaceForObstacle, SURFACES } from '../../config/surfaces';
import { surfaceHeight, type Obstacle } from '../collision/environment';
import { PEEK_ZONES } from '../tactical/complex';

const palette = {
  facility:[0xa8b8b5,0x607c7c], research:[0xb8c7cc,0x607b8a],
  urban:[0xb5a38e,0x837b6e], courtyard:[0xc5b28e,0x8e967b],
} as const;

export function tacticalSurfaceStyle(obstacle:Obstacle,map:string){
  const id=surfaceForObstacle(obstacle);
  const {min,max}=obstacle.box,x=(min.x+max.x)/2,z=(min.z+max.z)/2;
  const theme=map==='complex'?PEEK_ZONES.find(zone=>Math.abs(zone.center.x-x)<12.1&&Math.sign(zone.center.z)===Math.sign(z))?.theme:undefined;
  const tint=obstacle.material?PENETRATION_MATERIALS[obstacle.material].color:theme?palette[theme][obstacle.kind==='cover'?1:0]:obstacle.kind==='cover'?0x718e8b:0xc6bfae;
  return {family:SURFACES[id].visualMaterialId,tint,glass:id==='glass'};
}

/** Build the same top plane that the shared collision system samples. */
export function tacticalRampGeometry(obstacle:Obstacle) {
  const {min,max}=obstacle.box;
  const points=[new Vector3(min.x,min.y,min.z),new Vector3(max.x,min.y,min.z),new Vector3(max.x,min.y,max.z),new Vector3(min.x,min.y,max.z)];
  for(const p of points.slice())points.push(new Vector3(p.x,surfaceHeight(obstacle,p.x,p.z),p.z));
  const faces=[4,6,5,4,7,6,0,1,2,0,2,3,0,4,5,0,5,1,1,5,6,1,6,2,2,6,7,2,7,3,3,7,4,3,4,0];
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(faces.flatMap(i=>points[i].toArray()),3));
  geometry.computeVertexNormals();
  return geometry;
}
