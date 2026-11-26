// Dev-only: per-feature render cost. Open /dev/graphics-bench.html and call
// graphicsBench.run({patch, frames}). Each frame is forced to finish on the GPU
// (1-pixel readback), so the time includes rasterisation, not just submission.
import {Simulation} from '../engine/simulation/Simulation';
import {RangeRenderer} from '../engine/rendering/RangeRenderer';
import {DEFAULT_SETTINGS,GRAPHICS_PRESETS} from '../config/settings';
import {emptyInput,type Settings} from '../engine/types';
const host=document.getElementById('stage')!;
let renderer:RangeRenderer|null=null;
const median=(a:number[])=>{const s=a.slice().sort((x,y)=>x-y);return s[Math.floor(s.length/2)]??0;};
(window as unknown as {graphicsBench:unknown}).graphicsBench={
 async run({patch={},preset='low',frames=24,map='range'}:{patch?:Partial<Settings>;preset?:Settings['graphicsPreset'];frames?:number;map?:Settings['practiceMap']}){
  renderer?.dispose();renderer=null;
  const settings:Settings={...structuredClone(DEFAULT_SETTINGS),...GRAPHICS_PRESETS[preset],autoGraphics:false,practiceMap:map,targetCount:5,frameLimit:0,...patch};
  const sim=new Simulation('free','rifleA',settings);renderer=new RangeRenderer(host,sim,settings,{recordFrames:false});await renderer.prepare();sim.running=true;
  const gl=renderer.renderer.getContext(),pixel=new Uint8Array(4),times:number[]=[],cpu:number[]=[];
  for(let i=0;i<frames+4;i++){
   await new Promise(r=>requestAnimationFrame(r));sim.step(1/120,emptyInput());sim.step(1/120,emptyInput());
   const t0=performance.now();renderer.render(1,1/60,false,false);const t1=performance.now();gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);const t2=performance.now();
   if(i>=4){cpu.push(t1-t0);times.push(t2-t0);}
  }
  const info=renderer.renderer.info,r=renderer as unknown as {composer:{passes:unknown[]}|null;sun:{shadow:{mapSize:{x:number}}}};
  const size=renderer.renderer.getDrawingBufferSize(new (await import('three')).Vector2());
  return {frameMs:+median(times).toFixed(2),cpuMs:+median(cpu).toFixed(2),calls:info.render.calls,triangles:info.render.triangles,programs:info.programs?.length??0,passes:r.composer?.passes.length??0,shadowMap:renderer.renderer.shadowMap.enabled?r.sun.shadow.mapSize.x:0,buffer:[size.x,size.y]};
 }
};
