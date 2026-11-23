import {describe,it,expect} from 'vitest';
import {Vector3} from 'three';
import {Simulation} from '../engine/simulation/Simulation';
import {ReplayRecorder} from '../engine/replay/recording';
import {ReplayPlayer,captureReplayFrame} from '../engine/replay/playback';
import {DEFAULT_SETTINGS} from '../config/settings';
import {emptyInput} from '../engine/types';
const dt=1/120,deg=180/Math.PI;

describe('Replay preserves legitimate combat outcomes rather than only matching misses',()=>{
 it('keeps browser input resets between ticks from mutating stored movement state',async()=>{
  const s=new Simulation('free','rifleA',structuredClone(DEFAULT_SETTINGS)),r=new ReplayRecorder(s),input=emptyInput();s.running=true;input.forward=1;input.fire=true;
  for(let n=0;n<60;n++)s.step(dt,input);
  // BrowserInput reuses its object and clears it on unlock, without a new tick.
  Object.assign(input,emptyInput());s.clearMovementInput();s.clearFireView();s.running=false;s.completed=true;
  expect((await new ReplayPlayer(r.finish()!).verify()).passed).toBe(true);
 });
 it('recomputes an actual rendered-frame headshot and elimination twice',async()=>{
  const s=new Simulation('free','rifleA',structuredClone({...DEFAULT_SETTINGS,targetCount:1,behavior:'long' as const}));s.renderedTargets.attach();const r=new ReplayRecorder(s);s.running=true;
  for(let n=0;n<180;n++){s.step(dt,emptyInput());if(n%2===0)captureReplayFrame(s,(s.renderedTargets.latest?.id??0)+1,1000+n*1000*dt,.25,s.ticks);}
  const frame=s.renderedTargets.latest!,head=new Vector3().setFromMatrixPosition(frame.targets[0]!.matrices[0]),origin=s.movement.position.clone().add(new Vector3(0,s.movement.eyeHeight,0)),d=head.sub(origin),yaw=Math.atan2(-d.x,-d.z),pitch=Math.atan2(d.y,Math.hypot(d.x,d.z)),gain=s.settings.sensitivity*s.settings.degreesPerCount;
  s.look(-(yaw-s.yaw)*deg/gain,-(pitch-s.pitch)*deg/gain);s.captureFireView(frame.submittedAt);s.step(dt,{...emptyInput(),fire:true,firePresses:1});
  expect(s.shots.at(-1)?.targetPoseSource).toBe('rendered-frame');expect(s.shots.at(-1)?.hit).toBe('head');expect(s.stats.eliminations).toBe(1);
  const record=r.finish()!;const a=await new ReplayPlayer(record).verify(),b=await new ReplayPlayer(record).verify();expect(a.passed).toBe(true);expect(a).toEqual(b);expect(a.score).toBe(1);expect(a.hits).toBe(1);
 });
 it('reproduces a real defender death, paused clock debt and same-map retry',async()=>{
  const s=new Simulation('free','rifleA',structuredClone({...DEFAULT_SETTINGS,practiceMap:'long' as const,targetCount:1,defenderSkill:'expert' as const,defenderReaction:.15,defenderAccuracy:.98,defenderFirstShotError:.05,defenderReposition:0,randomDefenders:false})),r=new ReplayRecorder(s);s.running=true;
  // Move physically from protected spawn into the first long-lane doorway.
  for(let n=0;n<2400&&!s.exposure.death;n++){
   const dx=-s.movement.position.x,dz=(Math.abs(dx)>.1?5:-3)-s.movement.position.z,yaw=Math.atan2(-dx,-dz);
   s.step(dt,{...emptyInput(),forward:1,movementYaw:yaw});
  }
  expect(s.exposure.death).not.toBeNull();const deathTick=s.ticks;
  for(let n=0;n<50;n++)s.step(dt,emptyInput());expect(s.ticks).toBe(deathTick);
  s.retryTactical();s.running=true;for(let n=0;n<60;n++)s.step(dt,emptyInput());
  const record=r.finish()!,a=await new ReplayPlayer(record).verify(),b=await new ReplayPlayer(record).verify();expect(a.passed).toBe(true);expect(a).toEqual(b);expect(a.deaths).toBeGreaterThan(0);expect(record.events.some(e=>e.kind==='death')).toBe(true);expect(record.events.some(e=>e.kind==='respawn')).toBe(true);
 });
});
