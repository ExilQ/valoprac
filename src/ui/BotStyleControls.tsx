import './botStyle.css';
import {useApp} from '../app/store';
import {BOT_MOVEMENT_STYLES,BOT_MOVEMENT_STYLE_IDS,type BotMovementChoice} from '../engine/tactical/botMovementStyles';
import type {Settings} from '../engine/types';

const PEEKS=['closeRush','wideSwing','jiggleCrouch','poppin'] as const,PROS=['something','primmie','flashback','texture','karon'] as const;
/** 12.40: how defenders move and peek, and what they look like. */
export function BotStyleControls(){
 const s=useApp(x=>x.settings),update=useApp(x=>x.updateSettings),choice=s.botMovement??'off';
 const selected=choice!=='off'&&choice!=='random'?BOT_MOVEMENT_STYLES[choice]:null;
 return <div className="operator-configuration bot-style-configuration"><h4>상대 봇 무빙 · 외형</h4>
  <label className="practice-select">봇 무빙<select aria-label="봇 무빙" value={choice} onChange={e=>update({botMovement:e.target.value as BotMovementChoice})}>
   <option value="off">기본 (각 고정 · 재배치)</option><option value="random">무작위 (봇마다 다른 무빙)</option>
   <optgroup label="피킹 방법">{PEEKS.map(id=><option key={id} value={id}>{BOT_MOVEMENT_STYLES[id].name}</option>)}</optgroup>
   <optgroup label="프로 선수 무빙 참고">{PROS.map(id=><option key={id} value={id}>{BOT_MOVEMENT_STYLES[id].name}</option>)}</optgroup>
  </select></label>
  <p className="field-note">{selected?selected.summary:choice==='random'?`봇마다 ${BOT_MOVEMENT_STYLE_IDS.length}가지 무빙 중 하나를 골라 엄폐물에서 피킹하고 교전합니다. 마지막 제거 분석에 상대 무빙이 표시됩니다.`:'봇이 자리를 지키다 재배치합니다(이전과 같음).'}</p>
  {choice!=='off'&&<p className="field-note">봇도 플레이어와 같은 규칙을 따릅니다. 멈춰서 데드존(달리기 속도의 27.5%) 아래로 느려지거나 앉아서 걸을 때만 정확히 쏩니다. 선수 무빙은 공개된 설명을 바탕으로 만든 연습용 근사이며, 해당 선수와 관련이 없습니다.</p>}
  <label className="practice-select">봇 외형<select aria-label="봇 외형" value={s.botAppearance??'trainingBot'} onChange={e=>update({botAppearance:e.target.value as Settings['botAppearance']})}>
   <option value="trainingBot">연습 봇 · 눈에 잘 띄는 색</option><option value="agent">기존 요원</option>
  </select></label>
  <p className="field-note">외형은 다음 훈련부터 적용됩니다. 판정 범위는 같습니다.</p>
 </div>;
}
