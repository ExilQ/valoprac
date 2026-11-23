import {useEffect,useRef,useState} from 'react';
import {Runtime,INITIAL_TELEMETRY,type Telemetry} from '../../engine/Runtime';
import type {Settings} from '../../engine/types';
import type {AimRecord} from '../types';
import {Crosshair} from '../../components/Crosshair';
import {ScopeOverlay} from '../../components/ScopeOverlay';
import {createTacticalAssessmentPlan,tacticalAssessmentSettings,tacticalAssessmentContext,type TacticalAssessmentPlan} from '../TacticalAssessmentRuntime';
import './tactical-assessment.css';

export interface TacticalAssessmentProps {settings:Settings;base:number;alternative?:number;onRecord:(record:AimRecord)=>void;onClose:()=>void;seed?:number;}
export function TacticalAssessment({settings,base,alternative,onRecord,onClose,seed}:TacticalAssessmentProps){
 const dialog=useRef<HTMLDialogElement>(null),host=useRef<HTMLDivElement>(null),runtime=useRef<Runtime|null>(null),callback=useRef(onRecord),activeBlock=useRef('');callback.current=onRecord;
 const [adsAlternative,setAdsAlternative]=useState(settings.adsSensitivity),[plan,setPlan]=useState<TacticalAssessmentPlan|null>(null),[index,setIndex]=useState(0),[locked,setLocked]=useState(false),[telemetry,setTelemetry]=useState<Telemetry>(INITIAL_TELEMETRY),[count,setCount]=useState(0),[finished,setFinished]=useState(false),[error,setError]=useState(''),[closing,setClosing]=useState(false);
 const block=plan?.blocks[index];
 useEffect(()=>{dialog.current?.showModal();return()=>dialog.current?.close();},[]);
 useEffect(()=>{
  if(!block||!host.current)return;setCount(0);setFinished(false);setError('');setTelemetry(INITIAL_TELEMETRY);activeBlock.current=block.id;
  const localSettings=tacticalAssessmentSettings(settings,block);let r:Runtime;let total=0;
  const context=tacticalAssessmentContext(block,record=>{callback.current(record);if(activeBlock.current!==block.id)return;total++;setCount(total);if(total>=block.trials)r.finish();},setError);
  try{r=new Runtime(host.current,'free',block.weapon,localSettings,false,value=>{setTelemetry(value);if(value.time>=block.duration+block.warmupSeconds&&!r.simulation.completed)r.finish();},setLocked,setError,()=>{setFinished(true);setLocked(false);},undefined,context);runtime.current=r;}
  catch(e){setError(e instanceof Error?e.message:'실전 측정 화면을 시작하지 못했습니다.');return;}
  return()=>{activeBlock.current='';runtime.current=null;r.dispose();};
 },[block?.id]);
 const close=()=>{setClosing(true);const r=runtime.current;if(r){r.simulation.running=false;if(document.pointerLockElement===r.renderer.canvas)document.exitPointerLock();}void(r?.flushAimAssessment()??Promise.resolve()).finally(onClose);};
 const localSettings=block?tacticalAssessmentSettings(settings,block):settings;
 return <dialog ref={dialog} className="aim-session tactical-assessment" aria-labelledby="tactical-assessment-title" onCancel={event=>event.preventDefault()}><header><div><small>일반 훈련 설정을 바꾸지 않는 독립 실전 평가</small><h2 id="tactical-assessment-title">전술 사격 · 정조준 감도 검증</h2></div><button disabled={closing} onClick={close}>측정 종료</button></header>
 {!plan?<section className="tactical-assessment-intro"><h3>비조준과 정조준을 따로 비교합니다.</h3><p>전술 각쪼개기는 실제 감도 {base}{alternative&&alternative!==base?` / ${alternative}`:''}를 비교합니다. 정조준은 비조준 감도 {base}를 고정하고 아래 정조준 배율만 비교합니다.</p><label className="number-field">비교할 정조준 감도 배율<input aria-label="비교할 정조준 감도 배율" type="number" min="0.1" max="2" step="0.05" value={adsAlternative} onChange={event=>{const value=event.target.valueAsNumber;if(Number.isFinite(value))setAdsAlternative(Math.max(.1,Math.min(2,value)));}}/></label><p>현재 정조준 배율 {settings.adsSensitivity} · 같게 두면 해당 배율의 기준 측정만 진행합니다.</p><ul><li>실제 전술 맵의 엄폐·노출·이동·반동·산포·수비수가 작동합니다.</li><li>밴달·팬텀 1.25배, 오퍼레이터 2.5배·5배를 각각 기록합니다.</li><li>배율은 우클릭과 설정된 배율 키로 직접 맞추세요. 다른 배율로 쏜 기록은 해당 비교에서 제외됩니다.</li><li>각 블록은 워밍업 2초 뒤 8발 또는 최대 40초이며, 두 번 교차 반복합니다. 블록 사이에 자유롭게 쉴 수 있습니다.</li></ul><p className="field-note">이 실전 과제는 통제된 클릭 검사보다 변동이 큽니다. 한 차례의 결과로 실제 게임 전이나 최적 정조준 배율을 확정하지 않습니다.</p><button className="primary-button" onClick={()=>{setPlan(createTacticalAssessmentPlan({base,alternative,adsBase:settings.adsSensitivity,adsAlternative,seed}));setIndex(0);}}>실전 비교 계획 만들기</button></section>:block?<><div className="tactical-assessment-block"><strong>{block.label}</strong><span>블록 {index+1} / {plan.blocks.length} · {block.factor==='sensitivity'?'감도':'정조준 배율'} {block.value.toFixed(3)} · 반복 {block.round+1}</span></div><div className="game-stage tactical-assessment-stage"><div ref={host} className="webgl-host"/>{block.weapon==='operator'?<ScopeOverlay amount={telemetry.scopeAmount??0} zoom={telemetry.scopeZoom??1} state={telemetry.operatorState} zoomBinding={localSettings.operatorZoomBinding}/>:<Crosshair settings={localSettings} ads={telemetry.ads}/>}
 <div className="tactical-assessment-hud" aria-live="polite"><span>{telemetry.time<2?'워밍업 · 분석 제외':`기록 ${count} / ${block.trials}`}</span><span>잔여 {Math.max(0,Math.ceil(block.duration+2-telemetry.time))}초</span><span>요구 배율 {block.zoom}× · 현재 {(telemetry.scopeZoom??1).toFixed(2)}×</span><span>{telemetry.ammo}발 · 속도 {telemetry.speed.toFixed(2)} m/s</span></div>
 {!locked&&<div className="pause-overlay"><div className="pause-card"><h3>{finished?'블록 측정 종료':telemetry.peeking?.deaths?'수비수와 교전 후 일시정지':'실전 평가 준비'}</h3><p>{block.zoom===1?'엄폐에서 직접 각을 확인하고 제동한 뒤 머리를 조준해 사격하세요.':'정해진 배율로 정조준하고 이동을 멈춘 뒤 한 발씩 조준하세요.'}</p><p>WASD 이동 · C 앉기 · 우클릭 조준 · {localSettings.operatorZoomBinding.replace('Key','')} 배율 · ESC 일시정지</p>{error&&<p role="alert">{error}</p>}{finished?<><p>{count}개 기록을 수집했습니다. 8개가 모이지 않은 블록은 완전한 비교로 사용하지 않습니다.</p>{index+1<plan.blocks.length?<button className="primary-button" disabled={closing} onClick={()=>{const r=runtime.current;setClosing(true);void(r?.flushAimAssessment()??Promise.resolve()).then(()=>{setIndex(i=>i+1);setClosing(false);});}}>다음 블록 준비 · 휴식 후 계속</button>:<button className="primary-button" onClick={close}>결과로 돌아가기</button>}</>:<button className="primary-button" onClick={()=>{const r=runtime.current;if(!r)return;if(r.simulation.exposure.death)r.retryTactical();void r.resume();}}>클릭하여 실전 측정 시작</button>}</div></div>}
 </div><p className="field-note">부위별 실제 명중과 조준 궤적을 함께 기록합니다. 이동 오차·반동·산포가 있는 사격은 별도 집계하며 중립 감도 탐색 점수에 합치지 않습니다.</p></>:null}</dialog>;
}
export {TacticalResults} from './TacticalResults';
