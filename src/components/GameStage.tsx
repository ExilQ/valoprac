import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Pause, Play, RotateCcw, Volume2, Crosshair as CrosshairIcon, LogOut, AlertCircle } from 'lucide-react';
import { useApp } from '../app/store';
import { Runtime, INITIAL_TELEMETRY, type Telemetry } from '../engine/Runtime';
import { MODES } from '../training/modes/modes';
import { PracticeControls } from '../ui/PracticeControls';
import { WEAPONS } from '../config/weapons';
import { SettingsPanel } from '../ui/SettingsPanel';
import { LiveRecoil } from '../ui/LiveRecoil';
import { Crosshair } from './Crosshair';
export function GameStage({preview=false}:{preview?:boolean}){
  const host=useRef<HTMLDivElement>(null),runtime=useRef<Runtime|null>(null);
  const [telemetry,setTelemetry]=useState<Telemetry>(INITIAL_TELEMETRY),[error,setError]=useState('');
  const mode=useApp(s=>s.mode),weapon=useApp(s=>s.weapon),settings=useApp(s=>s.settings),locked=useApp(s=>s.locked);
  const menu=useApp(s=>s.menu),finish=useApp(s=>s.finish);
  useEffect(()=>{
    if(!host.current)return;
    let r:Runtime;
    try{r=new Runtime(host.current,mode,weapon,settings,preview,setTelemetry,locked=>useApp.setState({locked,paused:!locked}),setError,data=>{void finish(data);},id=>useApp.getState().setWeapon(id));runtime.current=r;}
    catch(error){console.error(error);setError('입체 그래픽을 시작하지 못했습니다. 하드웨어 가속과 그래픽 지원을 확인하세요.');return;}
    return ()=>{runtime.current=null;r.dispose();};
  },[mode,preview,finish]);
  useEffect(()=>{runtime.current?.configure(settings);},[settings]);
  useEffect(()=>{runtime.current?.switchWeapon(weapon);},[weapon]);
  const remaining=mode==='free'?Math.floor(telemetry.time):Math.max(0,Math.ceil(settings.duration-telemetry.time));const profile=WEAPONS[weapon];
  const resume=()=>{if(!runtime.current){setError('입체 그래픽이 준비되지 않았습니다. 하드웨어 가속을 확인한 뒤 새로고침하세요.');return;}setError('');void runtime.current.resume();};
  return <div className={`game-stage ${preview?'range-preview':''}`} style={{'--hud-scale':settings.hudScale} as CSSProperties}>
    <div ref={host} className="webgl-host"/>
    {preview?<><div className="range-shade"/><div className="range-caption"><span className="status-dot"/> 실시간 입체 훈련장 <span>머리만 유효</span></div><div className="range-target-label"><CrosshairIcon size={14}/> 정밀 판정 · 고정 시간 간격</div>{error&&<p className="preview-error">{error}</p>}</>:<>
      <div className="game-top"><div className="mode-pill"><span className="status-dot"/>{MODES[mode].title}</div><div className={`timer ${mode!=='free'&&remaining<=10?'danger':''}`}><small>{mode==='free'?'자유 훈련 · 경과 시간':'남은 시간'}</small>{Math.floor(remaining/60).toString().padStart(2,'0')}<em>:</em>{(remaining%60).toString().padStart(2,'0')}</div><div className="kill-counter"><strong>{telemetry.score}</strong><small>제거</small></div></div>
      <Crosshair settings={settings} hit={telemetry.hitAge<0.16}/>
      {settings.showHeadshotConfirmation&&telemetry.hitAge<0.3&&<div className={`hit-confirm ${telemetry.hit==='head'?'head':''}`}>{telemetry.hit==='head'?'헤드샷':telemetry.hit==='torso'?'몸통 명중':'팔다리 명중'}</div>}
      {telemetry.early&&<div className="early-feedback">{telemetry.grounded?'제동 전 사격 · 이동 오차 발생':'공중 사격 · 오차 증가'}</div>}
      {settings.brakingHud&&<div className="braking-hud"><div className="hud-eyebrow">이동과 정확도</div><div className="speed"><strong>{telemetry.speed.toFixed(2)}</strong><span>미터/초</span><b className={telemetry.accurate?'ready':'not-ready'}>{telemetry.accurate?'정확도 준비':'이동 오차'}</b></div><div className="speed-meter"><i style={{width:`${Math.min(100,telemetry.speed/5.4*100)}%`}}/><b style={{left:`${0.65/5.4*100}%`}}/></div><div className="braking-times"><span>키 해제 후 <b>{telemetry.release===null?'—':`${Math.round(telemetry.release*1000)} 밀리초`}</b></span><span>준비까지 예상 <b>{telemetry.ready===null?'—':`${Math.round(telemetry.ready*1000)} 밀리초`}</b></span><span>최근 제동 발사 시점 <b>{telemetry.thresholdDelta===null?'—':`${telemetry.thresholdDelta>=0?'+':''}${Math.round(telemetry.thresholdDelta*1000)} 밀리초`}</b></span></div></div>}
      {settings.showControlHints&&<div className="game-bottom-center"><span><kbd>W A S D</kbd> 이동</span><span><kbd>Shift</kbd> 걷기</span><span><kbd>Ctrl</kbd> 앉기</span><span><kbd>R</kbd> 재장전</span><span><kbd>Esc</kbd> 설정</span><span><kbd>{settings.bindings.weapons.replace('Key','')}</kbd> 무기 선택</span></div>}
      <div className="ammo-hud"><span>{profile.name}</span><strong>{String(telemetry.ammo).padStart(2,'0')}<small> / {profile.magazine}</small></strong><small className="reserve-count">예비 {settings.infiniteReserve?'∞':telemetry.reserve}</small><p>{telemetry.reloading!==null?`재장전 ${telemetry.reloading.toFixed(1)}초`:weapon==='sheriff'?'단발 · 정조준 없음':telemetry.ads?'정조준 1.25배':'우클릭 · 정조준'}</p></div>
      {settings.showPerformance&&<div className="performance-hud">{Math.round(telemetry.fps)} 프레임/초 <span>·</span> 지연 상위 5% {telemetry.p95.toFixed(1)} 밀리초 <span>·</span> 120회/초 연산 {telemetry.debt>0&&`· 대기 ${telemetry.debt}회`}</div>}
      {mode==='free'&&settings.practiceHud&&telemetry.summary&&<div className="practice-stat-hud"><b>사격 통계</b><span>발사 {telemetry.summary.shots} · 명중 {telemetry.summary.heads+telemetry.summary.bodies+telemetry.summary.limbs} · 빗나감 {telemetry.summary.misses}</span><span>명중률 {telemetry.summary.hitAccuracy.toFixed(1)}% · 헤드샷 {telemetry.summary.headshotAccuracy.toFixed(1)}%</span></div>}
      {settings.recoilAnalysis&&mode==='free'&&<LiveRecoil runtime={runtime.current} telemetry={telemetry}/>}
      {!locked&&<div className="pause-overlay"><div className="pause-card"><div className="pause-intro"><span className="pause-symbol">{telemetry.time>0?<Pause size={25}/>:<CrosshairIcon size={28}/>}</span><p className="eyebrow">{telemetry.time>0?'훈련 일시정지':'훈련 준비 완료'}</p><h2>{telemetry.time>0?'호흡을 고르고, 다시.':'한 발에 집중하세요.'}</h2><p>{MODES[mode].description}</p><div className="pause-keys"><span><kbd>W A S D</kbd> 이동</span><span><kbd>마우스</kbd> 조준 · 사격</span><span><kbd>Space</kbd> 점프</span></div>{error&&<div className="inline-notice"><AlertCircle size={16}/>{error}</div>}<button className="primary-button" onClick={resume}><Play size={17} fill="currentColor"/>{telemetry.time>0?'훈련 계속하기':'클릭하여 훈련 시작'}</button><small>마우스가 잠깁니다. <kbd>Esc</kbd>로 해제할 수 있습니다.</small></div><details className="pause-settings" open={mode==='free'}><summary>무기 선택 · 표적 설정</summary><PracticeControls free={mode==='free'} onResetTargets={()=>runtime.current?.resetTargets()} onResetStats={()=>runtime.current?.resetStatistics()}/></details><details className="pause-settings"><summary>마우스·조준선·그래픽·사운드 설정</summary><SettingsPanel initialTab="controls"/></details><div className="pause-actions"><button onClick={()=>{const r=runtime.current;if(!r)return;const blob=new Blob([JSON.stringify({recordedAt:new Date().toISOString(),mode:'browser',display:{width:window.innerWidth,height:window.innerHeight,dpr:window.devicePixelRatio},settings:r.simulation.settings,latency:r.latency.snapshot()},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='valoprac-browser-diagnostics.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}>입력 처리 진단 저장</button><button onClick={()=>runtime.current?.finish()}><RotateCcw size={14}/> 훈련 종료 · 기록 저장</button><button onClick={menu}><LogOut size={14}/> 저장 없이 나가기</button></div></div></div>}
    </>}
  </div>;
}
