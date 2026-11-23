import {SCENARIO_ROUTE_TITLES} from '../training/scenarios/types';
import type {SimulationOptions} from '../training/platform/SessionOptions';
import {selectedTraining} from '../app/trainingNavigation';
import {LEVEL_SPECS} from '../config/tactical';
import type {Mode,Settings} from '../engine/types';
import {MODES} from '../training/modes/modes';
import {DRILL_LABELS} from '../training/modes/TapDrill';

type TrainingSettings=Pick<Settings,'practiceMap'|'drill'>;
/** Present the selected task rather than its underlying simulation mode. Several
 * tactical and movement tasks intentionally share the unlimited `free` runtime. */
export function trainingTitle(mode:Mode,s:TrainingSettings,options?:SimulationOptions){
 if(options?.exercise)return options.exercise.kind==='warmup'?'1분 워밍업':'플래시 회피 훈련';
 if(options?.scenario)return options.scenario.title;
 const selection=selectedTraining(mode,s);
 if(selection==='tactical')return s.drill==='mixed'?'복합 전술 훈련':'각체크·피킹';
 if(selection==='vertical')return '수직 각체크 훈련';
 if(selection==='braking')return '톡브레이킹 훈련';
 if(selection==='spray')return '반동 연습';
 if(selection==='bunny')return '버니합 훈련';
 if(selection==='wallbang')return '월샷 훈련';
 if(selection==='free'&&s.drill!=='none')return DRILL_LABELS[s.drill];
 return MODES[mode].title;
}
export function trainingDescription(mode:Mode,s:TrainingSettings,options?:SimulationOptions){
 if(options?.exercise)return options.exercise.kind==='warmup'?'각을 잡고 지나가는 표적을 조준하세요. 60초 동안 실제 사격으로 제거한 수를 기록하며, 완료 후 같은 설정으로 즉시 다시 시작할 수 있습니다.':'시각·소리 신호를 확인하면 직접 시야를 돌리세요. 실제 카메라 회전 시작과 기준 각도 도달을 120Hz 시뮬레이션 시각으로 기록합니다.';
 if(options?.scenario)return options.scenario.title+' · 직접 이동해 방어각을 확인하고 엄폐·제동·사격 결과를 비교하세요.';
 switch(selectedTraining(mode,s)){
  case 'tactical':return s.practiceMap==='tactical'
   ?'코너를 직접 피킹하고 발소리에 반응하는 표적을 확인하세요. 이 기존 코너 맵은 노출 사망을 지원하지 않습니다.'
   :'엄폐에서 직접 이동해 한 번에 한 각을 확인하세요. 수비수의 사격과 소리를 관찰하고 제동 후 발사하세요.';
  case 'vertical':return '계단과 경사로를 직접 이동하며 상·하단 수비각을 차례로 확인하세요. 적이 선 지면을 기준으로 머리 높이를 조정하세요.';
  case 'bunny':return '착지 직전에 점프를 다시 입력하고 A·D와 마우스로 공중 방향을 조절하세요. 입력 시점과 속도 보존, 착지 위치를 비교합니다.';
  case 'wallbang':return '엄폐물에 사격해 통과 구간과 피해를 확인하세요. 재질·두께·입사각과 무기별 관통 결과를 비교합니다.';
  default:return MODES[mode].description;
 }
}
export function trainingMapTitle(s:Pick<Settings,'practiceMap'>){
 if(s.practiceMap==='range')return '기본 사격장';
 if(s.practiceMap==='complex')return '전술 피킹 연구실';
 if(s.practiceMap==='tactical')return '기존 코너 피킹';
 if(s.practiceMap==='bunny')return '관성 이동 코스';
 if(s.practiceMap==='wallbang')return '재질 관통 사격장';
 return LEVEL_SPECS[s.practiceMap].title;
}
export function trainingTimed(mode:Mode,s:Pick<Settings,'practiceMap'|'peekingTimed'>,options?:SimulationOptions){if(options?.exercise)return true;if(options?.scenario)return options.scenario.rules.duration!==null;return mode!=='free'||s.practiceMap==='complex'&&s.peekingTimed;}

export function scenarioTitleIsLiteral(options?:SimulationOptions){const d=options?.scenario;return !!d&&d.title!==SCENARIO_ROUTE_TITLES[d.routeId];}

export function trainingKeyLabel(code:string) {
 if(code.startsWith('Key'))return code.slice(3);
 if(code.startsWith('Digit'))return code.slice(5);
 if(code.startsWith('Arrow'))return {ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→'}[code]??code;
 return code.replace(/(?:Left|Right)$/,'').replace('Control','Ctrl');
}
