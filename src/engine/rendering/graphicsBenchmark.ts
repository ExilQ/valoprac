import {Simulation} from '../simulation/Simulation';
import {RangeRenderer} from './RangeRenderer';
import {GRAPHICS_PRESETS} from '../../config/settings';
import {renderPixelRatio} from '../../config/graphicsPolicy';
import {emptyInput,type Quality,type Settings} from '../types';
import type {GraphicsCapabilities} from './GraphicsCapabilities';

/** One preset measured on this computer. Each frame waits for the GPU to
 * finish (a one-pixel readback), so times include rasterisation and are a
 * little pessimistic: in play the CPU and GPU overlap. */
export interface PresetMeasurement {preset:Quality;medianMs:number;p90Ms:number;fps:number;completed:boolean;}
export interface GraphicsBenchmarkResult {
  refreshHz:number;targetMs:number;width:number;height:number;
  gpu:GraphicsCapabilities|null;results:PresetMeasurement[];recommended:Quality;measuredAt:number;
}
export const BENCHMARK_ORDER:Quality[]=['low','medium','high','ultra'];
const COMMON_REFRESH=[60,75,90,100,120,144,165,170,180,200,240,280,360];

const frame=()=>new Promise<number>(resolve=>requestAnimationFrame(resolve));
const percentile=(values:number[],q:number)=>{const s=values.slice().sort((a,b)=>a-b);return s.length?s[Math.min(s.length-1,Math.floor((s.length-1)*q))]:Infinity;};

/** Display refresh rate from idle animation-frame intervals, snapped to a
 * common panel rate. */
export async function measureRefreshRate(samples=60):Promise<number>{
  const times:number[]=[];let last=await frame();
  for(let i=0;i<samples;i++){const now=await frame();times.push(now-last);last=now;}
  const hz=1000/percentile(times,.5);
  return COMMON_REFRESH.reduce((best,rate)=>Math.abs(rate-hz)<Math.abs(best-hz)?rate:best,60);
}

/** Highest preset whose 90th-percentile frame time fits the display's frame
 * budget; Low when nothing fits. */
export function recommendPreset(results:PresetMeasurement[],targetMs:number):Quality{
  let choice:Quality='low';
  for(const preset of BENCHMARK_ORDER){const r=results.find(x=>x.preset===preset);if(r?.completed&&r.p90Ms<=targetMs)choice=preset;}
  return choice;
}

/** Render each preset off-screen at the window's real drawing-buffer size and
 * time it. Simulation state is local to the benchmark and never recorded. */
export async function runGraphicsBenchmark(base:Settings,options:{onProgress?:(preset:Quality,index:number)=>void;signal?:AbortSignal;frames?:number;warmup?:number;budgetMs?:number}={}):Promise<GraphicsBenchmarkResult>{
  const {onProgress,signal,frames=45,warmup=10,budgetMs=7000}=options;
  const refreshHz=await measureRefreshRate();
  const targetMs=1000/refreshHz;
  const width=Math.max(320,window.innerWidth),height=Math.max(180,window.innerHeight);
  const host=document.createElement('div');
  host.setAttribute('aria-hidden','true');
  Object.assign(host.style,{position:'fixed',left:'0',top:'0',width:`${width}px`,height:`${height}px`,opacity:'0',pointerEvents:'none',zIndex:'-1'});
  document.body.appendChild(host);
  const results:PresetMeasurement[]=[];let gpu:GraphicsCapabilities|null=null;
  try{
    for(const [index,preset] of BENCHMARK_ORDER.entries()){
      if(signal?.aborted)throw new DOMException('Benchmark cancelled','AbortError');
      onProgress?.(preset,index);
      // A preset that already missed by far makes higher presets pointless.
      const previous=results[results.length-1];
      if(previous&&(!previous.completed||previous.medianMs>targetMs*4)){results.push({preset,medianMs:Infinity,p90Ms:Infinity,fps:0,completed:false});continue;}
      const settings:Settings={...base,...GRAPHICS_PRESETS[preset],autoGraphics:false,frameLimit:0,practiceMap:base.practiceMap==='complex'||base.practiceMap==='bunny'?base.practiceMap:'range'};
      const simulation=new Simulation('free','rifleA',settings);
      const renderer=new RangeRenderer(host,simulation,settings,{recordFrames:false});
      try{
        gpu??=renderer.capabilities;
        await renderer.prepare();simulation.running=true;
        const gl=renderer.renderer.getContext(),pixel=new Uint8Array(4),times:number[]=[],started=performance.now();let completed=true;
        for(let i=0;i<warmup+frames;i++){
          if(signal?.aborted)throw new DOMException('Benchmark cancelled','AbortError');
          await frame();
          simulation.step(1/120,emptyInput());simulation.step(1/120,emptyInput());
          const t0=performance.now();renderer.render(1,1/60,false,false);gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
          if(i>=warmup)times.push(performance.now()-t0);
          if(performance.now()-started>budgetMs){completed=times.length>=10;break;}
        }
        const medianMs=percentile(times,.5),p90Ms=percentile(times,.9);
        results.push({preset,medianMs:+medianMs.toFixed(2),p90Ms:+p90Ms.toFixed(2),fps:Math.round(1000/medianMs),completed});
      }finally{renderer.dispose();}
    }
  }finally{host.remove();}
  const ratio=renderPixelRatio(window.devicePixelRatio,1,width,height);
  return {refreshHz,targetMs:+targetMs.toFixed(2),width:Math.round(width*ratio),height:Math.round(height*ratio),gpu,results,recommended:recommendPreset(results,targetMs),measuredAt:Date.now()};
}
