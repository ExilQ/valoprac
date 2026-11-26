import {describe,expect,it} from 'vitest';
import {FIRE_VARIANTS,synthesizeShot} from '../engine/audio/synthesis';
import {synthesizeFootstep} from '../engine/audio/footstepSynthesis';
import {synthesizeKnife} from '../engine/audio/knifeSynthesis';
import {windowRms,type Pcm} from '../engine/audio/dsp';
import {AUDIO_MIX} from '../engine/audio/Audio';
import {AUDIO_PROFILES} from '../config/audio';
import {WEAPON_ORDER} from '../config/weapons';
import {SURFACE_FOOTSTEP_SOUND_PROFILES} from '../config/surfaces';

const RATE=48000,dB=(x:number)=>20*Math.log10(x);
const spread=(values:number[])=>dB(Math.max(...values))-dB(Math.min(...values));
describe('12.26 mix balance',()=>{
 it('keeps round-robin gunshots within 2 dB of each other (designed jitter ±0.7 dB)',()=>{
  for(const gun of WEAPON_ORDER)for(const perspective of ['first','third'] as const){
   const levels=Array.from({length:FIRE_VARIANTS},(_,v)=>windowRms(synthesizeShot(gun,RATE,v,perspective),RATE,.25));
   expect(spread(levels),`${gun} ${perspective}`).toBeLessThan(2);
  }
 });
 it('loudness-matches the four footstep variants of every floor',()=>{
  for(const material of SURFACE_FOOTSTEP_SOUND_PROFILES){const levels=[0,1,2,3].map(v=>windowRms([synthesizeFootstep(RATE,v,material as never)],RATE,.1));expect(spread(levels),material).toBeLessThan(.5);}
 });
 it('keeps a knife swing well under a rifle shot',()=>{
  const rifle=windowRms(synthesizeShot('rifleA',RATE,0,'first'),RATE,.25)*AUDIO_MIX.playerFireGain*AUDIO_PROFILES.rifleA.gain;
  const slash=windowRms([synthesizeKnife('slash',RATE) as Pcm],RATE,.25)*AUDIO_MIX.knifeSlashGain;
  const stab=windowRms([synthesizeKnife('stab',RATE) as Pcm],RATE,.25)*AUDIO_MIX.knifeStabGain;
  expect(dB(rifle/slash)).toBeGreaterThan(6);expect(dB(rifle/stab)).toBeGreaterThan(6);
 });
});
