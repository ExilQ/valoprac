import type {FootstepMaterial} from '../footsteps/Footsteps';
// Independent original shoe/ground transients. No sampled game audio. Concrete
// retains the existing waveform; other surfaces add restrained resonances.
export function synthesizeFootstep(sampleRate:number,side:number,material:FootstepMaterial='concrete'){const samples=new Float32Array(Math.round(sampleRate*.14));let seed=0x71914+side*907,low=0;
 for(let i=0;i<samples.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const t=i/sampleRate,noise=seed/4294967296*2-1;low+=.12*(noise-low);const base=(low*.9+Math.sin(2*Math.PI*(95+side*7)*t)*.45)*Math.exp(-t*33);
 const surface=material==='steel'?(Math.sin(2*Math.PI*510*t)+.38*Math.sin(2*Math.PI*1275*t))*.16*Math.exp(-t*31):material==='tile'?(noise-low)*.11*Math.exp(-t*70)+Math.sin(2*Math.PI*730*t)*.085*Math.exp(-t*48):material==='wood'?Math.sin(2*Math.PI*185*t)*.2*Math.exp(-t*46):0;
 samples[i]=Math.tanh(base+surface)*.65;}return samples;
}
