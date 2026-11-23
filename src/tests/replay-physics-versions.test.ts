import {describe,expect,it} from 'vitest';
import legacyFixture from './fixtures/replay-10.0.0.json';
import legacyPhysics from './fixtures/replay-10.0.0-physics.json';
import legacyScenario from './fixtures/replay-10.0.0-scenario.json';
import {DEFAULT_SETTINGS} from '../config/settings';
import {SURFACE_CALIBRATION_VERSION} from '../config/surfaces';
import {Simulation} from '../engine/simulation/Simulation';
import {FixedClock} from '../engine/simulation/FixedClock';
import {ReplayRecorder} from '../engine/replay/recording';
import {ReplayPlayer,captureReplayFrame} from '../engine/replay/playback';
import {deterministicState,replayCompatibility,replayOutcome} from '../engine/replay/integrity';
import {decodeReplay,encodeReplay} from '../engine/replay/codec';
import {validateReplay} from '../engine/replay/validation';
import {emptyInput,type Settings} from '../engine/types';
import {obstaclesFor} from '../engine/tactical/map';
import type {ReplayRecording} from '../engine/replay/types';
import {createScenario} from '../training/scenarios/templates';

describe('Simulation rules are selected before replay reconstruction',()=>{
 it('verifies the unchanged actual10 replay and independent frozen movement/material recordings',async()=>{
  expect(legacyPhysics.fixtures.map(f=>f.recording.final.checksum)).toEqual(['144b56481234c538','d9a482b7fceefe17','8258a72b4893789f','e057e8ff19a698a7']);
  for(const record of [legacyFixture,...legacyPhysics.fixtures.map(f=>f.recording)] as ReplayRecording[]){
   const before=JSON.stringify(record),p=new ReplayPlayer(record),verification=await p.verify();
   expect(p.rules).toBe('legacy-v2');expect(p.simulation.rules).toBe('legacy-v2');
   expect(verification.passed,record.header.physics).toBe(true);expect(verification.checksum).toBe(record.final.checksum);
   const decoded=await decodeReplay(await encodeReplay(record));expect((await new ReplayPlayer(decoded).verify()).passed).toBe(true);
   expect(JSON.stringify(record)).toBe(before);
  }
 });
 it('records retained rules as simulation2 and retains its original state layout',async()=>{
  const s=new Simulation('free','rifleA',structuredClone(DEFAULT_SETTINGS),{},'legacy-v2'),recorder=new ReplayRecorder(s);s.running=true;
  for(let n=0;n<180;n++)s.step(1/120,{...emptyInput(),forward:1,jump:n===30,jumpHeld:n>=30&&n<33});
  const record=recorder.finish()!,state=deterministicState(s);
  expect(record.header).toMatchObject(replayCompatibility('legacy-v2'));expect(record.header.materialPhysicsVersion).toBeUndefined();
  expect(state).not.toHaveProperty('simulationRules');expect(state.movementProfile).not.toHaveProperty('stepMinLandingWidth');expect(state.movement).not.toHaveProperty('rules');
  expect((await new ReplayPlayer(record).verify()).passed).toBe(true);
 });
 it('retains the original scenario rules object in historical checksums',async()=>{
  const scenario=createScenario('close-corner');scenario.rules.combatMode='learning';
  const s=new Simulation('free','rifleA',structuredClone(DEFAULT_SETTINGS),{scenario},'legacy-v2'),recorder=new ReplayRecorder(s);s.running=true;
  for(let n=0;n<30;n++)s.step(1/120,emptyInput());
  const state=deterministicState(s);
  expect(state.platform).toMatchObject({options:{scenario:{rules:scenario.rules}}});
  expect(state.movement).not.toHaveProperty('rules');expect(state.defenders).not.toHaveProperty('rules');
  expect((await new ReplayPlayer(recorder.finish()!).verify()).passed).toBe(true);
 });
 it('verifies an independent original scenario replay with retained rules, retry and shot state',async()=>{
  const record=legacyScenario.recording as ReplayRecording,before=JSON.stringify(record);
  expect(legacyScenario.baselineCommit).toBe('0029c162de2756aa11092748514efe726e1ee217');
  expect(record.final.checksum).toBe('0504b121cca31227');expect(record.final.shots).toBe(1);
  expect(record.events.map(e=>e.kind)).toEqual(expect.arrayContaining(['jump','landing','weapon','respawn','shot']));
  const player=new ReplayPlayer(record);expect(player.rules).toBe('legacy-v2');
  expect((await player.verify()).passed).toBe(true);expect(player.mismatches).toEqual([]);
  expect((await new ReplayPlayer(await decodeReplay(await encodeReplay(record))).verify()).passed).toBe(true);
  expect(JSON.stringify(record)).toBe(before);
 });
 it('requires the complete versioned calibration identity and rejects mixed rules',()=>{
  const s=new Simulation('free','rifleA',structuredClone(DEFAULT_SETTINGS)),recorder=new ReplayRecorder(s),record=recorder.finish()!;
  expect(record.header).toMatchObject({gameVersion:'12.0.0',simulationVersion:'valoprac-replay-simulation-3',simulationRules:'materials-v3',materialPhysicsVersion:SURFACE_CALIBRATION_VERSION,inputVersion:'ordered-fixed-input-1',weaponVersion:'weapons-10.0.0',physics:'valorant',seed:DEFAULT_SETTINGS.seed});
  for(const mutate of [
   (r:ReplayRecording)=>{delete r.header.materialPhysicsVersion;},
   (r:ReplayRecording)=>{r.header.materialPhysicsVersion='unregistered';},
   (r:ReplayRecording)=>{r.header.simulationRules='legacy-v2';},
   (r:ReplayRecording)=>{r.header.inputVersion='unordered';},
   (r:ReplayRecording)=>{r.header.weaponVersion='unknown';},
   (r:ReplayRecording)=>{r.header.gameVersion='10.0.0';},
  ]){const changed=structuredClone(record);mutate(changed);expect(()=>new ReplayPlayer(changed)).toThrow(/호환/);}
  const mixed=structuredClone(legacyFixture) as ReplayRecording;mixed.header.materialPhysicsVersion=SURFACE_CALIBRATION_VERSION;expect(()=>new ReplayPlayer(mixed)).toThrow(/호환/);
 });
 it('fingerprints physical map assignments while appearance changes preserve compatibility',()=>{
  const obstacle=obstaclesFor('range')[0],color=obstacle.color,surfaceId=obstacle.surfaceId,before=replayCompatibility();
  try{
   obstacle.color=0xff00ff;expect(replayCompatibility()).toEqual(before);
   obstacle.surfaceId=surfaceId==='glass'?'steel':'glass';expect(replayCompatibility().calibrationFingerprint).not.toBe(before.calibrationFingerprint);
   expect(replayCompatibility('legacy-v2')).toMatchObject({calibrationFingerprint:'b9c4ab53c0512d05'});
  }finally{obstacle.color=color;if(surfaceId===undefined)delete obstacle.surfaceId;else obstacle.surfaceId=surfaceId;}
 });
 for(const profile of ['valorant','cs2','sourceClassic'] as const)for(const preset of ['low','medium','high','ultra'] as const){
  it(`${profile}/${preset}: replays authored collision/materials at60,144,240Hz`,()=>{
   const patch:Partial<Settings>={movementPhysics:profile==='valorant'?'valorant':'counterStrike',csMovementPreset:profile==='sourceClassic'?'sourceClassic':'cs2',practiceMap:'bunny',graphicsPreset:preset,targetCount:1,behavior:'stationary'};
   const s=new Simulation('free','rifleA',structuredClone({...DEFAULT_SETTINGS,...patch}));s.renderedTargets.attach();const recorder=new ReplayRecorder(s);s.running=true;let frameId=0;
   for(let n=0;n<360;n++){
    if(n%60===0)s.look(2,-1);if(n%2===0)captureReplayFrame(s,++frameId,1000+n*1000/120,.375,s.ticks);
    if(n===150)s.configure({movementPhysics:'counterStrike',csMovementPreset:'sourceClassic'});
    if(n===230)s.switchWeapon('sheriff');
    s.step(1/120,{...emptyInput(),forward:n<240?1:0,strafe:n%120<60?.25:-.25,jump:n%80===0,jumpHeld:n%80<3,fire:n%61===0,firePresses:n%61===0?1:0});
   }
   const record=recorder.finish()!;validateReplay(record);expect(record.header.materialPhysicsVersion).toBe(SURFACE_CALIBRATION_VERSION);
   for(const fps of [60,144,240]){
    const p=new ReplayPlayer(record),clock=new FixedClock();let frames=0;
    while(!p.ended&&frames++<fps*5)clock.advance(1/fps,()=>p.advanceToTick(Math.min(record.ticks,p.simulation.ticks+1)));
    expect(p.ended,`${fps}Hz`).toBe(true);expect(p.mismatches).toEqual([]);expect(replayOutcome(p.simulation)).toEqual(record.final);
   }
  });
 }
});
