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

type Levels={volume:number;interfaceVolume:number};
export function installInterfaceAudio(target:Document,readLevels:()=>Levels){
 let context:AudioContext|null=null,buffer:AudioBuffer|null=null,disposed=false,resuming=false,lastPlayed=-Infinity;
 const voices=new Set<{source:AudioBufferSourceNode;gain:GainNode;endsAt:number}>();
 const play=async(event:MouseEvent)=>{
  if(event.button!==0||!(event.target instanceof Element))return;
  const button=event.target.closest('button');
  if(!button||button.matches(':disabled,[aria-disabled="true"]'))return;
  const levels=readLevels();if(levels.volume*levels.interfaceVolume<=0)return;
  try{
   context??=new AudioContext({latencyHint:'interactive'});
   if(context.state!=='running'){
    if(resuming)return;
    resuming=true;try{await context.resume();}finally{resuming=false;}
   }
   if(disposed||context.state!=='running')return;
   const {volume,interfaceVolume}=readLevels();if(volume*interfaceVolume<=0)return;
   const now=context.currentTime;
   // Let each tap finish naturally; cutting off the previous waveform makes a click.
   if(now-lastPlayed<.055)return;
   for(const voice of voices)if(voice.endsAt<=now){voice.source.disconnect();voice.gain.disconnect();voices.delete(voice);}
   if(!buffer){
    const samples=createInterfaceClickSamples(context.sampleRate);
    buffer=context.createBuffer(1,samples.length,context.sampleRate);buffer.getChannelData(0).set(samples);
   }
   const source=context.createBufferSource(),gain=context.createGain();
   const voice={source,gain,endsAt:now+buffer.duration};
   source.buffer=buffer;gain.gain.value=volume*interfaceVolume;
   source.connect(gain).connect(context.destination);voices.add(voice);
   source.onended=()=>{source.disconnect();gain.disconnect();voices.delete(voice);};
   source.start();lastPlayed=now;
  }catch{/* Browser audio policy must never block a button action. */}
 };
 const click=(event:MouseEvent)=>{void play(event);};
 // Native click covers mouse, touch and keyboard activation once, after activation.
 target.addEventListener('click',click,{passive:true});
 return()=>{
  disposed=true;target.removeEventListener('click',click);
  for(const voice of voices){try{voice.source.stop();}catch{/* Already ended. */}voice.source.disconnect();voice.gain.disconnect();}
  voices.clear();if(context)void context.close().catch(()=>{});
 };
}
