import {OperatorScopeControls} from './OperatorScopeControls';
import {CombatControls} from './CombatControls';
import {WEAPONS,WEAPON_ORDER} from '../config/weapons';
import {useApp} from '../app/store';
import {TacticalMapSelection} from './TacticalMapSelection';
import {DRILL_LABELS} from '../training/modes/TapDrill';
import type {Drill,Settings} from '../engine/types';
export function TacticalControls({menu=false}:{menu?:boolean}){
 const s=useApp(x=>x.settings),update=useApp(x=>x.updateSettings),setMode=useApp(x=>x.setMode);
 const choose=(drill:Drill)=>{
  if(menu)setMode(['tapAD','tapDA','release','wide','repeat','stopMoving','moving'].includes(drill)?'braking':'free');
  const patch:Partial<Settings>=drill==='stopMoving'?{behavior:'reactive',practiceMap:'range'}:drill==='moving'?{practiceMap:'range',analysisWall:true,recoilAnalysis:true}:drill==='corner'?{practiceMap:'garage'}:drill==='vertical'?{practiceMap:'mid'}:drill==='mixed'?{practiceMap:'multi'}:drill==='bunny'?{practiceMap:'bunny',combatMode:'learning',exposureEnabled:false}:drill==='wallbang'?{practiceMap:'wallbang',combatMode:'learning',exposureEnabled:false}:{practiceMap:'range',analysisWall:false};
  update({drill,...patch});
 };
 return <section className="tactical-controls settings-card"><h3>전술·이동 훈련</h3>
 <label className="practice-select">훈련 과제<select aria-label="훈련 과제" value={s.drill} onChange={e=>choose(e.target.value as Drill)}>{Object.entries(DRILL_LABELS).map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label>
 {s.practiceMap==='bunny'?<section className="movement-configuration"><h4>수동 점프와 관성</h4><p className="field-note">착지 직전에 점프 키를 다시 눌러 다음 점프를 연결하세요. 키를 계속 누르고 있어도 자동으로 반복 점프하지 않습니다. 공중 방향 전환은 현재 속도와 가속 한도를 따릅니다.</p><label className="range-field"><span>착지 전 입력 버퍼<b>{s.jumpBufferMs}ms</b></span><input aria-label="착지 전 입력 버퍼" type="range" min="0" max="140" step="5" value={s.jumpBufferMs} onChange={e=>update({jumpBufferMs:+e.target.value})}/></label><p className="field-note">이동 모델은 훈련용 보정값이며 실제 게임의 세부 물리와 동일하다고 검증하지 않았습니다.</p></section>:<><CombatControls/><div className="operator-configuration"><h4>수비수 장비</h4><label className="practice-select">방어 무기<select value={s.defenderWeapon} onChange={e=>update({defenderWeapon:e.target.value as Settings['defenderWeapon']})}><option value="mixed">시나리오별 혼합</option>{WEAPON_ORDER.map(id=><option key={id} value={id}>{WEAPONS[id].name}</option>)}</select></label><label className="practice-toggle"><span>검증된 위치 안에서 무작위 배치</span><input type="checkbox" checked={s.randomDefenders} onChange={e=>update({randomDefenders:e.target.checked})}/></label></div></>}
 {s.practiceMap==='wallbang'&&<section className="wallbang-configuration"><h4>재질과 관통</h4><p className="field-note">같은 엄폐물도 무기·재질·관통한 두께·입사각에 따라 피해가 달라집니다. 사격 후 진단에서 실제 통과 구간을 확인할 수 있습니다.</p><label className="practice-toggle"><span>개발자용 관통 진단</span><input type="checkbox" checked={s.penetrationDiagnostics} onChange={e=>update({penetrationDiagnostics:e.target.checked})}/></label><p className="field-note">관통 저항과 피해 감소는 공개된 게임 내부 공식이 아닌 훈련용 보정 모델입니다.</p></section>}
 <details><summary>저격 스코프 · 표적 이동</summary><OperatorScopeControls compact/><label className="practice-select">표적 이동 난이도<select value={s.botDifficulty} onChange={e=>update({botDifficulty:e.target.value as Settings['botDifficulty']})}><option value="easy">입문 · 느린 이동</option><option value="normal">보통</option><option value="hard">숙련 · 빠른 방향 전환</option></select></label><p className="field-note">수비수의 조준 실력과 표적 이동 난이도는 별도로 조정합니다. 소총 ADS 설정은 유지됩니다. 저격총은 이동·착지 직후와 비조준 사격에 큰 오차가 적용됩니다.</p></details>
 {s.practiceMap==='complex'&&<section className="peeking-duration" aria-label="피킹 훈련 시간"><label className="practice-toggle"><span>시간제 피킹</span><input type="checkbox" checked={s.peekingTimed} onChange={e=>update({peekingTimed:e.target.checked})}/></label>{s.peekingTimed?<div className="duration-options">{[30,60,120].map(n=><button key={n} aria-pressed={s.duration===n} onClick={()=>update({duration:n})}>{n}초</button>)}</div>:<p className="field-note">직접 종료할 때까지 계속됩니다.</p>}</section>}
 {menu&&<details><summary>전체 전술 맵 선택</summary><TacticalMapSelection includeBase/><p className="field-note">분리 진입과 고저차를 훈련하는 자체 제작 공간입니다. 공식 지도·원본 좌표·추출 에셋을 사용하지 않습니다.</p></details>}
 <a href="/tactical-guide.html" target="_blank" rel="noreferrer">이동·정조준·전술 맵 검증 현황</a></section>;
}
