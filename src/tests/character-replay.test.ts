import {describe,expect,it} from 'vitest';
import {DEFAULT_SETTINGS} from '../config/settings';
import {ReplayPlayer,captureReplayFrame} from '../engine/replay/playback';
import {ReplayRecorder} from '../engine/replay/recording';
import type {ReplayRecording} from '../engine/replay/types';
import {Simulation} from '../engine/simulation/Simulation';
import {FIELD_CHARACTER_GEOMETRY,LEGACY_CHARACTER_GEOMETRY} from '../engine/targets/characterProfile';
import {emptyInput} from '../engine/types';
import fixture from './fixtures/replay-12.05-target.json';

describe('Character mesh selection is preserved with replay authority',()=>{
 it('reproduces a frozen 12.05 headshot and replay checksum using its original mesh',async()=>{
  const record=fixture.recording as ReplayRecording,player=new ReplayPlayer(record);
  expect(record.header.characterGeometryVersion).toBeUndefined();
  expect(player.simulation.characterGeometry).toBe(LEGACY_CHARACTER_GEOMETRY);
  expect(player.simulation.targets[0].characterGeometry).toBe(LEGACY_CHARACTER_GEOMETRY);
  expect(record.final.hits).toBe(1);
  expect(await player.verify()).toMatchObject({passed:true,checksum:'354098319fe11413'});
 });
 it('records the new mesh, reconstructs a rendered-frame hit and rejects a stripped version',async()=>{
  const sim=new Simulation('free','rifleA',{...structuredClone(DEFAULT_SETTINGS),targetCount:1,targetDistance:8,behavior:'stationary'});
  sim.renderedTargets.attach();
  const recorder=new ReplayRecorder(sim);
  sim.running=true;captureReplayFrame(sim,1,1000,.65,sim.ticks);sim.captureFireView(1000);
  sim.step(1/120,{...emptyInput(),fire:true,firePresses:1});
  expect(sim.shots[0]).toMatchObject({hit:'head',targetPoseSource:'rendered-frame'});
  const record=recorder.finish()!;
  expect(record.header.characterGeometryVersion).toBe(FIELD_CHARACTER_GEOMETRY);
  const player=new ReplayPlayer(record);
  expect(player.simulation.targets[0].characterGeometry).toBe(FIELD_CHARACTER_GEOMETRY);
  expect(await player.verify()).toMatchObject({passed:true});
  delete record.header.characterGeometryVersion;
  expect(()=>new ReplayPlayer(record)).toThrow(/호환/);
 });
});
