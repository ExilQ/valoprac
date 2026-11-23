import {describe,it,expect} from 'vitest';
import {createScenario,SCENARIO_ROUTES} from '../training/scenarios/templates';
import {validateScenario,analyzeScenarioGeometry,scenarioLevel} from '../training/scenarios/validation';
import {compileScenario,selectScenarioPlacements} from '../training/scenarios/compile';
import {Movement} from '../engine/movement/Movement';
import {emptyInput} from '../engine/types';

describe('A4 five original tactical routes have real traversable cover and sightlines',()=>{
 for(const route of SCENARIO_ROUTES)it(`${route.id}: validates cover, exposure progression and actual manual-controller traversal`,()=>{
  const def=validateScenario(createScenario(route.id)),plan=compileScenario(def),geometry=plan.geometry,level=scenarioLevel(def),m=new Movement(undefined,level.obstacles);m.reset(plan.spawn,0,true);
  expect(geometry.spawnThreats).toEqual([]);expect(geometry.maxSimultaneousThreats).toBeLessThanOrEqual(1);expect(geometry.revealed).toHaveLength(def.bots.length);
  let tick=0;for(const destination of plan.route.slice(1)){while(Math.hypot(destination.x-m.position.x,destination.z-m.position.z)>.08&&tick<4000){const dx=destination.x-m.position.x,dz=destination.z-m.position.z;m.step({...emptyInput(),forward:1},Math.atan2(-dx,-dz),1/120,++tick/120);}expect(tick).toBeLessThan(4000);}
  expect(Math.abs(m.position.y-plan.route.at(-1)!.y)).toBeLessThan(.06);expect(m.grounded).toBe(true);
 });
 it('separates deliberate crossfire from sequential angle clearing',()=>{
  const d=createScenario('long-lane');d.bots.push({id:'second',position:{x:1.7,y:0,z:-20},weapon:'rifleB',movement:'hold',alternatives:[]});
  expect(()=>validateScenario(d)).toThrow(/동시에/);d.rules.exposurePolicy='crossfire';expect(analyzeScenarioGeometry(validateScenario(d)).maxSimultaneousThreats).toBe(2);
 });
 it('rejects floating, embedded, out-of-bounds and exposed starting positions',()=>{
  for(const mutate of [(d:ReturnType<typeof createScenario>)=>d.bots[0].position.y=1,(d:ReturnType<typeof createScenario>)=>d.player.position={x:0,y:0,z:-5},(d:ReturnType<typeof createScenario>)=>d.bots[0].position.x=200,(d:ReturnType<typeof createScenario>)=>d.bots[0].position={x:0,y:0,z:-25.3}]){const d=createScenario('long-lane');mutate(d);expect(()=>validateScenario(d)).toThrow();}
 });
 it('rejects an impossible alternative path and overlapping bot anchors',()=>{
  const d=createScenario('long-lane');d.bots[0].movement='reposition';d.bots[0].alternatives=[{x:10.4,y:0,z:-22.6}];expect(()=>validateScenario(d)).toThrow(/경로|노출/);
  const overlap=createScenario('long-lane');overlap.bots.push({...structuredClone(overlap.bots[0]),id:'duplicate-space'});expect(()=>validateScenario(overlap)).toThrow(/겹칩니다/);
 });
 it('randomizes only validated anchors deterministically and leaves hold bots still',()=>{
  const d=createScenario('sequential');d.rules.randomSpawns=true;const a=selectScenarioPlacements(validateScenario(d),4),b=selectScenarioPlacements(validateScenario(d),4);expect(a).toEqual(b);
  for(let n=0;n<32;n++)for(const [i,sector]of selectScenarioPlacements(d,n).entries()){expect([d.bots[i].position,...d.bots[i].alternatives]).toContainEqual(sector.position);expect(sector.jitter).toBe(0);expect(sector.navigation).toEqual([sector.position]);}
 });
 it('preserves source level architecture, collision boundaries and authored routes',()=>{
  const d=createScenario('vertical'),before=JSON.stringify(scenarioLevel(d).route),boxes=scenarioLevel(d).obstacles.map(o=>[o.box.min.toArray(),o.box.max.toArray()]);compileScenario(d);expect(JSON.stringify(scenarioLevel(d).route)).toBe(before);expect(scenarioLevel(d).obstacles.map(o=>[o.box.min.toArray(),o.box.max.toArray()])).toEqual(boxes);
 });
});
