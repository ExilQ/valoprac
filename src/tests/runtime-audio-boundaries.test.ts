import {afterEach,describe,expect,it,vi} from 'vitest';
import {TrainingAudio} from '../engine/audio/Audio';
import {FixedClock,FIXED_DT} from '../engine/simulation/FixedClock';
import type {ShotEvent} from '../engine/types';
import type {PenetrationSegment} from '../engine/collision/Ballistics';

vi.mock('../storage/audioAssets',()=>({readAudioAssets:async()=>[]}));
class AudioNodeMock {
 gain={value:1};threshold={value:0};ratio={value:1};buffer:unknown;onended:(()=>void)|null=null;
 starts:number[]=[];stopped=0;disconnected=false;
 connect(node:AudioNodeMock){return node;}disconnect(){this.disconnected=true;}
 start(time:number){this.starts.push(time);}stop(){this.stopped++;this.onended?.();}
}
class AudioContextMock {
 static instances:AudioContextMock[]=[];sampleRate=8000;currentTime=100;state='running';destination=new AudioNodeMock();sources:AudioNodeMock[]=[];
 constructor(){AudioContextMock.instances.push(this);}
 createGain(){return new AudioNodeMock();}createDynamicsCompressor(){return this.createGain();}
 createBufferSource(){const n=new AudioNodeMock();this.sources.push(n);return n;}
 createBuffer(_channels:number,length:number,rate:number){return{duration:length/rate,copyToChannel(){}};}
 resume(){return Promise.resolve();}close(){this.state='closed';return Promise.resolve();}
}
const step={id:7,timestamp:.1,position:{x:0,y:0,z:0},radius:20,speed:5};
const shot={weapon:'rifleA',timestamp:.1,magazineShot:0,penetrationSegments:[],hit:'miss'} as unknown as ShotEvent;
const segment=(patch:Partial<PenetrationSegment>={}):PenetrationSegment=>({obstacle:0,material:'concrete',entry:{x:1,y:1,z:-3},exit:{x:1,y:1,z:-3.2},entryNormal:{x:0,y:0,z:1},exitNormal:{x:0,y:0,z:-1},thickness:.2,resistance:9,cost:1.8,damageBefore:1,damageAfter:.6,penetrated:true,inside:false,...patch});
afterEach(()=>{vi.unstubAllGlobals();AudioContextMock.instances=[];});
async function setup(){vi.stubGlobal('AudioContext',AudioContextMock);const audio=new TrainingAudio();await audio.unlock();audio.sync(0);return{audio,c:AudioContextMock.instances[0]};}

describe('Audio identities follow the authoritative session, not retained renderer resources',()=>{
 it('keeps pause deduplication but admits restarted shot/contact IDs with reused buffers and a new clock anchor',async()=>{
  const {audio,c}=await setup();
  const play=(id:number)=>{audio.shot(shot);audio.enemyShot('rifleA',{x:0,y:1,z:-10},.1,3);audio.footstep({...step,id});audio.landing({...step,id,kind:'landing',impactSpeed:5});audio.botFootstep(3,{...step,id});};
  try{
   play(7);expect(c.sources).toHaveLength(5);const buffers=c.sources.map(s=>s.buffer);
   audio.stop();audio.sync(0);play(7);expect(c.sources).toHaveLength(5);expect(audio.activeVoiceCount).toBe(0);
   c.currentTime=200;audio.resetSession(0);play(1);
   expect(c.sources).toHaveLength(10);expect(c.sources.slice(5).map(s=>s.buffer)).toEqual(buffers);
   expect(c.sources.slice(5).every(s=>s.starts[0]===200.1)).toBe(true);expect(c.sources.slice(0,5).every(s=>s.stopped===1&&s.disconnected)).toBe(true);
   expect(AudioContextMock.instances).toHaveLength(1);expect(audio.activeVoiceCount).toBe(5);
   expect([audio.events,audio.footstepEvents,audio.landingEvents,audio.botFootstepEvents]).toEqual([2,2,2,2]);
   play(1);expect(c.sources).toHaveLength(10);
  }finally{audio.dispose();}
 });
 it('plays only actual material boundaries while retaining legacy segments and input immutability',async()=>{
  const {audio,c}=await setup(),segments=[segment({entrySurface:false}),segment({entrySurface:false,exitSurface:false}),segment({penetrated:false,exitSurface:false}),segment()],before=structuredClone(segments);
  try{audio.impacts(segments,.1);expect(c.sources).toHaveLength(4);expect(c.sources[0].buffer).not.toBe(c.sources[1].buffer);expect(c.sources[0].buffer).toBe(c.sources[3].buffer);expect(segments).toEqual(before);}finally{audio.dispose();}
 });
});

describe('Fixed-step clock recovers from invalid frame timestamps without discarding valid debt',()=>{
 it('ignores nonfinite elapsed samples and resumes exact fixed steps',()=>{
  const clock=new FixedClock(),steps:number[]=[];
  for(const elapsed of [NaN,Infinity,-Infinity]){expect(clock.advance(elapsed,dt=>steps.push(dt))).toBe(0);expect(clock.accumulator).toBe(0);expect(clock.deferredTicks).toBe(0);}
  clock.advance(FIXED_DT,dt=>steps.push(dt));expect(steps).toEqual([FIXED_DT]);expect(clock.ticks).toBe(1);
 });
 it('still drains already-earned catch-up work after a malformed timing sample',()=>{
  const clock=new FixedClock();let ticks=0;clock.advance(2.5,()=>ticks++);expect(clock.deferredTicks).toBe(180);
  clock.advance(NaN,()=>ticks++);expect(ticks).toBe(240);expect(clock.deferredTicks).toBe(60);
  clock.advance(Infinity,()=>ticks++);expect(ticks).toBe(300);expect(clock.deferredTicks).toBe(0);expect(clock.accumulator).toBeCloseTo(0,10);
  clock.advance(FIXED_DT,()=>ticks++);expect(ticks).toBe(301);
 });
});
