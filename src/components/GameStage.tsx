import {ExerciseHUD,ExerciseResults} from '../ui/ExerciseTraining';
import {MovementPracticePanel} from '../ui/MovementPracticePanel';
import {navigate} from '../app/navigation';
import type {ReplayRecording} from '../engine/replay/types';
import {EnvironmentCheck} from '../ui/EnvironmentCheck';
import {GraphicsNotice} from '../ui/GraphicsNotice';
import {ScopeOverlay} from './ScopeOverlay';
import {DeathReplay} from '../ui/PeekingFeedback';
import {LegalNotice} from '../ui/LegalNotice';
import {GameHUD} from '../ui/GameHUD';
import {PatchNotes} from '../ui/PatchNotes';
import {lazy,Suspense,useEffect,useRef,useState,type CSSProperties} from 'react';
import { Pause, Play, RotateCcw, Volume2, Crosshair as CrosshairIcon, LogOut, AlertCircle } from 'lucide-react';
import { useApp } from '../app/store';
import { Runtime, INITIAL_TELEMETRY, type Telemetry } from '../engine/Runtime';
import {trainingTitle,trainingDescription} from '../ui/trainingPresentation';
import { PracticeControls } from '../ui/PracticeControls';
import { WEAPONS } from '../config/weapons';
import { SettingsPanel } from '../ui/SettingsPanel';
import { Crosshair } from './Crosshair';
const ReplayViewer=lazy(()=>import('../ui/ReplayViewer').then(m=>({default:m.ReplayViewer})));
export function GameStage({preview=false}:{preview?:boolean}){
  const host=useRef<HTMLDivElement>(null),runtime=useRef<Runtime|null>(null);
  const [telemetry,setTelemetry]=useState<Telemetry>(INITIAL_TELEMETRY),[error,setError]=useState(''),[review,setReview]=useState<ReplayRecording|null>(null);
  const mode=useApp(s=>s.mode),weapon=useApp(s=>s.weapon),settings=useApp(s=>s.settings),locked=useApp(s=>s.locked);
  const menu=useApp(s=>s.menu),finish=useApp(s=>s.finish),options=useApp(s=>s.sessionOptions),result=useApp(s=>s.result),update=useApp(s=>s.updateSettings);
  useEffect(()=>{
    if(!host.current)return;
    let r:Runtime;
    try{r=new Runtime(host.current,mode,weapon,settings,preview,setTelemetry,locked=>useApp.setState({locked,paused:!locked}),setError,data=>{void finish(data,!preview&&!!options.exercise);},id=>useApp.getState().setWeapon(id),undefined,preview?{}:options);runtime.current=r;useApp.getState().reportGraphics(r.renderer.capabilities);}
    catch(error){console.error(error);setError('입체 그래픽을 시작하지 못했습니다. 하드웨어 가속과 그래픽 지원을 확인하세요.');return;}
    return ()=>{runtime.current=null;r.dispose();};
  },[mode,preview,finish,preview?settings.practiceMap:null,preview?null:options]);
  useEffect(()=>{runtime.current?.configure(settings);},[settings]);
  useEffect(()=>{runtime.current?.switchWeapon(weapon);},[weapon]);
  const exerciseResult=!preview&&options.exercise&&result?.exercise?result:null;
  const retryExercise=()=>{const r=runtime.current;if(r?.restartExercise()){setReview(null);useApp.setState({result:null,locked:false,paused:true});void r.resume();}};
  const remaining=mode==='free'?Math.floor(telemetry.time):Math.max(0,Math.ceil(settings.duration-telemetry.time));const profile=WEAPONS[weapon];
  const resume=(capture=false)=>{if(!runtime.current){setError('입체 그래픽이 준비되지 않았습니다. 하드웨어 가속을 확인한 뒤 새로고침하세요.');return;}setError('');void runtime.current.resume(capture);};
  return <div className={`game-stage ${preview?'range-preview':''}`} style={{'--hud-scale':settings.hudScale} as CSSProperties}>
    <div ref={host} className="webgl-host"/>
    {preview?<><div className="range-shade"/><div className="range-caption"><span className="status-dot"/> 실시간 입체 훈련장 <span>머리만 유효</span></div><div className="range-target-label"><CrosshairIcon size={14}/> 정밀 판정 · 고정 시간 간격</div>{error&&<p className="preview-error">{error}</p>}</>:<>

      <PatchNotes/><ExerciseHUD report={telemetry.exercise}/>
      <GameHUD runtime={runtime.current} settings={settings} telemetry={telemetry} mode={mode} weapon={weapon}/>
      {weapon==='operator'&&<ScopeOverlay amount={telemetry.scopeAmount??0} zoom={telemetry.scopeZoom??1} state={telemetry.operatorState} zoomBinding={settings.operatorZoomBinding}/>}
      {(weapon!=='operator'||(telemetry.scopeAmount??0)<.1)&&<Crosshair weapon={weapon} ads={telemetry.ads} settings={settings} hit={telemetry.hitAge<0.16}/>}

      {settings.showHeadshotConfirmation&&telemetry.hitAge<0.3&&<div className={`hit-confirm ${telemetry.hit==='head'?'head':''}`}>{telemetry.hit==='head'?'헤드샷':telemetry.hit==='torso'?'몸통 명중':'팔다리 명중'}</div>}
      {telemetry.early&&<div className="early-feedback">{telemetry.grounded?'제동 전 사격 · 이동 오차 발생':'공중 사격 · 오차 증가'}</div>}






      {!locked&&<div className="pause-overlay">{exerciseResult?<div className="pause-card"><ExerciseResults session={exerciseResult} onRetry={retryExercise} onDetails={()=>{navigate('/results.html');useApp.setState({screen:'results'});}} onExit={menu}/></div>:<div className="pause-card"><div className="pause-intro"><span className="pause-symbol">{telemetry.time>0?<Pause size={25}/>:<CrosshairIcon size={28}/>}</span><p className="eyebrow">{trainingTitle(mode,settings)} · {telemetry.time>0?'훈련 일시정지':'훈련 준비 완료'}</p><h2>{runtime.current?.simulation.exposure.death?(runtime.current.simulation.defenders?.death?.cause==='shot'?'수비수의 사격에 맞았습니다.':'적 시야에 너무 오래 노출됐습니다.'):telemetry.time>0?'호흡을 고르고, 다시.':options.exercise?.kind==='flash'?'신호를 보고, 시야를 돌리세요.':options.exercise?'각을 잡고, 지나가는 표적을 조준하세요.':'한 발에 집중하세요.'}</h2>{runtime.current?.simulation.exposure.death&&(()=>{const d=runtime.current.simulation.exposure.death!;return <div className="exposure-feedback"><b>{d.angle} · 적 {d.bot+1}번</b>{telemetry.peeking&&<DeathReplay report={telemetry.peeking}/>}<p>노출 {d.duration.toFixed(2)}초 · 엄폐물을 이용해 한 번에 한 각만 확인하세요.</p><small>내 위치 {d.player.x.toFixed(1)}, {d.player.y.toFixed(1)}, {d.player.z.toFixed(1)} · 수비 위치 {d.defender.x.toFixed(1)}, {d.defender.y.toFixed(1)}, {d.defender.z.toFixed(1)}</small><button className="secondary-button" onClick={()=>{runtime.current?.retryTactical();resume();}}>같은 맵에서 즉시 재시도</button></div>;})()}<p>{trainingDescription(mode,settings,options)}</p><GraphicsNotice/><EnvironmentCheck runtime={runtime.current} telemetry={telemetry}/><div className="pause-keys"><span><kbd>W A S D</kbd> 이동</span><span><kbd>마우스</kbd> 조준 · 사격</span><span><kbd>Space</kbd> 점프</span></div>{error&&<div className="inline-notice"><AlertCircle size={16}/>{error}</div>}{telemetry.graphicsReady===false&&telemetry.graphicsPreparation&&<p className="field-note" role="status">그래픽 준비 · {({idle:'대기',compiling:'셰이더 컴파일',warming:'렌더링 경로 예열',gpu:'그래픽 처리 완료 대기',ready:'시작 화면 준비',failed:'다시 준비 필요',disposed:'종료'})[telemetry.graphicsPreparation.stage]} · {(telemetry.graphicsPreparation.elapsedMs/1000).toFixed(1)}초{telemetry.graphicsPreparation.completedPrograms!==null&&telemetry.graphicsPreparation.totalPrograms>0?` · ${telemetry.graphicsPreparation.completedPrograms}/${telemetry.graphicsPreparation.totalPrograms} 프로그램`:''}</p>}<button className="primary-button" disabled={telemetry.graphicsReady===false} onClick={()=>{if(runtime.current?.simulation.exposure.death)runtime.current.retryTactical();resume();}}><Play size={17} fill="currentColor"/>{telemetry.graphicsReady===false?'훈련 그래픽 준비 중…':telemetry.time>0?'훈련 계속하기':'클릭하여 훈련 시작'}</button>{error&&telemetry.graphicsReady===false&&<button className="secondary-button" onClick={()=>{setError('');runtime.current?.prepareGraphics();}}>그래픽 다시 준비</button>}<small>마우스가 잠깁니다. <kbd>Esc</kbd>로 해제할 수 있습니다.</small></div><MovementPracticePanel settings={settings} snapshot={telemetry.movementPractice??null} onSettings={update} onAction={action=>{runtime.current?.performMovementAction(action);}} onBuildGhost={()=>{void runtime.current?.prepareMovementGhost();}} onReview={()=>setReview(runtime.current?.replaySnapshot()??null)} ghostStatus={telemetry.ghostStatus} ghostError={telemetry.ghostError} ghost={runtime.current?.getMovementGhost()??null}/>{review&&<Suspense fallback={<p role="status">이동 시도 검토를 준비합니다…</p>}><ReplayViewer recording={review} initialTime={telemetry.movementPractice?.last?.startTime??0} initialCamera="third-person" onClose={()=>setReview(null)}/></Suspense>}<details className="pause-settings" open={mode==='free'}><summary>무기 선택 · 표적 설정</summary><PracticeControls free={mode==='free'} onResetTargets={()=>runtime.current?.resetTargets()} onResetStats={()=>runtime.current?.resetStatistics()}/></details><details className="pause-settings"><summary>마우스·조준선·그래픽·사운드 설정</summary><SettingsPanel initialTab="controls"/></details><button className="secondary-button" onClick={()=>{if(runtime.current?.simulation.exposure.death)runtime.current.retryTactical();resume(true);}}>전체화면 · 키 잠금으로 시작</button><p className="field-note">키 잠금 미지원 시 C로 앉으세요. Ctrl+W 차단은 브라우저·운영체제에 따라 제한됩니다.</p><div className="pause-actions"><button onClick={()=>{const r=runtime.current;if(!r)return;const blob=new Blob([JSON.stringify({recordedAt:new Date().toISOString(),mode:'browser',display:{width:window.innerWidth,height:window.innerHeight,dpr:window.devicePixelRatio},settings:r.simulation.settings,input:{rawRequest:r.input.rawConfirmation,keyboard:r.input.keyboardStatus,delivery:r.input.diagnostics.snapshot()},latency:r.latency.snapshot()},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='valoprac-browser-diagnostics.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}>입력 처리 진단 저장</button><button onClick={()=>runtime.current?.finish()}><RotateCcw size={14}/> 훈련 종료 · 기록 저장</button><button onClick={menu}><LogOut size={14}/> 저장 없이 나가기</button></div><LegalNotice/></div>}</div>}
    </>}
  </div>;
}
