import {Vector3} from 'three';
import {CollisionController} from '../../engine/movement/CollisionController';
import {levelFor,visibleBetween,type TacticalLevel} from '../../engine/tactical/levels';
import {routeSpace,sampleRoute} from '../../engine/tactical/complexValidation';
import {playerVisibilitySamples} from '../../engine/tactical/DefenderAI';
import {scenarioRoute} from './templates';
import {MAX_SCENARIO_BOTS,MAX_SCENARIO_BYTES,SCENARIO_ROUTE_IDS,ScenarioError,type ScenarioDefinition,type ScenarioGeometryReport,type ScenarioRouteId} from './types';
import type {Vec3} from '../../engine/types';

const WEAPONS=['rifleA','rifleB','sheriff','operator'];
function fail(message:string):never{throw new ScenarioError(message);}
const plain=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
function object(value:unknown,keys:readonly string[],label:string):Record<string,unknown>{if(!plain(value)||Object.keys(value).length!==keys.length||Object.keys(value).some(k=>!keys.includes(k)))fail(`${label}: 지원하는 필수 항목만 포함하세요.`);return value;}
function safeTree(value:unknown,depth=0,counter={nodes:0}){if(++counter.nodes>6000||depth>10)fail('시나리오의 중첩 또는 자료 수가 한도를 넘습니다.');if(value===null||typeof value==='boolean')return;if(typeof value==='number'){if(!Number.isFinite(value))fail('모든 수치는 유한해야 합니다.');return;}if(typeof value==='string'){if(value.length>256)fail('문자열이 너무 깁니다.');return;}if(Array.isArray(value)){if(value.length>48)fail('배열이 너무 깁니다.');for(const x of value)safeTree(x,depth+1,counter);return;}if(!plain(value))fail('시나리오는 실행 코드가 없는 자료여야 합니다.');for(const[k,v]of Object.entries(value)){if(['__proto__','constructor','prototype'].includes(k))fail('허용되지 않는 속성입니다.');safeTree(v,depth+1,counter);}}
function number(value:unknown,min:number,max:number,label:string){if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)fail(`${label}: ${min}–${max} 범위의 수치를 사용하세요.`);return value;}
function choice<T extends string>(value:unknown,values:readonly T[],label:string):T{if(typeof value!=='string'||!values.includes(value as T))fail(`${label}: 지원하지 않는 값입니다.`);return value as T;}
function flag(value:unknown,label:string){if(typeof value!=='boolean')fail(`${label}: 참 또는 거짓을 사용하세요.`);return value;}
function id(value:unknown,label:string){if(typeof value!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(value))fail(`${label}: 영문·숫자·밑줄·하이픈으로 1–64자를 사용하세요.`);return value;}
function position(raw:unknown,label:string):Vec3{const p=object(raw,['x','y','z'],label);return{x:number(p.x,-250,250,label),y:number(p.y,0,20,label),z:number(p.z,-250,250,label)};}
const distance=(a:Vec3,b:Vec3)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
export function scenarioLevel(def:Pick<ScenarioDefinition,'template'>):TacticalLevel{const level=levelFor(def.template);if(!level)fail('시나리오 맵이 없습니다.');return level;}
export function scenarioApproach(def:ScenarioDefinition){const route=scenarioRoute(def.routeId).route;return[{...def.player.position},...route.slice(1).map(p=>({...p}))];}
function supported(level:TacticalLevel,controller:CollisionController,p:Vec3,radius:number,label:string){const b=level.bounds;if(p.x<b[0]+radius||p.x>b[0]+b[2]-radius||p.z<b[1]+radius||p.z>b[1]+b[3]-radius)fail(`${label}: 맵 경계 밖입니다.`);const v=new Vector3(p.x,p.y,p.z),support=controller.support(v,p.y+.03);if(!support.walkable||Math.abs(support.height-p.y)>.03||!controller.canOccupy(v,1.85,radius))fail(`${label}: 바닥 지지와 몸체 공간이 유효하지 않습니다.`);}
function bodyVisible(level:TacticalLevel,player:ScenarioDefinition['player'],bot:Vec3){
 const source={x:bot.x,y:bot.y+1.68,z:bot.z};
 for(const yaw of [player.yaw,player.yaw+Math.PI/2])for(const crouch of [0,1]){const samples=playerVisibilitySamples({position:player.position,velocity:{x:0,y:0,z:0},eyeHeight:crouch?1.12:1.64,crouch,grounded:true,yaw,pitch:player.pitch});if(samples.some(p=>visibleBetween(level.obstacles,source,p)))return true;}
 return false;
}
/** Actual map-ray/occupied-volume audit. A sample fraction is not pixel area. */
export function analyzeScenarioGeometry(def:ScenarioDefinition):ScenarioGeometryReport{
 const level=scenarioLevel(def),controller=new CollisionController(level.obstacles),route=scenarioApproach(def),samples=sampleRoute(route,.1),spawnThreats:string[]=[],revealed=new Set<string>(),newlyExposed:ScenarioGeometryReport['newlyExposed']=[];let maxSimultaneousThreats=0,navigationSamples=0;
 if(samples.length>4000)fail('진입 경로 표본이 한도를 넘습니다.');
 for(const p of samples)if(!routeSpace(level,p))fail('진입 경로가 벽·급격한 높이 변화 또는 머리 공간에 막혀 있습니다. 시작 위치를 경로에 맞추세요.');
 for(const bot of def.bots){
  const placements=[bot.position,...bot.alternatives];for(const p of placements)supported(level,controller,p,.4,`${bot.id} 배치`);
  if(placements.some(p=>bodyVisible(level,def.player,p)))spawnThreats.push(bot.id);
  if(bot.movement==='reposition')for(let i=0;i<placements.length;i++)for(let j=i+1;j<placements.length;j++)for(const p of sampleRoute([placements[i],placements[j]],.1)){navigationSamples++;if(navigationSamples>6000)fail('수비수 재배치 경로가 너무 복잡합니다.');supported(level,controller,p,.4,`${bot.id} 재배치 경로`);}
 }
 if(spawnThreats.length)fail('시작 위치에서 이미 몸체가 수비수에게 노출됩니다. 엄폐 뒤의 시작 위치를 선택하세요.');
 for(let index=0;index<samples.length;index++){
  const p=samples[index],eye={x:p.x,y:p.y+1.64,z:p.z},visible=def.bots.filter(bot=>[bot.position,...bot.alternatives].some(q=>visibleBetween(level.obstacles,eye,{x:q.x,y:q.y+1.68,z:q.z}))).map(bot=>bot.id);
  maxSimultaneousThreats=Math.max(maxSimultaneousThreats,visible.length);const fresh=visible.filter(key=>!revealed.has(key));if(fresh.length)newlyExposed.push({index,bots:fresh});for(const key of visible)revealed.add(key);
 }
 if(revealed.size!==def.bots.length)fail('일부 수비 위치는 선택한 진입 경로에서 드러나지 않습니다. 수비 위치를 다시 배치하세요.');
 if(def.rules.exposurePolicy==='sequential'&&maxSimultaneousThreats>1)fail('순차 진입에서 여러 수비각이 동시에 노출됩니다. 배치를 바꾸거나 교차 사격 규칙을 선택하세요.');
 return{routeId:def.routeId,routeSamples:samples.length,maxSimultaneousThreats,newlyExposed,revealed:[...revealed],spawnThreats,navigationSamples};
}
/** Schema and resource validation precede geometry, with fresh canonical output. */
export function validateScenarioWithGeometry(raw:unknown){
 safeTree(raw);let bytes:number;try{bytes=new TextEncoder().encode(JSON.stringify(raw)).length;}catch{fail('시나리오를 직렬화할 수 없습니다.');}if(bytes!>MAX_SCENARIO_BYTES)fail('시나리오는 24KB 이하여야 합니다.');
 const o=object(raw,['schema','id','title','template','routeId','seed','player','bots','rules'],'시나리오');if(o.schema!==1)fail('지원하지 않는 시나리오 버전입니다.');
 const routeId=choice(o.routeId,SCENARIO_ROUTE_IDS,'경로'),route=scenarioRoute(routeId);if(o.template!==route.template)fail('맵과 경로가 서로 맞지 않습니다.');
 if(typeof o.title!=='string'||!o.title.trim()||o.title.length>64||/[\u0000-\u001f\u007f]/.test(o.title))fail('이름은 제어 문자가 없는 1–64자여야 합니다.');
 const seed=number(o.seed,1,2147483647,'시드');if(!Number.isSafeInteger(seed))fail('시드는 정수여야 합니다.');
 const ruleKeys=['difficulty','combatMode','duration','exposureLimit','randomSpawns','infiniteReserve','autoReload','exposurePolicy'];
 if(plain(o.rules)&&Object.hasOwn(o.rules,'arrival'))ruleKeys.push('arrival');
 const p=object(o.player,['position','yaw','pitch','weapon'],'시작 위치'),rules=object(o.rules,ruleKeys,'훈련 규칙');
 if(!Array.isArray(o.bots)||o.bots.length<1||o.bots.length>MAX_SCENARIO_BOTS)fail('수비수는 1–12명이어야 합니다.');const ids=new Set<string>();
 const bots=o.bots.map((value,index)=>{const b=object(value,['id','position','weapon','movement','alternatives'],`${index+1}번 수비수`),key=id(b.id,'수비수 ID');if(ids.has(key))fail('수비수 ID가 중복되었습니다.');ids.add(key);if(!Array.isArray(b.alternatives)||b.alternatives.length>4)fail('대체 수비 위치는 최대 4개입니다.');const alternatives=b.alternatives.map((q,i)=>position(q,`${key} 대체 위치 ${i+1}`)),movement=choice(b.movement,['hold','reposition'] as const,'이동 방식');if(movement==='reposition'&&!alternatives.length)fail('재배치 수비수에게 대체 위치가 필요합니다.');return{id:key,position:position(b.position,`${key} 위치`),weapon:choice(b.weapon,WEAPONS,'무기') as ScenarioDefinition['player']['weapon'],movement,alternatives};});
 for(let i=0;i<bots.length;i++)for(let j=i+1;j<bots.length;j++)if([bots[i].position,...bots[i].alternatives].some(a=>[bots[j].position,...bots[j].alternatives].some(b=>distance(a,b)<.85)))fail('수비수의 가능한 배치가 서로 겹칩니다.');
 const def:ScenarioDefinition={schema:1,id:id(o.id,'시나리오 ID'),title:o.title,routeId,template:route.template,seed,player:{position:position(p.position,'플레이어 위치'),yaw:number(p.yaw,-Math.PI*2,Math.PI*2,'시작 방향'),pitch:number(p.pitch,-1.48,1.48,'상하 조준'),weapon:choice(p.weapon,WEAPONS,'플레이어 무기') as ScenarioDefinition['player']['weapon']},bots,rules:{difficulty:choice(rules.difficulty,['beginner','normal','advanced','expert'] as const,'난이도'),combatMode:choice(rules.combatMode,['learning','gunfight','exposure'] as const,'교전 규칙'),duration:rules.duration===null?null:number(rules.duration,15,600,'훈련 시간'),exposureLimit:number(rules.exposureLimit,.5,5,'노출 시간'),randomSpawns:flag(rules.randomSpawns,'무작위 배치'),infiniteReserve:flag(rules.infiniteReserve,'무제한 예비 탄약'),autoReload:flag(rules.autoReload,'자동 재장전'),exposurePolicy:choice(rules.exposurePolicy,['sequential','crossfire'] as const,'노출 규칙'),...(Object.hasOwn(rules,'arrival')?{arrival:choice(rules.arrival,['after-clear'] as const,'수비수 등장')}: {})}};
 const level=scenarioLevel(def);
 supported(level,new CollisionController(level.obstacles),def.player.position,.28,'플레이어 시작 위치');
 return { definition:def, geometry:analyzeScenarioGeometry(def) };
}

export function validateScenario(raw:unknown):ScenarioDefinition {
 return validateScenarioWithGeometry(raw).definition;
}

/** Snap close changes in height to the same support plane used by Movement. */
export function scenarioPlacement(def:ScenarioDefinition,x:number,z:number,y:number):Vec3 {
 const level=scenarioLevel(def),controller=new CollisionController(level.obstacles);
 const support=controller.support(new Vector3(x,y,z),y+.3);
 return {x,z,y:support.walkable&&Math.abs(support.height-y)<=.3?support.height:y};
}
