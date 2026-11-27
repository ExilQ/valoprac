import {describe,expect,it} from 'vitest';
import {WEAPONS,LEGACY_WEAPONS} from '../config/weapons';
import {DEFAULT_SETTINGS} from '../config/settings';
import {Simulation} from '../engine/simulation/Simulation';
import {ReplayRecorder} from '../engine/replay/recording';
import {ReplayPlayer} from '../engine/replay/playback';
import {replayCompatibility} from '../engine/replay/integrity';
import {emptyInput} from '../engine/types';
import {CURRENT_SIMULATION_RULES} from '../engine/simulation/rules';
import {HISTORICAL_COURSE_TITLES,MAP_COURSES} from '../config/mapCourses';
import courseReplays from './fixtures/replay-12.26-courses.json';
import type {ReplayRecording} from '../engine/replay/types';

describe('12.27 firearm values (weapons-v6) and replay compatibility',()=>{
 it('uses the official wiki values from v6 and keeps the recorded values for older rules',()=>{
  expect(CURRENT_SIMULATION_RULES).toBe('acceleration-v10');
  expect([WEAPONS.rifleA.reserve,WEAPONS.rifleB.reserve]).toEqual([50,60]);
  expect([WEAPONS.rifleA.airSpread,WEAPONS.rifleB.airSpread,WEAPONS.sheriff.airSpread]).toEqual([10,10,7]);
  expect([LEGACY_WEAPONS.rifleA.reserve,LEGACY_WEAPONS.rifleB.reserve]).toEqual([75,90]);
  expect([LEGACY_WEAPONS.rifleA.airSpread,LEGACY_WEAPONS.rifleB.airSpread,LEGACY_WEAPONS.sheriff.airSpread]).toEqual([8.5,8,8]);
  for(const rules of ['legacy-v2','materials-v3','air-steering-v4','bunny-hop-v5'] as const)expect(new Simulation('free','rifleA',structuredClone(DEFAULT_SETTINGS),{},rules).weapon.profile.reserve).toBe(75);
  expect(new Simulation('free','rifleB',structuredClone(DEFAULT_SETTINGS)).weapon.profile.reserve).toBe(60);
 });
 it('leaves every historical calibration fingerprint unchanged',()=>{
  expect(replayCompatibility('bunny-hop-v5',undefined,'range').calibrationFingerprint).toBe('51ab2c96687f0c34');
  expect(replayCompatibility('bunny-hop-v5',undefined,'fd-preaim').calibrationFingerprint).toBe('6b906d2585d8df33');
  expect(replayCompatibility('air-steering-v4',undefined,'range').calibrationFingerprint).toBe('b52af82a11aa044c');
  expect(replayCompatibility('materials-v3',undefined,'range').calibrationFingerprint).toBe('9ca31fd4d9c0502c');
  expect(replayCompatibility('weapons-v6',undefined,'range')).toMatchObject({simulationVersion:'valoprac-replay-simulation-6',simulationRules:'weapons-v6'});
  expect(replayCompatibility('weapons-v6',undefined,'range').calibrationFingerprint).not.toBe('51ab2c96687f0c34');
 });
 for(const rules of ['bunny-hop-v5','weapons-v6'] as const)it(`${rules}: airborne spray replays exactly with its own firearm values`,async()=>{
  const settings={...structuredClone(DEFAULT_SETTINGS),infiniteReserve:false};
  const s=new Simulation('free','rifleA',settings,{},rules),recorder=new ReplayRecorder(s);s.running=true;
  for(let n=0;n<720;n++)s.step(1/120,{...emptyInput(),forward:1,fire:n%40<30,jump:n%60===0,jumpHeld:n%60<3,reload:n===400});
  const record=recorder.finish()!;expect(record.header.simulationRules).toBe(rules);
  expect(s.shots.some(shot=>shot.spread?.air>0)).toBe(true);
  expect(s.weapons.rifleA.reserve).toBe(rules==='weapons-v6'?WEAPONS.rifleA.reserve-25:LEGACY_WEAPONS.rifleA.reserve-25);
  const player=new ReplayPlayer(record);expect(player.rules).toBe(rules);
  const verification=await player.verify();expect(verification.passed).toBe(true);
 });
 it('gives defender guns the firearm values of the replayed ruleset',()=>{
  const settings={...structuredClone(DEFAULT_SETTINGS),practiceMap:'site' as const,defenderWeapon:'rifleB' as const};
  for(const [rules,reserve] of [['bunny-hop-v5',90],['weapons-v6',60]] as const){
   const s=new Simulation('free','rifleA',structuredClone(settings),{},rules);
   expect(s.defenders?.memories.length).toBeGreaterThan(0);for(const m of s.defenders!.memories)expect(m.gun.profile.reserve).toBe(reserve);
  }
 });
 it('verifies replays recorded on renamed courses before 12.27 (fixture from 12.26)',async()=>{
  expect(courseReplays.fixtures.map(f=>[f.map,f.title])).toEqual([['bind','바인드'],['haven','헤이븐'],['icebox','아이스박스']]);
  for(const f of courseReplays.fixtures){
   const record=f.recording as unknown as ReplayRecording,player=new ReplayPlayer(record);expect(player.rules).toBe('bunny-hop-v5');
   const verification=await player.verify();expect(verification.passed,f.map).toBe(true);expect(verification.checksum).toBe(record.final.checksum);
  }
  for(const course of MAP_COURSES.filter(c=>!('drill' in c)))expect(HISTORICAL_COURSE_TITLES[course.id],course.id).toBeTruthy();
 });
 it('records and verifies new replays on renamed courses under weapons-v6',async()=>{
  const s=new Simulation('free','rifleA',{...structuredClone(DEFAULT_SETTINGS),practiceMap:'bind' as never}),recorder=new ReplayRecorder(s);s.running=true;
  for(let n=0;n<240;n++)s.step(1/120,{...emptyInput(),forward:1,fire:n%50<6});
  expect(s.level?.title).toBe('전이문 마당');expect((await new ReplayPlayer(recorder.finish()!).verify()).passed).toBe(true);
 });
});
