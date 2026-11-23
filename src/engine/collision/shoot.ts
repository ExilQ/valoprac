import { Ray, Vector3 } from 'three';
import type { HitZone } from '../types';
import type { Target } from '../targets/Target';
import { nearestEnvironmentHit,ENVIRONMENT,type Obstacle } from './environment';
import {poseForTarget,type RenderedTargetFrame} from './RenderedTargets';
import {WEAPONS,type WeaponProfile} from '../../config/weapons';
import {traceBallisticRay,type PenetrationSegment} from './Ballistics';
import {LEGACY_SIMULATION_RULES,type SimulationRulesId} from '../simulation/rules';
const environmentPoint=new Vector3(),targetPoint=new Vector3();
export interface HitResult {zone:HitZone;target:Target|null;point:Vector3;distance:number;penetrationScale?:number;penetratedLayers?:number;segments?:PenetrationSegment[];stopReason?:string}
function intersectTarget(target:Target,ray:Ray,out:Vector3,frame?:RenderedTargetFrame){
  if(!target.enabled||!target.active)return null;
  if(!frame)return target.intersect(ray,out);
  const pose=poseForTarget(target,frame);return pose?target.intersect(ray,out,pose.matrices):null;
}
export function castShot(ray:Ray,targets:Target[],out:HitResult,obstacles:Obstacle[]=ENVIRONMENT,frame?:RenderedTargetFrame){
  out.penetrationScale=1;out.penetratedLayers=0;out.segments=[];out.stopReason=undefined;
  const wallDistance=nearestEnvironmentHit(ray,150,environmentPoint,obstacles);
  out.zone=Number.isFinite(wallDistance)?'wall':'miss';out.target=null;out.distance=Number.isFinite(wallDistance)?wallDistance:150;
  out.point.copy(ray.direction).multiplyScalar(out.distance).add(ray.origin);
  for(const target of targets){
    const hit=intersectTarget(target,ray,targetPoint,frame);
    if(hit&&hit.distance<out.distance){out.zone=hit.zone;out.target=target;out.point.copy(targetPoint);out.distance=hit.distance;}
  }return out;
}

/** Geometry and attenuation shared with defender bullets. The closest body
 * candidate is tested at the submitted pose; walls decide whether it is reachable.
 * Existing direct callers retain their defaults; simulations select rules explicitly. */
export function castWeaponShot(ray:Ray,targets:Target[],out:HitResult,profile:WeaponProfile,obstacles:Obstacle[]=ENVIRONMENT,frame?:RenderedTargetFrame,rules:SimulationRulesId=LEGACY_SIMULATION_RULES){
 let nearest=150,zone:HitZone='miss',selected:Target|null=null;const point=new Vector3();
 for(const target of targets){const hit=intersectTarget(target,ray,targetPoint,frame);if(hit&&hit.distance<nearest){nearest=hit.distance;zone=hit.zone;selected=target;point.copy(targetPoint);}}
 const trace=traceBallisticRay(ray,profile,selected?{zone,distance:nearest,point}:null,obstacles,150,rules);
 out.zone=trace.zone;out.target=trace.zone==='wall'||trace.zone==='miss'?null:selected;out.point.copy(trace.point);out.distance=trace.distance;out.penetrationScale=trace.damageScale;out.penetratedLayers=trace.penetratedLayers;out.segments=trace.segments;out.stopReason=trace.stopReason;return out;
}
/** Compatibility entry: Operator now follows the same material traversal. */
export function castOperatorShot(ray:Ray,targets:Target[],out:HitResult,obstacles:Obstacle[]=ENVIRONMENT,frame?:RenderedTargetFrame,rules:SimulationRulesId=LEGACY_SIMULATION_RULES){return castWeaponShot(ray,targets,out,WEAPONS.operator,obstacles,frame,rules);}
