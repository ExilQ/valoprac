import {Box3,Vector3} from 'three';
import type {Obstacle} from '../collision/environment';
import type {SurfaceMaterial} from '../../config/penetration';
import type {Vec3} from '../types';
import type {AngleSector,TacticalLevel} from './levels';

/** Original metre-scale training architecture. These dimensions are provisional
 * VALOPRAC exercises, not reconstructed geometry or verified native movement. */
function builder(){
 const obstacles:Obstacle[]=[];
 const box=(x1:number,y1:number,z1:number,x2:number,y2:number,z2:number,kind:'wall'|'cover'='wall',material:SurfaceMaterial='reinforced',color=0xb8c2bb)=>{
  const obstacle:Obstacle={box:new Box3(new Vector3(Math.min(x1,x2),y1,Math.min(z1,z2)),new Vector3(Math.max(x1,x2),y2,Math.max(z1,z2))),kind,material,color};
  obstacles.push(obstacle);return obstacle;
 };
 return{obstacles,box};
}

const movement=builder();
const m=movement.box;
// A continuous quiet return gallery flanks three connected manual movement
// exercises. Missing a raised landing returns to the same physical ground floor.
m(-12.4,0,-44.4,12.4,5.7,-44);
m(-12.4,0,7.8,12.4,5.7,8.2);
m(-12.4,0,-44,-12,5.7,7.8);
m(12,0,-44,12.4,5.7,7.8);
const up=m(-2.8,0,-14,2.8,.8,-8,'cover','concrete',0x819e9b);
up.ramp={axis:'z',low:0,high:.8,ascending:-1};
for(const[start,end]of[[-20,-14],[-26,-22],[-32,-28],[-34,-33]] as const)m(-2.8,0,start,2.8,.8,end,'cover','concrete',0x819e9b);
const down=m(-2.8,0,-40,2.8,.8,-34,'cover','concrete',0x819e9b);
down.ramp={axis:'z',low:0,high:.8,ascending:1};
// Eight 15 cm risers are ordinary solid collision, followed by a broad landing
// and a separate descending ramp. A crouch portal is a real low ceiling.
for(let i=0;i<8;i++)m(6,0,-7-i,9,(i+1)*.15,-6-i,'cover','concrete',0xa6a48d);
m(6,0,-22,9,1.2,-14,'cover','concrete',0xa6a48d);
const stairReturn=m(6,0,-30,9,1.2,-22,'cover','concrete',0xa6a48d);
stairReturn.ramp={axis:'z',low:0,high:1.2,ascending:1};
m(5.7,1.45,-1.6,9.3,2.1,-.9,'wall','reinforced',0x6b8389);
m(5.7,0,-1.6,6,1.45,-.9);m(9,0,-1.6,9.3,1.45,-.9);
// Jump-peek parapet: the visible far lane is revealed by real eye height.
m(-10.3,0,-26,-7,1.75,-25.7,'cover','concrete',0x9ba79a);
export const BUNNY_RETURN_ROUTE:Vec3[]=[{x:-5,y:0,z:5},{x:-5,y:0,z:-40},{x:10.5,y:0,z:-40},{x:10.5,y:0,z:5}];
export const BUNNY_RAMP_ROUTE:Vec3[]=[{x:0,y:0,z:5},{x:0,y:0,z:-7.5},{x:0,y:.8,z:-14.2},{x:0,y:.8,z:-19}];
export const BUNNY_STAIR_ROUTE:Vec3[]=[{x:7.5,y:0,z:-4},...Array.from({length:8},(_,i)=>({x:7.5,y:(i+1)*.15,z:-6.5-i})),{x:7.5,y:1.2,z:-20},{x:7.5,y:0,z:-31}];
export const BUNNY_JUMP_GAPS=Object.freeze([{takeoffZ:-19.5,landingZ:-22.5},{takeoffZ:-25.5,landingZ:-28.5}]);
export const BUNNY_LEVEL:TacticalLevel={id:'bunny',title:'버니합 훈련',family:'운동 역학 연구동',description:'수동 연속 점프 · 공중 방향 전환 · 경사로와 2m 간격 플랫폼 · 지면 복귀로',obstacles:movement.obstacles,spawn:{x:0,y:0,z:5},route:[...BUNNY_RAMP_ROUTE,...BUNNY_RETURN_ROUTE,...BUNNY_STAIR_ROUTE],angles:[],bounds:[-12.4,-44.4,24.8,52.6]};

const penetration=builder(),p=penetration.box;
p(-15.4,0,-21.5,15.4,5.8,-21);
p(-15.4,0,7.6,15.4,5.8,8);
p(-15.4,0,-21,-15,5.8,7.6);p(15,0,-21,15.4,5.8,7.6);
const angles:AngleSector[]=[],route:Vec3[]=[{x:-13,y:0,z:5}];
/** Continuous routes are separate from the level's visibility/label checkpoints. */
export const WALLBANG_APPROACH_ROUTES:Vec3[][]=[];
export const WALLBANG_SAMPLES=Object.freeze([
 {centerX:-10,material:'thinWood' as const,thickness:.16,label:'목재 · 낮은 저항',color:0x9d805b},
 {centerX:0,material:'thinMetal' as const,thickness:.16,label:'강판 · 중간 저항',color:0x6c8c96},
 {centerX:10,material:'reinforced' as const,thickness:.28,label:'보강벽 · 관통 불가',color:0xa6aab0}
]);
for(const[index,sample]of WALLBANG_SAMPLES.entries()){
 const x=sample.centerX;
 p(x-5,0,-.22,x-1.4,5.8,.22);p(x+1.4,0,-.22,x+5,5.8,.22);
 p(x-1.4,3.25,-.22,x+1.4,5.8,.22);
 if(index<2)p(x+4.85,0,-21,x+5.15,5.8,0);
 p(x-1.8,0,-8-sample.thickness/2,x+1.8,2.5,-8+sample.thickness/2,'cover',sample.material,sample.color);
 // Side approaches offer visible confirmation before retreating behind the
 // sample. Sound or earlier visibility may inform a bot; the map grants no vision.
 const position={x,y:0,z:-16},side={x:x+3,y:0,z:-5};
 angles.push({id:`wallbang-${index+1}`,label:sample.label,zoneId:`material-${index+1}`,position,jitter:.12,radius:.5,weapon:index===1?'operator':'rifleA',facingYaw:0,alternatives:[{x:x-.12,y:0,z:-16.12},{x:x+.12,y:0,z:-15.88}],navigation:[{x:x-.35,y:0,z:-16},position,{x:x+.35,y:0,z:-16}]});
 route.push({x:x-2,y:0,z:5},{x,y:0,z:5},side);
 WALLBANG_APPROACH_ROUTES.push([{x,y:0,z:5},{x,y:0,z:-3},side,{x:x+3,y:0,z:-18}]);
}
export const WALLBANG_LEVEL:TacticalLevel={id:'wallbang',title:'월샷 훈련',family:'재료 탄도 연구동',description:'목재·강판·보강벽 · 실제 두께와 입사각 · 측면 확인 후 엄폐 사격',obstacles:penetration.obstacles,spawn:route[0],route,angles,bounds:[-15.4,-21.5,30.8,29.5]};
export const MECHANICS_LEVELS={bunny:BUNNY_LEVEL,wallbang:WALLBANG_LEVEL} as const;
