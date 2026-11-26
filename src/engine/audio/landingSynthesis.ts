import type {FootstepMaterial} from '../footsteps/Footsteps';
import {Rng,band,biquad,envelope,fadeEdges,glideTone,mixInto,modal,noise,normalize,samplesFor,scale} from './dsp';
import type {Pcm} from './dsp';
import {FLOORS} from './footstepSynthesis';

/** Original landing (12.24): both feet in quick succession, a heavier body
 * drop, the floor's response and a brief rattle of carried gear. */
export function synthesizeLanding(sampleRate:number,material:FootstepMaterial='concrete'){
  const rate=sampleRate,floor=FLOORS[material]??FLOORS.concrete,rng=new Rng(0x5811ab+material.length*17),out=new Float32Array(Math.round(rate*.23));
  const drop=glideTone(out.length,rate,95,48,.02,.05,.002);
  const thud=biquad(noise(out.length,rng),rate,'lowpass',260,.8);for(let i=0;i<thud.length;i++)thud[i]*=envelope(i/rate,.002,.035);
  mixInto(out,drop,.55*floor.thump+.2,0,rate);mixInto(out,thud,.9*floor.thump,0,rate);
  for(const [time,gain] of [[0,1],[.018,.8]] as const){
    const scuff=band(noise(samplesFor(.12,rate),rng),rate,floor.scuff[0],floor.scuff[1]);for(let i=0;i<scuff.length;i++)scuff[i]*=envelope(i/rate,.0015,.022);
    mixInto(out,scuff,floor.scuffLevel*2*gain,time,rate);
    mixInto(out,modal(samplesFor(.2,rate),rate,floor.modes,rng,.0008),floor.modeLevel*1.2*gain,time,rate);
  }
  // Gear rattle: a few tiny metallic ticks after the impact.
  for(let k=0;k<4;k++){const t=.03+k*.017+rng.range(0,.01);mixInto(out,modal(samplesFor(.03,rate),rate,[{freq:rng.range(3200,5600),decay:.006,amp:1}],rng),.08,t,rate);}
  biquad(out,rate,'highpass',45,.7);scale(out,floor.damp);fadeEdges(out,rate,.0005,.02);
  return normalize([out],.62*floor.damp)[0];
}
