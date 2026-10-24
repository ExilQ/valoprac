import {synthesizeFootstep} from './footstepSynthesis';
import type {FootstepEvent} from '../footsteps/Footsteps';
import { AUDIO_PROFILES, AUDIO_ACTIONS, type AudioAction } from '../../config/audio';
import { readAudioAssets } from '../../storage/audioAssets';
import { WEAPON_ORDER } from '../../config/weapons';
import { synthesize } from './synthesis';
import type { Settings, ShotEvent, WeaponId } from '../types';
type Channel='firing'|'handling'|'feedback'|'footsteps';
interface Voice {source:AudioBufferSourceNode;gain:GainNode;channel:Channel}
export class TrainingAudio {
  private context:AudioContext|null=null;private channels:Record<Channel,GainNode>|null=null;private master:GainNode|null=null;private compressor:DynamicsCompressorNode|null=null;
  private buffers=new Map<string,AudioBuffer>();private voices=new Set<Voice>();private loading:Promise<void>|null=null;private disposed=false;private lastShot='';private anchor=0;private weapon:WeaponId='rifleA';
  private stepBuffers:AudioBuffer[]=[];private lastFootstep=0;footstepEvents=0;
  custom=new Set<string>();events=0;
  async unlock(){
    if(this.disposed)return;
    if(!this.context){const c=this.context=new AudioContext({latencyHint:'interactive'});this.master=c.createGain();this.compressor=c.createDynamicsCompressor();this.compressor.threshold.value=-6;this.compressor.ratio.value=5;this.master.connect(this.compressor).connect(c.destination);
      this.channels={firing:c.createGain(),handling:c.createGain(),feedback:c.createGain(),footsteps:c.createGain()};for(const g of Object.values(this.channels))g.connect(this.master);
      for(const id of WEAPON_ORDER)for(const action of AUDIO_ACTIONS){const values=synthesize(id,action,c.sampleRate),b=c.createBuffer(1,values.length,c.sampleRate);b.copyToChannel(values,0);this.buffers.set(`${id}:${action}`,b);}
      for(let side=0;side<2;side++){const values=synthesizeFootstep(c.sampleRate,side),b=c.createBuffer(1,values.length,c.sampleRate);b.copyToChannel(values,0);this.stepBuffers.push(b);}
      this.loading=this.preload(c);
    }
    await this.context.resume();await this.loading;
  }
  private async preload(c:AudioContext){
    const install=async(id:string,bytes:ArrayBuffer)=>{const buffer=await c.decodeAudioData(bytes.slice(0));if(this.disposed||buffer.duration>8)return;if(typeof buffer.getChannelData==='function'){let peak=0;for(let ch=0;ch<buffer.numberOfChannels;ch++){const data=buffer.getChannelData(ch);for(let i=0;i<data.length;i++)peak=Math.max(peak,Math.abs(data[i]));}const scale=peak>1e-6?Math.min(2,0.78/peak):1;for(let ch=0;ch<buffer.numberOfChannels;ch++){const data=buffer.getChannelData(ch);for(let i=0;i<data.length;i++)data[i]*=scale;}}this.buffers.set(id,buffer);this.custom.add(id);};
    const jobs:Promise<unknown>[]=[];
    for(const id of WEAPON_ORDER)for(const action of AUDIO_ACTIONS){const asset=AUDIO_PROFILES[id].assets[action];if(asset?.redistributionAuthorized&&asset.path.startsWith('/')&&!asset.path.startsWith('//'))jobs.push(fetch(asset.path).then(r=>{if(!r.ok)throw new Error('audio');return r.arrayBuffer();}).then(b=>install(`${id}:${action}`,b)));}
    try{const assets=await readAudioAssets();for(const a of assets)if(a.authorized)jobs.push(install(a.id,a.bytes));}catch{/* Original buffers remain available when storage is blocked. */}
    await Promise.allSettled(jobs);
  }
  sync(time:number){if(this.context)this.anchor=this.context.currentTime-time;}
  levels(s:Settings){if(!this.master||!this.channels)return;this.master.gain.value=s.volume;this.channels.firing.gain.value=s.firingVolume;this.channels.handling.gain.value=s.handlingVolume;this.channels.feedback.gain.value=s.feedbackVolume;this.channels.footsteps.gain.value=s.footstepVolume;}
  selectWeapon(id:WeaponId){if(this.weapon!==id){this.stop();this.weapon=id;}}
  shot(s:ShotEvent){const key=`${s.weapon}:${s.timestamp}:${s.magazineShot}`;if(key===this.lastShot)return;this.lastShot=key;this.events++;this.play(s.weapon,'fire','firing',s.timestamp);if(s.hit==='head')this.play(s.weapon,'elimination','feedback');else if(['torso','arm','leg'].includes(s.hit))this.play(s.weapon,'equip','feedback',undefined,0.35);}
  footstep(e:FootstepEvent){if(e.id<=this.lastFootstep)return;this.lastFootstep=e.id;this.footstepEvents++;const b=this.stepBuffers[e.id%2];if(b)this.playBuffer(b,'footsteps',e.timestamp,.65);}
  action(id:WeaponId,action:'reload'|'equip'){this.play(id,action,'handling');}
  private play(id:WeaponId,action:AudioAction,channel:Channel,time?:number,scale=1){
    const b=this.buffers.get(`${id}:${action}`);if(b)this.playBuffer(b,channel,time,AUDIO_PROFILES[id].gain*scale);
  }
  private playBuffer(b:AudioBuffer,channel:Channel,time?:number,scale=1){
    const c=this.context;if(!c||c.state!=='running'||!this.channels||this.disposed)return;
    if(this.voices.size>=48){const v=this.voices.values().next().value as Voice|undefined;if(v){v.source.onended=null;v.source.stop();v.source.disconnect();v.gain.disconnect();this.voices.delete(v);}}
    const source=c.createBufferSource(),gain=c.createGain();source.buffer=b;gain.gain.value=scale;source.connect(gain).connect(this.channels[channel]);
    const v={source,gain,channel};this.voices.add(v);source.onended=()=>{source.disconnect();gain.disconnect();this.voices.delete(v);};source.start(time===undefined?c.currentTime:Math.max(c.currentTime,Math.min(c.currentTime+0.025,this.anchor+time)));
  }
  get activeVoiceCount(){return this.voices.size;}
  stop(){for(const v of this.voices){v.source.onended=null;try{v.source.stop();}catch{/* Already ended. */}v.source.disconnect();v.gain.disconnect();}this.voices.clear();}
  dispose(){this.disposed=true;this.stop();for(const g of Object.values(this.channels??{}))g.disconnect();this.master?.disconnect();this.compressor?.disconnect();void this.context?.close();this.context=null;this.channels=null;this.buffers.clear();this.stepBuffers.length=0;this.custom.clear();}
}
