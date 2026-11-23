import {SURFACES,type SurfaceId,type BulletImpactProfile} from '../../config/surfaces';
/** Original short impact synthesis. No game recordings or proprietary samples. */
export function synthesizeMaterialImpact(material:SurfaceId,sampleRate:number,exit=false):Float32Array<ArrayBuffer>{
 return synthesizeImpactProfile(SURFACES[material].bulletImpactProfile,sampleRate,exit);
}
export function synthesizeImpactProfile(kind:BulletImpactProfile,sampleRate:number,exit=false):Float32Array<ArrayBuffer>{
 const duration=kind==='metal'?.15:kind==='glass'?.11:.085;
 const data=new Float32Array(Math.ceil(sampleRate*duration));let seed=0x53f19+(exit?113:0);
 for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=seed/2147483648-1,t=i/sampleRate,envelope=Math.exp(-t*(kind==='metal'?38:65));
  const tone=kind==='metal'?Math.sin(t*2*Math.PI*2180)*.32+Math.sin(t*2*Math.PI*3470)*.13:kind==='wood'?Math.sin(t*2*Math.PI*310)*.28:kind==='glass'?Math.sin(t*2*Math.PI*4800)*.2:Math.sin(t*2*Math.PI*165)*.2;
  data[i]=(noise*(kind==='glass'?.55:.35)+tone)*envelope*(exit?.5:.7);
 }return data;
}
