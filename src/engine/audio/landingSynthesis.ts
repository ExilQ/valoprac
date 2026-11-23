import type {FootstepMaterial} from '../footsteps/Footsteps';
/** Independently synthesized two-foot impact with a short cloth/sole tail.
 * No game recording or existing walking waveform is sampled or altered. */
export function synthesizeLanding(sampleRate:number,material:FootstepMaterial='concrete'){
 const samples=new Float32Array(Math.round(sampleRate*.23));let seed=0x5811ab,low=0;
 for(let i=0;i<samples.length;i++){
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;const t=i/sampleRate,noise=seed/4294967296*2-1;
  low+=.075*(noise-low);const body=Math.sin(2*Math.PI*(72*t-22*t*t))*.5*Math.exp(-t*23);
  const sole=low*.95*Math.exp(-t*31)+(noise-low)*.09*Math.exp(-t*75);
  const surface=material==='steel'?(Math.sin(2*Math.PI*380*t)+.3*Math.sin(2*Math.PI*1040*t))*.12*Math.exp(-t*25)
   :material==='tile'?Math.sin(2*Math.PI*870*t)*.09*Math.exp(-t*48)
   :material==='wood'?Math.sin(2*Math.PI*148*t)*.22*Math.exp(-t*28)
   :material==='glass'?Math.sin(2*Math.PI*1630*t)*.1*Math.exp(-t*43)
   :material==='plastic'?Math.sin(2*Math.PI*470*t)*.16*Math.exp(-t*38)
   :material==='rubber'?low*.32*Math.exp(-t*33)
   :material==='fabric'?low*.12*Math.exp(-t*60):0;
  const damping=material==='rubber'?.66:material==='fabric'?.4:1;
  const attack=Math.min(1,t/.002);samples[i]=Math.tanh((body+sole)*damping+surface)*.75*attack;
 }
 return samples;
}
