import {describe,expect,it} from 'vitest';
import {DEFAULT_SETTINGS} from '../config/settings';
import {ReplayPlayer,captureReplayFrame} from '../engine/replay/playback';
import {ReplayRecorder} from '../engine/replay/recording';
import type {ReplayRecording} from '../engine/replay/types';
import {Simulation} from '../engine/simulation/Simulation';
import {FIELD_CHARACTER_GEOMETRY,LEGACY_CHARACTER_GEOMETRY,PREVIOUS_FIELD_GEOMETRY} from '../engine/targets/characterProfile';
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
 it('preserves the 12.06 headshot session fingerprint, checksum and articulated geometry',async()=>{
  // The 12.06 session had no 12.31 settings keys; they are part of the checksum state.
  const settings:Partial<typeof DEFAULT_SETTINGS>={...structuredClone(DEFAULT_SETTINGS),behavior:'stationary',targetCount:1,targetDistance:8};for(const key of ['infiniteMagazine','botRespawn','botRespawnDelay'] as const)delete settings[key];
  const sim=new Simulation('free','rifleA',settings as typeof DEFAULT_SETTINGS,{},'materials-v3',PREVIOUS_FIELD_GEOMETRY);
  sim.renderedTargets.attach();
  const recorder=new ReplayRecorder(sim);
  sim.running=true;captureReplayFrame(sim,1,1000,.65,sim.ticks);sim.captureFireView(1000);
  sim.step(1/120,{...emptyInput(),fire:true,firePresses:1});
  const record=recorder.finish()!;
  // Captured with the published a0faad5 sources before the silhouette revision.
  expect(record.header.calibrationFingerprint).toBe('c62cd09ad9c0482e');
  expect(record.final).toMatchObject({hits:1,checksum:'9b379b08f270d4a8'});
  const player=new ReplayPlayer(record);
  expect(player.simulation.characterGeometry).toBe(PREVIOUS_FIELD_GEOMETRY);
  expect(await player.verify()).toMatchObject({passed:true});
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
