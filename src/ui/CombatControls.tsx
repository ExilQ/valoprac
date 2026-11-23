import {useApp} from '../app/store';
import type {Settings} from '../engine/types';

export const COMBAT_MODE_LABELS:Record<Settings['combatMode'],string>={learning:'각 학습',gunfight:'교전 훈련',exposure:'노출 제한'};
export const DEFENDER_SKILL_LABELS:Record<Settings['defenderSkill'],string>={beginner:'입문',normal:'보통',advanced:'숙련',expert:'전문'};
const MODES:{id:Settings['combatMode'];description:string}[]=[
 {id:'learning',description:'사격 피해 없이 각과 조준 시간을 익힙니다.'},
 {id:'gunfight',description:'수비수의 실제 탄도와 피해로 승패를 판정합니다.'},
 {id:'exposure',description:'설정한 가시 노출 시간을 기준으로 훈련합니다.'}
];
type MotorSetting='defenderAimSpeed'|'defenderAimAcceleration'|'defenderStability'|'defenderFirstShotError'|'defenderRecoilControl'|'defenderTactics'|'defenderReaction'|'defenderReposition';
export function CombatControls(){
 const s=useApp(x=>x.settings),update=useApp(x=>x.updateSettings);
 const number=(key:MotorSetting,label:string,min:number,max:number,step:number,unit:string,scale=1)=><label className="range-field"><span>{label}<b>{Number((s[key]*scale).toFixed(scale===1000?0:2))}{unit}</b></span><input aria-label={label} type="range" min={min} max={max} step={step} value={s[key]} onChange={e=>update({[key]:+e.target.value})}/></label>;
 return <section className="combat-controls" aria-label="전투 훈련 설정"><h4>전투 방식</h4><div className="combat-mode-options" role="group" aria-label="전투 방식">{MODES.map(m=><button key={m.id} aria-pressed={s.combatMode===m.id} onClick={()=>update({combatMode:m.id,exposureEnabled:m.id==='exposure'})}><strong>{COMBAT_MODE_LABELS[m.id]}</strong><span>{m.description}</span></button>)}</div>
 <label className="practice-select">수비수 실력<select aria-label="수비수 실력" value={s.defenderSkill} onChange={e=>update({defenderSkill:e.target.value as Settings['defenderSkill']})}>{Object.entries(DEFENDER_SKILL_LABELS).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><p className="field-note">실력별로 인식·조준·반동 제어와 판단이 달라집니다. 실제 게임의 계급별 반응 시간을 뜻하지 않습니다.</p>
 {s.combatMode==='exposure'&&<div className="exposure-controls">{number('defenderReaction','기준 시각 반응 지연',.15,1.5,.01,'ms',1000)}<label className="range-field"><span>노출 제한<b>{s.exposureLimit.toFixed(1)}초</b></span><input aria-label="노출 제한" type="range" min=".5" max="5" step=".1" value={s.exposureLimit} onChange={e=>update({exposureLimit:+e.target.value})}/></label><label className="practice-select">노출 누적 방식<select value={s.exposureMode} onChange={e=>update({exposureMode:e.target.value as Settings['exposureMode']})}><option value="continuous">엄폐하면 초기화</option><option value="persistent">엄폐 중 서서히 회복</option></select></label><p className="field-note">이 모드의 제거 원인은 노출 제한입니다. 교전 훈련의 탄도 피해와 구분해 기록합니다.</p></div>}
 <details className="combat-advanced"><summary>고급 · 조준과 판단 조정</summary>{s.combatMode!=='exposure'&&number('defenderReaction','기준 시각 반응 지연',.15,1.5,.01,'ms',1000)}{number('defenderAimSpeed','기준 조준 각속도',30,480,5,'°/초')}{number('defenderAimAcceleration','기준 조준 가속도',100,4000,50,'°/초²')}{number('defenderStability','조준 안정성',.1,.98,.01,'%',100)}{number('defenderFirstShotError','초기 조준 오차',.05,4,.05,'°')}{number('defenderRecoilControl','반동 제어',0,.98,.01,'%',100)}{number('defenderTactics','전술 판단',0,1,.05,'%',100)}{number('defenderReposition','재배치 빈도',0,1,.05,'%',100)}<p className="field-note">설정은 실력 프로필의 기준값입니다. 조준은 유한한 속도로 이동하며 무기 산포·반동·재장전이 별도로 적용됩니다. 현재 보정 모델은 실제 게임과 동일하다고 검증하지 않았습니다.</p><label className="practice-toggle"><span>개발자용 봇 조준 진단</span><input type="checkbox" checked={s.botDiagnostics} onChange={e=>update({botDiagnostics:e.target.checked})}/></label><p className="field-note">진단을 켜면 봇의 내부 상태와 마지막 인지 위치를 표시합니다.</p></details></section>;
}
