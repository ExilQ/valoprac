import {describe,it,expect,vi} from 'vitest';
import {DEFAULT_SETTINGS} from '../config/settings';
import {LEVEL_IDS} from '../config/tactical';
import {Simulation} from '../engine/simulation/Simulation';
import {emptyInput,type InputState,type Settings} from '../engine/types';
import {activeAngles,zoneForScenario} from '../engine/tactical/complex';
// These tests verify the calibration evidence recorded for the 12.35 rules
// (acceleration-v10); reference-v11 behaviour is covered by its own tests.
vi.mock('../engine/simulation/rules',async original=>({...await original<typeof import('../engine/simulation/rules')>(),CURRENT_SIMULATION_RULES:'acceleration-v10'}));

const dt=1/120;
function simulation(patch:Partial<Settings>={}){
 return new Simulation('free','operator',{...DEFAULT_SETTINGS,practiceMap:'complex',peekScenario:'wide',targetCount:1,randomDefenders:false,autoReload:false,defenderReposition:0,exposureEnabled:false,...patch});
}
function advance(s:Simulation,count:number,patch:Partial<InputState>={}){for(let i=0;i<count;i++)s.step(dt,{...emptyInput(),...patch});}

describe('Peeking scenarios integrated with the real simulation clock',()=>{
 it('finishes a timed free-peeking session exactly once at its configured duration',()=>{
  const s=simulation({duration:15,peekingTimed:true}),finished=vi.fn();s.onFinish=finished;s.running=true;
  advance(s,15*120-1);expect(s.completed).toBe(false);expect(finished).not.toHaveBeenCalled();
  advance(s,1);expect(s.completed).toBe(true);expect(s.running).toBe(false);expect(s.time).toBe(15);expect(finished).toHaveBeenCalledTimes(1);
  advance(s,120);expect(s.time).toBe(15);expect(finished).toHaveBeenCalledTimes(1);
 });
 it('keeps connected-map free exploration unlimited when its timed option is off',()=>{
  const s=simulation({duration:15,peekingTimed:false});s.running=true;advance(s,16*120);
  expect(s.completed).toBe(false);expect(s.running).toBe(true);expect(s.time).toBe(16);
 });
 it('does not impose the peeking timer on the existing ordinary Free Practice range',()=>{
  const s=simulation({practiceMap:'range',duration:15,peekingTimed:true,analysisWall:true});s.running=true;advance(s,16*120);
  expect(s.defenders).toBeNull();expect(s.completed).toBe(false);expect(s.running).toBe(true);expect(s.time).toBe(16);
 });
 for(const id of LEVEL_IDS)it(`${id}: uses actual weapon-aware defenders while preserving all original three sectors`,()=>{
  const s=simulation({practiceMap:id,targetCount:5,defenderWeapon:'operator'});
  expect(s.defenders).not.toBeNull();expect(s.angles).not.toBeNull();expect(s.targets.filter(t=>t.enabled&&t.active)).toHaveLength(3);
  expect(s.defenders!.memories.filter((_,i)=>s.targets[i].enabled).map(m=>m.weapon)).toEqual(['operator','operator','operator']);
  s.running=true;advance(s,120);expect(s.defenders!.perceptionUpdates).toBeGreaterThan(15);expect(s.snapshot().peeking).toBeDefined();
 });
 it('changes selected sectors and defender weapons without leaving bots from the previous scenario',()=>{
  const s=simulation({targetCount:3,peekScenario:'slicing'});expect(s.targets.filter(t=>t.enabled)).toHaveLength(3);
  s.configure({peekScenario:'shoulder',defenderWeapon:'operator'});
  const enabled=s.targets.filter(t=>t.enabled);expect(enabled).toHaveLength(1);expect(enabled[0].position.toArray()).toEqual(Object.values(activeAngles('shoulder')[0].position));
  expect(s.defenders!.memories[0].weapon).toBe('operator');
  s.retryTactical();const entry=zoneForScenario('shoulder')!.entry;expect(s.movement.position.toArray()).toEqual([entry.x,entry.y,entry.z]);
 });
 it('uses the random-spawn preference immediately and keeps each chosen spawn inside a validated sector',()=>{
  const s=simulation({peekScenario:'slicing',targetCount:3,randomDefenders:true}),before=s.targets.filter(t=>t.enabled).map(t=>t.generation);
  s.configure({randomDefenders:false});
  for(const [i,t]of s.targets.filter(t=>t.enabled).entries()){
   const p=activeAngles('slicing')[i].position;expect(t.generation).toBeGreaterThan(before[i]);expect(t.position.toArray()).toEqual([p.x,p.y,p.z]);
  }
 });
});

describe('Retry, scope and analytics preserve the intended independent state',()=>{
 it('retries a real exposure death locally, restoring ammunition and life-local state while preserving time and session statistics',()=>{
  const s=simulation({practiceMap:'garage',combatMode:'exposure',targetCount:3,defenderReaction:1.5,exposureEnabled:true,exposureLimit:.5});s.running=true;
  advance(s,1,{scopePresses:1});advance(s,90);advance(s,1,{firePresses:1});advance(s,240);
  expect(s.shots).toHaveLength(1);advance(s,1,{scopePresses:1});advance(s,90);expect(s.weapon.scopeLevel).toBe(1);
  s.movement.position.set(0,0,5);s.movement.previous.copy(s.movement.position);advance(s,200);
  expect(s.defenders!.death?.cause).toBe('exposure');expect(s.exposure.death).not.toBeNull();expect(s.running).toBe(false);
  s.footsteps.footstepAccumulation=.61;const saved={ammo:s.weapon.ammo,reserve:s.weapon.reserve,time:s.time,shots:s.stats.shots,deaths:s.defenders!.report.deaths};
  s.retryTactical();
  expect(s.defenders!.death).toBeNull();expect(s.exposure.death).toBeNull();expect(s.defenders!.health).toBe(150);expect(s.targets.filter(t=>t.enabled&&t.active)).toHaveLength(3);
  expect(s.weapon.scopeLevel).toBe(0);expect(s.weapon.scopeAmount).toBe(0);expect(s.weapon.scopeZoom).toBe(1);expect(s.ads).toBe(false);
  expect(s.weapon.ammo).toBe(s.weapon.profile.magazine);expect(s.weapon.reserve).toBe(s.weapon.profile.reserve);expect(s.time).toBe(saved.time);expect(s.stats.shots).toBe(saved.shots);expect(s.defenders!.report.deaths).toBe(saved.deaths);expect(s.footsteps.footstepAccumulation).toBe(0);
  s.running=true;advance(s,1);expect(s.weapon.scopeLevel).toBe(0);expect(s.ads).toBe(false);
 });
 it('resets Operator totals alongside ordinary statistics without refilling ammo or erasing movement distance',()=>{
  const s=simulation({practiceMap:'range',analysisWall:true});s.running=true;
  advance(s,1,{scopePresses:1});advance(s,120);advance(s,1,{firePresses:1});advance(s,240);advance(s,1,{firePresses:1});
  expect(s.operatorStats.scopedShots).toBe(1);expect(s.operatorStats.unscopedShots).toBe(1);expect(s.operatorStats.recoverySamples).toBe(1);
  s.footsteps.footstepAccumulation=.47;const ammo=s.weapon.ammo,time=s.time;s.resetStatistics();
  expect(s.stats.shots).toBe(0);expect(s.shots).toEqual([]);expect(Object.values(s.operatorStats).every(v=>v===0)).toBe(true);expect(s.weapon.ammo).toBe(ammo);expect(s.time).toBe(time);expect(s.footsteps.footstepAccumulation).toBe(.47);
  advance(s,240);advance(s,1,{firePresses:1});expect(s.operatorStats.unscopedShots).toBe(1);expect(s.operatorStats.recoverySamples).toBe(0);
 });
 it('captures detached peeking snapshots so caller edits cannot change live training evidence',()=>{
  const s=simulation();s.running=true;advance(s,30);const first=s.snapshot();expect(first.peeking).toBeDefined();
  first.peeking!.path.push({x:999,y:999,z:999});first.peeking!.operator.scopedShots=999;first.operator!.scopedShots=999;
  const next=s.snapshot();expect(next.peeking!.path.some(p=>p.x===999)).toBe(false);expect(next.peeking!.operator.scopedShots).toBe(0);expect(next.operator!.scopedShots).toBe(0);
 });
});

it('predicts the stricter sniper movement-ready threshold without changing rifle prediction',()=>{
 const s=new Simulation('free','operator',{...DEFAULT_SETTINGS});s.movement.velocity.x=.60;s.movement.speed=.60;
 expect(s.movement.estimateReadyTime(emptyInput(),0)).toBe(0);
 expect(s.movement.estimateReadyTime(emptyInput(),0,dt,5.13*.72*.15)).toBeGreaterThan(0);
});

it('records Operator braking only after resolved velocity reaches its own precision threshold',()=>{
 const s=new Simulation('free','operator',{...DEFAULT_SETTINGS});s.running=true;advance(s,50,{strafe:1});
 let velocityAtThreshold:number|null=null;for(let i=0;i<100;i++){s.step(dt,emptyInput());if(s.braking.thresholdTime!==null){velocityAtThreshold=s.movement.speed;break;}}
 expect(velocityAtThreshold).not.toBeNull();expect(velocityAtThreshold!).toBeLessThanOrEqual(5.13*.72*.15);
});
