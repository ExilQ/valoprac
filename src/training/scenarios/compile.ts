import {SeededRandom} from '../../engine/simulation/random';
import type {AngleSector} from '../../engine/tactical/levels';
import {scenarioRoute} from './templates';
import {validateScenarioWithGeometry,scenarioApproach} from './validation';
import type {CompiledScenario,ScenarioDefinition} from './types';
import type {Vec3} from '../../engine/types';

const copy=(p:Vec3):Vec3=>({x:p.x,y:p.y,z:p.z});
const distinct=(rows:readonly Vec3[])=>rows.filter((p,i)=>rows.findIndex(q=>Math.hypot(p.x-q.x,p.y-q.y,p.z-q.z)<1e-8)===i).map(copy);
/** Choices are explicit validated anchors. No unconstrained jitter is added. */
export function selectScenarioPlacements(def:ScenarioDefinition,attempt:number):AngleSector[]{
 if(!Number.isSafeInteger(attempt)||attempt<0||attempt>1_000_000)throw new Error('시나리오 재시도 번호가 올바르지 않습니다.');
 const rng=new SeededRandom(def.seed^Math.imul(attempt+1,0x45d9f3b));
 return def.bots.map((bot,index)=>{
  const anchors=distinct([bot.position,...bot.alternatives]),selected=copy(anchors[def.rules.randomSpawns?Math.floor(rng.next()*anchors.length):0]),navigation=bot.movement==='reposition'?distinct([selected,...anchors]):[copy(selected)];
  return{id:bot.id,label:`${def.title} · 수비수 ${index+1}`,position:selected,jitter:0,radius:.7,zoneId:def.routeId,weapon:bot.weapon,facingYaw:Math.atan2(def.player.position.x-selected.x,def.player.position.z-selected.z),navigation,alternatives:navigation.map(copy)};
 });
}
export function compileScenario(raw:ScenarioDefinition):CompiledScenario{
 const {definition,geometry}=validateScenarioWithGeometry(raw),rules=definition.rules,route=scenarioRoute(definition.routeId);
 return{definition,settingsPatch:{practiceMap:definition.template,seed:definition.seed,targetCount:definition.bots.length,targetSize:1,targetSpeed:1,analysisWall:false,drill:'none',behavior:'stationary',defenderSkill:rules.difficulty,defenderWeapon:'mixed',combatMode:rules.combatMode,exposureEnabled:rules.combatMode==='exposure',exposureLimit:rules.exposureLimit,exposureMode:'continuous',duration:rules.duration??60,peekingTimed:rules.duration!==null,randomDefenders:rules.randomSpawns,defenderReposition:definition.bots.some(b=>b.movement==='reposition')?.45:0,infiniteReserve:rules.infiniteReserve,autoReload:rules.autoReload,eliminationRule:'damage',peekScenario:route.template==='complex'?'slicing':'free'},sectors:selectScenarioPlacements(definition,0),spawn:copy(definition.player.position),yaw:definition.player.yaw,pitch:definition.player.pitch,weapon:definition.player.weapon,route:scenarioApproach(definition),geometry};
}

/** Find a replayable first layout that differs from the current starting layout. */
export function scenarioWithDifferentPlacement(definition: ScenarioDefinition): ScenarioDefinition | null {
 if (!definition.bots.some(bot => bot.alternatives.some(p => p.x !== bot.position.x || p.y !== bot.position.y || p.z !== bot.position.z))) return null;
 const initial = selectScenarioPlacements(definition, 0);
 for (let offset = 1; offset <= 64; offset++) {
  const seed = (definition.seed - 1 + offset) % 2147483647 + 1;
  const candidate = { ...definition, seed, rules: { ...definition.rules, randomSpawns:true } };
  if (selectScenarioPlacements(candidate, 0).some(({position:p}, i) => {
   const previous = initial[i].position;
   return p.x !== previous.x || p.y !== previous.y || p.z !== previous.z;
  })) return candidate;
 }
 return null;
}
