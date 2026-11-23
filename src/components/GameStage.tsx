import {LegalNotice} from '../ui/LegalNotice';
import {GameHUD} from '../ui/GameHUD';
import {PatchNotes} from '../ui/PatchNotes';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Pause, Play, RotateCcw, Volume2, Crosshair as CrosshairIcon, LogOut, AlertCircle } from 'lucide-react';
import { useApp } from '../app/store';
import { Runtime, INITIAL_TELEMETRY, type Telemetry } from '../engine/Runtime';
import { MODES } from '../training/modes/modes';
import { PracticeControls } from '../ui/PracticeControls';
import { WEAPONS } from '../config/weapons';
import { SettingsPanel } from '../ui/SettingsPanel';
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
  },[mode,preview,finish,preview?settings.practiceMap:null]);
  useEffect(()=>{runtime.current?.configure(settings);},[settings]);
  useEffect(()=>{runtime.current?.switchWeapon(weapon);},[weapon]);
  const remaining=mode==='free'?Math.floor(telemetry.time):Math.max(0,Math.ceil(settings.duration-telemetry.time));const profile=WEAPONS[weapon];
  const resume=(capture=false)=>{if(!runtime.current){setError('입체 그래픽이 준비되지 않았습니다. 하드웨어 가속을 확인한 뒤 새로고침하세요.');return;}setError('');void runtime.current.resume(capture);};
  return <div className={`game-stage ${preview?'range-preview':''}`} style={{'--hud-scale':settings.hudScale} as CSSProperties}>
    <div ref={host} className="webgl-host"/>
    {preview?<><div className="range-shade"/><div className="range-caption"><span className="status-dot"/> 실시간 입체 훈련장 <span>머리만 유효</span></div><div className="range-target-label"><CrosshairIcon size={14}/> 정밀 판정 · 고정 시간 간격</div>{error&&<p className="preview-error">{error}</p>}</>:<>

      <PatchNotes/>
      <GameHUD runtime={runtime.current} settings={settings} telemetry={telemetry} mode={mode} weapon={weapon}/>
      <Crosshair ads={telemetry.ads} settings={settings} hit={telemetry.hitAge<0.16}/>
      {settings.showHeadshotConfirmation&&telemetry.hitAge<0.3&&<div className={`hit-confirm ${telemetry.hit==='head'?'head':''}`}>{telemetry.hit==='head'?'헤드샷':telemetry.hit==='torso'?'몸통 명중':'팔다리 명중'}</div>}
      {telemetry.early&&<div className="early-feedback">{telemetry.grounded?'제동 전 사격 · 이동 오차 발생':'공중 사격 · 오차 증가'}</div>}






      {!locked&&<div className="pause-overlay"><div className="pause-card"><div className="pause-intro"><span className="pause-symbol">{telemetry.time>0?<Pause size={25}/>:<CrosshairIcon size={28}/>}</span><p className="eyebrow">{telemetry.time>0?'훈련 일시정지':'훈련 준비 완료'}</p><h2>{runtime.current?.simulation.exposure.death?'적 시야에 너무 오래 노출됐습니다.':telemetry.time>0?'호흡을 고르고, 다시.':'한 발에 집중하세요.'}</h2>{runtime.current?.simulation.exposure.death&&(()=>{const d=runtime.current.simulation.exposure.death!;return <div className="exposure-feedback"><b>{d.angle} · 적 {d.bot+1}번</b><p>노출 {d.duration.toFixed(2)}초 · 엄폐물을 이용해 한 번에 한 각만 확인하세요.</p><small>내 위치 {d.player.x.toFixed(1)}, {d.player.y.toFixed(1)}, {d.player.z.toFixed(1)} · 수비 위치 {d.defender.x.toFixed(1)}, {d.defender.y.toFixed(1)}, {d.defender.z.toFixed(1)}</small><button className="secondary-button" onClick={()=>{runtime.current?.retryTactical();resume();}}>같은 맵에서 즉시 재시도</button></div>;})()}<p>{MODES[mode].description}</p><div className="pause-keys"><span><kbd>W A S D</kbd> 이동</span><span><kbd>마우스</kbd> 조준 · 사격</span><span><kbd>Space</kbd> 점프</span></div>{error&&<div className="inline-notice"><AlertCircle size={16}/>{error}</div>}<button className="primary-button" onClick={()=>{if(runtime.current?.simulation.exposure.death)runtime.current.retryTactical();resume();}}><Play size={17} fill="currentColor"/>{telemetry.time>0?'훈련 계속하기':'클릭하여 훈련 시작'}</button><small>마우스가 잠깁니다. <kbd>Esc</kbd>로 해제할 수 있습니다.</small></div><details className="pause-settings" open={mode==='free'}><summary>무기 선택 · 표적 설정</summary><PracticeControls free={mode==='free'} onResetTargets={()=>runtime.current?.resetTargets()} onResetStats={()=>runtime.current?.resetStatistics()}/></details><details className="pause-settings"><summary>마우스·조준선·그래픽·사운드 설정</summary><SettingsPanel initialTab="controls"/></details><button className="secondary-button" onClick={()=>{if(runtime.current?.simulation.exposure.death)runtime.current.retryTactical();resume(true);}}>전체화면 · 키 잠금으로 시작</button><p className="field-note">키 잠금 미지원 시 C로 앉으세요. Ctrl+W 차단은 브라우저·운영체제에 따라 제한됩니다.</p><div className="pause-actions"><button onClick={()=>{const r=runtime.current;if(!r)return;const blob=new Blob([JSON.stringify({recordedAt:new Date().toISOString(),mode:'browser',display:{width:window.innerWidth,height:window.innerHeight,dpr:window.devicePixelRatio},settings:r.simulation.settings,input:{rawRequest:r.input.rawConfirmation,keyboard:r.input.keyboardStatus,delivery:r.input.diagnostics.snapshot()},latency:r.latency.snapshot()},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='valoprac-browser-diagnostics.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}>입력 처리 진단 저장</button><button onClick={()=>runtime.current?.finish()}><RotateCcw size={14}/> 훈련 종료 · 기록 저장</button><button onClick={menu}><LogOut size={14}/> 저장 없이 나가기</button></div><LegalNotice/></div></div>}
    </>}
  </div>;
}
