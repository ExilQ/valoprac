import type { Mode } from '../../engine/types';
export const MODES:Record<Mode,{title:string;subtitle:string;description:string;skill:string;count:number}>= {
  precision:{title:'헤드샷 정밀도',subtitle:'한 발, 하나의 목표',description:'무작위 위치의 표적을 정확하게 제거하세요. 머리를 맞혀야 표적이 쓰러집니다.',skill:'정밀도 · 첫 발',count:5},
  braking:{title:'제동과 카운터 스트레이핑',subtitle:'멈추는 순간을 익히세요',description:'좌우로 이동한 뒤 제동하고 사격하세요. 키 해제와 반대 방향 입력의 결과를 비교합니다.',skill:'이동 · 사격 타이밍',count:3},
  spray:{title:'스프레이 제어',subtitle:'반동을 손끝으로',description:'벽 중앙을 조준하고 연사하세요. 탄착군과 보정 궤적을 분석합니다. 고정 표적도 배치됩니다.',skill:'연사 · 반동 보정',count:1},
  tracking:{title:'이동 표적 추적',subtitle:'움직임을 읽으세요',description:'방향을 바꾸는 표적의 머리를 추적하세요. 여섯 가지 이동 패턴을 선택할 수 있습니다.',skill:'추적 · 방향 전환',count:4}
};
export const MODE_ORDER:Mode[]=['precision','braking','spray','tracking'];
