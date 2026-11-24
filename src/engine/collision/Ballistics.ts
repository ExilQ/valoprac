import {Ray,Vector3} from 'three';
import type {WeaponProfile} from '../../config/weapons';
import type {HitZone,Vec3} from '../types';
import {ENVIRONMENT,type Obstacle} from './environment';
import {staticBroadphaseFor} from './StaticBroadphase';
import {LEGACY_SIMULATION_RULES,type SimulationRulesId} from '../simulation/rules';
import {PENETRATION_MATERIALS,PENETRATION_WEAPONS,materialFor,type SurfaceMaterial} from '../../config/penetration';
export interface PenetrationSegment {obstacle:number;material:SurfaceMaterial;entry:Vec3;exit:Vec3;entryNormal:Vec3;exitNormal:Vec3;thickness:number;resistance:number;cost:number;damageBefore:number;damageAfter:number;penetrated:boolean;inside:boolean;
 /** Current traversal intervals can split inside a solid or end at a target.
  * False suppresses a fabricated surface event; omitted keeps legacy effects. */
 entrySurface?:boolean;exitSurface?:boolean;
}
export interface BallisticTrace {zone:HitZone;point:Vector3;distance:number;damageScale:number;penetrationScale:number;penetratedLayers:number;segments:PenetrationSegment[];stopReason:'target'|'range'|'material'|'capacity'|'layers'|'floor';remainingPower:number;}
export interface BallisticTarget {distance:number;zone:HitZone;point:Vec3;}
interface Interval {index:number;start:number;end:number;normalIn:Vector3;normalOut:Vector3;inside:boolean;material:SurfaceMaterial;physicalEnd?:number;}
const EPS=1e-7;
const candidates:number[]=[];
/** Exact convex clipping of an AABB or the occupied wedge below a ramp. Normals
 * point out of the collision volume; the length is actual ray traversal. */
export function obstacleRayInterval(ray:Ray,obstacle:Obstacle,index=0,rules:SimulationRulesId=LEGACY_SIMULATION_RULES):Interval|null{
 const b=obstacle.box,r=obstacle.ramp;
 let slope=0,intercept=0;
 if(r){slope=(r.high-r.low)/(b.max[r.axis]-b.min[r.axis])*r.ascending;intercept=r.ascending===1?r.low-slope*b.min[r.axis]:r.high-slope*b.min[r.axis];}
 let start=-Infinity,end=Infinity,inx=0,iny=0,inz=0,outx=0,outy=0,outz=0,inside=true;
 // Same seven clipping planes and arithmetic order as the reference. Normal
 // vectors are materialized only for a real interval, never for rejected boxes.
 for(let plane=0,n=r?7:6;plane<n;plane++){
  let x=0,y=0,z=0,limit=0;
  switch(plane){case 0:x=1;limit=b.max.x;break;case 1:x=-1;limit=-b.min.x;break;case 2:y=1;limit=b.max.y;break;case 3:y=-1;limit=-b.min.y;break;case 4:z=1;limit=b.max.z;break;case 5:z=-1;limit=-b.min.z;break;default:if(r!.axis==='x')x=-slope;else z=-slope;y=1;limit=intercept;}
  const side=limit-x*ray.origin.x-y*ray.origin.y-z*ray.origin.z,denom=x*ray.direction.x+y*ray.direction.y+z*ray.direction.z;
  if(side< -EPS)inside=false;
  if(Math.abs(denom)<1e-12){if(side< -EPS)return null;continue;}
  const t=side/denom;
  if(denom<0&&t>start){start=t;inx=x;iny=y;inz=z;}else if(denom>0&&t<end){end=t;outx=x;outy=y;outz=z;}
  if(start>end+EPS)return null;
 }
 if(end<=EPS||!Number.isFinite(end))return null;
 return{index,start:Math.max(0,start),end,normalIn:inside?ray.direction.clone().negate():new Vector3(inx,iny,inz).normalize(),normalOut:new Vector3(outx,outy,outz).normalize(),inside,material:materialFor(obstacle,rules)};
}
const point=(ray:Ray,d:number):Vec3=>({x:ray.origin.x+ray.direction.x*d,y:ray.origin.y+ray.direction.y*d,z:ray.origin.z+ray.direction.z*d});
/** Modular boxes with the same surface form one finish. Their shared or buried
 * faces are not impact surfaces; distinct-material insert faces stay explicit. */
function sameMaterialContinues(intervals:readonly Interval[],material:Interval,at:number,before:boolean):boolean{
 for(const other of intervals){
  if(other===material||other.material!==material.material)continue;
  const end=other.physicalEnd??other.end;
  if(before?other.start<at-EPS&&end>=at-EPS:other.start<=at+EPS&&end>at+EPS)return true;
 }
 return false;
}
/** Shared wall traversal for player and bot shots. Perception remains opaque.
 * Collision candidates are supplied independently from the shooter's knowledge. */
export function traceBallisticRay(ray:Ray,profile:WeaponProfile,target:BallisticTarget|null,obstacles:Obstacle[]=ENVIRONMENT,maxDistance=150,rules:SimulationRulesId=LEGACY_SIMULATION_RULES):BallisticTrace{
 const floor=ray.direction.y< -1e-12?-ray.origin.y/ray.direction.y:Infinity;
 const inRange=!!target&&target.distance<=maxDistance,requestedLimit=Math.min(maxDistance,target?.distance??maxDistance),floorFirst=floor>EPS&&floor<requestedLimit;
 const config=PENETRATION_WEAPONS[profile.penetration??'medium'],limit=floorFirst?floor:requestedLimit,trace:BallisticTrace={zone:floorFirst?'wall':inRange?target!.zone:'miss',point:new Vector3().copy(ray.origin).addScaledVector(ray.direction,limit),distance:limit,damageScale:1,penetrationScale:1,penetratedLayers:0,segments:[],stopReason:floorFirst?'floor':inRange?'target':'range',remainingPower:config.power};
 const index=staticBroadphaseFor(obstacles);if(index)index.queryRay(ray,limit,candidates);
 const intervals:Interval[]=[];for(let j=0,n=index?candidates.length:obstacles.length;j<n;j++){const i=index?candidates[j]:j,hit=obstacleRayInterval(ray,obstacles[i],i,rules);if(hit&&hit.start<limit-EPS){if(rules!=='legacy-v2')hit.physicalEnd=hit.end;hit.end=Math.min(hit.end,limit);intervals.push(hit);}}
 const boundaries=[...new Set(intervals.flatMap(i=>[i.start,i.end]))].sort((a,b)=>a-b);let lastMaterial:SurfaceMaterial|null=null,lastEnd=-Infinity;
 for(let k=0;k<boundaries.length-1;k++){
  const a=boundaries[k],b=boundaries[k+1];if(b-a<EPS||a>=limit)continue;
  if(floor>EPS&&floor<=a+EPS){trace.zone='wall';trace.distance=floor;trace.point.copy(ray.origin).addScaledVector(ray.direction,floor);trace.stopReason='floor';return trace;}
  const mid=(a+b)/2;let material:Interval|null=null;for(const i of intervals)if(i.start<=mid&&i.end>=mid&&(!material||PENETRATION_MATERIALS[i.material].resistance>PENETRATION_MATERIALS[material.material].resistance))material=i;if(!material){lastMaterial=null;continue;}
  // Overlapping collision volumes charge the greatest resistance, not a sum
  // of duplicate architecture boxes. Opaque inserts cannot hide inside wood.
  const definition=PENETRATION_MATERIALS[material.material];
  const newLayer=lastMaterial!==material.material||Math.abs(a-lastEnd)>EPS,thickness=b-a,cost=definition.resistance*thickness,blocked=definition.opaque?'material':newLayer&&trace.penetratedLayers>=config.maxLayers?'layers':cost>trace.remainingPower+EPS?'capacity':null;
  const before=trace.damageScale,after=blocked?before:before*(newLayer?definition.retention:1)*Math.exp(-cost/config.power*config.loss);
  const segment:PenetrationSegment={obstacle:material.index,material:material.material,entry:point(ray,a),exit:point(ray,b),entryNormal:{x:material.normalIn.x,y:material.normalIn.y,z:material.normalIn.z},exitNormal:{x:material.normalOut.x,y:material.normalOut.y,z:material.normalOut.z},thickness,resistance:definition.resistance,cost,damageBefore:before,damageAfter:after,penetrated:!blocked,inside:material.inside&&a===0};
  if(rules!=='legacy-v2'){
   // Boundary partitions account for resistance, not extra holes in a wall.
   // Keep their exact charge arithmetic while emitting only authored faces.
   if(material.inside||Math.abs(a-material.start)>EPS||sameMaterialContinues(intervals,material,a,true))segment.entrySurface=false;
   if(blocked||Math.abs(b-material.physicalEnd!)>EPS||sameMaterialContinues(intervals,material,b,false))segment.exitSurface=false;
  }
  trace.segments.push(segment);if(blocked){trace.zone='wall';trace.distance=a;trace.point.set(segment.entry.x,segment.entry.y,segment.entry.z);trace.stopReason=blocked;return trace;}
  trace.remainingPower=Math.max(0,trace.remainingPower-cost);trace.damageScale=trace.penetrationScale=after;if(newLayer)trace.penetratedLayers++;lastMaterial=material.material;lastEnd=b;
 }
 if(floor>EPS&&floor<limit){trace.zone='wall';trace.distance=floor;trace.point.copy(ray.origin).addScaledVector(ray.direction,floor);trace.stopReason='floor';}
 return trace;
}
