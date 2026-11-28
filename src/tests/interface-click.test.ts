import {afterEach,describe,expect,it,vi} from 'vitest';
import {createInterfaceClickSamples,installInterfaceAudio} from '../ui/interfaceClick';
import {bandPower} from './helpers/spectrum';

class ElementMock {
 disabled=false;isButton=true;
 closest(selector:string){return this.isButton&&selector.includes('button')?this:null;}
 matches(selector:string){return selector.includes(':disabled')?this.disabled:false;}
 getAttribute(){return null;}
}
class NodeMock {
 gain={value:1};buffer:unknown;onended:(()=>void)|null=null;stopped=0;disconnected=false;
 connect(next:NodeMock){return next;}
 disconnect(){this.disconnected=true;}
 start(){}
 stop(){this.stopped++;this.onended?.();}
}
class ContextMock {
 static instances:ContextMock[]=[];
 state='running';currentTime=0;sampleRate=48000;destination=new NodeMock();sources:NodeMock[]=[];gains:NodeMock[]=[];
 constructor(){ContextMock.instances.push(this);}
 createBuffer(_channels:number,length:number,rate:number){return {duration:length/rate,getChannelData:()=>new Float32Array(length)};}
 createBufferSource(){const node=new NodeMock();this.sources.push(node);return node;}
 createGain(){const node=new NodeMock();this.gains.push(node);return node;}
 resume(){this.state='running';return Promise.resolve();}
 close(){this.state='closed';return Promise.resolve();}
}
function setup(){
 ContextMock.instances=[];vi.stubGlobal('AudioContext',ContextMock);vi.stubGlobal('Element',ElementMock);
 const target=new EventTarget(),button=new ElementMock(),levels={volume:.8,interfaceVolume:.4};
 const dispose=installInterfaceAudio(target as Document,()=>levels);
 const click=(options:{button?:number;detail?:number}={})=>{
  const event=new Event('click');Object.defineProperties(event,{target:{value:button},button:{value:options.button??0},detail:{value:options.detail??1}});target.dispatchEvent(event);
 };
 return {click,dispose,button,levels};
}
afterEach(()=>vi.unstubAllGlobals());

describe('Interface feedback waveform and activation (no physical listening claim)',()=>{
 it('uses a quiet low tone with silent endpoints and negligible high-frequency energy at common sample rates',()=>{
  for(const rate of [44100,48000,96000]){
   const pcm=createInterfaceClickSamples(rate),power=bandPower(pcm,rate);
   expect(pcm.length/rate).toBeCloseTo(.072,4);expect(Math.abs(pcm[0])).toBe(0);expect(Math.abs(pcm.at(-1)!)).toBe(0);
   expect(power.peak).toBeLessThan(.08);expect(power.rms).toBeGreaterThan(.01);expect(power.above4000).toBeLessThan(.00001);
   const crossings=Array.from(pcm).filter((value,i)=>i&&value*pcm[i-1]<0).length;
   expect(crossings).toBeGreaterThan(30);expect(crossings).toBeLessThan(60);
   expect(Math.max(...Array.from(pcm,(value,i)=>i?Math.abs(value-pcm[i-1]):0))).toBeLessThan(.005);
  }
 });
 it('creates no audio until an enabled primary-button activation and also accepts keyboard clicks',()=>{
  const {click,button,levels,dispose}=setup();
  expect(ContextMock.instances).toHaveLength(0);
  button.isButton=false;click();button.isButton=true;button.disabled=true;click();button.disabled=false;click({button:2});
  levels.interfaceVolume=0;click();expect(ContextMock.instances).toHaveLength(0);
  levels.interfaceVolume=.4;click({detail:0});
  expect(ContextMock.instances).toHaveLength(1);expect(ContextMock.instances[0].sources).toHaveLength(1);dispose();
 });
 it('lets tails finish and bounds rapid repeats without hard-stopping a playing tap',()=>{
  const {click,dispose}=setup();click();const context=ContextMock.instances[0];
  for(let i=0;i<100;i++)click();expect(context.sources).toHaveLength(1);
  context.currentTime=.056;click();expect(context.sources).toHaveLength(2);expect(context.sources[0].stopped).toBe(0);
  context.currentTime=.112;click();expect(context.sources[0].disconnected).toBe(true);
  expect(context.sources.filter(source=>!source.disconnected)).toHaveLength(2);
  dispose();expect(context.state).toBe('closed');expect(context.sources.every(source=>source.disconnected)).toBe(true);
  const count=context.sources.length;click();expect(context.sources).toHaveLength(count);
 });
 it('reads master and interface volume again on every activation, including mute',()=>{
  const {click,levels,dispose}=setup();click();const context=ContextMock.instances[0];
  expect(context.gains[0].gain.value).toBeCloseTo(.32);
  levels.volume=.5;levels.interfaceVolume=.2;context.currentTime=.1;click();expect(context.gains[1].gain.value).toBeCloseTo(.1);
  levels.volume=0;context.currentTime=.2;click();expect(context.sources).toHaveLength(2);dispose();
 });
 it('ignores a denied audio context and cancels pending unlocks on cleanup',async()=>{
  const {click,dispose}=setup();
  let resolve!:()=>void;
  class SuspendedContext extends ContextMock {
   state='suspended';
   resume(){return new Promise<void>(done=>{resolve=()=>{this.state='running';done();};});}
  }
  vi.stubGlobal('AudioContext',SuspendedContext);click();click();const context=ContextMock.instances[0];
  expect(context.sources).toHaveLength(0);dispose();resolve();await Promise.resolve();await Promise.resolve();expect(context.sources).toHaveLength(0);
  const next=setup();vi.stubGlobal('AudioContext',class {constructor(){throw new Error('Audio unavailable');}});
  expect(()=>next.click()).not.toThrow();next.dispose();
 });
});
