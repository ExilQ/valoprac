import {useEffect,useState} from 'react';
import type {SessionData,WeaponId} from '../engine/types';
import {WEAPONS,WEAPON_ORDER} from '../config/weapons';
import {DEFAULT_FLASH_OPTIONS,DEFAULT_WARMUP_OPTIONS,type ExerciseKind,type ExerciseOptions,type ExerciseReport} from '../training/exercises/types';
import {clearExerciseBests,recordExerciseBest} from '../training/exercises/personalBest';
import {SessionReplay} from './SessionReplay';
import './exerciseTraining.css';

export function ExerciseSetup({kind,onStart}:{kind:ExerciseKind;onStart:(options:ExerciseOptions,weapon:WeaponId)=>void}){
 const [weapon,setWeapon]=useState<WeaponId>('rifleA'),[window,setWindow]=useState(.8),[turn,setTurn]=useState(100),[message,setMessage]=useState('');
 return <section className="exercise-setup data-card"><p className="eyebrow">60 SECONDS / ORIGINAL TRAINING</p><h2>{kind==='warmup'?'1분 워밍업':'플래시 회피 훈련'}</h2><p>{kind==='warmup'?'각을 잡고 지나가는 표적을 실제 3D 조준과 사격으로 제거하세요. 점수는 제거 수 하나로 비교합니다.':'신호가 나타나면 마우스로 시야를 돌리세요. 실제 회전 시작과 기준 각도 도달 시점을 기록합니다.'}</p>
  <label className="practice-select">사용 무기<select value={weapon} onChange={e=>setWeapon(e.target.value as WeaponId)}>{WEAPON_ORDER.map(id=><option value={id} key={id}>{WEAPONS[id].name}</option>)}</select></label>
  {kind==='flash'&&<div className="exercise-option-row"><label>반응 창 <strong>{window.toFixed(2)}초</strong><input aria-label="플래시 반응 창" type="range" min="0.25" max="1.5" step="0.05" value={window} onChange={e=>setWindow(+e.target.value)}/></label><label>회전 기준 <strong>{turn}°</strong><input aria-label="플래시 회전 기준" type="range" min="60" max="150" step="5" value={turn} onChange={e=>setTurn(+e.target.value)}/></label></div>}
  <button className="primary-button" onClick={()=>onStart(kind==='warmup'?{...DEFAULT_WARMUP_OPTIONS}:{...DEFAULT_FLASH_OPTIONS,responseWindowSeconds:window,turnThresholdDegrees:turn},weapon)}>1분 훈련 시작</button>
  <p className="field-note">입력과 판정은 공통 엔진·리플레이를 사용합니다. 첫 진입에는 그래픽 준비가 필요하며, 완료 후 다시 시작할 때 렌더러를 재사용합니다. 실제 게임의 능력 효과나 반응속도 검사를 그대로 복제한 과제가 아닙니다.</p>
  <button className="back-button" onClick={()=>setMessage(clearExerciseBests()?'이 브라우저의 1분 과제 최고 기록을 지웠습니다.':'최고 기록을 지우지 못했습니다.')}>1분 과제 최고 기록 지우기</button>{message&&<p role="status">{message}</p>}
 </section>;
}
export function ExerciseHUD({report}:{report:ExerciseReport|undefined}){const cue=report?.flash?.active;if(!cue)return null;return <aside className="flash-turn-cue" role="status"><b>회피 신호 · 시야를 돌리세요</b><span>{cue.maximumTurnDegrees.toFixed(0)}° 회전 · 남은 {Math.max(0,cue.deadline-cue.cueTime-(report!.elapsedSeconds-cue.cueTime)).toFixed(2)}초</span></aside>;}
export function ExerciseResults({session,onRetry,onDetails,onExit}:{session:SessionData;onRetry:()=>void;onDetails?:()=>void;onExit:()=>void}){
 const report=session.exercise,[best,setBest]=useState<{score:number|null;improved:boolean;saved:boolean}>({score:null,improved:false,saved:true});
 useEffect(()=>{setBest(recordExerciseBest(session));},[session.id]);if(!report)return null;
 const flash=report.flash,warmup=report.warmup;
 return <section className="exercise-results"><p className="eyebrow">{report.completed?'60초 훈련 완료':'훈련 조기 종료'}</p><h2>{report.kind==='warmup'?'1분 워밍업':'플래시 회피 훈련'}</h2><div className="exercise-score"><strong>{report.score}</strong><span>{report.kind==='warmup'?'제거':'회피 성공'}</span></div><p>같은 버전·시드·무기·이동 물리·과제 설정의 최고 기록 <b>{best.score??'—'}</b>{best.improved?' · 새 기록':''}</p>
  {warmup&&<p>발사 {warmup.shots}발 · 명중률 {warmup.hitAccuracy.toFixed(1)}% · 지나간 표적 {warmup.escaped}개</p>}
  {flash&&<div className="exercise-result-metrics"><span>성공률 <b>{flash.successRate.toFixed(1)}%</b></span><span>회전 시작 평균 <b>{flash.meanOnsetSeconds===null?'—':Math.round(flash.meanOnsetSeconds*1000)+'ms'}</b></span><span>기준 도달 평균 <b>{flash.meanCompletionSeconds===null?'—':Math.round(flash.meanCompletionSeconds*1000)+'ms'}</b></span></div>}
  {!best.saved&&<p role="status">최고 기록을 저장하지 못했습니다. 현재 결과는 계속 확인할 수 있습니다.</p>}
  <div className="exercise-result-actions"><button className="primary-button" onClick={onRetry}>같은 설정으로 즉시 재시작</button>{onDetails&&<button className="secondary-button" onClick={onDetails}>상세 결과</button>}<button className="secondary-button" onClick={onExit}>훈련장으로</button></div><SessionReplay session={session}/>
 </section>;
}
