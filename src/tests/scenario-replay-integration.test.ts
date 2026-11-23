import {describe,it,expect} from 'vitest';
import {Vector3} from 'three';
import {Simulation} from '../engine/simulation/Simulation';
import {ReplayRecorder} from '../engine/replay/recording';
import {ReplayPlayer} from '../engine/replay/playback';
import {encodeReplay,decodeReplay} from '../engine/replay/codec';
import {simulationChecksum} from '../engine/replay/integrity';
import {createScenario,SCENARIO_ROUTES} from '../training/scenarios/templates';
import {compileScenario,selectScenarioPlacements} from '../training/scenarios/compile';
import {encodeScenario} from '../training/scenarios/codec';
import {DEFAULT_SETTINGS} from '../config/settings';
import {emptyInput,type InputState} from '../engine/types';
import {visibleBetween} from '../engine/tactical/levels';

const DT=1/120,DEG=180/Math.PI;
function step(s:Simulation,input:Partial<InputState>={}){s.step(DT,{...emptyInput(),...input});}
function aim(s:Simulation,point:Vector3){const d=point.clone().sub(s.movement.position).sub(new Vector3(0,s.movement.eyeHeight,0)),yaw=Math.atan2(-d.x,-d.z),pitch=Math.atan2(d.y,Math.hypot(d.x,d.z)),gain=s.settings.sensitivity*s.settings.degreesPerCount;s.look(-(yaw-s.yaw)*DEG/gain,-(pitch-s.pitch)*DEG/gain);}

describe('A4/A5 scenario options execute and replay through the common authority',()=>{
 for(const route of SCENARIO_ROUTES)for(const random of [false,true])it(`${route.id}/${random?'random-anchors':'primary'} preserves actual approach, hit and retry outcomes`,async()=>{
  const def=createScenario(route.id);def.seed=random?7319:1947;def.rules.randomSpawns=random;def.rules.combatMode='learning';def.player.weapon='rifleA';
  const plan=compileScenario(def),level=plan.definition.template,sim=new Simulation('free','sheriff',structuredClone(DEFAULT_SETTINGS),{scenario:def}),record=new ReplayRecorder(sim);sim.running=true;
  expect(sim.practiceMap).toBe(level);expect(sim.weaponId).toBe('rifleA');expect(sim.settings.seed).toBe(def.seed);expect(sim.targets.filter(t=>t.enabled)).toHaveLength(def.bots.length);
  expect(sim.targets.filter(t=>t.enabled).map(t=>({x:t.position.x,y:t.position.y,z:t.position.z}))).toEqual(selectScenarioPlacements(def,0).map(a=>a.position));
  let count=0;
  for(const destination of plan.route.slice(1)){
   while(Math.hypot(destination.x-sim.movement.position.x,destination.z-sim.movement.position.z)>.08&&count++<4000){const dx=destination.x-sim.movement.position.x,dz=destination.z-sim.movement.position.z;step(sim,{forward:1,movementYaw:Math.atan2(-dx,-dz)});}
   expect(count).toBeLessThan(4000);
  }
  for(let n=0;n<90;n++)step(sim);
  const eye={x:sim.movement.position.x,y:sim.movement.position.y+sim.movement.eyeHeight,z:sim.movement.position.z};
  const visible=sim.targets.filter(t=>t.enabled&&t.active).find(t=>{const p=t.headPosition(new Vector3());return visibleBetween(sim.obstacles,eye,p);});expect(visible).toBeDefined();
  aim(sim,visible!.headPosition(new Vector3()));step(sim,{fire:true,firePresses:1});expect(sim.shots.at(-1)?.hit).toBe('head');expect(sim.stats.eliminations).toBe(1);
  const generation=sim.targets[0].generation;sim.resetTargets();expect(sim.targets[0].generation).toBeGreaterThan(generation);sim.retryTactical();expect(sim.lifeGeneration).toBe(1);
  expect({x:sim.movement.position.x,y:sim.movement.position.y,z:sim.movement.position.z}).toEqual(def.player.position);expect(sim.yaw).toBe(def.player.yaw);expect(sim.pitch).toBe(def.player.pitch);
  expect(sim.targets.filter(t=>t.enabled).map(t=>({x:t.position.x,y:t.position.y,z:t.position.z}))).toEqual(selectScenarioPlacements(def,1).map(a=>a.position));
  sim.running=true;for(let n=0;n<60;n++)step(sim);
  const recording=record.finish()!,encoded=await encodeReplay(recording),decoded=await decodeReplay(encoded),a=await new ReplayPlayer(decoded).verify(),b=await new ReplayPlayer(decoded).verify();
  expect(a.passed).toBe(true);expect(a).toEqual(b);expect(a.checksum).toBe(simulationChecksum(sim));expect(a.score).toBe(1);expect(a.hits).toBe(1);
  console.log(JSON.stringify({benchmark:'scenario-common-replay',route:route.id,random,seed:def.seed,ticks:sim.ticks,bots:def.bots.length,score:a.score,hits:a.hits,checksum:a.checksum,passed:a.passed,routeSamples:plan.geometry.routeSamples,maxThreats:plan.geometry.maxSimultaneousThreats,codeBytes:encodeScenario(def).length,replayGzipBytes:encoded.length}));
 },15000);
 it('opens the entry gate, activates the next defender after a clear, and replays both transitions',async()=>{
  const def=createScenario('sequential');
  def.rules.arrival='after-clear';def.rules.startOnEntry=true;def.rules.combatMode='learning';
  const sim=new Simulation('free','rifleA',structuredClone(DEFAULT_SETTINGS),{scenario:def});
  const recorder=new ReplayRecorder(sim);
  sim.running=true;
  expect(sim.targets.filter(t=>t.enabled&&t.active)).toHaveLength(0);
  for(let i=0;i<15;i++)step(sim);
  expect(sim.targets.filter(t=>t.enabled&&t.active)).toHaveLength(0);
  for(const destination of compileScenario(def).route.slice(1,4)){
   let attempts=0;
   while(Math.hypot(destination.x-sim.movement.position.x,destination.z-sim.movement.position.z)>.08&&attempts++<2000){
    const dx=destination.x-sim.movement.position.x,dz=destination.z-sim.movement.position.z;
    step(sim,{forward:1,movementYaw:Math.atan2(-dx,-dz)});
   }
   expect(attempts).toBeLessThan(2000);
  }
  for(let i=0;i<90;i++)step(sim);
  expect(sim.targets.filter(t=>t.enabled&&t.active).map(t=>t.id)).toEqual([0]);
  aim(sim,sim.targets[0].headPosition(new Vector3()));step(sim,{fire:true,firePresses:1});
  expect(sim.kills.at(-1)?.targetId).toBe(0);
  expect(sim.targets.filter(t=>t.enabled&&t.active).map(t=>t.id)).toEqual([1]);
  sim.retryTactical();sim.running=true;step(sim);
  expect(sim.targets.filter(t=>t.enabled&&t.active)).toHaveLength(0);
  expect((await new ReplayPlayer(recorder.finish()!).verify()).passed).toBe(true);
 });
 it('keeps a real custom Operator death separate from reset and reconstructs it',async()=>{
  const def=createScenario('long-lane');def.rules.difficulty='expert';const sim=new Simulation('free','rifleA',structuredClone({...DEFAULT_SETTINGS,defenderReaction:.15,defenderFirstShotError:.05,defenderAccuracy:.98}),{scenario:def}),recorder=new ReplayRecorder(sim);sim.running=true;
  for(let n=0;n<2400&&!sim.exposure.death;n++){const dx=-sim.movement.position.x,dz=(Math.abs(dx)>.1?5:-3)-sim.movement.position.z;step(sim,{forward:1,movementYaw:Math.atan2(-dx,-dz)});}
  expect(sim.exposure.death).not.toBeNull();expect(sim.defenders?.death?.weapon).toBe('operator');const tick=sim.ticks;for(let n=0;n<50;n++)step(sim);expect(sim.ticks).toBe(tick);
  sim.retryTactical();sim.running=true;for(let n=0;n<30;n++)step(sim);
  const recording=recorder.finish()!,verification=await new ReplayPlayer(recording).verify();expect(verification.passed).toBe(true);expect(verification.deaths).toBe(1);expect(recording.events.some(e=>e.kind==='respawn')).toBe(true);
 });
 it('honors an imported time limit and recreates completion rather than inheriting unlimited Free Practice',async()=>{
  const def=createScenario('close-corner');def.rules.duration=15;def.rules.combatMode='learning';const sim=new Simulation('free','rifleA',structuredClone(DEFAULT_SETTINGS),{scenario:def}),record=new ReplayRecorder(sim);let completed=0;sim.onFinish=()=>completed++;sim.running=true;
  for(let n=0;n<1820;n++)step(sim);expect(sim.time).toBe(15);expect(sim.completed).toBe(true);expect(sim.running).toBe(false);expect(completed).toBe(1);expect((await new ReplayPlayer(record.finish()!).verify()).passed).toBe(true);
 });
 it('keeps imported exposure elimination distinct from ballistic damage',async()=>{
  const def=createScenario('long-lane');def.rules.combatMode='exposure';def.rules.exposureLimit=.5;const sim=new Simulation('free','rifleA',structuredClone(DEFAULT_SETTINGS),{scenario:def}),record=new ReplayRecorder(sim);sim.running=true;
  for(let n=0;n<1800&&!sim.exposure.death;n++){const dx=-sim.movement.position.x,dz=(Math.abs(dx)>.1?5:-3)-sim.movement.position.z;step(sim,{forward:1,movementYaw:Math.atan2(-dx,-dz)});}
  expect(sim.defenders?.death?.cause).toBe('exposure');expect(sim.defenders?.health).toBe(150);expect((await new ReplayPlayer(record.finish()!).verify()).passed).toBe(true);
 });
});
