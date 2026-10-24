import { Box3, Vector3, Ray } from 'three';
export interface Obstacle {box:Box3; color:number; kind:'cover'|'wall'}
const box=(x:number,y:number,z:number,w:number,h:number,d:number,color:number,kind:'cover'|'wall'='wall'):Obstacle=>({box:new Box3(new Vector3(x-w/2,y-h/2,z-d/2),new Vector3(x+w/2,y+h/2,z+d/2)),color,kind});
export const ENVIRONMENT:Obstacle[]=[
  box(-12.4,3,-10,0.8,6,42,0x242d36),box(12.4,3,-10,0.8,6,42,0x242d36),
  box(0,3,-30.4,25.6,6,0.8,0x252e36),box(0,3,10.4,25.6,6,0.8,0x242d36),
  box(-6.4,0.72,-12,1.5,1.44,2,0x475053,'cover'),
  box(6.4,1.1,-16,1.5,2.2,1.8,0x434c52,'cover')
];
const tempHit=new Vector3();
export function nearestEnvironmentHit(ray:Ray,max:number,out:Vector3,obstacles:Obstacle[]=ENVIRONMENT){let nearest=max;let found=false;
  for(const o of obstacles){if(ray.intersectBox(o.box,tempHit)){const d=ray.origin.distanceTo(tempHit);if(d<nearest){nearest=d;out.copy(tempHit);found=true;}}}
  if(ray.direction.y<0){const d=-ray.origin.y/ray.direction.y;if(d>0&&d<nearest){nearest=d;out.copy(ray.direction).multiplyScalar(d).add(ray.origin);found=true;}}
  return found?nearest:Infinity;
}
