// A quiet, rounded tap: low sine partials with a gradual attack and a silent tail.
export function createInterfaceClickSamples(sampleRate:number){
 const duration=.072,samples=new Float32Array(Math.round(sampleRate*duration));
 for(let i=0;i<samples.length;i++){
  const time=i/sampleRate,progress=i/(samples.length-1);
  const attack=Math.sin(Math.min(1,time/.009)*Math.PI/2)**2;
  const envelope=attack*(1-progress)**2;
  const phase=2*Math.PI*(360*time-120*time*time/(2*duration));
  samples[i]=(Math.sin(phase)+.12*Math.sin(2*phase))*.09*envelope;
 }
 return samples;
}

/** Interface sound family (12.38). Games give navigation, commitment and
 * errors different sounds and keep hover near-silent; every tone here is an A
 * or an E so it sits in the key of every menu track. */
export type InterfaceSound='click'|'hover'|'nav'|'start'|'back'|'toggleOn'|'toggleOff'|'tick'|'denied';
export const INTERFACE_SOUND_SECONDS:Record<InterfaceSound,number>={click:.072,hover:.03,nav:.12,start:.5,back:.12,toggleOn:.075,toggleOff:.075,tick:.016,denied:.15};
const A=[110,220,440,880,1760],E=[164.81,329.63,659.26,1318.51];
interface Partial_{at:number;freq:number;to?:number;len:number;gain:number;h2?:number}
const RECIPES:Record<Exclude<InterfaceSound,'click'>,Partial_[]>={
 hover:[{at:0,freq:A[4],len:.03,gain:.016}],
 nav:[{at:0,freq:E[2],len:.06,gain:.045},{at:.05,freq:A[3],len:.07,gain:.045}],
 back:[{at:0,freq:A[2],len:.06,gain:.045},{at:.05,freq:E[1],len:.07,gain:.045}],
 toggleOn:[{at:0,freq:E[2],to:A[3],len:.075,gain:.05}],
 toggleOff:[{at:0,freq:A[3],to:E[2],len:.075,gain:.042}],
 tick:[{at:0,freq:E[3],len:.016,gain:.02}],
 start:[{at:0,freq:A[0],len:.18,gain:.05},{at:0,freq:A[1],len:.45,gain:.05},{at:.012,freq:E[1],len:.46,gain:.04},{at:.024,freq:A[2],len:.47,gain:.035},{at:.045,freq:E[2],len:.45,gain:.022}],
 denied:[{at:0,freq:A[0],len:.06,gain:.06,h2:.35},{at:.075,freq:A[0],len:.07,gain:.05,h2:.35}],
};
/** Sine partials with raised-cosine attacks and squared decays: silent
 * endpoints, no clicks, nothing above 4 kHz except the faint hover. */
export function createInterfaceSamples(kind:InterfaceSound,sampleRate:number){
 if(kind==='click')return createInterfaceClickSamples(sampleRate);
 const samples=new Float32Array(Math.round(sampleRate*INTERFACE_SOUND_SECONDS[kind]));
 for(const p of RECIPES[kind]){
  const from=Math.round(p.at*sampleRate),n=Math.min(samples.length-from,Math.round(p.len*sampleRate)),attack=Math.min(.006,p.len/4);let phase=0;
  for(let i=0;i<n;i++){
   const time=i/sampleRate,progress=i/(n-1),freq=p.to?p.freq+(p.to-p.freq)*Math.min(1,progress*1.6):p.freq;phase+=2*Math.PI*freq/sampleRate;
   const env=Math.sin(Math.min(1,time/attack)*Math.PI/2)**2*(1-progress)**2;
   samples[from+i]+=(Math.sin(phase)+(p.h2??.1)*Math.sin(2*phase))*p.gain*env;
  }
 }
 return samples;
}
/** Which sound an activated element makes. data-sound wins. */
export function interfaceSoundFor(element:Element):InterfaceSound|null{
 const tagged=element.closest('[data-sound]');const named=tagged?.getAttribute('data-sound');
 if(named&&named in INTERFACE_SOUND_SECONDS)return named as InterfaceSound;
 if(named==='none')return null;
 const input=element.closest('input');
 if(input){const type=input.type;if(type==='checkbox')return input.checked?'toggleOn':'toggleOff';if(type==='radio')return 'toggleOn';return null;}
 const control=element.closest('button,a[href],[role="tab"],summary');if(!control)return null;
 if(control.getAttribute('aria-disabled')==='true')return 'denied';
 if(control.matches('.start-button'))return 'start';
 if(control.matches('[role="tab"],nav a,a[aria-current]'))return 'nav';
 const label=`${control.getAttribute('aria-label')??''} ${control.getAttribute('title')??''}`;
 if(/닫기|뒤로|돌아가|취소|close|back|cancel/i.test(label)||control.matches('.dialog-close,[data-close]'))return 'back';
 if(control.matches('summary'))return (control.parentElement as HTMLDetailsElement|null)?.open?'toggleOff':'toggleOn';
 return 'click';
}
const MIN_GAP:Record<InterfaceSound,number>={click:.055,hover:.045,nav:.08,start:.25,back:.08,toggleOn:.05,toggleOff:.05,tick:.035,denied:.15};

type Levels={volume:number;interfaceVolume:number};
export function installInterfaceAudio(target:Document,readLevels:()=>Levels){
 let context:AudioContext|null=null,disposed=false,resuming=false,lastHover:Element|null=null;
 const buffers=new Map<InterfaceSound,AudioBuffer>(),last=new Map<InterfaceSound,number>();
 const voices=new Set<{source:AudioBufferSourceNode;gain:GainNode;endsAt:number}>();
 const play=async(kind:InterfaceSound,create:boolean,rate=1)=>{
  const levels=readLevels();if(levels.volume*levels.interfaceVolume<=0)return;
  try{
   // Hover and slider ticks never create or wake audio: only an activation may.
   if(!context&&!create)return;
   context??=new AudioContext({latencyHint:'interactive'});
   if(context.state!=='running'){
    if(!create||resuming)return;
    resuming=true;try{await context.resume();}finally{resuming=false;}
   }
   if(disposed||context.state!=='running')return;
   const {volume,interfaceVolume}=readLevels();if(volume*interfaceVolume<=0)return;
   const now=context.currentTime;
   // Let each sound finish naturally; cutting off the previous waveform makes a click.
   if(now-(last.get(kind)??-Infinity)<MIN_GAP[kind])return;
   for(const voice of voices)if(voice.endsAt<=now){voice.source.disconnect();voice.gain.disconnect();voices.delete(voice);}
   let buffer=buffers.get(kind);
   if(!buffer){
    const samples=createInterfaceSamples(kind,context.sampleRate);
    buffer=context.createBuffer(1,samples.length,context.sampleRate);buffer.getChannelData(0).set(samples);buffers.set(kind,buffer);
   }
   const source=context.createBufferSource(),gain=context.createGain();
   const voice={source,gain,endsAt:now+buffer.duration/rate};
   source.buffer=buffer;if(rate!==1&&source.playbackRate)source.playbackRate.value=rate;gain.gain.value=volume*interfaceVolume;
   source.connect(gain).connect(context.destination);voices.add(voice);
   source.onended=()=>{source.disconnect();gain.disconnect();voices.delete(voice);};
   source.start();last.set(kind,now);
  }catch{/* Browser audio policy must never block a button action. */}
 };
 const click=(event:MouseEvent)=>{
  if(event.button!==0||!(event.target instanceof Element))return;
  const button=event.target.closest('button');
  if(button?.matches(':disabled'))return;
  const kind=interfaceSoundFor(event.target);if(kind)void play(kind,true);
 };
 const hover=(event:PointerEvent)=>{
  if(event.pointerType!=='mouse'||event.buttons||!(event.target instanceof Element))return;
  const control=event.target.closest('button:not(:disabled),a[href],[role="tab"],summary');
  if(!control||control===lastHover)return;lastHover=control;
  if(control.closest('[data-sound="none"]'))return;
  void play('hover',false);
 };
 const out=(event:PointerEvent)=>{if(event.target instanceof Element&&event.target.closest('button,a[href],[role="tab"],summary')===lastHover&&!(event.relatedTarget instanceof Element&&lastHover?.contains(event.relatedTarget)))lastHover=null;};
 const input=(event:Event)=>{
  const el=event.target;if(!(el instanceof HTMLInputElement)||el.type!=='range')return;
  const min=Number(el.min||0),max=Number(el.max||100),ratio=max>min?(Number(el.value)-min)/(max-min):.5;
  void play('tick',false,.84+.32*Math.max(0,Math.min(1,ratio)));
 };
 const change=(event:Event)=>{if(event.target instanceof HTMLSelectElement)void play('toggleOn',true);};
 // Native click covers mouse, touch and keyboard activation once, after activation.
 target.addEventListener('click',click,{passive:true});
 target.addEventListener('pointerover',hover as EventListener,{passive:true});
 target.addEventListener('pointerout',out as EventListener,{passive:true});
 target.addEventListener('input',input,{passive:true});
 target.addEventListener('change',change,{passive:true});
 return()=>{
  disposed=true;target.removeEventListener('click',click);target.removeEventListener('pointerover',hover as EventListener);target.removeEventListener('pointerout',out as EventListener);
  target.removeEventListener('input',input);target.removeEventListener('change',change);
  for(const voice of voices){try{voice.source.stop();}catch{/* Already ended. */}voice.source.disconnect();voice.gain.disconnect();}
  voices.clear();if(context)void context.close().catch(()=>{});
 };
}
