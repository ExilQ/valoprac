import {synthesizeImpactProfile} from './materialImpact';
import {SURFACES,SURFACE_FOOTSTEP_SOUND_PROFILES,type BulletImpactProfile} from '../../config/surfaces';
import type {PenetrationSegment} from '../collision/Ballistics';
import {synthesizeFootstep} from './footstepSynthesis';
import {synthesizeLanding} from './landingSynthesis';
import {synthesizeTrainingCue} from './trainingCue';
import {synthesizeKnife,type KnifeSound} from './knifeSynthesis';
import type {LandingSoundEvent} from '../footsteps/Landings';
import type {FootstepEvent,FootstepMaterial} from '../footsteps/Footsteps';
import { AUDIO_PROFILES, AUDIO_ACTIONS, type AudioAction } from '../../config/audio';
import { readAudioAssets } from '../../storage/audioAssets';
import { WEAPON_ORDER } from '../../config/weapons';
import { synthesize } from './synthesis';
import {listenerForward,spatialCue,type ListenerPose} from './spatial';
import {FiringTimeline} from './FiringTimeline';
import {AUDIBLE_OCCLUSION,type AudibleOcclusionResolver} from './occlusion';
import type { Settings, ShotEvent, WeaponId, Vec3, MeleeEvent } from '../types';
type Channel='firing'|'handling'|'feedback'|'footsteps';
interface Voice {source:AudioBufferSourceNode;gain:GainNode;channel:Channel;spatial:AudioNode|null;filter:BiquadFilterNode|null;spatialMode:'hrtf'|'stereo'|'mono'|'none';occluded:boolean;startsAt:number;timestamp?:number;emitter?:string;position?:Vec3;baseGain:number}
function smooth(param:AudioParam,value:number,time:number){if(typeof param.setTargetAtTime==='function')param.setTargetAtTime(value,time,AUDIBLE_OCCLUSION.smoothingSeconds);else param.value=value;}
export class TrainingAudio {
  private context:AudioContext|null=null;private channels:Record<Channel,GainNode>|null=null;private master:GainNode|null=null;private compressor:DynamicsCompressorNode|null=null;
  private buffers=new Map<string,AudioBuffer>();private voices=new Set<Voice>();private loading:Promise<void>|null=null;private disposed=false;private lastShot='';private anchor=0;private weapon:WeaponId='rifleA';
  private stepBuffers=new Map<FootstepMaterial,AudioBuffer[]>();private lastFootstep=0;footstepEvents=0;
  private landingBuffers=new Map<FootstepMaterial,AudioBuffer>();private lastLanding=0;landingEvents=0;
  private botSteps=new Map<number,number>();botFootstepEvents=0;
  private pose:ListenerPose={position:{x:0,y:0,z:0},yaw:0,pitch:0};
  private firingTimeline=new FiringTimeline();readonly scheduling={staleDropped:0,futureDropped:0,lateCoalesced:0,lateRescheduled:0,queueDropped:0};
  private latestFire=new Map<string,number>();
  private occlusionResolver:AudibleOcclusionResolver|null=null;private lastOcclusionUpdate=-Infinity;
  spatialBackend:'unavailable'|'hrtf'|'stereo'|'mono'='unavailable';
  custom=new Set<string>();events=0;
  async unlock(){
    if(this.disposed)return;
    if(!this.context){const c=this.context=new AudioContext({latencyHint:'interactive'});this.master=c.createGain();this.compressor=c.createDynamicsCompressor();this.compressor.threshold.value=-6;this.compressor.ratio.value=5;this.master.connect(this.compressor).connect(c.destination);
      this.channels={firing:c.createGain(),handling:c.createGain(),feedback:c.createGain(),footsteps:c.createGain()};for(const g of Object.values(this.channels))g.connect(this.master);
      this.spatialBackend=typeof c.createPanner==='function'?'hrtf':typeof c.createStereoPanner==='function'?'stereo':'mono';this.listener(this.pose.position,this.pose.yaw,this.pose.pitch);
      for(const id of WEAPON_ORDER)for(const action of AUDIO_ACTIONS){const values=synthesize(id,action,c.sampleRate),b=c.createBuffer(1,values.length,c.sampleRate);b.copyToChannel(values,0);this.buffers.set(`${id}:${action}`,b);}
      for(const material of SURFACE_FOOTSTEP_SOUND_PROFILES){const pair:AudioBuffer[]=[];for(let side=0;side<2;side++){const values=synthesizeFootstep(c.sampleRate,side,material),b=c.createBuffer(1,values.length,c.sampleRate);b.copyToChannel(values,0);pair.push(b);}this.stepBuffers.set(material,pair);}
      for(const material of SURFACE_FOOTSTEP_SOUND_PROFILES){const values=synthesizeLanding(c.sampleRate,material),b=c.createBuffer(1,values.length,c.sampleRate);b.copyToChannel(values,0);this.landingBuffers.set(material,b);}
      for(const material of ['wood','metal','masonry','glass'] as BulletImpactProfile[])for(const exit of [false,true]){const values=synthesizeImpactProfile(material,c.sampleRate,exit),b=c.createBuffer(1,values.length,c.sampleRate);b.copyToChannel(values,0);this.buffers.set(`impact:${material}:${exit}`,b);}
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
  sync(time:number){if(this.context&&Number.isFinite(time))this.anchor=this.context.currentTime-time;}
  /** Audible geometry only: no bot perception, damage or footsteps are altered. */
  setOcclusionResolver(resolve:AudibleOcclusionResolver|null){this.occlusionResolver=resolve;this.lastOcclusionUpdate=-Infinity;this.listener(this.pose.position,this.pose.yaw,this.pose.pitch);}
  private covered(position:Vec3){try{return this.occlusionResolver?.(position,this.pose.position)===true;}catch{return false;}}
  /** Called from the actual player/camera transform, independent of screen size. */
  listener(position:Vec3,yaw:number,pitch=0){
    if(![position.x,position.y,position.z,yaw,pitch].every(Number.isFinite))return;
    this.pose={position:{...position},yaw,pitch};
    const now=this.context?.currentTime??0,refresh=now-this.lastOcclusionUpdate>=AUDIBLE_OCCLUSION.refreshSeconds;
    if(refresh)this.lastOcclusionUpdate=now;
    for(const v of this.voices)if(v.position){
      const cue=spatialCue(v.position,this.pose);
      if(v.spatialMode==='stereo'&&v.spatial)(v.spatial as StereoPannerNode).pan.value=cue.pan;
      if(refresh){const covered=this.covered(v.position);if(covered!==v.occluded){v.occluded=covered;if(v.filter)smooth(v.filter.frequency,covered?AUDIBLE_OCCLUSION.cutoffHz:Math.min(AUDIBLE_OCCLUSION.openCutoffHz,(this.context?.sampleRate??48000)/2),now);}}
      const value=v.baseGain*(v.spatialMode==='stereo'||v.spatialMode==='mono'?cue.gain:1)*(v.occluded?AUDIBLE_OCCLUSION.gain:1);
      smooth(v.gain.gain,value,now);
    }
    const l=this.context?.listener;if(!l)return;const f=listenerForward(yaw,pitch);
    if(l.positionX){l.positionX.value=position.x;l.positionY.value=position.y;l.positionZ.value=position.z;l.forwardX.value=f.x;l.forwardY.value=f.y;l.forwardZ.value=f.z;l.upX.value=0;l.upY.value=1;l.upZ.value=0;}
    else{l.setPosition(position.x,position.y,position.z);l.setOrientation(f.x,f.y,f.z,0,1,0);}
  }
  levels(s:Settings){if(!this.master||!this.channels)return;this.master.gain.value=s.volume;this.channels.firing.gain.value=s.firingVolume;this.channels.handling.gain.value=s.handlingVolume;this.channels.feedback.gain.value=s.feedbackVolume;this.channels.footsteps.gain.value=s.footstepVolume;}
  selectWeapon(id:WeaponId){if(this.weapon!==id){this.stop();this.weapon=id;}}
  shot(s:ShotEvent){const key=`${s.weapon}:${s.timestamp}:${s.magazineShot}`;if(key===this.lastShot)return;this.lastShot=key;this.events++;this.play(s.weapon,'fire','firing',s.timestamp,1,undefined,'player');this.impacts(s.penetrationSegments??[],s.timestamp);if(s.hit==='head')this.play(s.weapon,'elimination','feedback');else if(['torso','arm','leg'].includes(s.hit))this.play(s.weapon,'equip','feedback',undefined,0.35);}
  footstep(e:FootstepEvent){if(e.id<=this.lastFootstep)return;this.lastFootstep=e.id;this.footstepEvents++;const b=this.stepBuffers.get(e.surfaceId?SURFACES[e.surfaceId].footstepSoundProfile:e.material??'concrete')?.[e.id%2];if(b)this.playBuffer(b,'footsteps',e.timestamp,.65);}
  landing(e:LandingSoundEvent){if(e.id<=this.lastLanding)return;this.lastLanding=e.id;this.landingEvents++;const b=this.landingBuffers.get(e.surfaceId?SURFACES[e.surfaceId].footstepSoundProfile:e.material??'concrete');if(b)this.playBuffer(b,'footsteps',e.timestamp,Math.max(.15,Math.min(.85,e.impactSpeed/9)),e.position);}
  enemyShot(id:WeaponId,origin:number|Vec3,time?:number,sourceId?:number|string){
    if(typeof origin==='number'){this.play(id,'fire','firing',time,Math.max(.08,Math.min(.65,9/Math.max(9,origin))),undefined,`enemy:${sourceId??id}`);return;}
    this.play(id,'fire','firing',time,.65,origin,`enemy:${sourceId??`${id}:${origin.x}:${origin.z}`}`);
  }
  botFootstep(bot:number,e:FootstepEvent){if(e.id<=(this.botSteps.get(bot)??0))return;this.botSteps.set(bot,e.id);this.botFootstepEvents++;const b=this.stepBuffers.get(e.surfaceId?SURFACES[e.surfaceId].footstepSoundProfile:e.material??'concrete')?.[e.id%2];if(b)this.playBuffer(b,'footsteps',e.timestamp,.65,e.position);}
  resetBotSteps(){this.botSteps.clear();}
  surfaceImpact(surface:import('../../config/surfaces').SurfaceId,point:Vec3,time?:number,scale=1,emitter='player-floor-impact'){
    const buffer=this.buffers.get(`impact:${SURFACES[surface].bulletImpactProfile}:false`);if(buffer)this.playBuffer(buffer,'feedback',time,.38*scale,point,emitter);
  }
  impacts(segments:PenetrationSegment[],time?:number,scale=1){for(const segment of segments.slice(0,4)){const profile=SURFACES[segment.material].bulletImpactProfile,entry=this.buffers.get(`impact:${profile}:false`);if(entry&&segment.entrySurface!==false)this.playBuffer(entry,'feedback',time,.38*scale,segment.entry);if(segment.penetrated&&segment.exitSurface!==false){const exit=this.buffers.get(`impact:${profile}:true`);if(exit)this.playBuffer(exit,'feedback',time,.22*scale,segment.exit);}}}
  action(id:WeaponId,action:'reload'|'equip'|'bolt'|'scope'){if(id==='knife'){if(action==='equip')this.knifeSound('equip','handling',undefined,.7);return;}this.play(id,action,'handling');}
  private lastMelee=0;
  /** Attack swish, plus a body or surface impact when the blade connects. */
  melee(e:MeleeEvent){if(e.serial<=this.lastMelee)return;this.lastMelee=e.serial;this.events++;this.knifeSound(e.kind,'firing',e.timestamp,.8);
    if(e.hit==='wall')this.knifeSound('wall','feedback',e.timestamp,.55,e.impact??undefined);else if(e.hit!=='miss')this.knifeSound('hit','feedback',e.timestamp,e.killed?.95:.75);}
  private knifeSound(sound:KnifeSound,channel:Channel,time?:number,scale=1,position?:Vec3){
    const c=this.context;if(!c||this.disposed)return;const key=`knife:${sound}`;let buffer=this.buffers.get(key);
    if(!buffer){const values=synthesizeKnife(sound,c.sampleRate);buffer=c.createBuffer(1,values.length,c.sampleRate);buffer.getChannelData(0).set(values);this.buffers.set(key,buffer);}
    this.playBuffer(buffer,channel,time,scale,position,`knife:${sound}`);
  }
  trainingCue(source:Vec3,time:number){
    const c=this.context;if(!c||this.disposed||!Number.isFinite(time))return;
    let buffer=this.buffers.get('training:cue');
    if(!buffer){const values=synthesizeTrainingCue(c.sampleRate);buffer=c.createBuffer(1,values.length,c.sampleRate);buffer.getChannelData(0).set(values);this.buffers.set('training:cue',buffer);}
    this.playBuffer(buffer,'feedback',time,.55,source);
  }
  private play(id:WeaponId,action:AudioAction,channel:Channel,time?:number,scale=1,position?:Vec3,emitter?:string){
    const b=this.buffers.get(`${id}:${action}`);if(b&&id!=='knife')this.playBuffer(b,channel,time,AUDIO_PROFILES[id].gain*scale,position,emitter);
  }
  private release(v:Voice,stop=false){
    v.source.onended=null;if(stop){try{v.source.stop();}catch{/* Voice may already have finished. */}}
    v.source.disconnect();v.gain.disconnect();v.spatial?.disconnect();v.filter?.disconnect();this.voices.delete(v);
  }
  private playBuffer(b:AudioBuffer,channel:Channel,time?:number,scale=1,position?:Vec3,emitter?:string){
    const c=this.context;if(!c||c.state!=='running'||!this.channels||this.disposed)return;
    if(position&&![position.x,position.y,position.z].every(Number.isFinite))position=undefined;
    const now=c.currentTime,target=time===undefined?now:this.anchor+time;
    // A stalled render may deliver historic simulation events together. Drop
    // tails over 120 ms old, then preserve retained per-emitter intervals with
    // a bounded playout offset. Gameplay still uses the original shot time.
    if(!Number.isFinite(target)||target<now-.12){this.scheduling.staleDropped++;return;}
    if(target>now+2){this.scheduling.futureDropped++;return;}
    if(channel==='firing'&&emitter&&time!==undefined){if(time<=(this.latestFire.get(emitter)??-Infinity)){this.scheduling.staleDropped++;return;}this.latestFire.set(emitter,time);}
    let startsAt=Math.max(now,target);
    if(channel==='firing'&&emitter&&time!==undefined){const scheduled=this.firingTimeline.schedule(emitter,time,target,now);if(!scheduled){this.scheduling.queueDropped++;return;}startsAt=scheduled.startsAt;if(scheduled.repaired)this.scheduling.lateRescheduled++;}
    if(this.voices.size>=48){const old=this.voices.values().next().value as Voice|undefined;if(old)this.release(old,true);}
    const source=c.createBufferSource(),gain=c.createGain();source.buffer=b;gain.gain.value=scale;source.connect(gain);
    let spatial:AudioNode|null=null,filter:BiquadFilterNode|null=null,spatialMode:Voice['spatialMode']='none',occluded=false;
    if(position&&[position.x,position.y,position.z].every(Number.isFinite)){
      occluded=this.covered(position);if(occluded)gain.gain.value*=AUDIBLE_OCCLUSION.gain;
      if(typeof c.createBiquadFilter==='function'){filter=c.createBiquadFilter();filter.type='lowpass';filter.Q.value=.5;filter.frequency.value=occluded?AUDIBLE_OCCLUSION.cutoffHz:Math.min(AUDIBLE_OCCLUSION.openCutoffHz,c.sampleRate/2);gain.connect(filter);}
      const output:AudioNode=filter??gain;
      if(typeof c.createPanner==='function'){
        const p=c.createPanner();p.panningModel='HRTF';p.distanceModel='inverse';p.refDistance=9;p.maxDistance=120;p.rolloffFactor=1;
        if(p.positionX){p.positionX.value=position.x;p.positionY.value=position.y;p.positionZ.value=position.z;}else p.setPosition(position.x,position.y,position.z);
        output.connect(p).connect(this.channels[channel]);spatial=p;spatialMode='hrtf';
      }else if(typeof c.createStereoPanner==='function'){
        const p=c.createStereoPanner(),cue=spatialCue(position,this.pose);p.pan.value=cue.pan;gain.gain.value*=cue.gain;output.connect(p).connect(this.channels[channel]);spatial=p;spatialMode='stereo';
      }else{gain.gain.value*=spatialCue(position,this.pose).gain;output.connect(this.channels[channel]);spatialMode='mono';}
    }else gain.connect(this.channels[channel]);
    const v:Voice={source,gain,channel,spatial,filter,spatialMode,occluded,startsAt,timestamp:time,emitter,position:position?{...position}:undefined,baseGain:scale};
    this.voices.add(v);source.onended=()=>this.release(v);source.start(startsAt);
  }
  get activeVoiceCount(){return this.voices.size;}
  stop(){for(const v of [...this.voices])this.release(v,true);this.voices.clear();this.firingTimeline.clear();}
  /** A fresh Simulation restarts event IDs and timestamps. Pauses and weapon
   * changes retain those identities, so only an authority replacement resets
   * them. Synthesized/imported buffers and the existing context stay reusable. */
  resetSession(time=0){this.stop();this.lastShot='';this.lastMelee=0;this.lastFootstep=0;this.lastLanding=0;this.botSteps.clear();this.latestFire.clear();this.lastOcclusionUpdate=-Infinity;this.sync(time);}
  dispose(){this.disposed=true;this.stop();for(const g of Object.values(this.channels??{}))g.disconnect();this.master?.disconnect();this.compressor?.disconnect();void this.context?.close();this.context=null;this.channels=null;this.buffers.clear();this.stepBuffers.clear();this.landingBuffers.clear();this.botSteps.clear();this.latestFire.clear();this.occlusionResolver=null;this.custom.clear();this.spatialBackend='unavailable';}
}
