import type {Settings} from '../engine/types';
import type {MovementAction,MovementPracticeSnapshot,MovementToolsSettings,MovementToolBinding} from '../training/movementTools/types';
import {defaultMovementTools} from '../training/movementTools/types';
import {compareMovementGhost,type MovementGhost} from '../training/movementTools/GhostFromReplay';
import './movementPractice.css';

export interface MovementPracticePanelProps {
 settings:Settings;snapshot:MovementPracticeSnapshot|null;
 onAction:(action:MovementAction)=>void;onSettings:(patch:Partial<Settings>)=>void;
 onBuildGhost?:()=>void;onReview?:()=>void;
 ghostStatus?:'idle'|'preparing'|'ready'|'failed';ghostError?:string;
 ghost?:MovementGhost|null;
}
const LABELS:Record<MovementToolBinding,string>={save:'위치 저장',restore:'저장 위치 복원',takeoff:'마지막 이륙점',reset:'시도 초기화'};
const ACTIONS:Record<MovementToolBinding,MovementAction['kind']>={save:'movement-save',restore:'movement-restore',takeoff:'movement-takeoff',reset:'movement-reset'};
const KEYS=['save','restore','takeoff','reset'] as const;
const keyName=(code:string)=>code.startsWith('Key')?code.slice(3):code;
const meters=(value:number|null|undefined)=>value===null||value===undefined?'—':value.toFixed(2)+'m';
const delta=(value:number|null,unit:string)=>value===null?'—':(Math.abs(value)<.005?0:value).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2,signDisplay:'exceptZero'})+unit;

/** Paused controls; movement remains manual and ghosts are display-only. */
export function MovementPracticePanel({settings,snapshot,onAction,onSettings,onBuildGhost,onReview,ghostStatus='idle',ghostError,ghost=null}:MovementPracticePanelProps){
 const tools=settings.movementTools??defaultMovementTools(),attempt=snapshot?.current??snapshot?.last;
 const patch=(value:Partial<MovementToolsSettings>)=>onSettings({movementTools:{...tools,...value,bindings:value.bindings??{...tools.bindings}}});
 const available:Record<MovementToolBinding,boolean>={save:true,restore:!!snapshot?.saved,takeoff:!!snapshot?.canReturnTakeoff,reset:!!snapshot?.canReset};
 const reserved=new Set([...Object.values(settings.bindings),settings.operatorZoomBinding]);
 const samples=attempt?.samples??[],maxSpeed=Math.max(1,...samples.map(p=>p[4])),duration=Math.max(.001,attempt?.duration??0);
 const comparison=attempt&&ghost?compareMovementGhost(ghost,attempt):null;
 const firstGhostSample=ghost?.samples[0],lastGhostSample=ghost?.samples.at(-1);
 const ghostRetention=ghost?.landings===1&&ghost.landing&&firstGhostSample&&lastGhostSample?.[5]&&firstGhostSample[4]>1e-8?lastGhostSample[4]/firstGhostSample[4]:null;
 const retentionDelta=attempt?.speedPreservation!==null&&attempt?.speedPreservation!==undefined&&ghostRetention!==null?(attempt.speedPreservation-ghostRetention)*100:null;
 return <details className="movement-practice-panel"><summary>이동 연습 도구 · 위치·궤적·고스트</summary>
  <label className="movement-practice-toggle"><span>이동 연습 도구 사용</span><input type="checkbox" checked={tools.enabled} onChange={e=>patch({enabled:e.target.checked})}/></label>
  <p className="field-note">기존 맵과 선택한 이동 물리를 그대로 사용합니다. 키를 눌러 저장·복원하며, 공중 조향과 점프는 직접 조작합니다.</p>
  {tools.enabled&&<>
   <div className="movement-practice-actions">{KEYS.map(action=><button type="button" className="secondary-button" key={action} disabled={!available[action]} onClick={()=>onAction({kind:ACTIONS[action]})}><span>{LABELS[action]}</span><kbd>{keyName(tools.bindings[action])}</kbd></button>)}</div>
   <p className="movement-practice-message" role="status">{snapshot?.message??'이동을 시작하면 이륙과 착지 정보를 기록합니다.'}</p>
   <div className="movement-practice-options"><label><input type="checkbox" checked={tools.showTrajectory} onChange={e=>patch({showTrajectory:e.target.checked})}/> 궤적 표시</label><label><input type="checkbox" checked={tools.showGhost} onChange={e=>patch({showGhost:e.target.checked})}/> 이전 시도 고스트 표시</label></div>
   {attempt&&<div className="movement-attempt-summary"><b>{snapshot?.current?'현재 이동 시도':'최근 착지 시도'}{attempt.truncated?' · 기록 한도':''}</b><dl><div><dt>경과</dt><dd>{attempt.duration.toFixed(2)}s</dd></div><div><dt>최고 높이</dt><dd>{meters(attempt.peakHeight)}</dd></div><div><dt>이동 거리</dt><dd>{meters(attempt.distance)}</dd></div><div><dt>최고 속도</dt><dd>{attempt.peakSpeed.toFixed(2)}m/s</dd></div><div><dt>착지 속도</dt><dd>{attempt.landingSpeed===null?'—':attempt.landingSpeed.toFixed(2)+'m/s'}</dd></div><div><dt>속도 보존</dt><dd>{attempt.speedPreservation===null?'—':(attempt.speedPreservation*100).toFixed(1)+'%'}</dd></div></dl>
    {samples.length>1&&<svg viewBox="0 0 300 72" role="img" aria-label="이동 시도의 시간별 수평 속도"><path d="M 1 64 H 299" stroke="currentColor" opacity=".3"/><polyline fill="none" stroke="var(--accent,#ef5261)" strokeWidth="1.5" points={samples.map(p=>(1+Math.min(1,p[0]/duration)*298)+','+(64-Math.min(1,p[4]/maxSpeed)*58)).join(' ')}/></svg>}
   </div>}
   {comparison&&<div className="movement-attempt-summary movement-ghost-comparison" aria-label="이전 고스트와 수치 비교"><b>이전 고스트와 비교</b><p className="field-note">현재 시도 − 이전 고스트. 착지 차이는 두 위치 사이의 거리입니다.</p>{snapshot?.current&&<p className="field-note">진행 중인 시도입니다. 착지하면 최종 값을 확인하세요.</p>}<dl>
    <div><dt>시간 차이</dt><dd data-movement-delta="duration">{delta(comparison.elapsedDelta,'s')}</dd></div>
    <div><dt>이동 거리 차이</dt><dd data-movement-delta="distance">{delta(comparison.distanceDelta,'m')}</dd></div>
    <div><dt>최고 속도 차이</dt><dd data-movement-delta="speed">{delta(comparison.peakSpeedDelta,'m/s')}</dd></div>
    <div><dt>최고 높이 차이</dt><dd data-movement-delta="height">{delta(comparison.peakHeightDelta,'m')}</dd></div>
    <div><dt>착지 위치 차이</dt><dd data-movement-delta="landing">{meters(comparison.landingDistance)}</dd></div>
    <div><dt>속도 보존 차이</dt><dd data-movement-delta="preservation">{delta(retentionDelta,'%p')}</dd></div>
   </dl></div>}
   <div className="movement-practice-actions"><button type="button" className="secondary-button" disabled={!snapshot?.last||!onBuildGhost||ghostStatus==='preparing'} onClick={onBuildGhost}>{ghostStatus==='preparing'?'고스트 계산 중…':'최근 시도 고스트 만들기'}</button><button type="button" className="secondary-button" disabled={!snapshot?.last||!onReview} onClick={onReview}>최근 시도 카메라 검토</button></div>
   {ghostStatus==='ready'&&<p className="field-note" role="status">공유 리플레이로 고스트를 계산했습니다. 충돌·명중 판정에는 영향을 주지 않습니다.</p>}{ghostError&&<p className="inline-notice" role="status">{ghostError}</p>}
   <details className="movement-practice-bindings"><summary>이동 도구 키 지정</summary>{KEYS.map(action=><label key={action}><span>{LABELS[action]}</span><select aria-label={LABELS[action]+' 키'} value={tools.bindings[action]} onChange={e=>patch({bindings:{...tools.bindings,[action]:e.target.value}})}>{Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ',letter=>'Key'+letter).map(code=><option key={code} value={code} disabled={reserved.has(code)||Object.entries(tools.bindings).some(([other,value])=>other!==action&&value===code)}>{keyName(code)}</option>)}</select></label>)}<p className="field-note">이동·재장전·무기·스코프 키와 중복할 수 없습니다.</p></details>
   <p className="field-note">복원은 맵·벽·천장·지지면·물리 버전을 확인합니다. 점프 입력 버퍼와 연속 점프 타이밍을 지우고 저장된 실제 속도로 이어집니다. 궤적은 시도당 최대 20초·600점입니다.</p>
  </>}
 </details>;
}
