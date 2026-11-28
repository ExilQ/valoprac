import {BEATS_PER_BAR,MUSIC_TRACK_IDS,barEvents,loopBars,barSeconds,mulberry32,type Instrument,type MusicChoice,type MusicTrack,type MusicTrackId,type NoteEvent,type Tone} from './composition';
import {MUSIC_TRACKS} from './tracks';

const mtof=(m:number)=>440*2**((m-69)/12);
/** Spectral balance shared by every track, set from rendered measurements:
 * the first mixes put 74-85% of the energy under 200 Hz and under 0.4% above
 * 4 kHz, which sounds muddy and dull on headphones. */
export const MUSIC_BALANCE:Partial<Record<Instrument,number>>={bass:.42,sub:.3,kick:.6,tom:.8,hat:3.4,openHat:2.8,shaker:3,rim:1.5,pad:1.45,keys:1.35,arp:1.45,stab:1.45,lead:1.35,snare:1.35,clap:1.35};
/** With shuffle, a track plays at least this long, then changes at the next bar. */
export const SHUFFLE_SECONDS=150;
export const shuffleBars=(track:MusicTrack)=>Math.ceil(SHUFFLE_SECONDS/barSeconds(track));
export const MUSIC_FADE_SECONDS=1.6;

interface Bus{dry:AudioNode;reverb:AudioNode;delay:AudioNode}
interface SynthHost{readonly context:BaseAudioContext;readonly noise:AudioBuffer}
/** Short voices are rendered once per track into buffers and replayed: one
 * buffer source per note instead of 2-6 oscillators and filters. */
const CACHED=new Set<Instrument>(['bass','arp','stab','keys','kick','snare','clap','hat','openHat','rim','tom','shaker','crackle']);
const MAX_CACHED_SECONDS=2.5;
export const voiceKey=(e:NoteEvent)=>`${e.inst}|${e.notes.join(',')}|${Math.round(e.dur*8)/8}`;
/** Render every distinct short voice of one loop of a track. */
export async function renderVoices(track:MusicTrack,rate:number):Promise<Map<string,AudioBuffer>>{
  const seen=new Map<string,NoteEvent>(),beat=60/track.bpm;
  for(let bar=0;bar<track.introBars+loopBars(track);bar++)for(const e of barEvents(track,bar))if(CACHED.has(e.inst)&&e.dur*beat<MAX_CACHED_SECONDS)seen.set(voiceKey(e),{...e,dur:Math.round(e.dur*8)/8});
  const slots:{key:string;at:number;length:number}[]=[];let total=0;
  for(const [key,e] of seen){const length=e.dur*beat+(e.inst==='keys'?Math.max(.6,e.dur*beat*1.1)*1.6:.8);slots.push({key,at:total,length});total+=length+.05;}
  const context=new OfflineAudioContext(1,Math.max(1,Math.ceil(total*rate)),rate),host:SynthHost={context,noise:noiseBuffer(context)};
  for(const slot of slots){const e=seen.get(slot.key)!;voice(host,e.inst,toneOf(track,e.inst),e.notes,slot.at,e.dur*beat,1,context.destination);}
  const rendered=(await context.startRendering()).getChannelData(0),out=new Map<string,AudioBuffer>();
  for(const slot of slots){const from=Math.round(slot.at*rate),n=Math.round(slot.length*rate);let last=n;while(last>1&&Math.abs(rendered[from+last-1])<1e-5)last--;
    const buffer=new AudioBuffer({length:Math.max(1,last),sampleRate:rate,numberOfChannels:1});buffer.copyToChannel(rendered.subarray(from,from+last),0);out.set(slot.key,buffer);}
  return out;
}
function toneOf(track:MusicTrack,inst:Instrument):Tone|null{const s=track.sound;return inst==='pad'||inst==='keys'||inst==='stab'||inst==='arp'||inst==='lead'||inst==='bass'?s[inst]:null;}
function noiseBuffer(context:BaseAudioContext){
  const buffer=context.createBuffer(1,context.sampleRate*2,context.sampleRate),data=buffer.getChannelData(0),rand=mulberry32(1238);
  for(let i=0;i<data.length;i++)data[i]=rand()*2-1;return buffer;
}
function impulse(context:BaseAudioContext,seconds:number){
  const length=Math.round(context.sampleRate*seconds),buffer=context.createBuffer(2,length,context.sampleRate),rand=mulberry32(1239);
  for(let c=0;c<2;c++){const d=buffer.getChannelData(c);let lp=0;for(let i=0;i<length;i++){const t=i/length;lp+=(.55-.4*t)*((rand()*2-1)-lp);d[i]=lp*(1-t)**2.6*(i<context.sampleRate*.012?i/(context.sampleRate*.012):1);}}
  return buffer;
}

/** One playing track: its own bus, so a change of track crossfades. */
class Session{
  readonly out:GainNode;private sends:Bus;private nextBar=0;private nextTime:number;private stopped=false;private hiss:AudioBufferSourceNode|null=null;private delay:DelayNode;
  constructor(private engine:MusicEngine,readonly track:MusicTrack,start:number,fade:number,readonly startBar=0){
    const c=engine.context;this.out=c.createGain();this.out.gain.setValueAtTime(0,start);this.out.gain.linearRampToValueAtTime(track.gain,start+fade);this.out.connect(engine.input);
    const beat=60/track.bpm;this.delay=c.createDelay(2);this.delay.delayTime.value=beat*.75;
    const feedback=c.createGain();feedback.gain.value=.32;const tone=c.createBiquadFilter();tone.type='lowpass';tone.frequency.value=2600;
    const delayIn=c.createGain();delayIn.connect(this.delay);this.delay.connect(tone);tone.connect(feedback);feedback.connect(this.delay);tone.connect(this.out);
    const reverbIn=c.createGain();reverbIn.connect(engine.reverbInput);
    this.sends={dry:this.out,reverb:reverbIn,delay:delayIn};this.nextTime=start;this.nextBar=startBar;
    if(track.sound.hiss>0){const h=c.createBufferSource();h.buffer=engine.noise;h.loop=true;const lp=c.createBiquadFilter();lp.type='bandpass';lp.frequency.value=3200;lp.Q.value=.4;const g=c.createGain();g.gain.value=track.sound.hiss;h.connect(lp).connect(g).connect(this.out);h.start(start);this.hiss=h;}
  }
  get barsPlayed(){return this.nextBar-this.startBar;}
  /** Schedule every bar that starts before `until`. */
  scheduleUntil(until:number){
    const seconds=barSeconds(this.track);
    while(!this.stopped&&this.nextTime<until){for(const e of barEvents(this.track,this.nextBar))this.play(e,this.nextTime);this.nextBar++;this.nextTime+=seconds;}
    return this.nextTime;
  }
  get barStart(){return this.nextTime;}
  stop(at:number,fade:number){
    if(this.stopped)return;this.stopped=true;const g=this.out.gain;
    g.cancelScheduledValues(at);g.setValueAtTime(g.value,at);g.linearRampToValueAtTime(0,at+fade);
    try{this.hiss?.stop(at+fade+.05);}catch{/* Already stopped. */}
    this.engine.retire(this.out,at+fade+3);this.engine.retire(this.sends.reverb,at+fade+3);
  }
  private buses=new Map<Instrument,AudioNode>();
  /** One bus per instrument: static tone filter and fixed sends, shared by all its notes. */
  private bus(inst:Instrument):AudioNode{
    let bus=this.buses.get(inst);if(bus)return bus;
    const c=this.engine.context,input=c.createGain(),tone=this.toneFor(inst);let tail:AudioNode=input;
    if(tone&&!(inst==='bass'&&tone.sweep!==false)){const f=filter(c,'lowpass',tone.cutoff,tone.q??.7);input.connect(f);tail=f;}
    tail.connect(this.sends.dry);
    const rv=this.track.sound.reverb[inst]??0,dl=this.track.sound.delay[inst]??0;
    if(rv>0){const g=c.createGain();g.gain.value=rv;tail.connect(g).connect(this.sends.reverb);}
    if(dl>0){const g=c.createGain();g.gain.value=dl;tail.connect(g).connect(this.sends.delay);}
    this.buses.set(inst,input);return input;
  }
  /** Rendered short voices, once ready (see renderVoices). */
  voices:Map<string,AudioBuffer>|null=null;
  private play(e:NoteEvent,barTime:number){
    const beat=60/this.track.bpm,t=barTime+e.beat*beat,dur=e.dur*beat,level=e.vel*(this.track.mix[e.inst]??.4)*(MUSIC_BALANCE[e.inst]??1);
    if(level<=0)return;
    const cached=this.voices?.get(voiceKey(e));
    if(cached){const c=this.engine.context,src=c.createBufferSource(),g=c.createGain();src.buffer=cached;g.gain.value=level;src.connect(g).connect(this.bus(e.inst));src.start(t);this.engine.retire(g,t+cached.duration+.1);return;}
    const {node,end}=voice(this.engine,e.inst,this.toneFor(e.inst),e.notes,t,dur,level,this.bus(e.inst));
    this.engine.retire(node,end+.1);
  }
  private toneFor(inst:Instrument){return toneOf(this.track,inst);}
}

function envelope(param:AudioParam,t:number,attack:number,hold:number,release:number,peak:number){
  param.setValueAtTime(0,t);param.linearRampToValueAtTime(peak,t+attack);param.setValueAtTime(peak,t+Math.max(attack,hold));param.setTargetAtTime(0,t+Math.max(attack,hold),release/4);
  return t+Math.max(attack,hold)+release*1.5;
}
function osc(c:BaseAudioContext,type:OscillatorType,freq:number,t:number,end:number,detune=0){const o=c.createOscillator();o.type=type;o.frequency.value=freq;o.detune.value=detune;o.start(t);o.stop(end);return o;}
function noise(engine:SynthHost,t:number,end:number){const s=engine.context.createBufferSource();s.buffer=engine.noise;s.start(t,(t*7.31)%1.5);s.stop(end);return s;}
function filter(c:BaseAudioContext,type:BiquadFilterType,freq:number,q=.7){const f=c.createBiquadFilter();f.type=type;f.frequency.value=freq;f.Q.value=q;return f;}

/** Play one event into its instrument bus; returns the voice's output node and
 * when it has fully decayed. Only the bass keeps a per-note filter sweep. */
function voice(engine:SynthHost,inst:Instrument,tone:Tone|null,notes:number[],t:number,dur:number,level:number,out:AudioNode):{node:AudioNode;end:number}{
  const c=engine.context,g=c.createGain();g.connect(out);const done=(end:number)=>({node:g,end});
  switch(inst){
    case'pad':case'lead':case'stab':case'arp':{
      const tn=tone!,short=inst==='stab'||inst==='arp',release=inst==='arp'?Math.max(tn.release,dur*.8):tn.release;
      const end=envelope(g.gain,t,tn.attack,short?Math.min(dur,.05):dur,release,level*(inst==='pad'?.11/Math.sqrt(notes.length):inst==='stab'?.12/Math.sqrt(notes.length):.16));
      let depth:GainNode|null=null;
      if(inst==='lead'){const lfo=osc(c,'sine',5.2,t,end);depth=c.createGain();depth.gain.setValueAtTime(0,t);depth.gain.linearRampToValueAtTime(9,t+Math.min(.4,dur));lfo.connect(depth);}
      for(const n of notes){const fr=mtof(n),voices=[osc(c,tn.wave,fr,t,end,tn.detune??0)];if(tn.detune&&inst!=='stab')voices.push(osc(c,tn.wave,fr,t,end,-tn.detune));
        for(const v of voices){v.connect(g);if(depth)depth.connect(v.detune);}}
      return done(end);}
    case'bass':{
      const tn=tone!,end=envelope(g.gain,t,tn.attack,dur,tn.release,level*.16);let f:AudioNode=g;
      if(tn.sweep!==false){const sweep=filter(c,'lowpass',tn.cutoff,tn.q??.8);sweep.connect(g);sweep.frequency.setValueAtTime(tn.cutoff*1.8,t);sweep.frequency.exponentialRampToValueAtTime(tn.cutoff*.45,t+.22);f=sweep;}
      for(const n of notes){const fr=mtof(n);osc(c,tn.wave,fr,t,end).connect(f);const sub=c.createGain();sub.gain.value=.45;osc(c,'sine',fr,t,end).connect(sub).connect(g);}
      return done(end);}
    case'keys':{
      const end=envelope(g.gain,t,.004,.01,Math.max(.6,dur*1.1),level*.12);
      for(const n of notes){const fr=mtof(n),car=osc(c,'sine',fr,t,end),mod=osc(c,'sine',fr,t,end),idx=c.createGain();idx.gain.setValueAtTime(fr*1.6,t);idx.gain.exponentialRampToValueAtTime(fr*.15,t+.35);mod.connect(idx).connect(car.frequency);car.connect(g);}
      return done(end);}
    case'sub':{const end=envelope(g.gain,t,.05,dur,.4,level*.2);for(const n of notes)osc(c,'sine',mtof(n),t,end).connect(g);return done(end);}
    case'kick':{const o=osc(c,'sine',150,t,t+.5);o.frequency.setValueAtTime(155,t);o.frequency.exponentialRampToValueAtTime(46,t+.1);g.gain.setValueAtTime(level*.55,t);g.gain.exponentialRampToValueAtTime(.0005,t+.45);o.connect(g);
      const click=noise(engine,t,t+.012),hp=filter(c,'highpass',2000),cg=c.createGain();cg.gain.setValueAtTime(level*.08,t);cg.gain.linearRampToValueAtTime(0,t+.01);click.connect(hp).connect(cg).connect(g);return done(t+.5);}
    case'snare':{const n=noise(engine,t,t+.3),hp=filter(c,'highpass',1200),ng=c.createGain();ng.gain.setValueAtTime(level*.22,t);ng.gain.exponentialRampToValueAtTime(.0005,t+.22);n.connect(hp).connect(ng).connect(g);
      const body=osc(c,'triangle',190,t,t+.15),bg=c.createGain();bg.gain.setValueAtTime(level*.18,t);bg.gain.exponentialRampToValueAtTime(.0005,t+.12);body.connect(bg).connect(g);return done(t+.3);}
    case'clap':{const n=noise(engine,t,t+.3),bp=filter(c,'bandpass',1400,.9);n.connect(bp).connect(g);const p=g.gain;p.setValueAtTime(0,t);
      for(const k of [0,.011,.022]){p.setValueAtTime(level*.3,t+k);p.linearRampToValueAtTime(level*.05,t+k+.009);}p.setTargetAtTime(0,t+.03,.05);return done(t+.3);}
    case'hat':case'openHat':{const len=inst==='hat'?.05:.3,n=noise(engine,t,t+len+.05),hp=filter(c,'highpass',7600);g.gain.setValueAtTime(level*.12,t);g.gain.exponentialRampToValueAtTime(.0005,t+len);n.connect(hp).connect(g);return done(t+len+.05);}
    case'shaker':{const n=noise(engine,t,t+.1),bp=filter(c,'bandpass',6000,1.4);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(level*.12,t+.012);g.gain.exponentialRampToValueAtTime(.0005,t+.08);n.connect(bp).connect(g);return done(t+.1);}
    case'rim':{const o=osc(c,'square',1700,t,t+.05),bp=filter(c,'bandpass',1700,3);g.gain.setValueAtTime(level*.1,t);g.gain.exponentialRampToValueAtTime(.0005,t+.035);o.connect(bp).connect(g);return done(t+.05);}
    case'tom':{const f0=mtof(notes[0]??45),o=osc(c,'sine',f0*1.6,t,t+.4);o.frequency.exponentialRampToValueAtTime(f0,t+.12);g.gain.setValueAtTime(level*.4,t);g.gain.exponentialRampToValueAtTime(.0005,t+.35);o.connect(g);return done(t+.4);}
    case'riser':{const n=noise(engine,t,t+dur+.05),bp=filter(c,'bandpass',400,2.5);bp.frequency.setValueAtTime(400,t);bp.frequency.exponentialRampToValueAtTime(7000,t+dur);
      g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(level*.16,t+dur*.96);g.gain.linearRampToValueAtTime(0,t+dur);n.connect(bp).connect(g);return done(t+dur+.05);}
    case'crackle':{const n=noise(engine,t,t+.004),hp=filter(c,'highpass',2500);g.gain.setValueAtTime(level*.15,t);g.gain.linearRampToValueAtTime(0,t+.003);n.connect(hp).connect(g);return done(t+.01);}
  }
}

/** Menu music: chooses the track, schedules bars ahead and crossfades.
 * Works with a live AudioContext or an OfflineAudioContext (renderMusic). */
export class MusicEngine{
  readonly noise:AudioBuffer;readonly input:GainNode;readonly reverbInput:GainNode;readonly level:GainNode;private session:Session|null=null;private choice:MusicChoice='off';
  private shuffleOrder:MusicTrackId[]=[];private shuffleIndex=0;private timer:ReturnType<typeof setInterval>|null=null;
  constructor(readonly context:BaseAudioContext,destination:AudioNode,readonly realtime=true){
    const c=context;this.noise=noiseBuffer(c);this.input=c.createGain();this.level=c.createGain();this.level.gain.value=0;
    const comp=c.createDynamicsCompressor();comp.threshold.value=-16;comp.knee.value=10;comp.ratio.value=3;comp.attack.value=.01;comp.release.value=.25;
    const hp=filter(c,'highpass',28),limiter=c.createDynamicsCompressor();limiter.threshold.value=-4;limiter.knee.value=0;limiter.ratio.value=20;limiter.attack.value=.002;limiter.release.value=.1;
    /** Headroom after the limiter: its 6 ms look-ahead still lets the first transient through. */
    const trim=c.createGain();trim.gain.value=.66;
    const low=filter(c,'lowshelf',90),air=filter(c,'highshelf',4500);low.gain.value=-2;air.gain.value=4;
    this.input.connect(hp).connect(low).connect(air).connect(comp).connect(limiter).connect(trim).connect(this.level).connect(destination);
    this.reverbInput=c.createGain();const conv=c.createConvolver();conv.buffer=impulse(c,2.6);const ret=c.createGain();ret.gain.value=.5;this.reverbInput.connect(conv).connect(ret).connect(this.input);
  }
  private retired:{node:AudioNode;at:number}[]=[];
  /** Disconnect a finished voice so the graph stops processing it. */
  retire(node:AudioNode,at:number){
    if(this.realtime)setTimeout(()=>node.disconnect(),Math.max(0,at-this.context.currentTime)*1000);else this.retired.push({node,at});
  }
  /** Offline rendering: disconnect what has finished by `time`. */
  sweep(time:number){this.retired=this.retired.filter(r=>{if(r.at>time)return true;r.node.disconnect();return false;});}
  get current():MusicTrackId|null{return this.session?.track.id??null;}
  get selection(){return this.choice;}
  /** Overall music level (master x music x ducking), smoothed. */
  setLevel(value:number,at=this.context.currentTime){const p=this.level.gain;p.cancelScheduledValues(at);p.setTargetAtTime(Math.max(0,Math.min(1,value)),at,.25);}
  select(choice:MusicChoice,at=this.context.currentTime){
    if(choice===this.choice&&(this.session||choice==='off'))return;
    this.choice=choice;
    if(choice==='off'){this.session?.stop(at,MUSIC_FADE_SECONDS);this.session=null;this.stopTimer();return;}
    if(choice==='shuffle'){const r=mulberry32(Math.floor(Date.now()/1000));this.shuffleOrder=[...MUSIC_TRACK_IDS].sort(()=>r()-.5);if(this.session&&this.shuffleOrder[0]===this.session.track.id)this.shuffleOrder.push(this.shuffleOrder.shift()!);this.shuffleIndex=0;}
    this.startTrack(choice==='shuffle'?this.shuffleOrder[0]:choice,at);
  }
  private cache=new Map<MusicTrackId,Promise<Map<string,AudioBuffer>>>();
  private ready=new Map<MusicTrackId,Map<string,AudioBuffer>>();
  /** Rendered short voices for a track (the two most recent tracks are kept). */
  voicesFor(id:MusicTrackId){
    let p=this.cache.get(id);
    if(!p){p=renderVoices(MUSIC_TRACKS[id],this.context.sampleRate).then(v=>{this.ready.set(id,v);return v;});this.cache.set(id,p);
      while(this.cache.size>2){const old=this.cache.keys().next().value!;this.cache.delete(old);this.ready.delete(old);}}
    return p;
  }
  private generation=0;
  private startTrack(id:MusicTrackId,at:number,startBar=0,fade=MUSIC_FADE_SECONDS*.75){
    this.session?.stop(at,MUSIC_FADE_SECONDS);this.session=null;const generation=++this.generation;
    const begin=(time:number)=>{if(generation!==this.generation)return;
      this.session=new Session(this,MUSIC_TRACKS[id],time,fade,startBar);this.session.voices=this.ready.get(id)??null;if(this.realtime)this.startTimer();};
    if(this.ready.has(id)||!this.realtime){begin(at+.05);return;}
    // Wait for the rendered voices (a fraction of a second); a failed render plays live voices.
    void this.voicesFor(id).catch(()=>null).then(()=>begin(Math.max(at,this.context.currentTime)+.05));
  }
  /** Start a track at a given bar without a fade (offline rendering). */
  cue(id:MusicTrackId,startBar:number){this.choice=id;this.startTrack(id,0,startBar,.01);}
  /** Schedule ahead; with shuffle, move to the next track at a bar boundary. */
  pump(until:number){
    const s=this.session;if(!s)return;
    if(this.choice==='shuffle'&&s.barsPlayed>=shuffleBars(s.track)){this.shuffleIndex=(this.shuffleIndex+1)%this.shuffleOrder.length;this.startTrack(this.shuffleOrder[this.shuffleIndex],s.barStart);this.session!.scheduleUntil(until);return;}
    s.scheduleUntil(until);
  }
  private startTimer(){if(this.timer)return;const tick=()=>this.pump(this.context.currentTime+1.2);tick();this.timer=setInterval(tick,250);}
  private stopTimer(){if(this.timer)clearInterval(this.timer);this.timer=null;}
  dispose(){this.stopTimer();this.session?.stop(this.context.currentTime,.2);this.session=null;}
}

/** Render a track offline (tests, loudness calibration, previews). */
export async function renderMusic(id:MusicTrackId,seconds:number,rate=48000,startBar=0){
  const context=new OfflineAudioContext(2,Math.round(seconds*rate),rate),engine=new MusicEngine(context,context.destination,false);
  await engine.voicesFor(id);engine.setLevel(1,0);engine.level.gain.value=1;engine.cue(id,startBar);engine.pump(seconds);
  // Disconnect finished voices as the render advances, as the live engine does.
  for(let t=1;t<seconds;t+=1)void context.suspend(t).then(()=>{engine.sweep(t);void context.resume();});
  return context.startRendering();
}
export const BARS_PER_SECOND=(track:MusicTrack)=>track.bpm/60/BEATS_PER_BAR;
