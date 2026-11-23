import { BufferGeometry, Color, Float32BufferAttribute, Vector3 } from 'three';
import { arenaPalette } from '../../config/arenaAppearance';
import { PENETRATION_MATERIALS } from '../../config/penetration';
import { surfaceForObstacle, SURFACES } from '../../config/surfaces';
import { surfaceHeight, type Obstacle } from '../collision/environment';
import type { BoxFinish } from './ArchitecturalBox';
import { PEEK_ZONES } from '../tactical/complex';

export function paletteAt(map:string,x:number,z:number) {
 const theme=map==='complex'?PEEK_ZONES.find(zone=>Math.abs(zone.center.x-x)<12.1&&Math.sign(zone.center.z)===Math.sign(z))?.theme:undefined;
 return arenaPalette(map,theme);
}

export function tacticalSurfaceStyle(obstacle:Obstacle,map:string){
 const id=surfaceForObstacle(obstacle);
 const {min,max}=obstacle.box,x=(min.x+max.x)/2,z=(min.z+max.z)/2;
 const palette=paletteAt(map,x,z);
 const solid=obstacle.kind==='cover';
 const visibleWall=!solid&&!obstacle.material&&id==='plasteredConcrete';
 const tint=obstacle.material?PENETRATION_MATERIALS[obstacle.material].color:id==='glass'?0x9fcaca:obstacle.ramp?palette.skirt:solid?palette.cover:palette.wall;
 const family=visibleWall?palette.wallFamily:SURFACES[id].visualMaterialId;
 return {family,tint,glass:id==='glass',palette};
}

export function tacticalBands(obstacle:Obstacle,map:string):BoxFinish[]|undefined {
 if(obstacle.ramp||obstacle.material)return undefined;
 const {min,max}=obstacle.box,height=max.y-min.y;
 const {tint,glass,palette}=tacticalSurfaceStyle(obstacle,map);
 if(glass)return undefined;
 const half=height/2;
 if(obstacle.kind==='cover'){
  if(height<.48)return undefined;
  const rim=Math.min(.10,height*.16);
  return [{below:half-rim,color:new Color(tint)},{below:Infinity,color:new Color(palette.coverPanel)}];
 }
 if(height<2.15)return undefined;
 const waist=-half+Math.min(1.03,height*.36);
 return [
  {below:waist,color:new Color(palette.skirt)},
  {below:waist+.055,color:new Color(palette.accent)},
  {below:half-.10,color:new Color(tint)},
  {below:Infinity,color:new Color(palette.trim)},
 ];
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
