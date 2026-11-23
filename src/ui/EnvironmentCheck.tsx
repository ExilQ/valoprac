import {useEffect,useState} from 'react';
import {EnvironmentFrameSampler,evaluateEnvironment,EMPTY_FRAME_DELIVERY,UNKNOWN_ENVIRONMENT_SUPPORT,type BrowserEnvironmentSupport,type EnvironmentObservation,type EnvironmentReport} from '../engine/input/EnvironmentCheck';
import type {InputDiagnostics} from '../engine/input/InputDiagnostics';
import type {InputLatencyProbe} from '../benchmarks/InputLatencyProbe';
import type {GraphicsCapabilities} from '../engine/rendering/GraphicsCapabilities';
import './environmentCheck.css';
export interface EnvironmentRuntime {
 input:{readonly locked:boolean;rawConfirmation:EnvironmentObservation['rawRequest'];diagnostics:Pick<InputDiagnostics,'snapshot'>};
 latency:Pick<InputLatencyProbe,'snapshot'>;
 renderer:{capabilities:GraphicsCapabilities;canvas:HTMLCanvasElement;renderer?:{getContext:()=>WebGLRenderingContext|WebGL2RenderingContext}};
 simulation?:{settings:{frameLimit:number}};
}
export interface EnvironmentTelemetry {fps:number;p95:number;graphicsReady?:boolean;}
const names={pass:'확인',notice:'안내',warning:'주의',unknown:'미확인'} as const;
export function EnvironmentCheckView({report,open=false,onToggle,onRefresh}:{report:EnvironmentReport;open?:boolean;onToggle?:(open:boolean)=>void;onRefresh?:()=>void}){
 return <details className="environment-check" open={open} onToggle={e=>onToggle?.(e.currentTarget.open)}><summary><span>훈련 환경 점검</span><small>확인 {report.passed} · 주의 {report.warnings} · 미확인 {report.unknown}</small></summary><div className="environment-check-content"><div className="environment-check-heading"><p>브라우저가 제공하는 관측값으로 점검합니다.</p>{onRefresh&&<button type="button" onClick={onRefresh}>다시 측정</button>}</div><dl>{report.items.map(item=><div key={item.id} className={`environment-check-item ${item.state}`} data-check={item.id}><dt>{item.label}<span>{names[item.state]}</span></dt><dd>{item.detail}<small>{item.action}</small></dd></div>)}</dl><p className="environment-check-limit">{report.limitations}</p></div></details>;
}
function graphicsAPI(runtime:EnvironmentRuntime|null):EnvironmentObservation['graphicsAPI']{
 if(!runtime)return 'unknown';
 try{const gl=runtime.renderer.renderer?.getContext();if(!gl)return 'unknown';return /^WebGL 2/i.test(String(gl.getParameter(gl.VERSION)))?'WebGL2':'WebGL';}catch{return 'unavailable';}
}
/** The component is mounted in the pause UI only; no global listeners or sampler
 * remain active during actual gameplay. The pure view also accepts recorded data. */
export function EnvironmentCheck({runtime,telemetry}:{runtime:EnvironmentRuntime|null;telemetry:EnvironmentTelemetry}){
 const[open,setOpen]=useState(false),[revision,refresh]=useState(0),[support,setSupport]=useState<BrowserEnvironmentSupport>(UNKNOWN_ENVIRONMENT_SUPPORT),[cadence,setCadence]=useState(EMPTY_FRAME_DELIVERY),[,update]=useState(0);
 useEffect(()=>{
  if(!open)return;
  let active=true,raf=0,timer=0;const sampler=new EnvironmentFrameSampler(),canvas=runtime?.renderer.canvas;
  setSupport({pointerLock:canvas?typeof canvas.requestPointerLock==='function':null,fullscreen:typeof document.fullscreenEnabled==='boolean'?document.fullscreenEnabled:null,fullscreenActive:!!document.fullscreenElement,battery:{status:'pending',charging:null,level:null}});
  setCadence(EMPTY_FRAME_DELIVERY);
  // rAF's supplied timestamp identifies the rendering opportunity. A queued
  // callback can arrive later after a stall; sample actual callback arrival.
  const tick=()=>{if(!active)return;sampler.record(performance.now(),document.visibilityState==='visible');if(sampler.samples>=120){setCadence(sampler.snapshot());return;}raf=requestAnimationFrame(tick);};raf=requestAnimationFrame(tick);
  timer=window.setTimeout(()=>{cancelAnimationFrame(raf);if(active)setCadence(sampler.snapshot());},2200);
  const n=navigator as Navigator&{getBattery?:()=>Promise<{charging:boolean;level:number}>};
  if(n.getBattery)void n.getBattery().then(b=>{if(active)setSupport(s=>({...s,battery:{status:'available',charging:typeof b.charging==='boolean'?b.charging:null,level:Number.isFinite(b.level)?b.level:null}}));}).catch(()=>{if(active)setSupport(s=>({...s,battery:{status:'unavailable',charging:null,level:null}}));});
  else setSupport(s=>({...s,battery:{status:'unsupported',charging:null,level:null}}));
  const fullscreenChange=()=>{if(active)setSupport(s=>({...s,fullscreenActive:!!document.fullscreenElement}));};
  document.addEventListener('fullscreenchange',fullscreenChange);
  const interval=window.setInterval(()=>{if(active)update(n=>n+1);},750);
  return()=>{active=false;cancelAnimationFrame(raf);clearTimeout(timer);clearInterval(interval);document.removeEventListener('fullscreenchange',fullscreenChange);};
 },[runtime,open,revision]);
 const observation:EnvironmentObservation={support,locked:runtime?.input.locked??false,rawRequest:runtime?.input.rawConfirmation??'unverified',delivery:runtime?.input.diagnostics.snapshot()??null,cpuLatency:runtime?.latency.snapshot()??null,refresh:cadence,graphics:runtime?.renderer.capabilities??null,graphicsAPI:graphicsAPI(runtime),render:runtime?{fps:telemetry.fps,p95:telemetry.p95,frameLimit:runtime.simulation?.settings.frameLimit??0,ready:telemetry.graphicsReady!==false}:null};
 return <EnvironmentCheckView report={evaluateEnvironment(observation)} open={open} onToggle={setOpen} onRefresh={()=>refresh(n=>n+1)}/>;
}
