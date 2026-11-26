import {useEffect,useMemo,useRef,useState} from 'react';
import {Cpu,Gauge,TriangleAlert} from 'lucide-react';
import {useApp} from '../app/store';
import {GRAPHICS_PRESETS} from '../config/settings';
import {renderPixelRatio} from '../config/graphicsPolicy';
import {detectGraphicsCapabilities,type GraphicsCapabilities} from '../engine/rendering/GraphicsCapabilities';
import {SURFACE_QUALITY} from '../config/surfaceQuality';
import type {GraphicsBenchmarkResult} from '../engine/rendering/graphicsBenchmark';
import type {Quality,Settings} from '../engine/types';
import './graphicsQuality.css';

export const QUALITY_LABELS:Record<Quality,string>={low:'낮음',medium:'보통',high:'높음',ultra:'최고'};
const QUALITIES=Object.keys(QUALITY_LABELS) as Quality[];
const SHADOW_SIZE:Record<Quality|'off',string>={off:'끄기',low:'512',medium:'1024',high:'2048',ultra:'2048'};
const EFFECT_BUDGET:Record<Quality,number>={low:12,medium:24,high:48,ultra:96};
const BENCHMARK_KEY='valoprac-graphics-benchmark-v1';

/** What every preset changes, in the same rows a shooter's video menu uses. */
export function presetRows(){
  const value=(q:Quality)=>GRAPHICS_PRESETS[q] as Settings;
  return [
    {label:'렌더링 배율',cells:QUALITIES.map(q=>`${Math.round(value(q).renderScale*100)}%`)},
    {label:'안티에일리어싱',cells:QUALITIES.map(q=>value(q).antialias?'MSAA':'끄기')},
    {label:'그림자',cells:QUALITIES.map(q=>value(q).shadowQuality==='off'?'끄기':`${SHADOW_SIZE[value(q).shadowQuality]}²`)},
    {label:'재질 해상도',cells:QUALITIES.map(q=>`${SURFACE_QUALITY[value(q).textureQuality].size}px${SURFACE_QUALITY[value(q).textureQuality].normal?' · 노멀':''}`)},
    {label:'텍스처 필터링',cells:QUALITIES.map(q=>`${SURFACE_QUALITY[value(q).textureQuality].anisotropy}× 이방성`)},
    {label:'탄흔·파편',cells:QUALITIES.map(q=>`${EFFECT_BUDGET[value(q).effectsQuality]}개`)},
    {label:'빛 번짐 · 주변광 차폐',cells:QUALITIES.map(()=>'선택 사항')},
  ];
}
export function matchingPreset(s:Settings):Quality|null{
  return QUALITIES.find(q=>Object.entries(GRAPHICS_PRESETS[q]).every(([k,v])=>s[k as keyof Settings]===v))??null;
}

function detectOnce():GraphicsCapabilities|null{
  if(typeof document==='undefined')return null;
  try{const canvas=document.createElement('canvas'),gl=canvas.getContext('webgl2')??canvas.getContext('webgl');if(!gl)return null;const result=detectGraphicsCapabilities(gl);gl.getExtension('WEBGL_lose_context')?.loseContext();return result;}catch{return null;}
}
function loadBenchmark():GraphicsBenchmarkResult|null{try{const raw=localStorage.getItem(BENCHMARK_KEY);return raw?JSON.parse(raw) as GraphicsBenchmarkResult:null;}catch{return null;}}

export function GraphicsDiagnostics(){
  const observed=useApp(s=>s.graphics),settings=useApp(s=>s.settings);
  const [probe]=useState<GraphicsCapabilities|null>(()=>observed?null:detectOnce());
  const gpu=observed??probe,[size,setSize]=useState(()=>typeof window==='undefined'?{w:1920,h:1080,dpr:1}:{w:window.innerWidth,h:window.innerHeight,dpr:window.devicePixelRatio||1});
  useEffect(()=>{const update=()=>setSize({w:window.innerWidth,h:window.innerHeight,dpr:window.devicePixelRatio||1});window.addEventListener('resize',update);return()=>window.removeEventListener('resize',update);},[]);
  const ratio=renderPixelRatio(size.dpr,settings.renderScale,size.w,size.h),pixels=`${Math.round(size.w*ratio)}×${Math.round(size.h*ratio)}`;
  return <section className="settings-card graphics-diagnostics" aria-label="그래픽 실행 환경">
    <h3><Cpu size={18} aria-hidden="true"/> 그래픽 실행 환경</h3>
    {gpu?.kind==='software'&&<div className="graphics-warning" role="alert"><TriangleAlert size={16} aria-hidden="true"/><div><strong>브라우저가 그래픽카드 대신 CPU로 그리고 있습니다.</strong><p>이 상태에서는 고사양 PC에서도 높은 품질이 매우 느립니다. 브라우저 설정에서 하드웨어 가속을 켜고 브라우저를 다시 시작하세요. Chrome·Edge: 설정 → 시스템 → "가능한 경우 그래픽 가속 사용".</p></div></div>}
    {gpu?.kind==='integrated'&&<div className="graphics-warning soft" role="status"><TriangleAlert size={16} aria-hidden="true"/><div><strong>내장 그래픽으로 실행 중일 수 있습니다.</strong><p>별도 그래픽카드가 있는 노트북이라면 Windows 설정 → 디스플레이 → 그래픽에서 브라우저를 "고성능"으로 지정하세요.</p></div></div>}
    <dl className="graphics-facts">
      <div><dt>그래픽 장치</dt><dd>{gpu?.renderer||'브라우저가 이름을 알려 주지 않음'}</dd></div>
      <div><dt>하드웨어 가속</dt><dd>{gpu?.kind==='software'?'꺼짐 (CPU 렌더링)':gpu?.kind==='unknown'||!gpu?'확인 불가':'켜짐'}</dd></div>
      <div><dt>렌더링 해상도</dt><dd>{pixels} <small>창 {size.w}×{size.h} · 배율 {Math.round(settings.renderScale*100)}%</small></dd></div>
    </dl>
  </section>;
}

export function GraphicsBenchmark(){
  const settings=useApp(s=>s.settings),update=useApp(s=>s.updateSettings);
  const [result,setResult]=useState<GraphicsBenchmarkResult|null>(loadBenchmark),[running,setRunning]=useState<string|null>(null),[error,setError]=useState('');
  const abort=useRef<AbortController|null>(null);
  useEffect(()=>()=>abort.current?.abort(),[]);
  const run=async()=>{
    abort.current?.abort();const controller=abort.current=new AbortController();setError('');setRunning('측정 준비 중');
    try{
      const {runGraphicsBenchmark}=await import('../engine/rendering/graphicsBenchmark');
      const measured=await runGraphicsBenchmark(settings,{signal:controller.signal,onProgress:p=>setRunning(`${QUALITY_LABELS[p]} 측정 중`)});
      setResult(measured);try{localStorage.setItem(BENCHMARK_KEY,JSON.stringify(measured));}catch{/* Result still shown for this page. */}
    }catch(e){if(!(e instanceof DOMException&&e.name==='AbortError'))setError('측정하지 못했습니다. 다른 탭을 닫고 다시 시도하세요.');}
    finally{if(abort.current===controller){abort.current=null;setRunning(null);}}
  };
  return <section className="settings-card graphics-benchmark" aria-label="성능 측정">
    <h3><Gauge size={18} aria-hidden="true"/> 내 컴퓨터로 측정</h3>
    <p className="field-note">네 가지 품질을 이 화면 크기로 직접 그려 보고, 모니터 주사율을 유지하는 가장 높은 품질을 추천합니다. 약 10초 걸리며 훈련 기록에는 영향이 없습니다.</p>
    <div className="graphics-benchmark-actions">
      <button type="button" className="primary-button" disabled={!!running} onClick={()=>void run()}>{running??(result?'다시 측정':'성능 측정 시작')}</button>
      {running&&<button type="button" className="secondary-button" onClick={()=>abort.current?.abort()}>취소</button>}
    </div>
    {error&&<p className="inline-notice" role="status">{error}</p>}
    {result&&!running&&<>
      <table className="graphics-benchmark-table"><caption>{result.width}×{result.height} · 모니터 {result.refreshHz}Hz 기준 (프레임 예산 {result.targetMs}밀리초)</caption>
        <thead><tr><th scope="col">품질</th><th scope="col">예상 프레임</th><th scope="col">상위 10% 프레임 시간</th></tr></thead>
        <tbody>{result.results.map(r=><tr key={r.preset} data-recommended={r.preset===result.recommended?'true':undefined}><th scope="row">{QUALITY_LABELS[r.preset]}{r.preset===result.recommended&&<small> 추천</small>}</th><td>{r.completed?`약 ${r.fps}프레임/초`:r.fps>0?`약 ${r.fps}프레임/초 · 매우 느림`:'측정 생략 (아래 단계가 이미 느림)'}</td><td>{r.completed&&Number.isFinite(r.p90Ms)?`${r.p90Ms}밀리초`:'—'}</td></tr>)}</tbody>
      </table>
      <p className="field-note">매 프레임 그래픽카드가 끝날 때까지 기다려 재므로 실제 훈련보다 조금 낮게 나옵니다. {result.gpu?.kind==='software'?'CPU 렌더링 상태에서 측정되었습니다. 하드웨어 가속을 켠 뒤 다시 측정하세요.':''}</p>
      <button type="button" className="secondary-button" disabled={settings.graphicsPreset===result.recommended&&matchingPreset(settings)===result.recommended} onClick={()=>update({...GRAPHICS_PRESETS[result.recommended],autoGraphics:false})}>추천 품질({QUALITY_LABELS[result.recommended]}) 적용</button>
    </>}
  </section>;
}

/** Preset selector, the per-preset table and individual options. */
export function GraphicsQuality(){
  const s=useApp(x=>x.settings),update=useApp(x=>x.updateSettings);
  const current=useMemo(()=>matchingPreset(s),[s]),rows=useMemo(presetRows,[]);
  const set=(patch:Partial<Settings>)=>update({...patch,autoGraphics:false});
  const toggle=(key:'postProcessing'|'ambientOcclusion'|'premiumTheme',label:string,note?:string)=><label className="practice-toggle"><span>{label}{note&&<small>{note}</small>}</span><input type="checkbox" checked={s[key]} onChange={e=>set({[key]:e.target.checked})}/></label>;
  return <section className="settings-card graphics-quality">
    <h3>그래픽 품질</h3>
    <div className="quality-options" role="group" aria-label="그래픽 품질 단계">{QUALITIES.map(q=><button type="button" key={q} aria-pressed={current===q} className={current===q?'active':''} onClick={()=>set(GRAPHICS_PRESETS[q])}>{QUALITY_LABELS[q]}</button>)}</div>
    {!current&&<p className="field-note">사용자 지정 · 아래에서 바꾼 항목이 있습니다. 단계를 누르면 그 단계의 값으로 돌아갑니다.</p>}
    <div className="graphics-preset-table-wrap"><table className="graphics-preset-table"><caption>품질 단계별 설정</caption>
      <thead><tr><th scope="col">항목</th>{QUALITIES.map(q=><th scope="col" key={q} data-current={current===q?'true':undefined}>{QUALITY_LABELS[q]}</th>)}</tr></thead>
      <tbody>{rows.map(row=><tr key={row.label}><th scope="row">{row.label}</th>{row.cells.map((cell,i)=><td key={i} data-current={current===QUALITIES[i]?'true':undefined}>{cell}</td>)}</tr>)}</tbody>
    </table></div>
    <p className="field-note">모든 단계는 장면을 한 번만 그려 화면에 바로 출력합니다. 단계를 올리면 그림자 해상도, 재질 세부와 필터링, 탄흔 수만 늘어나며, 화면은 4K 크기를 넘지 않게 제한됩니다.</p>
    <details className="settings-disclosure" open={!current}><summary>세부 설정</summary>
      {(['shadowQuality','textureQuality','effectsQuality'] as const).map(key=><label className="practice-select" key={key}>{key==='shadowQuality'?'그림자 품질':key==='textureQuality'?'재질·텍스처 품질':'효과 품질'}<select value={s[key]} onChange={e=>set({[key]:e.target.value})}>{key==='shadowQuality'&&<option value="off">끄기</option>}{QUALITIES.map(v=><option key={v} value={v}>{QUALITY_LABELS[v]}</option>)}</select></label>)}
      {toggle('postProcessing','빛 번짐 (블룸)','화면 전체 후처리가 추가되어 부하가 늘어납니다')}
      {toggle('ambientOcclusion','주변광 차폐','장면을 한 번 더 그립니다 · 부하 큼')}
      {toggle('premiumTheme','무기 강조색 표시')}
    </details>
  </section>;
}
