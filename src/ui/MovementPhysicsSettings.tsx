import {resolveMovementPhysics} from '../config/movement';
import {useApp} from '../app/store';
import type {Settings} from '../engine/types';

export const MOVEMENT_PHYSICS_LABELS:Record<Settings['movementPhysics'],string>={valorant:'발로란트 물리엔진',counterStrike:'카운터 스트라이크 물리엔진'};
export function movementPhysicsLabel(s:Pick<Settings,'movementPhysics'|'csMovementPreset'>){
 return s.movementPhysics!=='counterStrike'?'발로란트':s.csMovementPreset==='sourceClassic'?'카운터 스트라이크 · 클래식 Source':'카운터 스트라이크 · CS2 보정';
}

export function MovementPhysicsSettings(){
 const s=useApp(x=>x.settings),update=useApp(x=>x.updateSettings);
 const isCS=s.movementPhysics==='counterStrike',physics=resolveMovementPhysics(s),effectiveBuffer=Math.round((physics.jumpBufferSeconds??0)*1000);
 return <section className="settings-card movement-physics-settings" aria-labelledby="movement-physics-heading"><h3 id="movement-physics-heading">이동 물리엔진</h3>
 <label className="practice-select">이동 물리엔진<select aria-label="이동 물리엔진" aria-describedby="movement-physics-description" value={s.movementPhysics} onChange={e=>update({movementPhysics:e.target.value as Settings['movementPhysics']})}>{Object.entries(MOVEMENT_PHYSICS_LABELS).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
 <p className="field-note" id="movement-physics-description">{isCS?'투영 기반 공중 가속과 지상 마찰을 사용합니다. A·D 입력에 마우스 회전을 더해 실제 공중 궤적을 바꿀 수 있습니다.':'강한 지상 제동과 제한된 공중 가속을 사용합니다. 점프 중에도 방향을 조절하며, 연속 점프의 과도한 속도 증가는 제한합니다.'}</p>
 <p className="movement-profile-summary"><span>선택한 방식</span><strong>{movementPhysicsLabel(s)}</strong></p>
 <p className="field-note">모든 기존 훈련과 맵에 적용됩니다. 훈련 중 전환하면 현재 위치에서 수평 속도와 대기 입력을 초기화합니다. 공중 높이와 수직 속도, 감도와 무기 설정은 유지합니다.</p>
 <details className="physics-advanced"><summary>고급 · 점프 입력과 물리 진단</summary>
 {isCS&&<><label className="practice-select">카운터 스트라이크 규칙<select aria-label="카운터 스트라이크 규칙" value={s.csMovementPreset} onChange={e=>update({csMovementPreset:e.target.value as Settings['csMovementPreset']})}><option value="cs2">CS2 기본 규칙 · 보정 모델</option><option value="sourceClassic">클래식 Source 버니합 · 별도 규칙</option></select></label><p className="field-note">{s.csMovementPreset==='sourceClassic'?'클래식 규칙은 더 자유로운 공중 가속과 속도 보존을 허용합니다. 일반 경쟁전 CS2 규칙과 구분해 사용하세요.':'CS2를 비교 기준으로 한 점프 타이밍·착지·속도 제한을 적용합니다. 실제 서브틱 엔진과 동일하다고 검증한 모델은 아닙니다.'}</p></>}
 <label className="range-field"><span>점프 입력 버퍼<b>{s.jumpBufferMs}ms</b></span><input aria-label="점프 입력 버퍼" type="range" min="0" max="140" step="5" value={s.jumpBufferMs} onChange={e=>update({jumpBufferMs:+e.target.value})}/></label><div className="setting-readout"><span>적용되는 점프 입력 창</span><strong>{effectiveBuffer}ms</strong></div><p className="field-note">착지 전 짧은 입력을 보관하는 기준값입니다. 선택한 규칙의 실제 허용 창과 점프 간격 제한이 함께 적용됩니다. 점프 키 유지는 자동 연속 점프를 만들지 않습니다.</p>
 <label className="practice-select">마우스 휠 점프<select aria-label="마우스 휠 점프" value={s.wheelJump} onChange={e=>update({wheelJump:e.target.value as Settings['wheelJump']})}><option value="off">사용 안 함 · 지정한 점프 키</option><option value="up">휠 위 · 점프 키와 함께 사용</option><option value="down">휠 아래 · 점프 키와 함께 사용</option></select></label><p className="field-note">휠 점프는 훈련에 마우스가 잠긴 동안만 입력됩니다. 스크롤 거리가 여러 번의 점프 충격으로 바뀌지는 않습니다.</p>
 <label className="practice-toggle"><span>이동 물리 진단 표시</span><input type="checkbox" checked={s.physicsDiagnostics} onChange={e=>update({physicsDiagnostics:e.target.checked})}/></label><p className="field-note">속도·입력 방향·실제 가속·착지 시점을 선택형 진단으로 확인합니다. 두 방식 모두 독립 보정 모델이며 실제 게임의 비공개 상수와 완전히 일치한다고 보증하지 않습니다.</p>
 </details></section>;
}
