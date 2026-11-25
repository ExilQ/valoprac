/** Original procedural knife sounds: an air swish for each attack, a short
 * blade impact, and a sheath draw for the equip. Deterministic noise keeps
 * the samples identical between sessions. No recorded game audio is used. */
export type KnifeSound='slash'|'stab'|'hit'|'wall'|'equip';

function noise(seed:number){let x=seed>>>0||1;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return((x>>>0)/4294967295)*2-1;};}

export function synthesizeKnife(sound:KnifeSound,sampleRate:number):Float32Array{
  const seconds=sound==='equip'?.34:sound==='stab'?.24:sound==='slash'?.28:.16;
  const n=Math.max(1,Math.round(seconds*sampleRate)),out=new Float32Array(n),rand=noise(sound.length*7919+n);
  // One-pole band pass whose centre sweeps over the sound (air moving past an edge).
  let low=0,band=0;
  for(let i=0;i<n;i++){
    const t=i/sampleRate,p=i/n,white=rand();
    if(sound==='slash'||sound==='stab'){
      const sweep=sound==='slash'?900+3600*Math.sin(Math.PI*Math.min(1,p*1.1)):1400+2600*p;
      const f=Math.min(.95,2*Math.sin(Math.PI*sweep/sampleRate));
      low+=f*band;const high=white-low-.55*band;band+=f*high;
      const env=sound==='slash'?Math.sin(Math.PI*Math.min(1,p*1.15))**2:Math.exp(-((p-.32)**2)/.018);
      out[i]=band*env*.55;
    }else if(sound==='hit'){
      // Dull body thump with a soft cloth/leather tick on top.
      const thump=Math.sin(2*Math.PI*(120-60*p)*t)*Math.exp(-t*38),tick=white*Math.exp(-t*170)*.45;
      out[i]=(thump*.8+tick)*.7;
    }else if(sound==='wall'){
      // Steel on hard surface: bright inharmonic ring that dies quickly.
      const ring=Math.sin(2*Math.PI*2730*t)*.5+Math.sin(2*Math.PI*4190*t)*.32+Math.sin(2*Math.PI*6150*t)*.18;
      out[i]=(ring*Math.exp(-t*42)+white*Math.exp(-t*260)*.6)*.5;
    }else{
      // Sheath draw: rising scrape, then a light metallic ring.
      const f=Math.min(.95,2*Math.sin(Math.PI*(2400+3000*p)/sampleRate));
      low+=f*band;const high=white-low-.4*band;band+=f*high;
      const scrape=band*Math.sin(Math.PI*Math.min(1,p/.7))*.35,ringStart=.62*seconds;
      const ring=t>ringStart?Math.sin(2*Math.PI*3320*(t-ringStart))*Math.exp(-(t-ringStart)*28)*.25:0;
      out[i]=scrape+ring;
    }
  }
  // Short fades avoid clicks at both ends.
  const fade=Math.min(n>>1,Math.round(sampleRate*.004));
  for(let i=0;i<fade;i++){const g=i/fade;out[i]*=g;out[n-1-i]*=g;}
  return out;
}
