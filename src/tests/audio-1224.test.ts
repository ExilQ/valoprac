import {afterEach,describe,expect,it,vi} from 'vitest';
import {indexedDB} from 'fake-indexeddb';
import {FIRE_VARIANTS,GUN_RECIPES,synthesizeFeedback,synthesizeShot} from '../engine/audio/synthesis';
import {SPACES,prefetchOrder,renderSound,spaceForMap} from '../engine/audio/soundBank';
import {TrainingAudio,AUDIO_MIX} from '../engine/audio/Audio';
import {toMono} from '../engine/audio/dsp';
import {WEAPON_ORDER} from '../config/weapons';
import {bandPower} from './helpers/spectrum';
import type {ShotEvent} from '../engine/types';

const RATE=48000;
describe('12.24 layered weapon audio',()=>{
 for(const gun of WEAPON_ORDER)it(`${gun}: stereo first person, mono darker third person, distinct deterministic variants, no sub-bass domination`,()=>{
  const first=synthesizeShot(gun,RATE,0,'first'),third=synthesizeShot(gun,RATE,0,'third');
  expect(first).toHaveLength(2);expect(third).toHaveLength(1);
  expect(first[0]).not.toEqual(first[1]);// decorrelated ears
  expect(synthesizeShot(gun,RATE,0,'first')).toEqual(first);
  const variants=Array.from({length:FIRE_VARIANTS},(_,v)=>toMono(synthesizeShot(gun,RATE,v,'first')));
  for(let i=1;i<variants.length;i++)expect(variants[i]).not.toEqual(variants[0]);
  for(const pcm of [...first,third[0]]){expect(pcm.every(Number.isFinite)).toBe(true);expect(Math.max(...pcm.map(Math.abs))).toBeLessThanOrEqual(.97);}
  const f=bandPower(toMono(first),RATE),t=bandPower(third[0],RATE);
  // The sniper's boom may sit lower; nothing may be dominated by sub-bass.
  expect(f.below250).toBeLessThan(gun==='operator'?.8:.6);expect(f.from250To4000).toBeGreaterThan(.3);
  expect(t.above4000).toBeLessThan(f.above4000+1e-9);
  expect(first[0].length/RATE).toBeCloseTo(GUN_RECIPES[gun].seconds,2);
  // The transient arrives within 3 ms: gunshots must not fade in.
  const mono=toMono(first),peak=Math.max(...mono.map(Math.abs));expect(mono.slice(0,Math.round(.003*RATE)).some(v=>Math.abs(v)>.3*peak)).toBe(true);
 });
});

describe('12.24 hit and kill feedback',()=>{
 it('makes the headshot short and bright, the body hit dull, and raises the kill confirm per streak step',()=>{
  const head=synthesizeFeedback('headshot',RATE),body=synthesizeFeedback('body',RATE);
  expect(head.length/RATE).toBeLessThanOrEqual(.2);
  expect(bandPower(head,RATE).above4000+bandPower(head,RATE).from250To4000).toBeGreaterThan(.9);
  expect(bandPower(body,RATE).above4000).toBeLessThan(bandPower(head,RATE).above4000);
  const centroid=(pcm:Float32Array)=>{let num=0,den=0;for(let k=1;k<200;k++){let re=0,im=0;const f=k*20;for(let i=0;i<pcm.length;i+=2){const w=2*Math.PI*f*i/RATE;re+=pcm[i]*Math.cos(w);im+=pcm[i]*Math.sin(w);}const p=re*re+im*im;num+=p*f;den+=p;}return num/den;};
  expect(centroid(synthesizeFeedback('kill',RATE,2))).toBeGreaterThan(centroid(synthesizeFeedback('kill',RATE,0)));
 });
});

describe('12.24 sound bank',()=>{
 it('renders every prefetched key, puts the room and equipped weapon first, and rejects unknown keys',()=>{
  const keys=prefetchOrder('sheriff','indoor');
  expect(keys[0]).toBe('ir:indoor');expect(keys[1]).toBe('sheriff:fire:0');expect(new Set(keys).size).toBe(keys.length);
  for(const key of keys){const channels=renderSound(key,8000);expect(channels,key).not.toBeNull();for(const c of channels!)expect(c.every(Number.isFinite),key).toBe(true);}
  expect(renderSound('nothing:here',8000)).toBeNull();expect(renderSound('rifleA:unknown',8000)).toBeNull();
  expect(prefetchOrder('knife','range')[1]).toBe('rifleA:fire:0');
 });
 it('maps maps to acoustic spaces and builds stereo room responses that decay',()=>{
  expect(spaceForMap('range')).toBe('range');expect(spaceForMap('complex')).toBe('indoor');expect(spaceForMap('ascent')).toBe('courtyard');
  for(const space of Object.keys(SPACES)){const [l,r]=renderSound(`ir:${space}`,8000)!;expect(l).not.toEqual(r);
   const energy=(a:Float32Array,from:number,to:number)=>a.slice(Math.round(from*8000),Math.round(to*8000)).reduce((s,v)=>s+v*v,0);
   expect(energy(l,.5,.7)).toBeLessThan(energy(l,0,.2)*.2);}
 });
});

class Node {gain={value:1};frequency={value:0};Q={value:0};type='';buffer:unknown=null;positionX={value:0};positionY={value:0};positionZ={value:0};panningModel='';distanceModel='';refDistance=0;maxDistance=0;rolloffFactor=0;onended:(()=>void)|null=null;connected:Node[]=[];connect(n:Node){this.connected.push(n);return n;}disconnect(){}start(){}stop(){}}
class Context {static last:Context;sampleRate=8000;currentTime=0;state='running';destination=new Node();listener={setPosition(){},setOrientation(){}};sources:Node[]=[];convolvers:Node[]=[];buffers:{key?:string;channels:number}[]=[];
 constructor(){Context.last=this;}createGain(){return new Node();}createDynamicsCompressor(){return new Node();}createBiquadFilter(){return new Node();}createPanner(){return new Node();}createConvolver(){const n=new Node();this.convolvers.push(n);return n;}
 createBufferSource(){const n=new Node();this.sources.push(n);return n;}createBuffer(channels:number,length:number,rate:number){const b={channels,duration:length/rate,copyToChannel(){}};this.buffers.push(b);return b;}
 resume(){return Promise.resolve();}close(){return Promise.resolve();}}
afterEach(()=>vi.unstubAllGlobals());
const shot=(hit:ShotEvent['hit'],magazineShot:number):ShotEvent=>({weapon:'rifleA',timestamp:magazineShot*.1,magazineShot,hit,penetrationSegments:[]} as unknown as ShotEvent);

describe('12.24 runtime mix',()=>{
 it('round-robins stereo player shots, routes feedback by hit zone, sends to the room reverb and escalates kill confirms',async()=>{
  vi.stubGlobal('AudioContext',Context);vi.stubGlobal('indexedDB',indexedDB);
  const audio=new TrainingAudio();audio.setSpace('indoor');await audio.unlock();audio.sync(0);const c=Context.last;
  expect(c.convolvers).toHaveLength(1);expect(c.convolvers[0].buffer).toBeTruthy();
  audio.shot(shot('miss',0));audio.shot(shot('miss',1));
  expect(c.sources[0].buffer).not.toBe(c.sources[1].buffer);expect((c.sources[0].buffer as {channels:number}).channels).toBe(2);
  const before=c.sources.length;audio.shot(shot('head',2));expect(c.sources.length-before).toBe(2);
  audio.shot(shot('torso',3));const body=c.sources.at(-1)!.buffer;expect(body).not.toBe(c.sources[before+1].buffer);
  audio.kill(1);const first=c.sources.at(-1)!.buffer;audio.kill(1.5);expect(c.sources.at(-1)!.buffer).not.toBe(first);
  c.currentTime=4.5;audio.kill(1.5+AUDIO_MIX.killStreakSeconds+1);expect(c.sources.at(-1)!.buffer).toBe(first);
  audio.dispose();
 });
});
