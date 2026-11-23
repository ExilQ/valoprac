import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {EnvironmentFrameSampler,evaluateEnvironment,EMPTY_FRAME_DELIVERY,UNKNOWN_ENVIRONMENT_SUPPORT,type EnvironmentObservation} from '../engine/input/EnvironmentCheck';
import {InputDiagnostics} from '../engine/input/InputDiagnostics';
import {InputLatencyProbe} from '../benchmarks/InputLatencyProbe';
import {classifyGraphicsRenderer} from '../engine/rendering/GraphicsCapabilities';
import {EnvironmentCheckView} from '../ui/EnvironmentCheck';
const observation=(patch:Partial<EnvironmentObservation>={}):EnvironmentObservation=>({support:UNKNOWN_ENVIRONMENT_SUPPORT,locked:false,rawRequest:'unverified',delivery:null,cpuLatency:null,refresh:EMPTY_FRAME_DELIVERY,graphics:null,graphicsAPI:'unknown',render:null,...patch});
const item=(o:EnvironmentObservation,id:string)=>evaluateEnvironment(o).items.find(i=>i.id===id)!;
describe('I5 — pure browser preflight policy',()=>{
 it('keeps unavailable device measurements unknown, with one clear local action per item',()=>{
  const report=evaluateEnvironment(observation());expect(report.items).toHaveLength(9);expect(new Set(report.items.map(i=>i.id)).size).toBe(9);expect(report.unknown).toBe(9);expect(report.warnings).toBe(0);
  for(const row of report.items){expect(row.action).toMatch(/[가-힣]/);expect(row.detail).not.toMatch(/NaN|Infinity|undefined/);}expect(report.limitations).toContain('업로드하지 않습니다');expect(report.limitations).toContain('GPU 완료');
 });
 it('separates Pointer Lock support from an actually locked training canvas',()=>{
  expect(item(observation({support:{...UNKNOWN_ENVIRONMENT_SUPPORT,pointerLock:true}}),'pointerLock').state).toBe('notice');
  expect(item(observation({support:{...UNKNOWN_ENVIRONMENT_SUPPORT,pointerLock:true},locked:true}),'pointerLock').state).toBe('pass');
  expect(item(observation({support:{...UNKNOWN_ENVIRONMENT_SUPPORT,pointerLock:false}}),'pointerLock').state).toBe('warning');
 });
 for(const[state,result]of[['accepted','pass'],['fallback','notice'],['denied','warning'],['unverified','unknown']]as const)it(`handles raw request ${state} without inferring sensor or OS settings`,()=>{
  const r=item(observation({rawRequest:state}),'rawMouse');expect(r.state).toBe(result);if(state==='accepted')expect(r.detail).toContain('센서 경로는 미검증');
 });
 it('accepts real InputDiagnostics observations even when opposite movement sums cancel',()=>{
  const d=new InputDiagnostics();for(let i=0;i<64;i++)d.record(100+i,100.5+i,.01,i%2?1:-1,0);
  const o=observation({delivery:d.snapshot(165)});expect(item(o,'relativeInput').state).toBe('pass');expect(item(o,'relativeInput').detail).toContain('64개');expect(item(o,'relativeInput').detail).toContain('X 0');expect(item(o,'inputConsistency').state).toBe('pass');
 });
 it('does not classify an idle paused cursor as broken high-rate input',()=>{
  const d=new InputDiagnostics();for(let i=0;i<64;i++)d.record(100+i,100.5+i,.01,1,0);
  const o=observation({delivery:d.snapshot(10000)});expect(o.delivery!.deliveredHz).toBe(0);expect(item(o,'inputConsistency').state).toBe('pass');
 });
 it('reports slow delivery/callbacks and labels CPU submit timing separately',()=>{
  const d=new InputDiagnostics(),cpu=new InputLatencyProbe();for(let i=0;i<40;i++)d.record(100+i,125+i,3,1,0);cpu.mark('look',100,101);cpu.submitted(110);
  const r=item(observation({delivery:d.snapshot(170),cpuLatency:cpu.snapshot()}),'inputConsistency');expect(r.state).toBe('warning');expect(r.detail).toContain('렌더 제출 CPU');expect(r.detail).toContain('10.00 ms');expect(r.action).toContain('다른 무거운 작업');
 });
 it('requires enough input samples and rejects invalid numerical observations',()=>{
  const d=new InputDiagnostics();d.record(0,0,0,0,0);expect(item(observation({delivery:d.snapshot(0)}),'inputConsistency').state).toBe('unknown');
  const invalid={...d.snapshot(0),events:Infinity,callbackP95:NaN,deliveryP95:NaN,sumX:Infinity};const report=evaluateEnvironment(observation({delivery:invalid,render:{fps:NaN,p95:Infinity,frameLimit:0,ready:true}}));expect(report.items.map(i=>i.detail).join(' ')).not.toMatch(/NaN|Infinity|undefined/);expect(report.items.find(i=>i.id==='relativeInput')!.state).toBe('unknown');
 });
 it('distinguishes a chosen30FPS limit from slow rendering and does not promise hardware speed',()=>{
  const graphics=classifyGraphicsRenderer('NVIDIA GeForce RTX4080'),base={graphics,graphicsAPI:'WebGL2' as const};
  expect(item(observation({...base,render:{fps:30,p95:34,frameLimit:30,ready:true}}),'frames').state).toBe('pass');
  const slow=observation({...base,render:{fps:5,p95:200,frameLimit:144,ready:true}});expect(item(slow,'frames').state).toBe('warning');expect(item(slow,'graphics').state).toBe('pass');
 });
 it('keeps shader preparation separate from missing/slow frame observations',()=>{
  expect(item(observation({render:{fps:0,p95:0,frameLimit:144,ready:false}}),'frames').detail).toContain('그래픽을 준비');expect(item(observation({render:{fps:0,p95:0,frameLimit:144,ready:true}}),'frames').state).toBe('unknown');
 });
 for(const[name,state]of[['SwiftShader','warning'],['Intel(R) UHD Graphics770','notice'],['WebKit WebGL','unknown']]as const)it(`${name}: exposes GPU classification without claiming a benchmark`,()=>{
  const r=item(observation({graphics:classifyGraphicsRenderer(name),graphicsAPI:'WebGL2'}),'graphics');expect(r.state).toBe(state);expect(r.detail).toContain('WebGL2');
 });
 it('offers a corrective action for unavailable WebGL without blaming an unknown device',()=>{
  const r=item(observation({graphicsAPI:'unavailable'}),'graphics');expect(r.state).toBe('warning');expect(r.action).toContain('하드웨어 가속 설정');
 });
 it('handles fullscreen and battery as optional capabilities, never an OS power-mode measurement',()=>{
  const support={pointerLock:true,fullscreen:true,fullscreenActive:true,battery:{status:'available' as const,charging:false,level:.15}},o=observation({support});expect(item(o,'fullscreen').state).toBe('pass');expect(item(o,'power').state).toBe('notice');expect(item(o,'power').detail).toContain('15%');expect(item(o,'power').detail).toContain('절전 모드는 확인 불가');
  expect(item(observation({support:{...support,battery:{status:'unavailable',charging:null,level:null}}}),'power').state).toBe('unknown');
 });
 it('does not infer a physical monitor refresh rate from callback intervals',()=>{
  const o=observation({refresh:{samples:60,medianMs:1000/60,p95Ms:18,maximumMs:20,estimatedHz:60}}),r=item(o,'refresh');expect(r.state).toBe('notice');expect(r.detail).toContain('모니터 주사율이 아닙니다');
 });
 it('renders accessible compact Korean rows without a mandatory modal or telemetry action',()=>{
  const html=renderToStaticMarkup(<EnvironmentCheckView report={evaluateEnvironment(observation())} open onRefresh={()=>{}}/>);expect(html).toContain('<summary>');expect(html).toContain('훈련 환경 점검');expect(html).toContain('다시 측정');expect((html.match(/data-check=/g)??[]).length).toBe(9);expect(html).toContain('이 브라우저에서만 사용');expect(html).not.toContain('role="dialog"');expect(html).not.toMatch(/https?:\/\//);
 });
});
describe('I5 — bounded callback cadence sampling',()=>{
 it('measures120delivered60Hz intervals and retains long visible stalls',()=>{
  const s=new EnvironmentFrameSampler();for(let i=0;i<=120;i++)s.record(i*1000/60);const r=s.snapshot();expect(r.samples).toBe(120);expect(r.estimatedHz).toBeCloseTo(60,8);s.record(2250);expect(s.snapshot().maximumMs).toBeCloseTo(250,8);expect(s.snapshot().samples).toBe(120);
 });
 it('excludes hidden intervals and resets cleanly without a fabricated initial sample',()=>{
  const s=new EnvironmentFrameSampler();s.record(0);s.record(16);s.record(3000,false);s.record(4000);expect(s.snapshot().samples).toBe(1);s.record(4016);expect(s.snapshot().samples).toBe(2);s.reset();expect(s.snapshot()).toEqual(EMPTY_FRAME_DELIVERY);
 });
 it('rejects nonfinite timestamps without poisoning later samples',()=>{
  const s=new EnvironmentFrameSampler();s.record(NaN);s.record(10);s.record(20);s.record(Infinity);s.record(30);s.record(40);expect(s.snapshot().samples).toBe(2);expect(s.snapshot().medianMs).toBe(10);
 });
});
