import { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Volume2, Crosshair as CrosshairIcon, LogOut, AlertCircle } from 'lucide-react';
import { useApp } from '../app/store';
import { Runtime, INITIAL_TELEMETRY, type Telemetry } from '../engine/Runtime';
import { MODES } from '../training/modes/modes';
import { Crosshair } from './Crosshair';
export function GameStage({preview=false}:{preview?:boolean}){
  const host=useRef<HTMLDivElement>(null),runtime=useRef<Runtime|null>(null);
  const [telemetry,setTelemetry]=useState<Telemetry>(INITIAL_TELEMETRY),[error,setError]=useState('');
  const mode=useApp(s=>s.mode),weapon=useApp(s=>s.weapon),settings=useApp(s=>s.settings),locked=useApp(s=>s.locked);
  const menu=useApp(s=>s.menu),finish=useApp(s=>s.finish);
  useEffect(()=>{
    if(!host.current)return;
    let r:Runtime;
    try{r=new Runtime(host.current,mode,weapon,settings,preview,setTelemetry,locked=>useApp.setState({locked,paused:!locked}),setError,data=>{void finish(data);});runtime.current=r;}
    catch(error){console.error(error);setError('입체 그래픽을 시작하지 못했습니다. 하드웨어 가속과 그래픽 지원을 확인하세요.');return;}
    return ()=>{runtime.current=null;r.dispose();};
  },[mode,weapon,settings,preview,finish]);
  const remaining=Math.max(0,Math.ceil(settings.duration-telemetry.time));
  const resume=()=>{if(!runtime.current){setError('입체 그래픽이 준비되지 않았습니다. 하드웨어 가속을 확인한 뒤 새로고침하세요.');return;}setError('');void runtime.current.resume();};
  return <div className={`game-stage ${preview?'range-preview':''}`}>
    <div ref={host} className="webgl-host"/>
    {preview?<><div className="range-shade"/><div className="range-caption"><span className="status-dot"/> 실시간 입체 훈련장 <span>머리만 유효</span></div><div className="range-target-label"><CrosshairIcon size={14}/> 정밀 판정 · 고정 시간 간격</div>{error&&<p className="preview-error">{error}</p>}</>:<>
      <div className="game-top"><div className="mode-pill"><span className="status-dot"/>{MODES[mode].title}</div><div className={`timer ${remaining<=10?'danger':''}`}><small>남은 시간</small>{Math.floor(remaining/60).toString().padStart(2,'0')}<em>:</em>{(remaining%60).toString().padStart(2,'0')}</div><div className="kill-counter"><strong>{telemetry.score}</strong><small>제거</small></div></div>
      <Crosshair settings={settings} hit={telemetry.hitAge<0.16}/>
      {telemetry.hitAge<0.3&&<div className={`hit-confirm ${telemetry.hit==='head'?'head':''}`}>{telemetry.hit==='head'?'헤드샷':telemetry.hit==='torso'?'몸통 · 제거 불가':'팔다리 · 제거 불가'}</div>}
      {telemetry.early&&<div className="early-feedback">{telemetry.grounded?'제동 전 사격 · 이동 오차 발생':'공중 사격 · 오차 증가'}</div>}
      {settings.brakingHud&&<div className="braking-hud"><div className="hud-eyebrow">이동과 정확도</div><div className="speed"><strong>{telemetry.speed.toFixed(2)}</strong><span>미터/초</span><b className={telemetry.accurate?'ready':'not-ready'}>{telemetry.accurate?'정확도 준비':'이동 오차'}</b></div><div className="speed-meter"><i style={{width:`${Math.min(100,telemetry.speed/5.4*100)}%`}}/><b style={{left:`${0.65/5.4*100}%`}}/></div><div className="braking-times"><span>키 해제 후 <b>{telemetry.release===null?'—':`${Math.round(telemetry.release*1000)} 밀리초`}</b></span><span>준비까지 예상 <b>{telemetry.ready===null?'—':`${Math.round(telemetry.ready*1000)} 밀리초`}</b></span><span>최근 제동 발사 시점 <b>{telemetry.thresholdDelta===null?'—':`${telemetry.thresholdDelta>=0?'+':''}${Math.round(telemetry.thresholdDelta*1000)} 밀리초`}</b></span></div></div>}
      <div className="game-bottom-center"><span><kbd>W A S D</kbd> 이동</span><span><kbd>Shift</kbd> 걷기</span><span><kbd>Ctrl</kbd> 앉기</span><span><kbd>R</kbd> 재장전</span><span><kbd>Esc</kbd> 일시정지</span></div>
      <div className="ammo-hud"><span>{weapon==='rifleA'?'소총 가':'소총 나'}</span><strong>{String(telemetry.ammo).padStart(2,'0')}<small> / {weapon==='rifleA'?25:30}</small></strong><p>{telemetry.reloading!==null?`재장전 ${telemetry.reloading.toFixed(1)}초`:'우클릭 · 정조준'}</p></div>
      {settings.showPerformance&&<div className="performance-hud">{Math.round(telemetry.fps)} 프레임/초 <span>·</span> 지연 상위 5% {telemetry.p95.toFixed(1)} 밀리초 <span>·</span> 120회/초 연산 {telemetry.debt>0&&`· 대기 ${telemetry.debt}회`}</div>}
      {!locked&&<div className="pause-overlay"><div className="pause-card"><span className="pause-symbol">{telemetry.time>0?<Pause size={25}/>:<CrosshairIcon size={28}/>}</span><p className="eyebrow">{telemetry.time>0?'훈련 일시정지':'훈련 준비 완료'}</p><h2>{telemetry.time>0?'호흡을 고르고, 다시.':'한 발에 집중하세요.'}</h2><p>{MODES[mode].description}</p><div className="pause-keys"><span><kbd>W A S D</kbd> 이동</span><span><kbd>마우스</kbd> 조준 · 사격</span><span><kbd>Space</kbd> 점프</span></div>{error&&<div className="inline-notice"><AlertCircle size={16}/><span>{error}<button className="reload-link" onClick={()=>window.location.reload()}>화면 다시 불러오기</button></span></div>}<button className="primary-button" onClick={resume}><Play size={17} fill="currentColor"/>{telemetry.time>0?'훈련 계속하기':'클릭하여 훈련 시작'}</button><small>마우스가 잠깁니다. <kbd>Esc</kbd>로 해제할 수 있습니다.</small><div className="pause-actions"><button onClick={()=>runtime.current?.finish()}><RotateCcw size={14}/> 현재 기록으로 종료</button><button onClick={menu}><LogOut size={14}/> 훈련 선택</button></div></div></div>}
    </>}
  </div>;
}
