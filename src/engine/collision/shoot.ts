import { Ray, Vector3 } from 'three';
import type { HitZone } from '../types';
import type { Target } from '../targets/Target';
import { nearestEnvironmentHit } from './environment';
const environmentPoint=new Vector3(),targetPoint=new Vector3();
export interface HitResult {zone:HitZone;target:Target|null;point:Vector3;distance:number}
export function castShot(ray:Ray,targets:Target[],out:HitResult){
  const wallDistance=nearestEnvironmentHit(ray,150,environmentPoint);
  out.zone=Number.isFinite(wallDistance)?'wall':'miss';out.target=null;out.distance=Number.isFinite(wallDistance)?wallDistance:150;
  out.point.copy(ray.direction).multiplyScalar(out.distance).add(ray.origin);
  for(const target of targets){
    const hit=target.intersect(ray,targetPoint);
    if(hit&&hit.distance<out.distance){out.zone=hit.zone;out.target=target;out.point.copy(targetPoint);out.distance=hit.distance;}
  }return out;
}
