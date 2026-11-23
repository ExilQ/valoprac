import {COMPLEX_LEVEL} from './complex';
import {MECHANICS_LEVELS} from './mechanics';
import {LEVEL_IDS,LEVEL_SPECS as specs} from '../../config/tactical';
export {LEVEL_IDS} from '../../config/tactical';
import {Box3,Ray,Vector3} from 'three';
import type {PracticeMap,Vec3,WeaponId} from '../types';
import {nearestEnvironmentHit,type Obstacle} from '../collision/environment';
export interface AngleSector {
 id:string;label:string;position:Vec3;jitter:number;radius:number;
 zoneId?:string;weapon?:WeaponId;facingYaw?:number;
 /** Grounded, collision-validated local choices. AI must still recheck each move. */
 alternatives?:Vec3[];navigation?:Vec3[];
}
export interface TacticalLevel {id:PracticeMap;title:string;family:string;description:string;obstacles:Obstacle[];spawn:Vec3;route:Vec3[];angles:AngleSector[];bounds:readonly number[];}

export function makeLevel(id:typeof LEVEL_IDS[number]):TacticalLevel{
 const s=specs[id],obstacles:Obstacle[]=[];const add=(x1:number,y1:number,z1:number,x2:number,y2:number,z2:number,kind:'wall'|'cover'='wall',color=0x596e75)=>{const o:Obstacle={box:new Box3(new Vector3(x1,y1,z1),new Vector3(x2,y2,z2)),kind,color};obstacles.push(o);return o;};
 const width=s.width,last=2*width;add(-width/2-.4,0,-s.depth-.7,last+width/2+.4,6,-s.depth, 'wall',0x334950);add(-width/2-.4,0,7,last+width/2+.4,4,7.4);add(-width/2-.4,0,-s.depth,-width/2,6,7);add(last+width/2,0,-s.depth,last+width/2+.4,6,7);
 const angles:AngleSector[]=[],route:Vec3[]=[{x:-width/2+1,y:0,z:5}];
 for(let i=0;i<3;i++){
  const x=i*width,h=s.heights[i],door=id==='garage'?.95:1.25,back=-s.depth;
  // Separate rooms and narrow offset entry windows restrict simultaneous threat exposure.
  add(x-width/2,0,-.35,x-door,5.8,.35);add(x+door,0,-.35,x+width/2,5.8,.35);
  if(i<2){if(id==='site'){add(x+width/2-.18,0,back+3,x+width/2+.18,5.8,0);}else add(x+width/2-.18,0,back,x+width/2+.18,5.8,0);}
  if(h>0){
   const rampEnd=-6,platformStart=-6;add(x-width/2+.2,0,back,x+width/2-.2,h,platformStart,'cover',0x48656e);
   if(id==='tower'&&i===0){for(let k=0;k<6;k++)add(x-.95,0,-(k+1),x+.95,(k+1)*.2,-k,'cover',0x75908d);}
   else{const r=add(x-1.05,0,rampEnd,x+1.05,h,.5,'cover',0x6b898a);r.ramp={axis:'z',low:0,high:h,ascending:-1};}
   // A clear upper landing is navigable and blocks bullets at the same physical height.
  }
  const offset=i%2===0?.4:-.4;
  const position={x:x+offset,y:h,z:back+2.4};
  angles.push({id:`${id}-${i+1}`,label:`${i+1}번 ${h>0?'상단':'하단'} 수비각`,position,jitter:.16,radius:.7,zoneId:`${id}-${i+1}`,weapon:(id==='long'&&i===0||h>1.5)?'operator':id==='garage'?'sheriff':i===1?'rifleB':'rifleA',facingYaw:0,alternatives:[{x:position.x-.16,y:h,z:position.z-.16},{x:position.x+.16,y:h,z:position.z+.16}],navigation:[{x:position.x-.55,y:h,z:position.z},position,{x:position.x+.55,y:h,z:position.z}]});
  const coverZ=Math.max(back+4,-9);add(x-width/2+.5,h,coverZ,x-width/2+2,h+.95,coverZ+1.4,'cover',0x718a83);
  // A second offset anchor creates a real alternative hold/reposition choice.
  // It stays below head height and clear of the existing entry/step/ramp routes.
  const sideZ=id==='long'?back*.5:id==='garage'?back+1:back+3;
  add(x+width/2-2.2,h,sideZ,x+width/2-.6,h+(id==='garage'?.82:id==='site'?1.15:.98),sideZ+1.6,'cover',id==='site'?0x8a8b72:0x59777a);
  route.push({x:x-2,y:0,z:5},{x,y:0,z:5},{x:x+2,y:0,z:5});
 }
 return {id,title:s.title,family:s.family,description:s.description,obstacles,angles,route,spawn:route[0],bounds:[-width/2-.5,-s.depth-1,last+width+1,s.depth+9]};
}
export const LEVELS=Object.fromEntries(LEVEL_IDS.map(id=>[id,makeLevel(id)])) as Record<typeof LEVEL_IDS[number],TacticalLevel>;
export const levelFor=(id:string):TacticalLevel|null=>LEVELS[id as typeof LEVEL_IDS[number]]??MECHANICS_LEVELS[id as keyof typeof MECHANICS_LEVELS]??(id==='complex'?COMPLEX_LEVEL:null);
const ray=new Ray(),from=new Vector3(),to=new Vector3(),hit=new Vector3();
export function visibleBetween(obstacles:Obstacle[],a:Vec3,b:Vec3){from.set(a.x,a.y,a.z);to.set(b.x,b.y,b.z).sub(from);const d=to.length();if(d<1e-6)return true;ray.set(from,to.multiplyScalar(1/d));return nearestEnvironmentHit(ray,d-1e-5,hit,obstacles)>=d-1e-5;}
export function standingSpace(obstacles:Obstacle[],p:Vec3,radius=.3,height=1.85){for(const o of obstacles){if(o.ramp)continue;const b=o.box;if(p.y>=b.max.y-1e-6||p.y+height<=b.min.y)continue;if(p.x+radius>b.min.x&&p.x-radius<b.max.x&&p.z+radius>b.min.z&&p.z-radius<b.max.z)return false;}return true;}
export function validateLevel(level:TacticalLevel){return level.route.map(p=>({position:p,visible:level.angles.filter(a=>visibleBetween(level.obstacles,{x:p.x,y:p.y+1.64,z:p.z},{x:a.position.x,y:a.position.y+1.68,z:a.position.z})).map(a=>a.id)}));}
