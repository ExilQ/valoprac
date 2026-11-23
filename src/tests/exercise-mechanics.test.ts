import {describe,it,expect} from 'vitest';
import {Vector3} from 'three';
import {Simulation} from '../engine/simulation/Simulation';
import {DEFAULT_SETTINGS} from '../config/settings';
import {emptyInput} from '../engine/types';
import {ReplayRecorder} from '../engine/replay/recording';
import {ReplayPlayer} from '../engine/replay/playback';
import {encodeReplay} from '../engine/replay/codec';
import {DEFAULT_FLASH_OPTIONS,DEFAULT_WARMUP_OPTIONS,validateExerciseOptions,type ExerciseOptions} from '../training/exercises/types';

const DT=1/120,DEG=180/Math.PI;
function simulation(exercise:ExerciseOptions=DEFAULT_WARMUP_OPTIONS){return new Simulation('free','rifleA',structuredClone(DEFAULT_SETTINGS),{exercise});}
function aimAtTarget(s:Simulation){
 const t=s.targets[0],head=t.headPosition(new Vector3()),d=head.sub(s.movement.position).sub(new Vector3(0,s.movement.eyeHeight,0)),yaw=Math.atan2(-d.x,-d.z),pitch=Math.atan2(d.y,Math.hypot(d.x,d.z)),gain=s.settings.sensitivity*s.settings.degreesPerCount;
 s.look(-(yaw-s.viewYaw)*DEG/gain,-(pitch-s.viewPitch)*DEG/gain);
}
describe('A1/A6 protocols use actual fixed-step movement, camera, weapons and outcomes',()=>{
 it('owns one real target at timezero and lets it cross the angle before respawning',()=>{
  const s=simulation(),start=s.targets[0].position.clone();expect(s.targets.filter(t=>t.enabled&&t.active)).toHaveLength(1);expect(s.exercise!.snapshot().warmup!.firstTargetAt).toBe(0);
  s.running=true;let crossed=false,last=start.x,maxActive=1;
  for(let tick=0;tick<7200;tick++){s.step(DT,emptyInput());const t=s.targets[0];maxActive=Math.max(maxActive,s.targets.filter(t=>t.enabled&&t.active).length);if(t.active&&t.position.x*last<0)crossed=true;if(t.active)last=t.position.x;}
  const report=s.exercise!.snapshot();expect(crossed).toBe(true);expect(maxActive).toBe(1);expect(report.warmup!.appearances).toBeGreaterThan(20);expect(report.warmup!.escaped).toBeGreaterThan(20);expect(report.score).toBe(0);expect(s.movement.position.toArray()).toEqual([0,0,5]);expect(s.completed).toBe(true);expect(s.running).toBe(false);expect(s.ticks).toBe(7200);expect(s.time).toBe(60);
  const tick=s.ticks;s.step(DT,{...emptyInput(),fire:true});expect(s.ticks).toBe(tick);expect(s.stats.shots).toBe(0);
  console.log(JSON.stringify({benchmark:'warmup-passive-crossings',fixedHz:120,report,firstTargetSimulationTime:0,graphicsLoadMeasured:false,playerMovementAutomatic:false}));
 });
 it('scores legitimate real3D headshots and reproduces all60seconds through the common replay',async()=>{
  const s=simulation(),r=new ReplayRecorder(s);s.running=true;let lastGeneration=-1;
  for(let tick=0;tick<7200;tick++){
   const t=s.targets[0],shoot=t.enabled&&t.active&&t.generation!==lastGeneration;
   if(shoot){aimAtTarget(s);lastGeneration=t.generation;}
   s.step(DT,{...emptyInput(),fire:shoot,firePresses:shoot?1:0});
  }
  const report=s.exercise!.snapshot();expect(report.completed).toBe(true);expect(report.score).toBe(s.stats.eliminations);expect(report.score).toBeGreaterThan(20);expect(s.shots.some(x=>x.hit==='head')).toBe(true);expect(s.shots.every(x=>x.targetId===0||x.hit==='miss')).toBe(true);
  const recording=r.finish()!,a=await new ReplayPlayer(recording).verify(),b=await new ReplayPlayer(recording).verify(),bytes=await encodeReplay(recording);expect(a.passed).toBe(true);expect(a).toEqual(b);expect(a.score).toBe(report.score);expect(bytes.length).toBeLessThanOrEqual(200000);
  console.log(JSON.stringify({benchmark:'warmup-real3d-replay',report,replay:a,gzipBytes:bytes.length,method:'Deterministic scripted test input aims at the real target; product contains no automatic aiming or movement.'}));
 },30000);
 it('keeps manual targetreset and configuration from enabling ordinary extra targets or resetting the clock',async()=>{
  const s=simulation(),r=new ReplayRecorder(s);s.running=true;for(let n=0;n<240;n++)s.step(DT,emptyInput());const before=s.time;
  s.configure({targetCount:12,behavior:'appearing',analysisWall:true});s.resetTargets();s.step(DT,emptyInput());expect(s.time).toBeGreaterThan(before);expect(s.targets.filter(t=>t.enabled)).toHaveLength(1);expect(s.targets[0].behavior).toBe('long');expect((await new ReplayPlayer(r.finish()!).verify()).passed).toBe(true);
 });
 it('measures genuine camera turn onset and completion from a seeded flash cue',async()=>{
  const s=simulation(DEFAULT_FLASH_OPTIONS),r=new ReplayRecorder(s);s.running=true;let turned=0;
  for(let n=0;n<7200;n++){const cue=s.exercise!.currentCue;if(cue&&cue.id!==turned&&s.time-cue.cueTime>=.25-1e-9){s.look(-110/(s.settings.sensitivity*s.settings.degreesPerCount),0);turned=cue.id;}s.step(DT,emptyInput());}
  const report=s.exercise!.snapshot(),events=report.flash!.events;expect(report.completed).toBe(true);expect(report.score).toBeGreaterThan(20);expect(events.every(e=>e.success&&e.maximumTurnDegrees>=100&&e.movementOnset!==null&&e.completionTime!==null)).toBe(true);
  for(const e of events){expect(e.movementOnset!-e.cueTime).toBeGreaterThanOrEqual(.25-1e-8);expect(e.completionTime!-e.cueTime).toBeLessThanOrEqual(.25+2*DT);expect(e.source.x-e.initialDirection.x*6).toBeCloseTo(0,10);expect(e.source.z-e.initialDirection.z*6).toBeCloseTo(5,10);}
  expect(s.movement.position.toArray()).toEqual([0,0,5]);const rec=r.finish()!,a=await new ReplayPlayer(rec).verify(),b=await new ReplayPlayer(rec).verify();expect(a.passed).toBe(true);expect(a).toEqual(b);
  console.log(JSON.stringify({benchmark:'flash-camera-reaction-replay',report,replay:a,clock:'120Hz simulation; no physical input-to-photon or native ability parity claim'}));
 },30000);
 it('does not count translation, partial turns or late movement as successful avoidance',()=>{
  const s=simulation(DEFAULT_FLASH_OPTIONS);s.running=true;let nudged=0;
  for(let n=0;n<7200;n++){const cue=s.exercise!.currentCue;if(cue&&cue.id!==nudged){s.look(-2/(s.settings.sensitivity*s.settings.degreesPerCount),0);nudged=cue.id;}s.step(DT,{...emptyInput(),forward:1});}
  const report=s.exercise!.snapshot();expect(report.score).toBe(0);expect(report.flash!.failures).toBeGreaterThan(20);expect(report.flash!.events.every(e=>e.success===false&&e.completionTime===null&&e.maximumTurnDegrees<3)).toBe(true);expect(s.movement.position.z).not.toBe(5);
 });
 it('preserves independent flash thresholds and rejects unsupported executable or unbounded settings',()=>{
  expect(validateExerciseOptions({schema:1,kind:'flash',durationSeconds:60,responseWindowSeconds:.25,turnThresholdDegrees:150})).toMatchObject({responseWindowSeconds:.25,turnThresholdDegrees:150});
  for(const raw of [null,{schema:2,kind:'warmup',durationSeconds:60},{schema:1,kind:'warmup',durationSeconds:600},{schema:1,kind:'warmup',durationSeconds:60,script:'alert(1)'},{schema:1,kind:'flash',durationSeconds:60,responseWindowSeconds:NaN,turnThresholdDegrees:100},{schema:1,kind:'flash',durationSeconds:60,responseWindowSeconds:.1,turnThresholdDegrees:100}])expect(()=>validateExerciseOptions(raw)).toThrow();
 });
});
