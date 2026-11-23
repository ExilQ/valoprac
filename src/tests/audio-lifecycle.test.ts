import { describe,it,expect,vi,afterEach } from 'vitest';
import { indexedDB } from 'fake-indexeddb';
import { TrainingAudio } from '../engine/audio/Audio';
import { DEFAULT_SETTINGS } from '../config/settings';
import { Simulation } from '../engine/simulation/Simulation';
import { emptyInput } from '../engine/types';
import { readAudioAssets,deleteAudioAsset,saveAudioAsset } from '../storage/audioAssets';
class NodeMock {
 gain={value:1};threshold={value:0};ratio={value:1};connected=false;disconnected=false;buffer:unknown;onended:(()=>void)|null=null;started=0;stopped=0;
 connect(next:NodeMock){this.connected=true;return next;}disconnect(){this.disconnected=true;}start(){this.started++;}stop(){this.stopped++;this.onended?.();}
}
class ContextMock {
 static contexts:ContextMock[]=[];state='running';currentTime=3;sampleRate=8000;destination=new NodeMock();nodes:NodeMock[]=[];
 constructor(){ContextMock.contexts.push(this);}createGain(){const n=new NodeMock();this.nodes.push(n);return n;}createDynamicsCompressor(){return this.createGain();}createBufferSource(){return this.createGain();}
 createBuffer(_channels:number,length:number,sampleRate:number){return {duration:length/sampleRate,copyToChannel:()=>{}};}
 decodeAudioData(_bytes:ArrayBuffer){return Promise.resolve(this.createBuffer(1,4000,8000));}resume(){this.state='running';return Promise.resolve();}close(){this.state='closed';return Promise.resolve();}
}
afterEach(()=>vi.unstubAllGlobals());
describe('Web Audio event and cleanup contracts (mock AudioContext, not acoustic/browser verification)',()=>{
 it('emits one firing event for one simulation shot, reuses buffers and stops all previous-weapon voices',async()=>{
  vi.stubGlobal('indexedDB',indexedDB);vi.stubGlobal('AudioContext',ContextMock);const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
  const audio=new TrainingAudio();await audio.unlock();audio.levels(DEFAULT_SETTINGS);audio.sync(0);
  const s=new Simulation('free','rifleA',DEFAULT_SETTINGS);s.running=true;s.step(1/120,{...emptyInput(),fire:true});const shot=s.shots[0];audio.shot(shot);audio.shot(shot);expect(audio.events).toBe(1);expect(fetch).not.toHaveBeenCalled();
  const c=ContextMock.contexts.at(-1)!;const old=c.nodes.filter(n=>n.started>0);expect(old.length).toBeGreaterThan(0);audio.selectWeapon('sheriff');expect(old.every(n=>n.stopped===1&&n.disconnected)).toBe(true);
  audio.action('sheriff','reload');for(let i=1;i<150;i++)audio.shot({...shot,timestamp:i/10});expect(audio.activeVoiceCount).toBeLessThanOrEqual(48);audio.dispose();expect(audio.activeVoiceCount).toBe(0);expect(c.state).toBe('closed');expect(c.nodes.every(n=>n.disconnected)).toBe(true);await audio.unlock();expect(c.state).toBe('closed');
 });
 it('restores authorized local sound files independently of weapon gameplay data',async()=>{
  vi.stubGlobal('indexedDB',indexedDB);vi.stubGlobal('AudioContext',ContextMock);const file=new File([new Uint8Array([1,2,3])],'owned-shot.wav',{type:'audio/wav'});
  await expect(saveAudioAsset('sheriff','fire',file,false)).rejects.toThrow('권한');await saveAudioAsset('sheriff','fire',file,true);let list=await readAudioAssets();expect(list.find(a=>a.id==='sheriff:fire')?.authorized).toBe(true);
  const audio=new TrainingAudio();await audio.unlock();expect(audio.custom.has('sheriff:fire')).toBe(true);audio.dispose();await deleteAudioAsset('sheriff:fire');list=await readAudioAssets();expect(list.find(a=>a.id==='sheriff:fire')).toBeUndefined();
 });
 it('rejects oversized or unsupported files before decoding or saving',async()=>{await expect(saveAudioAsset('rifleA','fire',new File(['x'],'wrong.txt'),true)).rejects.toThrow('오디오');await expect(saveAudioAsset('rifleA','fire',new File([new Uint8Array(2*1024*1024+1)],'large.wav'),true)).rejects.toThrow('메가바이트');});
});
