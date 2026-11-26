import type {FootstepMaterial} from '../footsteps/Footsteps';
import {Rng,band,biquad,envelope,fadeEdges,glideTone,matchLoudness,mixInto,modal,noise,normalize,samplesFor,scale,windowRms,type Mode} from './dsp';
import type {Pcm} from './dsp';

/* Original footsteps (12.24). A step is two contacts, heel then toe, about
 * 30-40 ms apart, each with a sole scuff, a small body thump and the floor's
 * own response. Energy sits in the 250 Hz-4 kHz band players listen for, as
 * competitive shooters prioritise footstep audibility over realism. Variants
 * (`side` 0-3) change timing, pitch and texture so steps never machine-gun. */

const m=(freq:number,decayMs:number,amp:number):Mode=>({freq,decay:decayMs/1000,amp});
interface Floor {modes:readonly Mode[];modeLevel:number;scuff:readonly [number,number];scuffLevel:number;grit:number;thump:number;damp:number;}
export const FLOORS:Readonly<Record<FootstepMaterial,Floor>>={
  concrete:{modes:[m(420,14,.5),m(1150,9,.3)],modeLevel:.35,scuff:[700,4200],scuffLevel:1,grit:.55,thump:.55,damp:1},
  steel:{modes:[m(380,90,.7),m(930,70,.55),m(1660,48,.4),m(2710,30,.25)],modeLevel:.85,scuff:[900,5200],scuffLevel:.75,grit:.25,thump:.45,damp:1},
  tile:{modes:[m(760,22,.6),m(2600,12,.45)],modeLevel:.6,scuff:[1200,6500],scuffLevel:.8,grit:.35,thump:.4,damp:1},
  wood:{modes:[m(240,40,.55),m(410,30,.7),m(900,18,.4)],modeLevel:.7,scuff:[550,3600],scuffLevel:.85,grit:.2,thump:.45,damp:1},
  rubber:{modes:[m(260,20,.6)],modeLevel:.4,scuff:[400,2200],scuffLevel:.7,grit:.05,thump:.6,damp:.75},
  glass:{modes:[m(2050,40,.6),m(3260,28,.45),m(5100,16,.3)],modeLevel:.55,scuff:[1500,7000],scuffLevel:.7,grit:.3,thump:.35,damp:1},
  plastic:{modes:[m(610,26,.6),m(1420,16,.4)],modeLevel:.65,scuff:[800,4800],scuffLevel:.8,grit:.15,thump:.45,damp:1},
  fabric:{modes:[m(300,15,.4)],modeLevel:.2,scuff:[350,1800],scuffLevel:.8,grit:.02,thump:.4,damp:.55},
};

function contact(rate:number,rng:Rng,floor:Floor,strength:number,pitch:number){
  const length=samplesFor(.11,rate),out=new Float32Array(length);
  const scuff=band(noise(length,rng),rate,floor.scuff[0]*pitch,floor.scuff[1]*pitch);
  for(let i=0;i<length;i++)scuff[i]*=envelope(i/rate,.0012,.016);
  mixInto(out,scuff,floor.scuffLevel*2.2,0,rate);
  if(floor.grit>0){const grit=band(noise(length,rng),rate,3000,9000,1);for(let i=0;i<length;i++)grit[i]*=envelope(i/rate,.0005,.006)*(rng.next()<.35?1:.3);mixInto(out,grit,floor.grit,0,rate);}
  mixInto(out,modal(length,rate,floor.modes,rng,.0006,pitch),floor.modeLevel,0,rate);
  mixInto(out,glideTone(length,rate,150*pitch,90*pitch,.01,.018),floor.thump*.5,0,rate);
  fadeEdges(out,rate,0,.02);
  return scale(out,strength);
}

/** Loudness of variant 0 per floor and sample rate. */
const STEP_REFERENCE=new Map<string,number>();
export function synthesizeFootstep(sampleRate:number,side:number,material:FootstepMaterial='concrete'){
  const rate=sampleRate,floor=FLOORS[material]??FLOORS.concrete,variant=((side%4)+4)%4;
  const rng=new Rng(0x71914+variant*907+material.length*131),out=new Float32Array(Math.round(rate*.14));
  const pitch=1+(variant-1.5)*.025+rng.range(-.01,.01),gap=.03+variant*.004+rng.range(0,.004);
  mixInto(out,contact(rate,rng,floor,1,pitch),1,0,rate);                 // heel
  mixInto(out,contact(rate,rng,floor,.62,pitch*1.08),1,gap,rate);        // toe
  biquad(out,rate,'highpass',110,.7);biquad(out,rate,'peaking',2200,.8,2.5);
  scale(out,floor.damp);fadeEdges(out,rate,.0003,.012);
  normalize([out],.52*floor.damp);
  // Steps carry distance information, so the four variants of one floor are
  // loudness-matched to variant 0 (peak normalisation left them up to 4 dB apart).
  const key=`${material}:${rate}`;
  if(variant===0){STEP_REFERENCE.set(key,windowRms([out],rate,.1));return out;}
  if(!STEP_REFERENCE.has(key))synthesizeFootstep(rate,0,material);
  return matchLoudness([out],rate,.1,STEP_REFERENCE.get(key)!,.62)[0];
}
