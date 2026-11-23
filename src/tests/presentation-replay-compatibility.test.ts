import {describe,it,expect} from 'vitest';
import fixture from './fixtures/replay-10.0.0.json';
import type {ReplayRecording} from '../engine/replay/types';
import {ReplayPlayer} from '../engine/replay/playback';
import {replayCompatibility} from '../engine/replay/integrity';
import {initializeKoreanInterface,setLocale} from '../i18n/locale';
import {setThemePreference} from '../ui/theme/theme';

describe('Presentation release keeps the mechanical compatibility contract',()=>{
 it('reconstructs an independently recorded10.00 replay with identical authority under both themes',async()=>{
  expect(replayCompatibility().gameVersion).toBe('10.0.0');const recording=fixture as ReplayRecording;
  setThemePreference('light');const light=await new ReplayPlayer(recording).verify();
  await setLocale('en');initializeKoreanInterface();setThemePreference('dark');const dark=await new ReplayPlayer(recording).verify();
  expect(light.passed).toBe(true);expect(dark).toEqual(light);expect(light.shots).toBe(1);expect(light.checksum).toBe(recording.final.checksum);setThemePreference('light');
 });
});
