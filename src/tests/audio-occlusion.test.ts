import {afterEach,describe,expect,it,vi} from 'vitest';
import {indexedDB} from 'fake-indexeddb';
import {TrainingAudio,AUDIO_MIX} from '../engine/audio/Audio';
import {AUDIBLE_OCCLUSION} from '../engine/audio/occlusion';

class Node {
  gain={value:1};frequency={value:0};Q={value:0};threshold={value:0};ratio={value:1};
  pan={value:0};positionX={value:0};positionY={value:0};positionZ={value:0};
  type='';panningModel='';distanceModel='';refDistance=0;maxDistance=0;rolloffFactor=0;
  buffer:unknown;onended:(()=>void)|null=null;disconnected=false;
  connect(n:Node){return n;}disconnect(){this.disconnected=true;}start(){}stop(){this.onended?.();}
}
class Context {
  static last:Context;sampleRate=8000;currentTime=0;state='running';destination=new Node();
  sources:Node[]=[];panners:Node[]=[];filters:Node[]=[];gains:Node[]=[];
  listener={positionX:{value:0},positionY:{value:0},positionZ:{value:0},forwardX:{value:0},forwardY:{value:0},forwardZ:{value:0},upX:{value:0},upY:{value:0},upZ:{value:0}};
  constructor(){Context.last=this;}createGain(){const n=new Node();this.gains.push(n);return n;}createDynamicsCompressor(){return this.createGain();}
  createBufferSource(){const n=new Node();this.sources.push(n);return n;}createPanner(){const n=new Node();this.panners.push(n);return n;}
  createBiquadFilter(){const n=new Node();this.filters.push(n);return n;}
  createBuffer(_c:number,n:number,r:number){return{duration:n/r,copyToChannel(){}};}resume(){return Promise.resolve();}close(){this.state='closed';return Promise.resolve();}
}
afterEach(()=>vi.unstubAllGlobals());
async function setup(ctor=Context){vi.stubGlobal('indexedDB',indexedDB);vi.stubGlobal('AudioContext',ctor);const audio=new TrainingAudio();await audio.unlock();audio.sync(0);return{audio,c:Context.last};}

describe('I1 audible-only positional occlusion',()=>{
  it('adds bounded low-pass attenuation to a covered source without replacing HRTF',async()=>{
    const{audio,c}=await setup(),query=vi.fn(()=>true);audio.listener({x:2,y:1.64,z:3},.3);audio.setOcclusionResolver(query);
    audio.enemyShot('rifleA',{x:-10,y:1.5,z:-18},0,1);
    expect(query).toHaveBeenCalledWith({x:-10,y:1.5,z:-18},{x:2,y:1.64,z:3});
    expect(c.filters[0].type).toBe('lowpass');expect(c.filters[0].frequency.value).toBe(AUDIBLE_OCCLUSION.cutoffHz);
    expect(c.gains.at(-1)!.gain.value).toBeCloseTo(.84*AUDIO_MIX.remoteFireGain*AUDIBLE_OCCLUSION.gain);
    expect(c.panners[0].panningModel).toBe('HRTF');audio.dispose();expect(c.filters[0].disconnected).toBe(true);
  });
  it('refreshes living tails at15Hz and restores an uncovered path without compounded attenuation',async()=>{
    const{audio,c}=await setup();let covered=true;const query=vi.fn(()=>covered);audio.setOcclusionResolver(query);audio.enemyShot('rifleA',{x:-8,y:1,z:-10},0,1);
    for(let i=0;i<6;i++)audio.listener({x:i/10,y:1.6,z:0},0);expect(query).toHaveBeenCalledTimes(1);
    c.currentTime=.07;covered=false;audio.listener({x:1,y:1.6,z:0},0);expect(query).toHaveBeenCalledTimes(2);
    // Uncovered: only air absorption over the source distance remains.
    expect(c.filters[0].frequency.value).toBeCloseTo(Math.min(c.sampleRate/2,AUDIO_MIX.airCutoff(Math.hypot(9,.6,10))));expect(c.gains.at(-1)!.gain.value).toBeCloseTo(.84*AUDIO_MIX.remoteFireGain);
    audio.setOcclusionResolver(null);audio.dispose();
  });
  it('positions actual landing contact cues and keeps footstep/landing ID streams separate',async()=>{
    const{audio,c}=await setup();const event={id:1,kind:'landing' as const,timestamp:0,position:{x:3,y:.4,z:-6},radius:20,speed:3,impactSpeed:6,material:'wood' as const};
    audio.footstep(event);audio.landing(event);audio.landing(event);expect(c.sources).toHaveLength(2);expect(c.panners).toHaveLength(1);
    expect([c.panners[0].positionX.value,c.panners[0].positionY.value,c.panners[0].positionZ.value]).toEqual([3,.4,-6]);audio.dispose();
  });
  it('uses a safe open path when a resolver fails and ignores nonfinite source coordinates',async()=>{
    const{audio,c}=await setup(),query=vi.fn(()=>{throw new Error('temporary geometry unavailable');});audio.setOcclusionResolver(query);
    expect(()=>audio.enemyShot('rifleA',{x:0,y:0,z:-10},0,1)).not.toThrow();expect(c.gains.at(-1)!.gain.value).toBeCloseTo(.84*AUDIO_MIX.remoteFireGain);
    audio.enemyShot('rifleA',{x:NaN,y:0,z:0},0,2);expect(query).toHaveBeenCalledTimes(1);expect(c.panners).toHaveLength(1);
    expect(()=>audio.listener({x:0,y:0,z:0},0)).not.toThrow();audio.dispose();
  });
  for(const backend of['stereo','mono']as const)it(`${backend}: applies distance and cover exactly once and updates through listener movement`,async()=>{
    class Fallback extends Context {createPanner=undefined as unknown as Context['createPanner'];createStereoPanner=backend==='stereo'?()=>{const n=new Node();this.panners.push(n);return n;}:undefined;}
    const{audio,c}=await setup(Fallback);audio.setOcclusionResolver(()=>true);audio.enemyShot('rifleA',{x:18,y:0,z:0},0,1);
    expect(c.gains.at(-1)!.gain.value).toBeCloseTo(.84*AUDIO_MIX.remoteFireGain*.5*.45);audio.listener({x:9,y:0,z:0},0);expect(c.gains.at(-1)!.gain.value).toBeCloseTo(.84*AUDIO_MIX.remoteFireGain*.45);audio.dispose();
  });
});
