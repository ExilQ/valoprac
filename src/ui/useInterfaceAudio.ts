import { useEffect } from 'react';
import { useApp } from '../app/store';
// One independent UI channel. Gameplay sound ownership remains inside Runtime.
export function useInterfaceAudio(){useEffect(()=>{
 let context:AudioContext|null=null;let buffer:AudioBuffer|null=null;let active:AudioBufferSourceNode|null=null;
 const click=(event:PointerEvent)=>{
  if(!(event.target instanceof Element)||!event.target.closest('button:not(:disabled)'))return;
  const {volume,interfaceVolume}=useApp.getState().settings;if(volume*interfaceVolume===0)return;
  try{context??=new AudioContext({latencyHint:'interactive'});void context.resume().catch(()=>{});
   if(!buffer){buffer=context.createBuffer(1,Math.floor(context.sampleRate*0.025),context.sampleRate);const d=buffer.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.sin(i/context.sampleRate*2*Math.PI*980)*Math.exp(-i/context.sampleRate*180)*0.15;}
   active?.stop();const source=context.createBufferSource(),gain=context.createGain();active=source;source.buffer=buffer;gain.gain.value=volume*interfaceVolume;source.connect(gain).connect(context.destination);source.onended=()=>{source.disconnect();gain.disconnect();if(active===source)active=null;};source.start();
  }catch{/* A denied audio context must not block interface actions. */}
 };
 document.addEventListener('pointerdown',click,{passive:true});return()=>{document.removeEventListener('pointerdown',click);active?.stop();if(context)void context.close();};
},[]);}
