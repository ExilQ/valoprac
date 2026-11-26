import type { GunId } from '../types';
import type { AudioAction } from '../../config/audio';
import {Rng,unit,band,biquad,envelope,fadeEdges,glideTone,mixInto,modal,noise,normalize,samplesFor,saturate,scale,sweepLowpass,toMono,type Mode} from './dsp';
import type {Pcm} from './dsp';

/* Independently synthesized weapon audio (12.24). Each shot is built the way
 * game weapon sounds are layered: mechanism click, muzzle crack, mid body,
 * low punch with a falling pitch, and a short dry tail. The room tail comes
 * from the runtime's convolution reverb so every map can colour it. Four
 * round-robin variants per shot avoid the machine-gun repetition of a single
 * buffer. Nothing is sampled from, or matched to, recordings of any game. */

export type Perspective='first'|'third';
export const FIRE_VARIANTS=4;

interface GunRecipe {
  seconds:number;seed:number;drive:number;width:number;
  mech:{modes:readonly Mode[];level:number};
  crack:{lo:number;hi:number;decay:number;level:number};
  body:{freq:number;q:number;decay:number;level:number};
  punch:{f0:number;f1:number;glide:number;decay:number;level:number};
  ring?:{modes:readonly Mode[];level:number};
  tail:{decay:number;level:number;cutoff:number};
}

const m=(freq:number,decayMs:number,amp:number):Mode=>({freq,decay:decayMs/1000,amp});
export const GUN_RECIPES:Readonly<Record<GunId,GunRecipe>>={
  // Full-power rifle: hard crack, a wide mid blast and a tight low punch.
  rifleA:{seconds:.62,seed:2303,drive:1.4,width:.55,
    mech:{modes:[m(2300,18,.5),m(3650,12,.35),m(5200,8,.25)],level:.3},
    crack:{lo:1700,hi:9500,decay:.02,level:1},body:{freq:720,q:.55,decay:.075,level:1},
    punch:{f0:150,f1:55,glide:.02,decay:.06,level:.62},tail:{decay:.22,level:.3,cutoff:2800}},
  // Suppressed rifle: little crack, a soft "pfft" of air and a prominent bolt clack.
  rifleB:{seconds:.44,seed:2606,drive:1.15,width:.45,
    mech:{modes:[m(2600,15,.55),m(4100,10,.35),m(1500,26,.32)],level:.62},
    crack:{lo:3200,hi:12000,decay:.009,level:.38},body:{freq:1050,q:.75,decay:.045,level:1},
    punch:{f0:125,f1:60,glide:.016,decay:.04,level:.42},tail:{decay:.12,level:.18,cutoff:2100}},
  // Heavy revolver: big blast, longer punch and a ringing frame.
  sheriff:{seconds:1.15,seed:101,drive:1.6,width:.6,
    mech:{modes:[m(1900,26,.6),m(3150,15,.4)],level:.32},
    crack:{lo:1500,hi:10500,decay:.026,level:1},body:{freq:520,q:.55,decay:.12,level:1},
    punch:{f0:160,f1:48,glide:.026,decay:.09,level:.68},
    ring:{modes:[m(1150,150,.12),m(2330,110,.08),m(3470,80,.05)],level:.2},tail:{decay:.42,level:.36,cutoff:3200}},
  // Bolt-action sniper: massive low boom and a long rolling tail.
  operator:{seconds:1.8,seed:9017,drive:1.6,width:.65,
    mech:{modes:[m(1700,30,.5),m(2850,20,.35)],level:.26},
    crack:{lo:1200,hi:9000,decay:.034,level:1},body:{freq:480,q:.5,decay:.2,level:1.15},
    punch:{f0:115,f1:36,glide:.04,decay:.15,level:.76},tail:{decay:.7,level:.45,cutoff:2400}},
};

/** One gunshot. First person: stereo, with the mechanism up close. Third
 * person (other shooters): mono for the 3D panner, no mechanism, darker. */
export function synthesizeShot(weapon:GunId,rate:number,variant=0,perspective:Perspective='first'):Pcm[]{
  const r=GUN_RECIPES[weapon],rng=new Rng(r.seed+variant*7919+(perspective==='third'?31:0)),length=samplesFor(r.seconds,rate);
  const pitch=1+rng.range(-.025,.025),level=1+rng.range(-.08,.08),mechDelay=rng.range(0,.0015);
  // Common layers (identical in both ears): the transient must stay centred.
  const common=new Float32Array(length);
  // Every layer is normalised to unit peak first, so the recipe levels are
  // true relative levels regardless of how much filtering removed.
  if(perspective==='first')mixInto(common,unit(modal(samplesFor(.06,rate),rate,r.mech.modes,rng,.0002,pitch)),r.mech.level,mechDelay,rate);
  const crack=band(noise(samplesFor(r.crack.decay*6,rate),rng),rate,r.crack.lo*pitch,r.crack.hi*(perspective==='third'?.6:1));
  for(let i=0;i<crack.length;i++)crack[i]*=envelope(i/rate,.0002,r.crack.decay);
  mixInto(common,unit(crack),r.crack.level*(perspective==='third'?.7:1),.0015,rate);
  const punch=glideTone(length,rate,r.punch.f0*pitch,r.punch.f1*pitch,r.punch.glide,r.punch.decay);
  const thump=biquad(noise(length,rng),rate,'lowpass',180,.9);for(let i=0;i<length;i++)thump[i]*=envelope(i/rate,.001,r.punch.decay*.6);
  mixInto(common,punch,r.punch.level,.0015,rate);mixInto(common,unit(thump),r.punch.level*.5,.0015,rate);
  if(r.ring)mixInto(common,unit(modal(length,rate,r.ring.modes,rng,.001,pitch)),r.ring.level,.002,rate);
  // Body and tail are decorrelated per ear for width.
  const channels=perspective==='first'?2:1,out:Pcm[]=[],shared=new Float32Array(length);
  for(let c=0;c<channels;c++){
    const ear=new Rng(r.seed*13+variant*101+c*7),side=new Float32Array(length);
    const body=biquad(noise(length,ear),rate,'bandpass',r.body.freq*pitch,r.body.q);for(let i=0;i<length;i++)body[i]*=envelope(i/rate,.0015,r.body.decay);
    biquad(body,rate,'peaking',r.body.freq*2.1*pitch,1,4);biquad(body,rate,'lowpass',5200,.7);
    mixInto(side,unit(body),r.body.level,.0015,rate);
    const tail=noise(length,ear);for(let i=0;i<length;i++)tail[i]*=envelope(i/rate,.012,r.tail.decay);
    band(tail,rate,120,r.tail.cutoff,1);sweepLowpass(tail,rate,t=>r.tail.cutoff*Math.exp(-t*3)+220);sweepLowpass(tail,rate,t=>r.tail.cutoff*Math.exp(-t*3)+220);
    mixInto(side,unit(tail),r.tail.level*(perspective==='third'?1.4:1),.004,rate);
    // Each ear gets its own body/tail noise; `width` sets how much of it is
    // ear-specific versus shared, so the transient and punch stay centred.
    const ch=new Float32Array(length),own=channels===2?r.width:0;
    for(let i=0;i<length;i++)ch[i]=common[i]+side[i]*(1-own)+side[i]*own;
    if(c===0)shared.set(side);else for(let i=0;i<length;i++)ch[i]=common[i]+shared[i]*(1-own)+side[i]*own;
    if(perspective==='third')biquad(ch,rate,'lowpass',7500,.7);
    biquad(ch,rate,'highpass',28,.7);
    out.push(ch);
  }
  for(const ch of out){saturate(ch,r.drive);fadeEdges(ch,rate,.0002,.04);}
  normalize(out,.89*level);
  return out;
}

/* ---------- handling foley ---------- */
const click=(rate:number,rng:Rng,freqs:readonly number[],decayMs=10,level=1)=>{
  const out=modal(samplesFor(decayMs/1000*6,rate),rate,freqs.map((f,i)=>m(f*rng.range(.97,1.03),decayMs*(1-i*.15),1/(i+1))),rng,.0002);
  const tick=band(noise(samplesFor(.006,rate),rng),rate,2500,9000);for(let i=0;i<tick.length;i++)tick[i]*=envelope(i/rate,.0001,.0012);
  mixInto(out,unit(tick),.45,0,rate);return scale(unit(out),level*.7);
};
/** Metal-on-polymer seat: magazine in, cylinder closed, bolt locked. */
const clack=(rate:number,rng:Rng,low:number,level=1)=>{
  const out=modal(samplesFor(.12,rate),rate,[m(low,28,.9),m(low*2.37,18,.55),m(low*4.1,12,.35),m(low*6.8,7,.2)],rng,.0003);
  const knock=biquad(noise(out.length,rng),rate,'bandpass',low*1.6,1.1);for(let i=0;i<knock.length;i++)knock[i]*=envelope(i/rate,.0003,.012);
  mixInto(out,unit(knock),.9,0,rate);return scale(unit(out),level);
};
/** Friction: magazine or slide travelling against metal. */
const slide=(rate:number,rng:Rng,seconds:number,from:number,to:number,level=1)=>{
  const out=band(noise(samplesFor(seconds,rate),rng),rate,350,3800);
  sweepLowpass(out,rate,t=>from+(to-from)*Math.min(1,t/seconds));
  biquad(out,rate,'peaking',(from+to)/4,1.2,5);
  for(let i=0;i<out.length;i++){const x=i/out.length;out[i]*=Math.sin(Math.PI*x)**1.5*(1+.35*Math.sin(i/rate*2*Math.PI*38));}
  return scale(unit(out),level*.55);
};
/** Cloth and grip movement under every equip and reload. */
const cloth=(rate:number,rng:Rng,seconds:number,level=1)=>{
  const out=band(noise(samplesFor(seconds,rate),rng),rate,200,2400);
  for(let i=0;i<out.length;i++){const x=i/out.length;out[i]*=Math.sin(Math.PI*x)**2;}
  return scale(unit(out),level*.4);
};

type Cue=readonly [time:number,make:(rate:number,rng:Rng)=>Pcm,gain:number];
function foley(rate:number,seconds:number,seed:number,cues:readonly Cue[],peak=.72){
  const out=new Float32Array(samplesFor(seconds,rate)),rng=new Rng(seed);
  for(const [time,make,gain] of cues)mixInto(out,make(rate,rng),gain,time,rate);
  biquad(out,rate,'highpass',70);fadeEdges(out,rate,.0005,.02);
  return normalize([out],peak)[0];
}

const RIFLE_RELOAD=(rate:number,seed:number,seconds:number,low:number):Pcm=>foley(rate,seconds,seed,([
  [.02,(r,g)=>cloth(r,g,.3,.5),1],
  [.4,(r,g)=>click(r,g,[3100,5200,7400],7),.55],         // magazine release
  [.46,(r,g)=>slide(r,g,.16,5000,1500),.45],             // magazine out
  [.56,(r,g)=>clack(r,g,low*1.4,.35),.5],                // empty magazine knocks free
  [1.25,(r,g)=>slide(r,g,.14,1800,5200),.4],             // new magazine slides in
  [1.4,(r,g)=>clack(r,g,low,1),1],                       // and seats
  [1.95,(r,g)=>slide(r,g,.1,2500,6000),.5],              // charging handle back
  [2.06,(r,g)=>click(r,g,[2400,3900,6100],12),.6],
  [2.12,(r,g)=>clack(r,g,low*1.8,.9),.85],               // released forward
] as Cue[]).map(([t,f,g])=>[Math.min(t as number,seconds-.15),f,g] as Cue));

const SIDEARM_RELOAD=(rate:number,seconds:number):Pcm=>foley(rate,seconds,515,[
  [.02,(r,g)=>cloth(r,g,.25,.45),1],
  [.12,(r,g)=>click(r,g,[2700,4400],9),.6],              // cylinder release
  [.2,(r,g)=>slide(r,g,.12,3000,1200),.4],               // cylinder swings out
  ...[0,1,2,3,4,5].map(k=>[.55+k*.035,(r:number,g:Rng)=>click(r,g,[4200+k*130,6900+k*90],22,.6),.5] as Cue), // spent cases
  [1.25,(r,g)=>slide(r,g,.1,1500,4500),.35],             // fresh rounds in
  [1.4,(r,g)=>clack(r,g,520,.6),.6],
  [1.9,(r,g)=>clack(r,g,640,1),1],                       // cylinder snaps shut
  [1.96,(r,g)=>click(r,g,[3300,5600],8),.5],
]);

const BOLT_CYCLE=(rate:number,seconds:number,seed:number):Pcm=>foley(rate,seconds,seed,([
  [.2,(r,g)=>click(r,g,[1900,3300,5100],16),.8],         // bolt handle lifts
  [.28,(r,g)=>slide(r,g,.17,2200,5200),.6],              // pulled back
  [.48,(r,g)=>clack(r,g,560,.55),.55],                   // case ejected, bolt stops
  [.95,(r,g)=>slide(r,g,.15,5200,2200),.55],             // pushed forward
  [1.12,(r,g)=>clack(r,g,480,1),1],                      // locked down
] as Cue[]).map(([t,f,g])=>[Math.min((t as number)*seconds/1.5,seconds-.12),f,g] as Cue));

const EQUIP=(rate:number,weapon:GunId):Pcm=>{
  const seconds=weapon==='operator'?.65:.32,low=weapon==='sheriff'?700:weapon==='operator'?430:520;
  return foley(rate,seconds,weapon.length*977,[
    [0,(r,g)=>cloth(r,g,seconds*.7,.7),1],
    [seconds*.42,(r,g)=>clack(r,g,low,.8),.75],
    [seconds*.42+.03,(r,g)=>click(r,g,[3000,5100],9),.4],
  ],.6);
};

/** Scope in/out: a short lens "fwip" and a detent click. */
const SCOPE=(rate:number):Pcm=>foley(rate,.18,733,[
  [0,(r,g)=>{const o=band(noise(samplesFor(.07,r),g),r,1200,5500);for(let i=0;i<o.length;i++)o[i]*=Math.sin(Math.PI*i/o.length)**2;return scale(o,1.4);},.8],
  [.05,(r,g)=>click(r,g,[2800,4700],7),.7],
],.5);

/** Mono reference signal for every weapon/action (tests, the Unreal export
 * and the custom-asset fallback); the runtime plays the stereo/variant forms. */
export function synthesize(weapon:GunId,action:AudioAction,rate:number):Pcm{
  return toMono(synthesizeAction(weapon,action,rate));
}
export function synthesizeAction(weapon:GunId,action:AudioAction,rate:number,variant=0):Pcm[]{
  switch(action){
    case 'fire':return synthesizeShot(weapon,rate,variant,'first');
    case 'reload':return [weapon==='sheriff'?SIDEARM_RELOAD(rate,2.25):RIFLE_RELOAD(rate,weapon.length*311+7,weapon==='operator'?3.7:2.5,weapon==='rifleB'?470:weapon==='operator'?400:520)];
    case 'bolt':return [BOLT_CYCLE(rate,1.5,weapon.length*53)];
    case 'equip':return [EQUIP(rate,weapon)];
    case 'scope':return [SCOPE(rate)];
    case 'elimination':return [synthesizeFeedback('headshot',rate)];
  }
}

/* ---------- hit and kill feedback ---------- */
export type FeedbackSound='headshot'|'body'|'kill';
/** Headshot: a bright, short metallic "dink" readable over gunfire.
 * Body hit: a dull, muffled thwack. Kill: a clean two-note confirm. */
export function synthesizeFeedback(kind:FeedbackSound,rate:number,step=0):Pcm{
  const rng=new Rng(kind==='headshot'?4410:kind==='body'?2205:8820);
  if(kind==='headshot'){
    const out=modal(samplesFor(.2,rate),rate,[m(2960,55,1),m(3075,48,.45),m(4410,38,.62),m(6230,26,.4),m(8120,16,.22)],rng,.0002);
    const tick=band(noise(samplesFor(.01,rate),rng),rate,3000,12000);for(let i=0;i<tick.length;i++)tick[i]*=envelope(i/rate,.0001,.0015);
    mixInto(out,tick,1.2,0,rate);
    const thud=glideTone(samplesFor(.08,rate),rate,260,140,.02,.025);mixInto(out,thud,.35,0,rate);
    fadeEdges(out,rate,.0002,.02);return normalize([out],.7)[0];
  }
  if(kind==='body'){
    const out=biquad(noise(samplesFor(.12,rate),rng),rate,'bandpass',900,.9);for(let i=0;i<out.length;i++)out[i]*=envelope(i/rate,.0008,.018);
    scale(out,3);mixInto(out,glideTone(out.length,rate,190,95,.02,.035),.9,0,rate);
    biquad(out,rate,'lowpass',3200,.7);fadeEdges(out,rate,.0003,.02);return normalize([out],.55)[0];
  }
  // Kill confirm rises a whole tone per consecutive kill (up to four steps).
  const ratio=Math.pow(2,Math.min(4,Math.max(0,step))*2/12),out=new Float32Array(samplesFor(.34,rate));
  for(const [time,f] of [[0,880],[.075,1318.5]] as const){
    const tone=modal(samplesFor(.26,rate),rate,[m(f*ratio,70,1),m(f*ratio*2,40,.25),m(f*ratio*3.01,22,.08)],rng,.003);
    mixInto(out,tone,time?1:.8,time,rate);
  }
  fadeEdges(out,rate,.0005,.03);return normalize([out],.5)[0];
}
