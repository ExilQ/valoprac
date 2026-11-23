import {Box3,Vector3} from 'three';
import type {PeekScenario,Vec3,WeaponId} from '../types';
import type {Obstacle} from '../collision/environment';
import type {AngleSector,TacticalLevel} from './levels';

export interface PeekZone {
 id:string;scenario:PeekScenario;name:string;focus:string;
 theme:'facility'|'research'|'urban'|'courtyard';center:Vec3;entry:Vec3;exit:Vec3;
 route:Vec3[];routes?:Vec3[][];angles:string[];
 recommended:'operator'|'rifleA'|'rifleB'|'sheriff';difficulty:number;vertical:number;
 material:'steel'|'concrete'|'tile'|'wood';bounds?:readonly [number,number,number,number];
}
const scenarios:PeekScenario[]=['wide','shoulder','jiggle','crouch','jump','vertical','slicing','mixed'];
const names=['와이드 피킹','숄더 피킹','지글 피킹','앉기 피킹','점프 피킹','고저차 피킹','각쪼개기','복합 피킹'];
const focus=['스윙 거리와 제동 후 첫 발','사격 유도와 볼트 회복창 활용','짧은 정보 노출과 반복 피킹 위험','엄폐 높이와 실제 머리 위치','공중 정보 수집과 안전한 복귀','계단·경사로·상단 방어각','한 번에 한 사선만 드러내기','교차 사선·소리·재배치'];
export const PEEK_ZONES:PeekZone[]=[];
export const COMPLEX_OBSTACLES:Obstacle[]=[];
const box=(x1:number,y1:number,z1:number,x2:number,y2:number,z2:number,kind:'wall'|'cover'='wall',color=0x9aa8a5)=>{
 const o:Obstacle={box:new Box3(new Vector3(Math.min(x1,x2),y1,Math.min(z1,z2)),new Vector3(Math.max(x1,x2),y2,Math.max(z1,z2))),kind,color};
 COMPLEX_OBSTACLES.push(o);return o;
};
const angles:AngleSector[]=[];
// One connected building: 16m central gallery, two 7m rear service galleries,
// and both outer return routes. Bay boundaries are collision, not teleport rooms.
box(-50,0,-46,50,6,-45.5);box(-50,0,45.5,50,6,46);
box(-50,0,-46,-49.5,6,46);box(49.5,0,-46,50,6,46);
for(let i=0;i<8;i++){
 const x=-36+(i%4)*24,sign=i<4?-1:1,front=sign*8,back=sign*38,entryX=x-6;
 const p=(u:number,d:number,y=0):Vec3=>({x:x+u,y,z:sign*d});
 const zone:PeekZone={id:String.fromCharCode(65+i),scenario:scenarios[i],name:names[i],focus:focus[i],theme:(['facility','research','urban','courtyard'] as const)[i%4],center:p(0,23),
  // Start behind the left entry jamb. The defender cannot see the spawn point.
  entry:p(-9.5,5),exit:p(7,44),route:[],routes:[],angles:[],recommended:i===1||i===4?'operator':i===2?'sheriff':i===3?'rifleB':'rifleA',difficulty:i===7?3:i===0?1:2,vertical:i===5?2.4:i===7?1.2:0,material:(['concrete','tile','steel','wood'] as const)[i%4],bounds:[x-12,Math.min(front,back),24,30]};
 PEEK_ZONES.push(zone);
 // Offset front/rear doors provide two real approaches to every exercise bay.
 box(x-12,0,front-.2,entryX-1.5,5.5,front+.2);box(entryX+1.5,0,front-.2,x+12,5.5,front+.2);
 box(entryX-1.5,3.2,front-.2,entryX+1.5,5.5,front+.2);
 box(x-12,0,back-.2,x+5.5,5.5,back+.2);box(x+8.5,0,back-.2,x+12,5.5,back+.2);
 box(x+5.5,i===5?4.2:3.2,back-.2,x+8.5,5.5,back+.2);
 box(x-12,0,Math.min(front,back),x-11.6,5.5,Math.max(front,back));box(x+11.6,0,Math.min(front,back),x+12,5.5,Math.max(front,back));
 const addAngle=(n:number,u:number,d:number,y=0,weapon:WeaponId='rifleA')=>{
  const id=`${zone.id}-${n}`,position=p(u,d,y);
  const alternatives=[p(u-.18,d-.18,y),p(u+.18,d-.18,y),p(u-.18,d+.18,y),p(u+.18,d+.18,y)];
  angles.push({id,label:`${zone.id} · ${zone.name} ${n}`,position,jitter:.18,radius:.65,zoneId:zone.id,weapon,facingYaw:sign<0?0:Math.PI,
   alternatives,navigation:[p(u-.55,d,y),position,p(u+.55,d,y)]});zone.angles.push(id);
 };
 if(i===6){
  // Three separate aperture/cell pairs. A 4m front gallery lets the player slice
  // the angles progressively; no sampled position reveals two primary defenders.
  for(let j=0;j<3;j++){
   const u=-8+j*8,c=x+u;
   box(c-3.8,0,18-.2,c-.85,5,18+.2);box(c+.85,0,18-.2,c+3.8,5,18+.2);
   if(j<2)box(c+3.8,0,18,c+4.2,5,33);
   addAngle(j+1,u,30,0,j===1?'rifleB':'rifleA');
  }
  zone.route=[zone.entry,p(-6,6.5),p(-6,11),p(-8,14),p(0,14),p(8,14)];
  // Upper side of the dividers is a clear rear flank. The first move crosses
  // an aperture, not a solid separator, before entering the common back aisle.
  zone.routes=[zone.route,[zone.exit,p(7,36),p(0,36),p(-8,36),p(-8,30)]];
 }else{
  // Full-height offset construction pier is the exposure edge for manual
  // shoulder/jiggle/wide movement; Crouch has a 1.35m silhouette-changing edge.
  box(x-3.7,0,sign*12,x-2.5,i===3?1.35:3.2,sign*22,'cover',0x697f83);
  const targetDepth=i===1||i===4?34:i===2?23:30;let height=0;
  if(i===5){
   height=2.4;box(x-1,0,27,x+10,2.4,37,'cover');
   const ramp=box(x+6,0,14,x+8.4,2.4,27,'cover');ramp.ramp={axis:'z',low:0,high:2.4,ascending:1};
   // Twelve 20cm risers run the entire 13m approach and meet the platform.
   for(let k=0;k<12;k++)box(x-.8,0,14+k*13/12,x+1,(k+1)*.2,14+(k+1)*13/12,'cover');
   const rear=box(x+5.7,0,37,x+8.3,2.4,43,'cover');rear.ramp={axis:'z',low:0,high:2.4,ascending:-1};
  }
  if(i===7){
   height=1.2;box(x+2,0,27,x+10,1.2,36,'cover');
   const ramp=box(x+7,0,16,x+9,1.2,27,'cover');ramp.ramp={axis:'z',low:0,high:1.2,ascending:1};
   const rear=box(x+5.7,0,36,x+8.3,1.2,43,'cover');rear.ramp={axis:'z',low:0,high:1.2,ascending:-1};
   addAngle(2,-7,31,0,'rifleB');box(x-.5,0,19,x+1,1.1,23,'cover');
  }
  if(i===3){box(x-9,0,sign*25,x-4,.92,sign*26,'cover');box(x+.5,0,sign*18,x+2,1.35,sign*20,'cover');}
  if(i===4){box(x-1.5,0,23,x+1.5,1.95,24,'cover');box(x+6,0,20,x+10,.95,22,'cover');}
  if(i===2){box(x+2,0,sign*14,x+3.2,2.2,sign*17,'cover');box(x+7,0,sign*27,x+9,1,sign*29,'cover');}
  addAngle(1,4,targetDepth,height,i===1||i===4||i===5?'operator':i===2?'sheriff':i===3?'rifleB':'rifleA');
  zone.route=[zone.entry,p(-6,6.5),p(-6,11),p(-6,23),p(-1.8,25),p(2,25)];
  const rear=[zone.exit,p(7,36),p(4,36,height),p(4,targetDepth,height)];
  zone.routes=[zone.route,rear];
  if(i===5){
   zone.route=[zone.entry,p(-6,6.5),p(-6,11),p(7.2,11),p(7.2,14),p(7.2,27,2.4),p(4,30,2.4)];
   zone.routes=[zone.route,[zone.entry,p(-6,6.5),p(-6,11),p(.1,11),p(.1,14),...Array.from({length:12},(_,k)=>p(.1,14+(k+1)*13/12-.02,(k+1)*.2)),p(.1,28,2.4),p(4,30,2.4)],[zone.exit,p(7,43),p(7,37,2.4),p(4,30,2.4)]];
  }
  if(i===7){
   // The low ground route remains a distinct crossfire; the ramp is a real
   // alternative climb, not an invisible y-level change or spawn teleport.
   zone.routes=[zone.route,[zone.entry,p(-6,6.5),p(-6,11),p(8,11),p(8,16),p(8,27,1.2),p(4,30,1.2)],[zone.exit,p(7,43),p(7,36,1.2),p(4,30,1.2)]];
  }
 }
}
export const COMPLEX_LEVEL:TacticalLevel={id:'complex',title:'전술 피킹 연구실',family:'연결형 전술 시설',description:'8개 구역 · 중앙 갤러리와 후방 우회로 · 실제 이동·가시성·무기별 방어전',obstacles:COMPLEX_OBSTACLES,spawn:{x:-46,y:0,z:0},route:PEEK_ZONES.flatMap(zone=>[{x:zone.entry.x,y:0,z:0},...zone.route,...zone.route.slice(0,-1).reverse(),{x:zone.entry.x,y:0,z:0}]),angles,bounds:[-50,-46,100,92]};
/** Collision-clear common circulation, connecting all eight front and rear doors. */
export const COMPLEX_CIRCULATION:Vec3[][]=[
 [{x:-48.75,y:0,z:0},{x:48.75,y:0,z:0}],
 [{x:-48.75,y:0,z:-44},{x:48.75,y:0,z:-44}],
 [{x:-48.75,y:0,z:44},{x:48.75,y:0,z:44}],
 [{x:-48.75,y:0,z:-44},{x:-48.75,y:0,z:44}],
 [{x:48.75,y:0,z:-44},{x:48.75,y:0,z:44}],
 ...PEEK_ZONES.map(z=>[{x:z.entry.x,y:0,z:0},z.entry]),
 ...PEEK_ZONES.map(z=>[z.exit,{x:z.exit.x,y:0,z:Math.sign(z.exit.z)*44}])
];
export function zoneForScenario(s:PeekScenario){return PEEK_ZONES.find(z=>z.scenario===(s==='operator'?'shoulder':s));}
export function zoneAt(p:Vec3){return PEEK_ZONES.find(q=>Math.abs(q.center.x-p.x)<12&&Math.sign(q.center.z)===Math.sign(p.z)&&Math.abs(p.z)>7&&Math.abs(p.z)<38);}
export function activeAngles(s:PeekScenario){const zone=zoneForScenario(s);return zone?COMPLEX_LEVEL.angles.filter(a=>zone.angles.includes(a.id)):COMPLEX_LEVEL.angles;}
