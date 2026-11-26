/** Offline DSP building blocks for the procedural sound set. Everything is
 * deterministic (seeded) and works on plain Float32Arrays so sounds can be
 * rendered once into AudioBuffers, in tests and in the offline renderer.
 * No recorded or third-party audio is used anywhere. */

/** PCM samples backed by a plain ArrayBuffer (what AudioBuffer.copyToChannel takes). */
export type Pcm=Float32Array<ArrayBuffer>;

export class Rng {
  private s:number;
  constructor(seed:number){this.s=(seed>>>0)||0x9e3779b9;}
  /** Uniform in [0,1). */
  next(){let x=this.s;x^=x<<13;x^=x>>>17;x^=x<<5;this.s=x>>>0;return this.s/4294967296;}
  /** Uniform in [-1,1). */
  signed(){return this.next()*2-1;}
  range(a:number,b:number){return a+(b-a)*this.next();}
}

export const samplesFor=(seconds:number,rate:number)=>Math.max(1,Math.ceil(seconds*rate));

export function noise(length:number,rng:Rng){const out=new Float32Array(length);for(let i=0;i<length;i++)out[i]=rng.signed();return out;}

export type FilterType='lowpass'|'highpass'|'bandpass'|'peaking'|'lowshelf'|'highshelf';
/** RBJ cookbook biquad, applied in place (direct form I). */
export function biquad(x:Pcm,rate:number,type:FilterType,freq:number,q=Math.SQRT1_2,gainDb=0){
  const f=Math.min(Math.max(freq,10),rate*.45),w=2*Math.PI*f/rate,cos=Math.cos(w),sin=Math.sin(w),alpha=sin/(2*q),A=Math.pow(10,gainDb/40);
  let b0=0,b1=0,b2=0,a0=1,a1=0,a2=0;
  switch(type){
    case 'lowpass':b0=(1-cos)/2;b1=1-cos;b2=(1-cos)/2;a0=1+alpha;a1=-2*cos;a2=1-alpha;break;
    case 'highpass':b0=(1+cos)/2;b1=-(1+cos);b2=(1+cos)/2;a0=1+alpha;a1=-2*cos;a2=1-alpha;break;
    case 'bandpass':b0=alpha;b1=0;b2=-alpha;a0=1+alpha;a1=-2*cos;a2=1-alpha;break;
    case 'peaking':b0=1+alpha*A;b1=-2*cos;b2=1-alpha*A;a0=1+alpha/A;a1=-2*cos;a2=1-alpha/A;break;
    case 'lowshelf':{const s=2*Math.sqrt(A)*alpha;b0=A*((A+1)-(A-1)*cos+s);b1=2*A*((A-1)-(A+1)*cos);b2=A*((A+1)-(A-1)*cos-s);a0=(A+1)+(A-1)*cos+s;a1=-2*((A-1)+(A+1)*cos);a2=(A+1)+(A-1)*cos-s;break;}
    case 'highshelf':{const s=2*Math.sqrt(A)*alpha;b0=A*((A+1)+(A-1)*cos+s);b1=-2*A*((A-1)+(A+1)*cos);b2=A*((A+1)+(A-1)*cos-s);a0=(A+1)-(A-1)*cos+s;a1=2*((A-1)-(A+1)*cos);a2=(A+1)-(A-1)*cos-s;break;}
  }
  b0/=a0;b1/=a0;b2/=a0;a1/=a0;a2/=a0;
  let x1=0,x2=0,y1=0,y2=0;
  for(let i=0;i<x.length;i++){const xi=x[i],y=b0*xi+b1*x1+b2*x2-a1*y1-a2*y2;x2=x1;x1=xi;y2=y1;y1=y;x[i]=y;}
  return x;
}
/** Band-limited noise: high-pass then low-pass (two poles each, run twice for 24 dB/oct). */
export function band(x:Pcm,rate:number,lo:number,hi:number,order=2){
  for(let k=0;k<order;k++){if(lo>0)biquad(x,rate,'highpass',lo);if(hi<rate/2)biquad(x,rate,'lowpass',hi);}
  return x;
}
/** One-pole low-pass whose cutoff follows a function of time (seconds). */
export function sweepLowpass(x:Pcm,rate:number,cutoff:(t:number)=>number){
  let y=0;for(let i=0;i<x.length;i++){const c=Math.min(rate*.45,Math.max(20,cutoff(i/rate))),a=1-Math.exp(-2*Math.PI*c/rate);y+=a*(x[i]-y);x[i]=y;}return x;
}

/** Attack ramp (raised cosine) then exponential decay with time constant tau. */
export function envelope(t:number,attack:number,tau:number){
  if(t<0)return 0;
  const a=attack>0&&t<attack?.5-.5*Math.cos(Math.PI*t/attack):1;
  return a*Math.exp(-Math.max(0,t-attack)/Math.max(1e-4,tau));
}
export function applyEnvelope(x:Pcm,rate:number,attack:number,tau:number,offset=0){
  for(let i=0;i<x.length;i++)x[i]*=envelope(i/rate-offset,attack,tau);return x;
}

/** Sine with an exponential pitch glide f0 -> f1 (time constant glideTau)
 * and exponential amplitude decay; a punch/sub layer. */
export function glideTone(length:number,rate:number,f0:number,f1:number,glideTau:number,decayTau:number,attack=.0008){
  const out=new Float32Array(length);let phase=0;
  for(let i=0;i<length;i++){const t=i/rate,f=f1+(f0-f1)*Math.exp(-t/glideTau);phase+=2*Math.PI*f/rate;out[i]=Math.sin(phase)*envelope(t,attack,decayTau);}
  return out;
}

export interface Mode {freq:number;decay:number;amp:number;}
/** Sum of exponentially damped sinusoids: struck metal, wood or polymer. */
export function modal(length:number,rate:number,modes:readonly Mode[],rng:Rng,attack=.0003,pitch=1){
  const out=new Float32Array(length);
  for(const m of modes){const f=m.freq*pitch;if(f>=rate*.45)continue;const phase=rng.next()*Math.PI*2,w=2*Math.PI*f/rate;
    for(let i=0;i<length;i++){const t=i/rate;out[i]+=m.amp*Math.sin(w*i+phase)*envelope(t,attack,m.decay);}}
  // Resonances may still ring when the buffer ends; never stop them with a click.
  const fade=Math.min(length>>1,Math.max(1,Math.round(length*.15)));
  for(let i=0;i<fade;i++)out[length-1-i]*=.5-.5*Math.cos(Math.PI*i/fade);
  return out;
}

export function mixInto(target:Pcm,source:Pcm,gain=1,offsetSeconds=0,rate=48000){
  const offset=Math.round(offsetSeconds*rate);
  for(let i=0;i<source.length;i++){const j=i+offset;if(j>=0&&j<target.length)target[j]+=source[i]*gain;}
  return target;
}
/** tanh saturation normalised so a full-scale input stays full scale. */
export function saturate(x:Pcm,drive:number){if(drive<=0)return x;const n=Math.tanh(drive);for(let i=0;i<x.length;i++)x[i]=Math.tanh(x[i]*drive)/n;return x;}
export function scale(x:Pcm,g:number){for(let i=0;i<x.length;i++)x[i]*=g;return x;}
export function peakOf(channels:readonly Pcm[]){let p=0;for(const c of channels)for(let i=0;i<c.length;i++){const a=Math.abs(c[i]);if(a>p)p=a;}return p;}
/** Scale a single signal to unit peak. */
export function unit(x:Pcm){const p=peakOf([x]);return p>1e-9?scale(x,1/p):x;}
export function normalize(channels:Pcm[],peak:number){const p=peakOf(channels);if(p>1e-9)for(const c of channels)scale(c,peak/p);return channels;}
/** Short raised-cosine fades so no buffer starts or ends with a click. */
export function fadeEdges(x:Pcm,rate:number,inSeconds=.0004,outSeconds=.01){
  const a=Math.min(x.length>>1,Math.round(inSeconds*rate)),b=Math.min(x.length>>1,Math.round(outSeconds*rate));
  for(let i=0;i<a;i++)x[i]*=.5-.5*Math.cos(Math.PI*i/a);
  for(let i=0;i<b;i++)x[x.length-1-i]*=.5-.5*Math.cos(Math.PI*i/b);
  return x;
}
export function toMono(channels:readonly Pcm[]){if(channels.length===1)return channels[0];const out=new Float32Array(channels[0].length);for(const c of channels)for(let i=0;i<out.length;i++)out[i]+=c[i]/channels.length;return out;}

export interface SpaceSpec {seconds:number;rt60:number;predelay:number;damping:number;early:readonly (readonly [number,number])[];seed:number;}
/** Stereo impulse response for a ConvolverNode: discrete early reflections
 * then decorrelated noise with a 60 dB decay of `rt60` seconds whose high
 * frequencies die faster (`damping` = cutoff drop per second). */
export function impulseResponse(rate:number,spec:SpaceSpec):[Pcm,Pcm]{
  const length=samplesFor(spec.seconds,rate),out:[Pcm,Pcm]=[new Float32Array(length),new Float32Array(length)];
  out.forEach((channel,c)=>{
    const rng=new Rng(spec.seed+c*7919),tail=noise(length,rng);
    for(let i=0;i<length;i++){const t=i/rate-spec.predelay;tail[i]*=t<0?0:Math.exp(-6.91*t/spec.rt60)*Math.min(1,t/.012);}
    sweepLowpass(tail,rate,t=>Math.max(900,11000-spec.damping*t));
    for(let i=0;i<length;i++)channel[i]=tail[i]*.55;
    for(const [time,gain] of spec.early){const j=Math.round((time+(c?.0013:0))*rate);if(j<length)channel[j]+=gain*(c?-.9:1);}
  });
  return normalize(out,.6) as [Pcm,Pcm];
}
