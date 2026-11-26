import {afterEach,describe,expect,it,vi} from 'vitest';
import {indexedDB} from 'fake-indexeddb';
import {TrainingAudio} from '../engine/audio/Audio';
import {DEFAULT_SETTINGS} from '../config/settings';
import type {ShotEvent} from '../engine/types';
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

// Minimal Web Audio graph recorder for routing checks.
class Node {gain={value:1};frequency={value:0};Q={value:0};type='';buffer:unknown=null;positionX={value:0};positionY={value:0};positionZ={value:0};pan={value:0};panningModel='';distanceModel='';refDistance=0;maxDistance=0;rolloffFactor=0;onended:(()=>void)|null=null;connected:Node[]=[];constructor(readonly all:Node[]){all.push(this);}connect(n:Node){this.connected.push(n);return n;}disconnect(){}start(){}stop(){}}
class Context {nodes:Node[]=[];sampleRate=8000;currentTime=0;state='running';destination=new Node(this.nodes);listener={setPosition(){},setOrientation(){}};
 createGain(){return new Node(this.nodes);}createDynamicsCompressor(){return new Node(this.nodes);}createBiquadFilter(){return new Node(this.nodes);}createPanner(){return new Node(this.nodes);}createConvolver(){return new Node(this.nodes);}createBufferSource(){return new Node(this.nodes);}
 createBuffer(channels:number,length:number,rate:number){return {channels,duration:length/rate,copyToChannel(){}};}resume(){return Promise.resolve();}close(){return Promise.resolve();}static last:Context;constructor(){Context.last=this;}}
afterEach(()=>vi.unstubAllGlobals());
describe('12.27 room reverb follows channel volume',()=>{
 it('sends every voice to the room through its channel volume bus',async()=>{
  vi.stubGlobal('AudioContext',Context);vi.stubGlobal('indexedDB',indexedDB);
  const audio=new TrainingAudio();audio.setSpace('range');await audio.unlock();audio.sync(0);
  const c=Context.last,internals=audio as unknown as {sends:Record<string,Node>;reverbIn:Node};
  for(const bus of Object.values(internals.sends))expect(bus.connected).toContain(internals.reverbIn);
  audio.levels({...DEFAULT_SETTINGS,firingVolume:0,footstepVolume:.4});
  expect(internals.sends.firing.gain.value).toBe(0);expect(internals.sends.footsteps.gain.value).toBe(.4);
  audio.shot({weapon:'rifleA',timestamp:0,magazineShot:0,hit:'miss',penetrationSegments:[]} as unknown as ShotEvent);
  const direct=c.nodes.filter(n=>n.connected.includes(internals.reverbIn));
  expect(direct.every(n=>Object.values(internals.sends).includes(n))).toBe(true);
  expect(c.nodes.some(n=>n.connected.includes(internals.sends.firing))).toBe(true);
  audio.dispose();
 });
});
