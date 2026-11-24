import {describe,expect,it} from 'vitest';
import {DEFAULT_SETTINGS} from '../config/settings';
import {ReplayPlayer} from '../engine/replay/playback';
import {ReplayRecorder} from '../engine/replay/recording';
import {Simulation} from '../engine/simulation/Simulation';
import {emptyInput,type InputState} from '../engine/types';
import {captureMotion} from '../training/scenarios/captureMotion';
import {decodeScenario,encodeScenario} from '../training/scenarios/codec';
import {compileScenario} from '../training/scenarios/compile';
import {scenarioComparisonKey} from '../training/scenarios/library';
import {motionPoint,withoutRecordedMotion} from '../training/scenarios/recordedMotion';
import {createMotionScenario} from '../training/scenarios/templates';
import {pairedMotionSessions} from '../ui/MotionComparison';

const step=(sim:Simulation,input:Partial<InputState>={})=>sim.step(1/120,{...emptyInput(),...input});

describe('Replay-derived opponent motion',()=>{
 it('extracts actual grounded movement and changing posture from fixed-step input history',async()=>{
  const sim=new Simulation('free','rifleA',DEFAULT_SETTINGS);
  const recorder=new ReplayRecorder(sim);
  sim.running=true;
  for(let tick=0;tick<300;tick++)step(sim,{strafe:tick<36?1:0,crouch:tick>=60&&tick<132,jump:tick===250});
  const record=recorder.finish()!;
  const motion=await captureMotion(record,0,1.8);
  expect(motion.points).toHaveLength(19);
  expect(motion.points[0]).toEqual([0,0,0,0]);
  expect(motion.points.some(point=>Math.abs(point[0])>50)).toBe(true);
  expect(motion.points.some(point=>point[3]===100)).toBe(true);
  await expect(captureMotion(record,1.4,1)).rejects.toThrow('점프');
 });

 it('waits for entry before replaying the pose, then reproduces the entire result',async()=>{
  const raw=createMotionScenario();
  raw.rules.combatMode='learning';
  const scenario=decodeScenario(encodeScenario(raw));
  expect(scenario.bots[0].motion).toEqual(raw.bots[0].motion);
  const plan=compileScenario(scenario),sim=new Simulation('free','rifleA',DEFAULT_SETTINGS,{scenario});
  const recorder=new ReplayRecorder(sim);
  sim.running=true;
  for(let i=0;i<120;i++)step(sim);
  expect(sim.targets[0].enabled).toBe(false);
  const waypoint=plan.route[1];
  for(let i=0;i<400&&!sim.targets[0].enabled;i++){
   const dx=waypoint.x-sim.movement.position.x,dz=waypoint.z-sim.movement.position.z;
   step(sim,{forward:1,movementYaw:Math.atan2(-dx,-dz)});
  }
  expect(sim.targets[0].enabled).toBe(true);
  for(let i=0;i<145;i++)step(sim);
  expect(sim.targets[0].crouch).toBe(1);
  expect(sim.targets[0].position.x).toBeCloseTo(scenario.bots[0].position.x-.75);
  for(let i=0;i<300;i++)step(sim);
  expect(sim.targets[0].crouch).toBe(0);
  expect(sim.targets[0].position.x).toBeCloseTo(scenario.bots[0].position.x+.30);
  expect(await new ReplayPlayer(recorder.finish()!).verify()).toMatchObject({passed:true});
 });

 it('transforms the path around its placement and rejects swept paths into back walls',()=>{
  const scenario=createMotionScenario(),bot=scenario.bots[0],motion=bot.motion!;
  const anchor={x:6,y:0,z:10};
  expect(motionPoint(anchor,{...motion,turns:1,mirror:true},[100,0,50,25])).toEqual({x:5.5,y:0,z:9,crouch:.25});
  motion.points=Array.from({length:21},(_,tick)=>[0,0,-28*tick,0]);
  expect(()=>compileScenario(scenario)).toThrow(/이동 재현.*벽/);
 });

 it('compares only the selected motion and its fixed control with equivalent settings',()=>{
  const moving=createMotionScenario(),fixed=withoutRecordedMotion(moving),mirror=structuredClone(moving);
  mirror.bots[0].motion!.mirror=true;
  const make=(scenario:typeof moving)=>new Simulation('free','rifleA',DEFAULT_SETTINGS,{scenario}).snapshot();
  const move=make(moving),control=make(fixed),different=make(mirror),tuned={...control,id:'different-sensitivity',settings:{...control.settings,sensitivity:5}};
  expect(scenarioComparisonKey(move)).not.toBe(scenarioComparisonKey(control));
  expect(scenarioComparisonKey(move,true)).toBe(scenarioComparisonKey(control));
  expect(pairedMotionSessions(move,[control,different,tuned])).toMatchObject({fixed:[control],moving:[move],hasMotion:true,next:fixed});
  expect(pairedMotionSessions(control,[move,different,tuned])).toMatchObject({fixed:[control],moving:[move],hasMotion:false,next:moving});
 });
});
