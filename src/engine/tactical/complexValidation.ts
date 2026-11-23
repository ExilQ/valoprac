import {COMPLEX_LEVEL,PEEK_ZONES,COMPLEX_CIRCULATION} from './complex';
import {standingSpace,visibleBetween,type TacticalLevel,type AngleSector} from './levels';
import {surfaceHeight} from '../collision/environment';
import type {Vec3} from '../types';

export function supportHeight(level:TacticalLevel,p:Vec3){
 let y=0;
 for(const o of level.obstacles){const b=o.box;if(p.x>=b.min.x&&p.x<=b.max.x&&p.z>=b.min.z&&p.z<=b.max.z){const h=surfaceHeight(o,p.x,p.z);if(b.min.y<=p.y+1e-6&&h<=p.y+.300001)y=Math.max(y,h);}}
 return y;
}
/** Same 30cm step allowance as Movement, including the true ramp surface. This
 * is a route audit, not a second movement implementation or a player assist. */
export function routeSpace(level:TacticalLevel,p:Vec3,radius=.28){
 for(const o of level.obstacles){const b=o.box;
  if(p.y+1.85<=b.min.y||p.y>=b.max.y||surfaceHeight(o,p.x,p.z)<=p.y+.300001)continue;
  if(p.x+radius>b.min.x&&p.x-radius<b.max.x&&p.z+radius>b.min.z&&p.z-radius<b.max.z)return false;
 }
 return Math.abs(supportHeight(level,p)-p.y)<=.300001;
}
export function sampleRoute(route:readonly Vec3[],spacing=.2){
 const out:Vec3[]=[];
 if(route.length)out.push({...route[0]});
 for(let j=1;j<route.length;j++){const a=route[j-1],b=route[j],n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/spacing));
  for(let i=1;i<=n;i++){const t=i/n;out.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});}
 }
 return out;
}
export function exposedAngles(level:TacticalLevel,p:Vec3,angles:readonly AngleSector[],jitterX=0,jitterZ=0){
 return angles.filter(a=>visibleBetween(level.obstacles,{x:p.x,y:p.y+1.64,z:p.z},{x:a.position.x+jitterX,y:a.position.y+1.68,z:a.position.z+jitterZ})).map(a=>a.id);
}
/** Encloses Simulation's actual alternative + x-jitter spawning contract.
 * Navigation remains a separate, grounded local path; it never changes spawn y. */
export function defenderPlacements(a:AngleSector){
 const bases=a.alternatives?.length?a.alternatives:[a.position];
 return [a.position,...bases.flatMap(p=>[-a.jitter,0,a.jitter].map(dx=>({...p,x:p.x+dx}))),...sampleRoute(a.navigation??[],.1)];
}
export function potentiallyExposedAngles(level:TacticalLevel,p:Vec3,angles:readonly AngleSector[]){
 const eye={x:p.x,y:p.y+1.64,z:p.z};
 return angles.filter(a=>defenderPlacements(a).some(q=>visibleBetween(level.obstacles,eye,{x:q.x,y:q.y+1.68,z:q.z}))).map(a=>a.id);
}
export function auditPeekingGeometry(){
 const level=COMPLEX_LEVEL;
 const zones=PEEK_ZONES.map(zone=>{
  const defenders=level.angles.filter(a=>zone.angles.includes(a.id)),samples=sampleRoute(zone.route,.2);
  const exposure=samples.map(position=>({position,visible:exposedAngles(level,position,defenders)}));
  const randomizedExposure=samples.map(position=>({position,visible:potentiallyExposedAngles(level,position,defenders)}));
  const routeFailures=(zone.routes??[zone.route]).flatMap((r,index)=>sampleRoute(r,.2).filter(p=>!routeSpace(level,p)).map(position=>({route:index,position})));
  const maxThreats=Math.max(0,...exposure.map(s=>s.visible.length));
  return {id:zone.id,scenario:zone.scenario,defenders:defenders.length,routeSamples:samples.length,maxSimultaneousThreats:maxThreats,maxPossibleThreats:Math.max(0,...randomizedExposure.map(s=>s.visible.length)),progressiveOnly:zone.scenario==='slicing',initialVisible:potentiallyExposedAngles(level,zone.entry,defenders),routeFailures,
   revealed:[...new Set(exposure.flatMap(s=>s.visible))],exposure};
 });
 const invalidDefenders=level.angles.flatMap(a=>defenderPlacements(a).filter(p=>!standingSpace(level.obstacles,p,.4)||Math.abs(supportHeight(level,p)-p.y)>1e-5).map(position=>({id:a.id,position})));
 const circulationFailures=COMPLEX_CIRCULATION.flatMap((r,i)=>sampleRoute(r,.2).filter(p=>!routeSpace(level,p)).map(position=>({route:i,position})));
 return {schema:2,method:'Actual obstacle raycasts; 20cm route samples with Movement step-height limits; alternative-plus-jitter spawn bounds and 10cm defender navigation samples; separate real Movement traversal regression tests',level:level.id,obstacles:level.obstacles.length,sectors:level.angles.length,zones,invalidDefenders,circulationFailures,
  passed:invalidDefenders.length===0&&circulationFailures.length===0&&zones.every(z=>!z.initialVisible.length&&!z.routeFailures.length&&z.revealed.length===z.defenders&&(!z.progressiveOnly||z.maxPossibleThreats<=1))};
}
