import {SURFACES} from '../../config/surfaces';
import type {PenetrationSegment} from '../collision/Ballistics';
import type {KnifeSound} from './knifeSynthesis';
import type {LandingSoundEvent} from '../footsteps/Landings';
import type {FootstepEvent} from '../footsteps/Footsteps';
import { AUDIO_PROFILES, AUDIO_ACTIONS, type AudioAction } from '../../config/audio';
import { readAudioAssets } from '../../storage/audioAssets';
import { WEAPON_ORDER } from '../../config/weapons';
import {FIRE_VARIANTS} from './synthesis';
import {KILL_STEPS,STEP_VARIANTS,THIRD_PERSON_VARIANTS,prefetchOrder,renderSound,type AcousticSpace} from './soundBank';
import type {Pcm} from './dsp';
import {listenerForward,spatialCue,type ListenerPose} from './spatial';
import {FiringTimeline} from './FiringTimeline';
import {AUDIBLE_OCCLUSION,type AudibleOcclusionResolver} from './occlusion';
import type { Settings, ShotEvent, WeaponId, Vec3, MeleeEvent } from '../types';
type Channel='firing'|'handling'|'feedback'|'footsteps';
interface Voice {source:AudioBufferSourceNode;gain:GainNode;channel:Channel;spatial:AudioNode|null;filter:BiquadFilterNode|null;send:GainNode|null;spatialMode:'hrtf'|'stereo'|'mono'|'none';occluded:boolean;startsAt:number;timestamp?:number;emitter?:string;position?:Vec3;baseGain:number;sendBase:number}
function smooth(param:AudioParam,value:number,time:number){if(typeof param.setTargetAtTime==='function')param.setTargetAtTime(value,time,AUDIBLE_OCCLUSION.smoothingSeconds);else param.value=value;}
function setParam(node:AudioNode,name:string,value:number){const p=(node as unknown as Record<string,AudioParam|undefined>)[name];if(p&&typeof p==='object'&&'value' in p)p.value=value;}

/** Mix calibration (12.24). Reverb sends per channel; the 3D roll-off for
 * footsteps is deliberately flatter than for gunfire so steps stay audible,
 * as competitive shooters favour hearing steps over distance realism. */
export const AUDIO_MIX={
  reverbSend:{firing:.16,remoteFiring:.42,handling:.04,feedback:.12,footsteps:.07} as const,
  rolloff:{firing:{ref:10,factor:1,max:140},footsteps:{ref:7,factor:.6,max:60},other:{ref:8,factor:1,max:80}} as const,
  /** Air absorption: open low-pass cutoff falls with distance (Hz). */
  airCutoff:(distance:number)=>Math.max(2800,20000*Math.exp(-distance/55)),
  playerFireGain:.95,remoteFireGain:.8,killStreakSeconds:2.5,
  /** A knife swing sits about 8 dB under a rifle shot and the knife draw
   * matches gun equips (12.26: the swing was as loud as a Vandal shot). */
  /** Jump push-off: a firm footstep, between a step (.6) and a hard landing. */
  jumpPushOffGain:.7,
  knifeSlashGain:.3,knifeStabGain:.45,knifeEquipGain:.5,
};

export class TrainingAudio {
  private context:AudioContext|null=null;private channels:Record<Channel,GainNode>|null=null;private master:GainNode|null=null;private compressor:DynamicsCompressorNode|null=null;private limiter:DynamicsCompressorNode|null=null;
  private reverbIn:GainNode|null=null;private sends:Record<Channel,GainNode>|null=null;private convolver:ConvolverNode|null=null;private space:AcousticSpace='range';private spaceLoaded:AcousticSpace|null=null;
  private buffers=new Map<string,AudioBuffer>();private voices=new Set<Voice>();private loading:Promise<void>|null=null;private disposed=false;private lastShot='';private anchor=0;private weapon:WeaponId='rifleA';
  private lastFootstep=0;footstepEvents=0;private lastLanding=0;landingEvents=0;private lastJump=0;jumpEvents=0;
  private botSteps=new Map<number,number>();botFootstepEvents=0;
  private pose:ListenerPose={position:{x:0,y:0,z:0},yaw:0,pitch:0};
  private firingTimeline=new FiringTimeline();readonly scheduling={staleDropped:0,futureDropped:0,lateCoalesced:0,lateRescheduled:0,queueDropped:0};
  private latestFire=new Map<string,number>();
  private occlusionResolver:AudibleOcclusionResolver|null=null;private lastOcclusionUpdate=-Infinity;
  /** PCM rendered ahead of time by the sound worker, waiting for a context. */
  private pending=new Map<string,{rate:number;channels:Pcm[]}>();private worker:Worker|null=null;
  private killStreak={step:0,last:-Infinity};
  spatialBackend:'unavailable'|'hrtf'|'stereo'|'mono'='unavailable';
  custom=new Set<string>();events=0;

  /** Start rendering sounds in the background before the first click, most
   * urgent first (equipped weapon, room, feedback, footsteps). */
  prefetch(weapon:WeaponId,space:AcousticSpace){
    this.weapon=weapon;this.space=space;
    if(this.disposed||this.worker||typeof Worker==='undefined')return;
    try{
      const worker=this.worker=new Worker(new URL('./soundWorker.ts',import.meta.url),{type:'module'});
      worker.onmessage=(event:MessageEvent<{key?:string;rate?:number;channels?:Pcm[];done?:boolean}>)=>{
        const {key,rate,channels,done}=event.data;
        if(done){worker.terminate();if(this.worker===worker)this.worker=null;return;}
        if(!key||!rate||!channels||this.disposed||this.buffers.has(key))return;
        this.pending.set(key,{rate,channels});if(key===`ir:${this.space}`)this.applySpace();
      };
      worker.onerror=()=>{worker.terminate();if(this.worker===worker)this.worker=null;};
      worker.postMessage({keys:prefetchOrder(weapon,space),rate:48000});
    }catch{this.worker=null;}
  }
  /** Acoustic space of the current map; selects the convolution response. */
  setSpace(space:AcousticSpace){this.space=space;this.applySpace();}
  private applySpace(){
    const c=this.context;if(!c||!this.convolver||this.spaceLoaded===this.space)return;
    const ir=this.buffer(`ir:${this.space}`);if(!ir)return;
    try{this.convolver.buffer=ir;this.spaceLoaded=this.space;}catch{/* A failed reverb keeps the dry mix. */}
  }
  /** AudioBuffer for a sound key: imported asset, worker PCM, or rendered now. */
  private buffer(key:string):AudioBuffer|undefined{
    const cached=this.buffers.get(key);if(cached)return cached;
    const c=this.context;if(!c||this.disposed)return undefined;
    let pcm=this.pending.get(key);this.pending.delete(key);
    // A ConvolverNode only accepts a buffer at the context's own sample rate
    // (worker responses are 48 kHz; many devices run at 44.1 kHz). Sources
    // resample by themselves, so only impulse responses are re-rendered.
    if(pcm&&key.startsWith('ir:')&&pcm.rate!==c.sampleRate)pcm=undefined;
    if(!pcm){const rendered=renderSound(key,c.sampleRate);if(!rendered)return undefined;pcm={rate:c.sampleRate,channels:rendered};}
    const b=c.createBuffer(pcm.channels.length,pcm.channels[0].length,pcm.rate);
    pcm.channels.forEach((data,ch)=>b.copyToChannel(data,ch));
    this.buffers.set(key,b);return b;
  }
  async unlock(){
    if(this.disposed)return;
    if(!this.context){const c=this.context=new AudioContext({latencyHint:'interactive'});
      // channels -> master volume -> glue compressor -> brick-wall limiter.
      this.master=c.createGain();this.compressor=c.createDynamicsCompressor();this.limiter=c.createDynamicsCompressor();
      for(const [name,value] of [['threshold',-16],['knee',8],['ratio',3],['attack',.004],['release',.16]] as const)setParam(this.compressor,name,value);
      for(const [name,value] of [['threshold',-1.5],['knee',0],['ratio',20],['attack',.001],['release',.08]] as const)setParam(this.limiter,name,value);
      this.master.connect(this.compressor).connect(this.limiter).connect(c.destination);
      this.channels={firing:c.createGain(),handling:c.createGain(),feedback:c.createGain(),footsteps:c.createGain()};for(const g of Object.values(this.channels))g.connect(this.master);
      if(typeof c.createConvolver==='function'){this.reverbIn=c.createGain();this.convolver=c.createConvolver();const wet=c.createGain();setParam(wet,'gain',.9);this.reverbIn.connect(this.convolver).connect(wet).connect(this.master);
        // Each channel's room send passes its own volume, so a muted channel has no tail either.
        this.sends={firing:c.createGain(),handling:c.createGain(),feedback:c.createGain(),footsteps:c.createGain()};for(const g of Object.values(this.sends))g.connect(this.reverbIn);}
      this.spatialBackend=typeof c.createPanner==='function'?'hrtf':typeof c.createStereoPanner==='function'?'stereo':'mono';this.listener(this.pose.position,this.pose.yaw,this.pose.pitch);
      this.applySpace();
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
  private cutoffFor(occluded:boolean,distance:number){const nyquist=(this.context?.sampleRate??48000)/2;return Math.min(occluded?AUDIBLE_OCCLUSION.cutoffHz:AUDIBLE_OCCLUSION.openCutoffHz,AUDIO_MIX.airCutoff(distance),nyquist);}
  /** Called from the actual player/camera transform, independent of screen size. */
  listener(position:Vec3,yaw:number,pitch=0){
    if(![position.x,position.y,position.z,yaw,pitch].every(Number.isFinite))return;
    this.pose={position:{...position},yaw,pitch};
    const now=this.context?.currentTime??0,refresh=now-this.lastOcclusionUpdate>=AUDIBLE_OCCLUSION.refreshSeconds;
    if(refresh)this.lastOcclusionUpdate=now;
    for(const v of this.voices)if(v.position){
      const cue=spatialCue(v.position,this.pose);
      if(v.spatialMode==='stereo'&&v.spatial)(v.spatial as StereoPannerNode).pan.value=cue.pan;
      if(refresh){const covered=this.covered(v.position);if(covered!==v.occluded)v.occluded=covered;if(v.filter)smooth(v.filter.frequency,this.cutoffFor(v.occluded,cue.distance),now);if(v.send)smooth(v.send.gain,v.sendBase*this.distanceSend(cue.distance),now);}
      const value=v.baseGain*(v.spatialMode==='stereo'||v.spatialMode==='mono'?cue.gain:1)*(v.occluded?AUDIBLE_OCCLUSION.gain:1);
      smooth(v.gain.gain,value,now);
    }
    const l=this.context?.listener;if(!l)return;const f=listenerForward(yaw,pitch);
    if(l.positionX){l.positionX.value=position.x;l.positionY.value=position.y;l.positionZ.value=position.z;l.forwardX.value=f.x;l.forwardY.value=f.y;l.forwardZ.value=f.z;l.upX.value=0;l.upY.value=1;l.upZ.value=0;}
    else{l.setPosition(position.x,position.y,position.z);l.setOrientation(f.x,f.y,f.z,0,1,0);}
  }
  /** Far sources are heard more through the room than directly. */
  private distanceSend(distance:number){return .55+Math.min(1,distance/35)*.9;}
  levels(s:Settings){if(!this.master||!this.channels)return;this.master.gain.value=s.volume;
    const volume:Record<Channel,number>={firing:s.firingVolume,handling:s.handlingVolume,feedback:s.feedbackVolume,footsteps:s.footstepVolume};
    for(const channel of Object.keys(volume) as Channel[]){this.channels[channel].gain.value=volume[channel];if(this.sends)this.sends[channel].gain.value=volume[channel];}}
  selectWeapon(id:WeaponId){if(this.weapon!==id){this.stop();this.weapon=id;}}
  /** Imported (custom) recordings replace every procedural variant. */
  private fireKey(id:WeaponId,variant:number,third:boolean){
    if(this.custom.has(`${id}:fire`))return `${id}:fire`;
    return third?`${id}:fire3p:${variant%THIRD_PERSON_VARIANTS}`:`${id}:fire:${variant%FIRE_VARIANTS}`;
  }
  shot(s:ShotEvent){const key=`${s.weapon}:${s.timestamp}:${s.magazineShot}`;if(key===this.lastShot)return;this.lastShot=key;this.events++;
    this.playKey(this.fireKey(s.weapon,s.magazineShot,false),'firing',s.timestamp,AUDIO_MIX.playerFireGain*(AUDIO_PROFILES[s.weapon]?.gain??1),undefined,'player');this.impacts(s.penetrationSegments??[],s.timestamp);
    if(s.hit==='head')this.playKey(this.custom.has(`${s.weapon}:elimination`)?`${s.weapon}:elimination`:'feedback:headshot','feedback',s.timestamp);
    else if(['torso','arm','leg'].includes(s.hit))this.playKey('feedback:body','feedback',s.timestamp,.85);}
  /** Elimination confirm; consecutive kills rise in pitch. */
  kill(time?:number){
    const now=time??this.context?.currentTime??0,streak=this.killStreak;
    streak.step=now-streak.last<=AUDIO_MIX.killStreakSeconds?Math.min(KILL_STEPS-1,streak.step+1):0;streak.last=now;
    this.playKey(`feedback:kill:${streak.step}`,'feedback',time===undefined?undefined:time+.035,.75);
  }
  footstep(e:FootstepEvent){if(e.id<=this.lastFootstep)return;this.lastFootstep=e.id;this.footstepEvents++;this.playKey(`step:${e.surfaceId?SURFACES[e.surfaceId].footstepSoundProfile:e.material??'concrete'}:${e.id%STEP_VARIANTS}`,'footsteps',e.timestamp,.6);}
  landing(e:LandingSoundEvent){if(e.id<=this.lastLanding)return;this.lastLanding=e.id;this.landingEvents++;this.playKey(`land:${e.surfaceId?SURFACES[e.surfaceId].footstepSoundProfile:e.material??'concrete'}`,'footsteps',e.timestamp,Math.max(.15,Math.min(.85,e.impactSpeed/9)),e.position);}
  /** audio-v8 jump push-off: a firm footstep on the takeoff surface. */
  jump(e:FootstepEvent){if(e.id<=this.lastJump)return;this.lastJump=e.id;this.jumpEvents++;this.playKey(`step:${e.surfaceId?SURFACES[e.surfaceId].footstepSoundProfile:e.material??'concrete'}:${e.id%STEP_VARIANTS}`,'footsteps',e.timestamp,AUDIO_MIX.jumpPushOffGain,e.position);}
  enemyShot(id:WeaponId,origin:number|Vec3,time?:number,sourceId?:number|string){
    const variant=Math.abs(Math.round((time??0)*120))%THIRD_PERSON_VARIANTS,key=this.fireKey(id,variant,true),gain=AUDIO_MIX.remoteFireGain*(id!=='knife'?AUDIO_PROFILES[id].gain:1);
    if(typeof origin==='number'){this.playKey(key,'firing',time,gain*Math.max(.12,Math.min(1,9/Math.max(9,origin))),undefined,`enemy:${sourceId??id}`);return;}
    this.playKey(key,'firing',time,gain,origin,`enemy:${sourceId??`${id}:${origin.x}:${origin.z}`}`);
  }
  botFootstep(bot:number,e:FootstepEvent){if(e.id<=(this.botSteps.get(bot)??0))return;this.botSteps.set(bot,e.id);this.botFootstepEvents++;this.playKey(`step:${e.surfaceId?SURFACES[e.surfaceId].footstepSoundProfile:e.material??'concrete'}:${e.id%STEP_VARIANTS}`,'footsteps',e.timestamp,.7,e.position);}
  resetBotSteps(){this.botSteps.clear();}
  surfaceImpact(surface:import('../../config/surfaces').SurfaceId,point:Vec3,time?:number,scale=1,emitter='player-floor-impact'){
    const buffer=this.buffer(`impact:${SURFACES[surface].bulletImpactProfile}:false`);if(buffer)this.playBuffer(buffer,'feedback',time,.38*scale,point,emitter);
  }
  impacts(segments:PenetrationSegment[],time?:number,scale=1){for(const segment of segments.slice(0,4)){const profile=SURFACES[segment.material].bulletImpactProfile,entry=this.buffer(`impact:${profile}:false`);if(entry&&segment.entrySurface!==false)this.playBuffer(entry,'feedback',time,.38*scale,segment.entry);if(segment.penetrated&&segment.exitSurface!==false){const exit=this.buffer(`impact:${profile}:true`);if(exit)this.playBuffer(exit,'feedback',time,.22*scale,segment.exit);}}}
  action(id:WeaponId,action:'reload'|'equip'|'bolt'|'scope'){if(id==='knife'){if(action==='equip')this.knifeSound('equip','handling',undefined,AUDIO_MIX.knifeEquipGain);return;}this.playKey(`${id}:${action}`,'handling',undefined,AUDIO_PROFILES[id].gain);}
  private lastMelee=0;
  /** Attack swish, plus a body or surface impact when the blade connects. */
  melee(e:MeleeEvent){if(e.serial<=this.lastMelee)return;this.lastMelee=e.serial;this.events++;this.knifeSound(e.kind,'firing',e.timestamp,e.kind==='slash'?AUDIO_MIX.knifeSlashGain:AUDIO_MIX.knifeStabGain);
    if(e.hit==='wall')this.knifeSound('wall','feedback',e.timestamp,.55,e.impact??undefined);else if(e.hit!=='miss')this.knifeSound('hit','feedback',e.timestamp,e.killed?.95:.75);}
  private knifeSound(sound:KnifeSound,channel:Channel,time?:number,scale=1,position?:Vec3){this.playKey(`knife:${sound}`,channel,time,scale,position,`knife:${sound}`);}
  trainingCue(source:Vec3,time:number){if(!Number.isFinite(time))return;this.playKey('training:cue','feedback',time,.55,source);}
  private playKey(key:string,channel:Channel,time?:number,scale=1,position?:Vec3,emitter?:string){
    const b=this.buffer(key);if(b)this.playBuffer(b,channel,time,scale,position,emitter);
  }
  private release(v:Voice,stop=false){
    v.source.onended=null;if(stop){try{v.source.stop();}catch{/* Voice may already have finished. */}}
    v.source.disconnect();v.gain.disconnect();v.spatial?.disconnect();v.filter?.disconnect();v.send?.disconnect();this.voices.delete(v);
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
    let spatial:AudioNode|null=null,filter:BiquadFilterNode|null=null,send:GainNode|null=null,spatialMode:Voice['spatialMode']='none',occluded=false,distance=0;
    const remote=!!position,sendBase=channel==='firing'?(remote?AUDIO_MIX.reverbSend.remoteFiring:AUDIO_MIX.reverbSend.firing):AUDIO_MIX.reverbSend[channel];
    if(position&&[position.x,position.y,position.z].every(Number.isFinite)){
      occluded=this.covered(position);if(occluded)gain.gain.value*=AUDIBLE_OCCLUSION.gain;distance=spatialCue(position,this.pose).distance;
      if(typeof c.createBiquadFilter==='function'){filter=c.createBiquadFilter();filter.type='lowpass';filter.Q.value=.5;filter.frequency.value=this.cutoffFor(occluded,distance);gain.connect(filter);}
      const output:AudioNode=filter??gain;
      if(typeof c.createPanner==='function'){
        const roll=channel==='footsteps'?AUDIO_MIX.rolloff.footsteps:channel==='firing'?AUDIO_MIX.rolloff.firing:AUDIO_MIX.rolloff.other;
        const p=c.createPanner();p.panningModel='HRTF';p.distanceModel='inverse';p.refDistance=roll.ref;p.maxDistance=roll.max;p.rolloffFactor=roll.factor;
        if(p.positionX){p.positionX.value=position.x;p.positionY.value=position.y;p.positionZ.value=position.z;}else p.setPosition(position.x,position.y,position.z);
        output.connect(p).connect(this.channels[channel]);spatial=p;spatialMode='hrtf';
      }else if(typeof c.createStereoPanner==='function'){
        const p=c.createStereoPanner(),cue=spatialCue(position,this.pose);p.pan.value=cue.pan;gain.gain.value*=cue.gain;output.connect(p).connect(this.channels[channel]);spatial=p;spatialMode='stereo';
      }else{gain.gain.value*=spatialCue(position,this.pose).gain;output.connect(this.channels[channel]);spatialMode='mono';}
    }else gain.connect(this.channels[channel]);
    // Room send: the convolution reverb gives every map its own tail.
    if(this.reverbIn&&sendBase>0){send=c.createGain();send.gain.value=sendBase*(remote?this.distanceSend(distance):1)*(occluded?.6:1);(filter??gain).connect(send).connect(this.sends?.[channel]??this.reverbIn);}
    const v:Voice={source,gain,channel,spatial,filter,send,spatialMode,occluded,startsAt,timestamp:time,emitter,position:position?{...position}:undefined,baseGain:scale,sendBase};
    this.voices.add(v);source.onended=()=>this.release(v);source.start(startsAt);
  }
  get activeVoiceCount(){return this.voices.size;}
  stop(){for(const v of [...this.voices])this.release(v,true);this.voices.clear();this.firingTimeline.clear();}
  /** A fresh Simulation restarts event IDs and timestamps. Pauses and weapon
   * changes retain those identities, so only an authority replacement resets
   * them. Synthesized/imported buffers and the existing context stay reusable. */
  resetSession(time=0){this.stop();this.lastShot='';this.lastMelee=0;this.lastFootstep=0;this.lastLanding=0;this.lastJump=0;this.killStreak={step:0,last:-Infinity};this.botSteps.clear();this.latestFire.clear();this.lastOcclusionUpdate=-Infinity;this.sync(time);}
  dispose(){this.disposed=true;this.stop();this.worker?.terminate();this.worker=null;this.pending.clear();for(const g of Object.values(this.channels??{}))g.disconnect();this.master?.disconnect();this.compressor?.disconnect();this.limiter?.disconnect();for(const g of Object.values(this.sends??{}))g.disconnect();this.sends=null;this.reverbIn?.disconnect();this.convolver?.disconnect();void this.context?.close();this.context=null;this.channels=null;this.reverbIn=null;this.convolver=null;this.buffers.clear();this.botSteps.clear();this.latestFire.clear();this.occlusionResolver=null;this.custom.clear();this.spatialBackend='unavailable';}
}
export type {AudioAction};
