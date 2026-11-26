import {SURFACES,type SurfaceId,type BulletImpactProfile} from '../../config/surfaces';
import {Rng,band,biquad,envelope,fadeEdges,glideTone,mixInto,modal,noise,normalize,samplesFor} from './dsp';
/** Original bullet impacts (12.24), no recordings: masonry cracks and sheds
 * grit, metal rings with an inharmonic ricochet ping, wood knocks and
 * splinters, glass cracks and tinkles. Exit wounds are quieter and duller. */
export function synthesizeMaterialImpact(material:SurfaceId,sampleRate:number,exit=false):Float32Array<ArrayBuffer>{
 return synthesizeImpactProfile(SURFACES[material].bulletImpactProfile,sampleRate,exit);
}
export function synthesizeImpactProfile(kind:BulletImpactProfile,sampleRate:number,exit=false):Float32Array<ArrayBuffer>{
 const rate=sampleRate,seconds=kind==='metal'?.24:kind==='glass'?.25:kind==='wood'?.16:.2,rng=new Rng(0x53f19+(exit?113:0)+kind.length*97);
 const out=new Float32Array(samplesFor(seconds,rate)) as Float32Array<ArrayBuffer>;
 const crack=band(noise(samplesFor(.03,rate),rng),rate,kind==='wood'?700:1400,kind==='glass'?14000:9000);for(let i=0;i<crack.length;i++)crack[i]*=envelope(i/rate,.0001,.004);
 mixInto(out,crack,1.6,0,rate);
 if(kind==='masonry'){
  mixInto(out,glideTone(out.length,rate,210,120,.01,.02),.5,0,rate);
  // Falling grit: short, sparse grains that thin out and fade.
  for(let k=0;k<16;k++){const t=.004+Math.pow(rng.next(),1.6)*.16,grain=band(noise(samplesFor(.006,rate),rng),rate,1500,6500);for(let i=0;i<grain.length;i++)grain[i]*=envelope(i/rate,.0003,.0012);mixInto(out,grain,.55*Math.exp(-t*14),t,rate);}
 }else if(kind==='metal'){
  const pitch=rng.range(.96,1.04),ping=modal(out.length,rate,[{freq:2140*pitch,decay:.085,amp:1},{freq:3470*pitch,decay:.06,amp:.6},{freq:5610*pitch,decay:.04,amp:.35},{freq:8220*pitch,decay:.022,amp:.2}],rng,.0002);
  mixInto(out,ping,.75,.001,rate);
 }else if(kind==='wood'){
  const knock=biquad(noise(out.length,rng),rate,'bandpass',520,2.2);for(let i=0;i<knock.length;i++)knock[i]*=envelope(i/rate,.0005,.03);
  mixInto(out,knock,3,0,rate);mixInto(out,modal(out.length,rate,[{freq:230,decay:.05,amp:1},{freq:610,decay:.03,amp:.5}],rng),.6,0,rate);
  for(let k=0;k<5;k++)mixInto(out,band(noise(samplesFor(.004,rate),rng),rate,2000,8000,1),.5,.008+k*.011+rng.range(0,.006),rate);
 }else{
  for(let k=0;k<14;k++){const t=rng.range(.004,.16);mixInto(out,modal(samplesFor(.08,rate),rate,[{freq:rng.range(3200,9500),decay:rng.range(.01,.035),amp:1}],rng),.25*(1-t/.2),t,rate);}
  const shards=band(noise(out.length,rng),rate,4000,14000,1);for(let i=0;i<shards.length;i++)shards[i]*=envelope(i/rate,.001,.04);mixInto(out,shards,.6,.002,rate);
 }
 if(exit)biquad(out,rate,'lowpass',3500,.7);
 biquad(out,rate,'highpass',90,.7);fadeEdges(out,rate,.0002,.015);
 return normalize([out],exit?.4:.56)[0] as Float32Array<ArrayBuffer>;
}
