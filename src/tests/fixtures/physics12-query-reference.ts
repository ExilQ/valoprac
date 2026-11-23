/** Frozen query reference from commit 0029c162de2756aa11092748514efe726e1ee217.
 * Import paths only adjusted; original clipping/traversal math and order retained.
 * Current materialFor defaults to legacy-v2 for this compatibility fixture. */
import {Ray,Vector3} from 'three';
import type {WeaponProfile} from '../../config/weapons';
import type {HitZone,Vec3} from '../../engine/types';
import {ENVIRONMENT,surfaceHeight,type Obstacle} from '../../engine/collision/environment';
import {PENETRATION_MATERIALS,PENETRATION_WEAPONS,materialFor,type SurfaceMaterial} from '../../config/penetration';
export interface PenetrationSegment {obstacle:number;material:SurfaceMaterial;entry:Vec3;exit:Vec3;entryNormal:Vec3;exitNormal:Vec3;thickness:number;resistance:number;cost:number;damageBefore:number;damageAfter:number;penetrated:boolean;inside:boolean;}
export interface BallisticTrace {zone:HitZone;point:Vector3;distance:number;damageScale:number;penetrationScale:number;penetratedLayers:number;segments:PenetrationSegment[];stopReason:'target'|'range'|'material'|'capacity'|'layers'|'floor';remainingPower:number;}
export interface BallisticTarget {distance:number;zone:HitZone;point:Vec3;}
interface Interval {index:number;start:number;end:number;normalIn:Vector3;normalOut:Vector3;inside:boolean;material:SurfaceMaterial;}
const EPS=1e-7;
/** Exact convex clipping of an AABB or the occupied wedge below a ramp. Normals
 * point out of the collision volume; the length is actual ray traversal. */
export function obstacleRayInterval(ray:Ray,obstacle:Obstacle,index=0):Interval|null{
 const b=obstacle.box,planes:[number,number,number,number][]=[[1,0,0,b.max.x],[-1,0,0,-b.min.x],[0,1,0,b.max.y],[0,-1,0,-b.min.y],[0,0,1,b.max.z],[0,0,-1,-b.min.z]];
 if(obstacle.ramp){const r=obstacle.ramp,slope=(r.high-r.low)/(b.max[r.axis]-b.min[r.axis])*r.ascending,intercept=r.ascending===1?r.low-slope*b.min[r.axis]:r.high-slope*b.min[r.axis];planes.push(r.axis==='x'?[-slope,1,0,intercept]:[0,1,-slope,intercept]);}
 let start=-Infinity,end=Infinity;const ni=new Vector3(),no=new Vector3();let inside=true;
 for(const[x,y,z,limit]of planes){const side=limit-x*ray.origin.x-y*ray.origin.y-z*ray.origin.z,denom=x*ray.direction.x+y*ray.direction.y+z*ray.direction.z;if(side< -EPS)inside=false;if(Math.abs(denom)<1e-12){if(side< -EPS)return null;continue;}const t=side/denom;if(denom<0&&t>start){start=t;ni.set(x,y,z).normalize();}else if(denom>0&&t<end){end=t;no.set(x,y,z).normalize();}if(start>end+EPS)return null;}
 if(end<=EPS||!Number.isFinite(end))return null;return{index,start:Math.max(0,start),end,normalIn:inside?ray.direction.clone().negate():ni,normalOut:no,inside,material:materialFor(obstacle)};
}
const point=(ray:Ray,d:number):Vec3=>({x:ray.origin.x+ray.direction.x*d,y:ray.origin.y+ray.direction.y*d,z:ray.origin.z+ray.direction.z*d});
/** Shared wall traversal for player and bot shots. Perception remains opaque.
 * Collision candidates are supplied independently from the shooter's knowledge. */
export function traceBallisticRay(ray:Ray,profile:WeaponProfile,target:BallisticTarget|null,obstacles:Obstacle[]=ENVIRONMENT,maxDistance=150):BallisticTrace{
 const floor=ray.direction.y< -1e-12?-ray.origin.y/ray.direction.y:Infinity;
 const inRange=!!target&&target.distance<=maxDistance,requestedLimit=Math.min(maxDistance,target?.distance??maxDistance),floorFirst=floor>EPS&&floor<requestedLimit;
 const config=PENETRATION_WEAPONS[profile.penetration??'medium'],limit=floorFirst?floor:requestedLimit,trace:BallisticTrace={zone:floorFirst?'wall':inRange?target!.zone:'miss',point:new Vector3().copy(ray.origin).addScaledVector(ray.direction,limit),distance:limit,damageScale:1,penetrationScale:1,penetratedLayers:0,segments:[],stopReason:floorFirst?'floor':inRange?'target':'range',remainingPower:config.power};
 const intervals:Interval[]=[];for(let i=0;i<obstacles.length;i++){const hit=obstacleRayInterval(ray,obstacles[i],i);if(hit&&hit.start<limit-EPS){hit.end=Math.min(hit.end,limit);intervals.push(hit);}}
 const boundaries=[...new Set(intervals.flatMap(i=>[i.start,i.end]))].sort((a,b)=>a-b);let lastMaterial:SurfaceMaterial|null=null,lastEnd=-Infinity;
 for(let k=0;k<boundaries.length-1;k++){
  const a=boundaries[k],b=boundaries[k+1];if(b-a<EPS||a>=limit)continue;
  if(floor>EPS&&floor<=a+EPS){trace.zone='wall';trace.distance=floor;trace.point.copy(ray.origin).addScaledVector(ray.direction,floor);trace.stopReason='floor';return trace;}
  const mid=(a+b)/2,active=intervals.filter(i=>i.start<=mid&&i.end>=mid);if(!active.length){lastMaterial=null;continue;}
  // Overlapping collision volumes charge the greatest resistance, not a sum
  // of duplicate architecture boxes. Opaque inserts cannot hide inside wood.
  const material=active.reduce((best,i)=>PENETRATION_MATERIALS[i.material].resistance>PENETRATION_MATERIALS[best.material].resistance?i:best,active[0]),definition=PENETRATION_MATERIALS[material.material];
  const newLayer=lastMaterial!==material.material||Math.abs(a-lastEnd)>EPS,thickness=b-a,cost=definition.resistance*thickness,blocked=definition.opaque?'material':newLayer&&trace.penetratedLayers>=config.maxLayers?'layers':cost>trace.remainingPower+EPS?'capacity':null;
  const before=trace.damageScale,after=blocked?before:before*(newLayer?definition.retention:1)*Math.exp(-cost/config.power*config.loss);
  const segment:PenetrationSegment={obstacle:material.index,material:material.material,entry:point(ray,a),exit:point(ray,b),entryNormal:{x:material.normalIn.x,y:material.normalIn.y,z:material.normalIn.z},exitNormal:{x:material.normalOut.x,y:material.normalOut.y,z:material.normalOut.z},thickness,resistance:definition.resistance,cost,damageBefore:before,damageAfter:after,penetrated:!blocked,inside:material.inside&&a===0};
  trace.segments.push(segment);if(blocked){trace.zone='wall';trace.distance=a;trace.point.set(segment.entry.x,segment.entry.y,segment.entry.z);trace.stopReason=blocked;return trace;}
  trace.remainingPower=Math.max(0,trace.remainingPower-cost);trace.damageScale=trace.penetrationScale=after;if(newLayer)trace.penetratedLayers++;lastMaterial=material.material;lastEnd=b;
 }
 if(floor>EPS&&floor<limit){trace.zone='wall';trace.distance=floor;trace.point.copy(ray.origin).addScaledVector(ray.direction,floor);trace.stopReason='floor';}
 return trace;
}

const tempHit=new Vector3();
export function nearestEnvironmentHit(ray:Ray,max:number,out:Vector3,obstacles:Obstacle[]=ENVIRONMENT){let nearest=max;let found=false;
  for(const o of obstacles){if(o.ramp){const r=o.ramp,axis=r.axis,slope=(r.high-r.low)/(o.box.max[axis]-o.box.min[axis])*r.ascending,intercept=r.ascending===1?r.low-slope*o.box.min[axis]:r.high-slope*o.box.min[axis],denom=ray.direction.y-slope*ray.direction[axis];if(Math.abs(denom)>1e-9){const d=(slope*ray.origin[axis]+intercept-ray.origin.y)/denom;if(d>0&&d<nearest){tempHit.copy(ray.direction).multiplyScalar(d).add(ray.origin);if(tempHit.x>=o.box.min.x&&tempHit.x<=o.box.max.x&&tempHit.z>=o.box.min.z&&tempHit.z<=o.box.max.z){nearest=d;out.copy(tempHit);found=true;}}}if(ray.intersectBox(o.box,tempHit)&&tempHit.y<=surfaceHeight(o,tempHit.x,tempHit.z)+1e-7){const d=ray.origin.distanceTo(tempHit);if(d<nearest){nearest=d;out.copy(tempHit);found=true;}}continue;}if(ray.intersectBox(o.box,tempHit)){const d=ray.origin.distanceTo(tempHit);if(d<nearest){nearest=d;out.copy(tempHit);found=true;}}}
  if(ray.direction.y<0){const d=-ray.origin.y/ray.direction.y;if(d>0&&d<nearest){nearest=d;out.copy(ray.direction).multiplyScalar(d).add(ray.origin);found=true;}}
  return found?nearest:Infinity;
}

const clamp=(n:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,n));
import type {PlayerBody} from "../../engine/tactical/DefenderAI";
function toWorld(p:PlayerBody,x:number,y:number,z=0):Vec3{const c=Math.cos(p.yaw),s=Math.sin(p.yaw);return{x:p.position.x+x*c+z*s,y:p.position.y+y,z:p.position.z-x*s+z*c};}
export function playerVisibilitySamples(p:PlayerBody):Vec3[]{const torso=p.eyeHeight-.51+clamp(p.crouch,0,1)*.09;return[[0,p.eyeHeight+.04],[-.12,p.eyeHeight+.04],[.12,p.eyeHeight+.04],[0,torso],[-.34,torso+.12],[.34,torso+.12],[-.13,.3],[.13,.3],[0,.72-clamp(p.crouch,0,1)*.2]].map(([x,y])=>toWorld(p,x,y));}
