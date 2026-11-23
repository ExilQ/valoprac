import { Ray, Vector3 } from 'three';
import type { HitZone } from '../types';
import type { Target } from '../targets/Target';
import { nearestEnvironmentHit,ENVIRONMENT,type Obstacle } from './environment';
const environmentPoint=new Vector3(),targetPoint=new Vector3();
export interface HitResult {zone:HitZone;target:Target|null;point:Vector3;distance:number;penetrationScale?:number;penetratedLayers?:number}
export function castShot(ray:Ray,targets:Target[],out:HitResult,obstacles:Obstacle[]=ENVIRONMENT){
  const wallDistance=nearestEnvironmentHit(ray,150,environmentPoint,obstacles);
  out.zone=Number.isFinite(wallDistance)?'wall':'miss';out.target=null;out.distance=Number.isFinite(wallDistance)?wallDistance:150;
  out.point.copy(ray.direction).multiplyScalar(out.distance).add(ray.origin);
  for(const target of targets){
    const hit=target.intersect(ray,targetPoint);
    if(hit&&hit.distance<out.distance){out.zone=hit.zone;out.target=target;out.point.copy(targetPoint);out.distance=hit.distance;}
  }return out;
}

/** Versioned high-penetration approximation. Actual Riot material thickness tables
 * are not public calibration data. Thick structure/ramp volumes remain solid. */
export function castOperatorShot(ray:Ray,targets:Target[],out:HitResult,obstacles:Obstacle[]=ENVIRONMENT){
 castShot(ray,targets,out,obstacles);out.penetrationScale=1;out.penetratedLayers=0;
 if(out.zone!=='wall')return out;
 const blockedDistance=out.distance,point=new Vector3();let closest=150;
 for(const target of targets){const hit=target.intersect(ray,point);if(!hit||hit.distance>=closest||hit.distance<blockedDistance)continue;const segments:{entry:number;exit:number;limit:number}[]=[];
  for(const o of obstacles){let entry=-Infinity,exit=Infinity;for(const axis of ['x','y','z'] as const){const d=ray.direction[axis],start=ray.origin[axis],lo=o.box.min[axis],hi=o.box.max[axis];if(Math.abs(d)<1e-9){if(start<lo||start>hi){entry=Infinity;break;}}else{const a=(lo-start)/d,b=(hi-start)/d;entry=Math.max(entry,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));}}if(exit>=Math.max(0,entry)&&entry<hit.distance&&exit>0)segments.push({entry:Math.max(0,entry),exit:Math.min(exit,hit.distance),limit:o.ramp?0:o.kind==='cover'?.8:.35});
  }
  segments.sort((a,b)=>a.entry-b.entry);let total=0,allowed=segments.length>0&&segments.length<=2;for(const s of segments){const thickness=s.exit-s.entry;total+=thickness;if(thickness>s.limit+1e-6)allowed=false;}if(total>1.1)allowed=false;
  if(allowed){out.zone=hit.zone;out.target=target;out.distance=hit.distance;out.point.copy(point);out.penetrationScale=Math.pow(.65,segments.length);out.penetratedLayers=segments.length;closest=hit.distance;}
 }
 return out;
}
