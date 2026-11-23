import type {DefenderState,PerceptionPhase} from '../engine/tactical/DefenderAI';
import type {Simulation} from '../engine/simulation/Simulation';
import type {HopSnapshot} from '../engine/movement/Movement';
import {PENETRATION_MATERIALS} from '../config/penetration';
const STATE_LABELS:Record<DefenderState,string>={holding:'각 유지',listening:'소리 청취',alert:'경계',tracking:'추적',firing:'사격',recovering:'회복',repositioning:'재배치','re-peeking':'재피킹',returning:'엄폐 복귀',eliminated:'제거됨'};
const PHASE_LABELS:Record<PerceptionPhase,string>={unaware:'미인지',detected:'감지',recognized:'인식',reacting:'반응 대기',aiming:'조준 접근',tracking:'추적',lost:'시야 상실'};
const STOP_LABELS:Record<string,string>={target:'표적 명중',range:'최대 거리',material:'관통 불가 재질',capacity:'관통력 소진',layers:'통과 층 제한',floor:'바닥 충돌'};
const timing=(n:number|null)=>n===null?'—':`${n>=0?'+':''}${Math.round(n)}ms`;
export function HopFeedback({h,compact=false}:{h:HopSnapshot;compact?:boolean}){
 return <section className={compact?'mechanics-hud':'data-card'} aria-label="버니합 훈련 분석"><h3>점프·착지 분석</h3><div className="mechanics-readouts"><span>점프 · 연속 연결<b>{h.jumps}회 · {h.chainedJumps}회</b></span><span>최근 착지 기준 입력<b>{timing(h.lastInputTimingMs)}</b></span><span>입력 평균 · 편차<b>{timing(h.timingMeanMs)} · {h.timingDeviationMs===null?'—':`${h.timingDeviationMs.toFixed(0)}ms`}</b></span><span>최고 속도<b>{h.peakSpeed.toFixed(2)}m/s</b></span><span>최근 속도 보존<b>{h.speedPreservation===null?'—':`${(h.speedPreservation*100).toFixed(0)}%`}</b></span><span>현재 지면 접촉<b>{Math.round(h.groundContactSeconds*1000)}ms</b></span></div>{!compact&&<p className="field-note">음수는 착지 전 입력입니다. 연속 연결은 실제 착지와 새 점프 입력으로 기록하며, 키 유지에 의한 자동 점프는 포함하지 않습니다. 최고 속도는 이 훈련의 실측값입니다.</p>}</section>;
}
export function WallbangFeedback({simulation:s}:{simulation:Simulation}){
 const shot=s.shots.at(-1),segments=shot?.penetrationSegments??[],last=segments.at(-1);
 if(!shot)return <section className="mechanics-hud"><h3>월샷 훈련</h3><span>엄폐물에 사격해 통과 구간과 피해를 확인하세요.</span></section>;
 return <section className="mechanics-hud" aria-label="관통 사격 결과"><h3>최근 관통 사격</h3><div className="mechanics-readouts"><span>실제 통과 층<b>{shot.penetratedLayers??0}층</b></span><span>재질<b>{last?PENETRATION_MATERIALS[last.material].name:'엄폐물 없음'}</b></span><span>사선 기준 두께<b>{segments.reduce((sum,p)=>sum+p.thickness,0).toFixed(2)}m</b></span><span>피해<b>{['head','torso','arm','leg'].includes(shot.hit)?(shot.damage??0).toFixed(1):'명중 없음'}</b></span></div><small>{last&&!last.penetrated?'관통 저항 또는 층 제한으로 정지':segments.length?'재질을 통과한 탄도':'직접 사격'} · 보정 모델</small></section>;
}
export function CombatDiagnostics({simulation:s}:{simulation:Simulation}){
 const bots=s.settings.botDiagnostics?s.defenders?.diagnostics()??[]:[],shot=s.settings.penetrationDiagnostics?s.shots.at(-1):undefined;
 if(!bots.length&&!shot)return null;
 const b=bots[0],deg=180/Math.PI;
 return <aside className="combat-diagnostics" aria-label="개발자 전투 진단"><b>개발자 진단 · 내부 정보</b>{b&&<><span>봇 {b.bot+1} · {STATE_LABELS[b.state]} / {PHASE_LABELS[b.phase]}</span><span>실제 조준 {Math.round(b.motor.yaw*deg)}° / {(b.motor.pitch*deg).toFixed(1)}°</span><span>목표 조준 {Math.round(b.motor.desiredYaw*deg)}° / {(b.motor.desiredPitch*deg).toFixed(1)}°</span><span>잔여 오차 {(b.motor.correction*deg).toFixed(2)}° · 반응 잔여 {Math.max(0,b.reactionUntil-s.time).toFixed(2)}초</span><span>반동 {b.recoil.pitch.toFixed(2)}° / {b.recoil.yaw.toFixed(2)}°</span><span>탄창 {b.ammo} · 연사 잔여 {b.burstRemaining}</span><span>마지막 인지 {b.known?`${b.known.x.toFixed(1)}, ${b.known.y.toFixed(1)}, ${b.known.z.toFixed(1)}`:'없음'} · 불확실성 {b.uncertaintyMetres.toFixed(1)}m</span>{bots.length>1&&<small>활성 봇 {bots.length}개 중 첫 봇 표시</small>}</>}{shot&&<><span>탄도 정지: {shot.penetrationStop?STOP_LABELS[shot.penetrationStop]??'기타 충돌':'없음'}</span>{shot.penetrationSegments?.map((p,i)=><span key={i}>{PENETRATION_MATERIALS[p.material].name} {p.thickness.toFixed(3)}m · 잔여 피해 {(p.damageAfter*100).toFixed(1)}% · {p.penetrated?'통과':'정지'}</span>)}</>}</aside>;
}
