import type {Drill,ShotEvent} from '../../engine/types';
export interface DrillStats {attempts:number;successes:number;early:number;wrongDirection:number;lastSpeed:number;lastWindow:number|null;}
export const DRILL_LABELS:Record<Drill,string>={none:'자유 연습',tapAD:'왼쪽 이동 → 오른쪽 톡 → 사격',tapDA:'오른쪽 이동 → 왼쪽 톡 → 사격',release:'좌우 이동 → 키 해제 → 사격',wide:'와이드 스윙 → 제동 → 헤드샷',repeat:'반복 좌우 스트레이핑',stopMoving:'이동 표적 → 제동 → 사격',corner:'코너 피킹 훈련',vertical:'수직 각체크 훈련',mixed:'복합 전술 훈련',moving:'이동 중 사격',bunny:'버니합 훈련',wallbang:'월샷 훈련'};
export class TapDrill {
 stats:DrillStats={attempts:0,successes:0,early:0,wrongDirection:0,lastSpeed:0,lastWindow:null};last='좌우로 충분히 이동한 뒤 제동하세요.';
 constructor(public drill:Drill){}
 shot(s:ShotEvent,initialVX:number){if(!['tapAD','tapDA','release','wide','repeat','stopMoving'].includes(this.drill))return;
  const expected=this.drill==='tapAD'?-1:this.drill==='tapDA'?1:0,direction=expected===0||Math.sign(initialVX)===expected,kind=this.drill==='release'?s.brakingKind==='neutral':s.brakingKind==='opposite',valid=s.releaseTime!==null&&(s.initialSpeed??0)>2;
  const ok=valid&&direction&&kind&&s.accurate&&s.hit==='head';this.stats.attempts++;this.stats.successes+=Number(ok);this.stats.early+=Number(!s.accurate);this.stats.wrongDirection+=Number(!direction);this.stats.lastSpeed=Math.hypot(s.velocity.x,s.velocity.z);this.stats.lastWindow=s.thresholdDelta;
  this.last=!valid?'충분히 이동하고 제동한 뒤 발사하세요.':!direction?'이번 과제의 시작 방향을 확인하세요.':!kind?this.drill==='release'?'반대 키 대신 이동 키를 놓아 제동하세요.':'진행 반대 방향 키를 짧게 눌러 제동하세요.':!s.accurate?'너무 이른 발사 · 실제 속도가 아직 높습니다.':s.hit!=='head'?'제동 성공 · 머리 조준을 확인하세요.':'톡브레이킹 헤드샷 성공';
 }
}
