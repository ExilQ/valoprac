import {afterEach,describe,expect,it,vi} from 'vitest';
import {createHash} from 'node:crypto';
import {synthesizeFootstep} from '../engine/audio/footstepSynthesis';
import {FOOTSTEP_MATERIALS} from '../engine/footsteps/Footsteps';
import {TrainingAudio} from '../engine/audio/Audio';
import {indexedDB} from 'fake-indexeddb';

afterEach(()=>vi.unstubAllGlobals());
describe('Original environment footstep timbres',()=>{
 it('preserves both existing concrete PCM waveforms byte for byte',()=>{
  const expected=['b10e1992a1f5a4c1f3301371d4c803890ba8553486ff929ae9e99d925940339b','c9098cd0cee2ae5ee0297af88f15fb9ff05388123f89e11862310be3de56bfd9'];
  for(const side of [0,1]){const samples=synthesizeFootstep(48000,side);expect(createHash('sha256').update(new Uint8Array(samples.buffer)).digest('hex')).toBe(expected[side]);expect(synthesizeFootstep(48000,side,'concrete')).toEqual(samples);}
 });
 it('provides distinct finite restrained surface transients without extending their playback duration',()=>{
  for(const rate of [8000,44100,48000]){const hashes=new Set<string>();for(const material of FOOTSTEP_MATERIALS){const samples=synthesizeFootstep(rate,0,material);expect(samples.length).toBe(Math.round(rate*.14));expect([...samples].every(Number.isFinite)).toBe(true);expect(Math.max(...samples.map(Math.abs))).toBeLessThan(.65);hashes.add(createHash('sha256').update(new Uint8Array(samples.buffer)).digest('hex'));}expect(hashes.size).toBe(4);}
 });
 it('selects the emitted surface buffer while retaining event deduplication and concrete fallback',async()=>{
  class Node {gain={value:1};threshold={value:0};ratio={value:1};buffer:unknown;onended:(()=>void)|null=null;connect(n:Node){return n;}disconnect(){}start(){}stop(){this.onended?.();}}
  const sources:Node[]=[];let bufferId=0;
  class Context {sampleRate=8000;currentTime=0;state='running';destination=new Node();createGain(){return new Node();}createDynamicsCompressor(){return new Node();}createBufferSource(){const n=new Node();sources.push(n);return n;}createBuffer(_c:number,n:number,r:number){return{id:++bufferId,duration:n/r,copyToChannel(){}};}resume(){return Promise.resolve();}close(){return Promise.resolve();}}
  vi.stubGlobal('AudioContext',Context);vi.stubGlobal('indexedDB',indexedDB);const audio=new TrainingAudio();await audio.unlock();
  const event={id:1,timestamp:0,position:{x:0,y:0,z:0},radius:20,speed:5};audio.footstep(event);const fallback=sources.at(-1)!.buffer;
  audio.footstep({...event,id:3,material:'concrete'});expect(sources.at(-1)!.buffer).toBe(fallback);
  const distinct=new Set([fallback]);for(const [i,material]of FOOTSTEP_MATERIALS.entries()){audio.footstep({...event,id:5+i*2,material});distinct.add(sources.at(-1)!.buffer);}expect(distinct.size).toBe(4);
  const n=sources.length;audio.footstep({...event,id:11,material:'wood'});expect(sources.length).toBe(n);expect(audio.footstepEvents).toBe(6);audio.dispose();expect(audio.activeVoiceCount).toBe(0);
 });
});
