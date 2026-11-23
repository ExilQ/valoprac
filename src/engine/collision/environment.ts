import { Box3, Vector3, Ray } from 'three';
import type {SurfaceMaterial} from '../../config/penetration';
export interface Obstacle {box:Box3; color:number; kind:'cover'|'wall';material?:SurfaceMaterial;ramp?:{axis:'x'|'z';low:number;high:number;ascending:1|-1}}
export function surfaceHeight(o:Obstacle,x:number,z:number){if(!o.ramp)return o.box.max.y;const r=o.ramp,v=r.axis==='x'?x:z,min=o.box.min[r.axis],max=o.box.max[r.axis];const t=Math.max(0,Math.min(1,(v-min)/(max-min)));return r.low+(r.high-r.low)*(r.ascending===1?t:1-t);}
const box=(x:number,y:number,z:number,w:number,h:number,d:number,color:number,kind:'cover'|'wall'='wall'):Obstacle=>({box:new Box3(new Vector3(x-w/2,y-h/2,z-d/2),new Vector3(x+w/2,y+h/2,z+d/2)),color,kind});
export const ENVIRONMENT:Obstacle[]=[
  box(-12.4,3,-10,0.8,6,42,0x242d36),box(12.4,3,-10,0.8,6,42,0x242d36),
  box(0,3,-30.4,25.6,6,0.8,0x252e36),box(0,3,10.4,25.6,6,0.8,0x242d36),
  box(-6.4,0.72,-12,1.5,1.44,2,0x475053,'cover'),
  box(6.4,1.1,-16,1.5,2.2,1.8,0x434c52,'cover')
];
const tempHit=new Vector3();
export function nearestEnvironmentHit(ray:Ray,max:number,out:Vector3,obstacles:Obstacle[]=ENVIRONMENT){let nearest=max;let found=false;
  for(const o of obstacles){if(o.ramp){const r=o.ramp,axis=r.axis,slope=(r.high-r.low)/(o.box.max[axis]-o.box.min[axis])*r.ascending,intercept=r.ascending===1?r.low-slope*o.box.min[axis]:r.high-slope*o.box.min[axis],denom=ray.direction.y-slope*ray.direction[axis];if(Math.abs(denom)>1e-9){const d=(slope*ray.origin[axis]+intercept-ray.origin.y)/denom;if(d>0&&d<nearest){tempHit.copy(ray.direction).multiplyScalar(d).add(ray.origin);if(tempHit.x>=o.box.min.x&&tempHit.x<=o.box.max.x&&tempHit.z>=o.box.min.z&&tempHit.z<=o.box.max.z){nearest=d;out.copy(tempHit);found=true;}}}if(ray.intersectBox(o.box,tempHit)&&tempHit.y<=surfaceHeight(o,tempHit.x,tempHit.z)+1e-7){const d=ray.origin.distanceTo(tempHit);if(d<nearest){nearest=d;out.copy(tempHit);found=true;}}continue;}if(ray.intersectBox(o.box,tempHit)){const d=ray.origin.distanceTo(tempHit);if(d<nearest){nearest=d;out.copy(tempHit);found=true;}}}
  if(ray.direction.y<0){const d=-ray.origin.y/ray.direction.y;if(d>0&&d<nearest){nearest=d;out.copy(ray.direction).multiplyScalar(d).add(ray.origin);found=true;}}
  return found?nearest:Infinity;
}
