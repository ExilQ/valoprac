import {afterEach,describe,it,expect,vi} from 'vitest';
import {indexedDB} from 'fake-indexeddb';
import {TrainingAudio} from '../engine/audio/Audio';
import type {FootstepEvent} from '../engine/footsteps/Footsteps';
import type {LandingSoundEvent} from '../engine/footsteps/Landings';
import type {PenetrationSegment} from '../engine/collision/Ballistics';

class AudioNodeMock {
 gain={value:1};threshold={value:0};ratio={value:1};buffer:unknown;onended:(()=>void)|null=null;
 connect(n:AudioNodeMock){return n;}disconnect(){}start(){}stop(){this.onended?.();}
}
const sources:AudioNodeMock[]=[];
class AudioContextMock {
 sampleRate=8000;currentTime=0;state='running';destination=new AudioNodeMock();
 createGain(){return new AudioNodeMock();}createDynamicsCompressor(){return new AudioNodeMock();}
 createBufferSource(){const source=new AudioNodeMock();sources.push(source);return source;}
 createBuffer(_channels:number,length:number,sampleRate:number){return{duration:length/sampleRate,copyToChannel(){}};}
 resume(){return Promise.resolve();}close(){return Promise.resolve();}
}
afterEach(()=>{vi.unstubAllGlobals();sources.length=0;});
const step=(id:number):FootstepEvent=>({id,timestamp:0,position:{x:0,y:0,z:0},radius:20,speed:5});
const segment=(material:PenetrationSegment['material']):PenetrationSegment=>({obstacle:0,material,entry:{x:0,y:1,z:-3},exit:{x:0,y:1,z:-3.2},entryNormal:{x:0,y:0,z:1},exitNormal:{x:0,y:0,z:-1},thickness:.2,resistance:7,cost:1.4,damageBefore:1,damageAfter:.6,penetrated:true,inside:false});

describe('Playback consumes physical contact surfaces',()=>{
 it('uses registered step and landing profiles, retaining legacy material fallback and event deduplication',async()=>{
  vi.stubGlobal('AudioContext',AudioContextMock);vi.stubGlobal('indexedDB',indexedDB);
  const audio=new TrainingAudio();await audio.unlock();
  const e={...step(1),material:'concrete' as const,surfaceId:'thinMetal' as const};audio.footstep(e);const steelStep=sources.at(-1)!.buffer;
  audio.footstep({...step(3),material:'steel'});expect(sources.at(-1)!.buffer).toBe(steelStep);
  audio.footstep({...step(5),surfaceId:'rubber'});expect(sources.at(-1)!.buffer).not.toBe(steelStep);
  audio.footstep({...step(5),surfaceId:'glass'});expect(sources).toHaveLength(3);
  const landing:LandingSoundEvent={...step(1),kind:'landing',impactSpeed:6,material:'concrete',surfaceId:'thinMetal'};
  audio.landing(landing);const steelLanding=sources.at(-1)!.buffer;expect(steelLanding).not.toBe(steelStep);
  audio.landing({...landing,id:2,surfaceId:undefined,material:'steel'});expect(sources.at(-1)!.buffer).toBe(steelLanding);
  audio.landing({...landing,id:3,surfaceId:'rubber'});expect(sources.at(-1)!.buffer).not.toBe(steelLanding);
  expect(e.radius).toBe(20);expect(landing.radius).toBe(20);expect(audio.footstepEvents).toBe(3);expect(audio.landingEvents).toBe(3);audio.dispose();
 });
 it('shares entry/exit audio by physical impact family instead of appearance ID',async()=>{
  vi.stubGlobal('AudioContext',AudioContextMock);vi.stubGlobal('indexedDB',indexedDB);
  const audio=new TrainingAudio();await audio.unlock();audio.impacts([segment('paintedMetal')],0);const [entry,exit]=sources.map(s=>s.buffer);
  audio.impacts([segment('thickMetal')],0);expect(sources[2].buffer).toBe(entry);expect(sources[3].buffer).toBe(exit);expect(entry).not.toBe(exit);
  audio.impacts([segment('concrete')],0);expect(sources[4].buffer).not.toBe(entry);audio.dispose();
 });
});
