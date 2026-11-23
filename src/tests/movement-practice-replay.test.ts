import {describe,it,expect} from 'vitest';
import {Simulation} from '../engine/simulation/Simulation';
import {ReplayRecorder} from '../engine/replay/recording';
import {ReplayPlayer} from '../engine/replay/playback';
import {buildMovementGhost} from '../training/movementTools/GhostFromReplay';
import {DEFAULT_SETTINGS} from '../config/settings';
import {defaultMovementTools} from '../training/movementTools/types';
import {emptyInput} from '../engine/types';
const dt=1/120;
const settings=()=>structuredClone({...DEFAULT_SETTINGS,movementTools:{...defaultMovementTools(),enabled:true}});

describe('A3 authoritative movement actions use the shared A2 command stream',()=>{
 it('replays save, restore, takeoff return and attempt reset with the same outcome',async()=>{
  const s=new Simulation('free','rifleA',settings()),r=new ReplayRecorder(s);s.running=true;expect(s.trainingAction({kind:'movement-save'}).ok).toBe(true);
  for(let n=0;n<180;n++)s.step(dt,{...emptyInput(),forward:1,jump:n===60,jumpHeld:n===60});
  expect(s.movementPractice.snapshot().last).not.toBeNull();expect(s.trainingAction({kind:'movement-takeoff'}).ok).toBe(true);
  for(let n=0;n<20;n++)s.step(dt,{...emptyInput(),strafe:1});
  expect(s.trainingAction({kind:'movement-restore'}).ok).toBe(true);expect(s.trainingAction({kind:'movement-reset'}).ok).toBe(true);
  const recording=r.finish()!,a=await new ReplayPlayer(recording).verify(),b=await new ReplayPlayer(recording).verify();expect(recording.commands.filter(c=>c[0]===12)).toHaveLength(4);expect(a.passed).toBe(true);expect(a).toEqual(b);
 });
 it('reconstructs an automatically captured jump clip from its true grounded origin',async()=>{
  const s=new Simulation('free','rifleA',settings()),r=new ReplayRecorder(s);s.running=true;
  for(let n=0;n<60;n++)s.step(dt,{...emptyInput(),forward:1});
  s.step(dt,{...emptyInput(),forward:1,jump:true,jumpHeld:true});
  let n=0;while(!s.movementPractice.snapshot().last&&n++<120)s.step(dt,{...emptyInput(),forward:1});
  const attempt=s.movementPractice.snapshot().last!,recording=r.snapshot()!,ghost=await buildMovementGhost(recording,{startTick:attempt.startTick,endTick:attempt.endTick});
  expect(ghost.origin.y).toBe(attempt.takeoff.y);expect(ghost.peakHeight).toBeCloseTo(attempt.peakHeight,10);expect(ghost.distance).toBeCloseTo(attempt.distance,10);expect(ghost.landing).toEqual(attempt.landing);expect(ghost.landings).toBe(1);
 });
 it('keeps disabled tool commands as unsuccessful actions without teleporting',async()=>{
  const s=new Simulation('free','rifleA',structuredClone(DEFAULT_SETTINGS)),r=new ReplayRecorder(s),position=s.movement.position.clone();expect(s.trainingAction({kind:'movement-save'}).ok).toBe(false);expect(s.trainingAction({kind:'movement-restore'}).ok).toBe(false);expect(s.movement.position.toArray()).toEqual(position.toArray());expect((await new ReplayPlayer(r.finish()!).verify()).passed).toBe(true);
 });
});
