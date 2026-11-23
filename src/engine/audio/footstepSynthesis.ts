import type {FootstepMaterial} from '../footsteps/Footsteps';
// Original sole/ground transients, without sampled game audio. A short impact
// supports a wider shoe/surface band rather than masking it with a bass sine.
export function synthesizeFootstep(sampleRate:number,side:number,material:FootstepMaterial='concrete'){const samples=new Float32Array(Math.round(sampleRate*.14));let seed=0x71914+side*907,low=0,shoe=0;
 const lowRate=1-Math.exp(-2*Math.PI*220/sampleRate),shoeRate=1-Math.exp(-2*Math.PI*2600/sampleRate);
 for(let i=0;i<samples.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const t=i/sampleRate,noise=seed/4294967296*2-1;low+=lowRate*(noise-low);shoe+=shoeRate*(noise-shoe);
 const impact=Math.sin(2*Math.PI*(95+side*7)*t)*.14*Math.exp(-t*45),sole=(shoe-low)*1.25*Math.exp(-t*40),grit=(noise-shoe)*.12*Math.exp(-t*95);
 const surface=material==='steel'?(Math.sin(2*Math.PI*510*t)+.38*Math.sin(2*Math.PI*1275*t))*.16*Math.exp(-t*31):material==='tile'?(noise-shoe)*.11*Math.exp(-t*70)+Math.sin(2*Math.PI*730*t)*.085*Math.exp(-t*48):material==='wood'?(Math.sin(2*Math.PI*380*t)*.13+Math.sin(2*Math.PI*185*t)*.07)*Math.exp(-t*46):material==='glass'?Math.sin(2*Math.PI*1960*t)*.085*Math.exp(-t*52):material==='plastic'?Math.sin(2*Math.PI*610*t)*.12*Math.exp(-t*55):material==='rubber'?low*.3*Math.exp(-t*35):material==='fabric'?low*.12*Math.exp(-t*65):0;
 const damping=material==='rubber'?.66:material==='fabric'?.4:1;
 samples[i]=Math.tanh((impact+sole+grit)*damping+surface)*.65*Math.min(1,t/.0008);}return samples;
}
