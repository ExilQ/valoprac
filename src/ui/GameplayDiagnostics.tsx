import type {HudRuntime} from './GameHUD';
import {DRILL_LABELS} from '../training/modes/TapDrill';
import {COMBAT_MODE_LABELS} from './CombatControls';
import {activeAngles} from '../engine/tactical/complex';
export function GameplayDiagnostics({runtime:r,placement='all'}:{runtime:HudRuntime|null;placement?:'all'|'training'|'input'}){if(!r)return null;const s=r.simulation,input=r.input,d=s.settings.inputDiagnostics?input.diagnostics.snapshot():null,max=s.exposure?Math.max(0,...s.exposure.values):0;
 return <>{d&&placement!=='training'&&<aside className="input-diagnostics"><b>입력 진단</b><span>마우스 잠금 {input.locked?'사용 중':'해제'}</span><span>원시 요청 {({accepted:'브라우저 수락 · 센서 경로 미검증',unverified:'확인 불가',fallback:'일반 상대 입력 대체',denied:'거부'})[input.rawConfirmation]}</span><span>키 잠금 {({locked:'사용 중',idle:'미사용',denied:'거부',unsupported:'미지원'})[input.keyboardStatus]}</span><span>전달 빈도 {d.deliveredHz.toFixed(0)}회/초 · 센서 주파수 아님</span><span>입력 콜백 상위 5% {d.callbackP95.toFixed(3)}밀리초</span><span>이벤트 전달 지연 상위 5% {d.deliveryP95.toFixed(2)}밀리초</span><small>운영체제 가속과 화면 반응 시간은 측정하지 않습니다.</small></aside>}
 {placement!=='input'&&s.settings.drill!=='none'&&!s.level&&<aside className="drill-hud"><b>{DRILL_LABELS[s.settings.drill]}</b><span>{s.tap.last}</span><small>시도 {s.tap.stats.attempts} · 제동 헤드샷 {s.tap.stats.successes} · 이른 발사 {s.tap.stats.early}</small><small>정확 구간 {s.braking.thresholdTime===null?'대기':s.braking.windowEnd===null?'현재 진입':`${Math.round((s.braking.windowEnd-s.braking.thresholdTime)*1000)}밀리초`}</small></aside>}
 {placement!=='input'&&s.level&&s.practiceMap==='bunny'&&<aside className="drill-hud"><b>버니합 훈련 · 수동 입력</b><span>착지 직전에 점프 키를 새로 눌러 연결하세요.</span><small>입력 버퍼 {s.settings.jumpBufferMs}ms · 지상·공중 속도 제한 적용</small></aside>}
 {placement!=='input'&&s.drill&&<FundamentalsHud drill={s.drill.snapshot()} title={s.level?.title??''}/>}{placement!=='input'&&s.level&&!s.drill&&s.practiceMap!=='bunny'&&<aside className="drill-hud"><b>{s.level.title} · 각 {s.defenders?s.targets.filter(t=>t.enabled&&!t.active).length:s.angles?.progress??0}개 완료</b><span>{s.targets.filter(t=>t.enabled).every(t=>!t.active)?'모든 각 정리 완료 · 일시정지 메뉴에서 표적 초기화':`${s.practiceMap==='complex'?activeAngles(s.settings.peekScenario).slice(0,s.settings.targetCount).length:s.level.angles.length}개 방어각 · 엄폐하며 순차 확인`}</span><small>현재 최장 노출 {max.toFixed(2)}초{s.settings.combatMode==='exposure'||s.settings.combatMode==='learning'&&s.settings.exposureEnabled?` / ${s.settings.exposureLimit.toFixed(1)}초 · ${s.settings.exposureMode==='continuous'?'연속 노출':'누적 노출'}`:` · ${COMBAT_MODE_LABELS[s.settings.combatMode]}`}</small></aside>}</>;
}

const DRILL_LABEL={preaim:'프리에임',angles:'각 체크',flick:'플릭',micro:'미세조정'} as const;
/** Fundamentals drills: progress and the skill each drill measures. */
function FundamentalsHud({drill,title}:{drill:import('../engine/tactical/FundamentalsDrill').FundamentalsSnapshot;title:string}){
 const rounds=drill.kind==='preaim'||drill.kind==='angles';
 return <aside className="drill-hud fundamentals-hud" data-drill={drill.kind}>
  <b>{title} · {DRILL_LABEL[drill.kind]}{rounds?` · 라운드 ${drill.round} · ${drill.cleared}/${drill.total}`:` · ${drill.kills}명 처치`}</b>
  <span>{drill.kind==='preaim'?'모서리를 돌기 전에 머리 높이에 조준점을 두세요':drill.kind==='angles'?'각을 하나씩 확인하고 어깨를 내미는 순간을 노리세요':drill.kind==='flick'?'멀리 나타나는 표적을 한 번에 끊어 치세요':'작게 움직이는 머리를 미세하게 따라가세요'}</span>
  <small>{[drill.preaimErrorDeg!==null&&`첫 노출 조준 오차 ${drill.preaimErrorDeg}°`,drill.flickDeg!==null&&`평균 플릭 ${drill.flickDeg}°`,drill.reactionMs!==null&&`평균 처치 ${drill.reactionMs}밀리초`,drill.roundSeconds!==null&&`라운드 ${drill.roundSeconds}초`,drill.kind==='flick'&&drill.misses>0&&`놓침 ${drill.misses}`].filter(Boolean).join(' · ')||'기록 대기 중'}</small>
 </aside>;
}
