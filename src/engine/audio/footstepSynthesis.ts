// Independent original shoe/ground transient. No sampled or redistributed game audio.
export function synthesizeFootstep(sampleRate:number,side:number){const samples=new Float32Array(Math.round(sampleRate*.14));let seed=0x71914+side*907,low=0;
 for(let i=0;i<samples.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const t=i/sampleRate,noise=seed/4294967296*2-1;low+=.12*(noise-low);samples[i]=Math.tanh((low*.9+Math.sin(2*Math.PI*(95+side*7)*t)*.45)*Math.exp(-t*33))*.65;}return samples;
}
