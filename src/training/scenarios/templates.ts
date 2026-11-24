import {LEVELS} from '../../engine/tactical/levels';
import {COMPLEX_LEVEL,PEEK_ZONES} from '../../engine/tactical/complex';
import type {MotionPoint} from './recordedMotion';
import type {Vec3} from '../../engine/types';
import type {ScenarioBot,ScenarioDefinition,ScenarioRoute,ScenarioRouteId} from './types';
const p=(x:number,z:number,y=0):Vec3=>({x,y,z});
const clone=<T,>(v:T):T=>structuredClone(v);
function bot(id:string,position:Vec3,weapon:ScenarioBot['weapon'],alternatives?:Vec3[]):ScenarioBot{return{id,position:clone(position),weapon,movement:'hold',alternatives:clone(alternatives??[])};}
const g=PEEK_ZONES.find(z=>z.id==='G')!;
function researchRoute(id: ScenarioRouteId, bay: string, title: string, objective: string): ScenarioRoute {
 const zone=PEEK_ZONES.find(item=>item.id===bay)!;
 const defender=COMPLEX_LEVEL.angles.find(angle=>angle.id===zone.angles[0])!;
 return {
  id, title, objective, description: `전술 피킹 연구실 ${bay} 구역`, template:'complex',
  route:clone(zone.route), spawn:clone(zone.entry), yaw:bay==='B'?0:Math.PI,
  primaryBots:[bot(defender.id,defender.position,defender.weapon??'operator',defender.alternatives)],
  difficulty:'고급', recommended:'rifleA', verticalMeters:zone.vertical, sectorCount:1,
 };
}
export const SCENARIO_ROUTES:readonly ScenarioRoute[]=[
 {id:'long-lane',title:'깊은 회랑',description:'원본 장거리 회랑의 첫 진입로',objective:'엄폐에서 머리 높이를 유지하며 깊은 오퍼레이터 각을 확인하세요.',template:'long',route:[clone(LEVELS.long.spawn),p(-2,5),p(0,5),p(0,-5)],spawn:clone(LEVELS.long.spawn),yaw:0,primaryBots:[bot('long-1',LEVELS.long.angles[0].position,'operator',LEVELS.long.angles[0].alternatives)],difficulty:'보통',recommended:'rifleA',verticalMeters:0,sectorCount:1},
 {id:'close-corner',title:'좁은 코너 진입',description:'원본 차고의 근접 문틀과 퇴로',objective:'넓게 노출되기 전에 가까운 모서리를 먼저 정리하세요.',template:'garage',route:[clone(LEVELS.garage.spawn),p(-2,5),p(0,5),p(0,-2)],spawn:clone(LEVELS.garage.spawn),yaw:0,primaryBots:[bot('garage-1',LEVELS.garage.angles[0].position,'sheriff',LEVELS.garage.angles[0].alternatives)],difficulty:'입문',recommended:'sheriff',verticalMeters:0,sectorCount:1},
 {id:'off-angle',title:'엄폐 옆 오프앵글',description:'원본 거점의 예상선 밖 수비 위치',objective:'정면만 조준하지 말고 엄폐 옆 수비 위치까지 각을 나눠 확인하세요.',template:'site',route:[clone(LEVELS.site.spawn),p(-2,5),p(0,5),p(0,-2)],spawn:clone(LEVELS.site.spawn),yaw:0,primaryBots:[bot('site-1',p(2.5,-10),'rifleB',[p(2.34,-10.16),p(2.66,-9.84)])],difficulty:'보통',recommended:'rifleA',verticalMeters:0,sectorCount:1},
 {id:'vertical',title:'계단 위 수비각',description:'원본 타워의 실제 계단과 상단 착지면',objective:'계단을 오르며 지역 바닥에 맞춘 머리 높이를 다시 잡으세요.',template:'tower',route:[clone(LEVELS.tower.spawn),p(-2,5),p(0,5),p(0,.5),p(0,-6,1.2),p(0,-8,1.2)],spawn:clone(LEVELS.tower.spawn),yaw:0,primaryBots:[bot('tower-1',LEVELS.tower.angles[0].position,'operator',LEVELS.tower.angles[0].alternatives)],difficulty:'고급',recommended:'operator',verticalMeters:1.2,sectorCount:1},
 {id:'sequential',title:'세 개의 분리 사선',description:'피킹 연구실 G 구역의 연결된 각쪼개기 경로',objective:'문틀을 이용해 세 수비수를 한 각씩 드러내세요.',template:'complex',route:clone(g.route),spawn:clone(g.entry),yaw:Math.PI,primaryBots:COMPLEX_LEVEL.angles.filter(a=>g.angles.includes(a.id)).map(a=>bot(a.id,a.position,a.weapon??'rifleA',a.alternatives)),difficulty:'고급',recommended:'rifleA',verticalMeters:0,sectorCount:3},
 researchRoute('sniper-jamb','B','저격수 문틀 피킹','문틀에서 짧게 노출하고 엄폐로 돌아온 뒤 저격수의 다음 사격 전에 다시 진입하세요.'),
 researchRoute('ramp-approach','F','경사로 상단 진입','경사로를 오르며 조준 높이를 바꾸고 2.4m 상단의 수비각을 확인하세요.'),
];
export function scenarioRoute(id:ScenarioRouteId){const route=SCENARIO_ROUTES.find(r=>r.id===id);if(!route)throw new Error('지원하지 않는 전술 경로입니다.');return route;}
export function createScenario(routeId:ScenarioRouteId):ScenarioDefinition{
 const route=scenarioRoute(routeId);return{schema:1,id:`route-${routeId}`,title:route.title,template:route.template,routeId,seed:1947,player:{position:clone(route.spawn),yaw:route.yaw,pitch:0,weapon:route.recommended},bots:clone(route.primaryBots),rules:{difficulty:route.difficulty==='입문'?'beginner':route.difficulty==='고급'?'advanced':'normal',combatMode:'gunfight',duration:null,exposureLimit:3,randomSpawns:false,infiniteReserve:true,autoReload:true,exposurePolicy:'sequential'}};
}

export function createHeadlineScenario():ScenarioDefinition {
 const scenario=createScenario('close-corner');
 scenario.id='close-corner-headline';
 scenario.title='헤드라인·앉기 교전';
 scenario.player.weapon='rifleA';
 scenario.bots[0].weapon='rifleB';
 scenario.rules.difficulty='normal';
 scenario.rules.defenderPolicy={style:'crouch-counter'};
 return scenario;
}

/** An authored sample so the route can be tried before any local replay exists. */
export function createMotionScenario():ScenarioDefinition {
 const scenario=createScenario('close-corner');
 scenario.id='garage-motion-rehearsal';
 scenario.title='이동 재현 · 차고 문틀';
 scenario.player.weapon='rifleA';
 scenario.bots[0].weapon='rifleB';
 scenario.rules.startOnEntry=true;
 scenario.bots[0].motion={source:'authored',turns:0,mirror:false,points:Array.from({length:31},(_,index):MotionPoint=>{
  const t=index/10;
  // Move into the door's sight line, hold a low stance, then step out.
  const x=t<.8?-Math.round(75*t/.8):t<1.9?-75:Math.round(-75+105*(t-1.9)/1.1);
  const crouch=Math.round(100*Math.max(0,Math.min(1,(t-.65)/.2,(2.15-t)/.2)));
  return [x||0,0,0,crouch];
 })};
 return scenario;
}
