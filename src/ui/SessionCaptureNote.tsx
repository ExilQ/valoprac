import type {SessionData} from '../engine/types';
export function SessionCaptureNote({session}:{session:SessionData}){
 if(session.runtime!=='unreal')return null;const evidence=session.streamEvidence;
 return <p className="capture-note"><strong>언리얼 스트림 기록</strong> · 서버가 보낸 누적 집계와 최근 상세 사격 데이터를 표시합니다. 입력 지연 측정값은 포함하지 않습니다.{evidence&&!evidence.endedNormally&&<> 연결 종료 전 마지막으로 수신한 상태를 저장한 중단 기록입니다.</>}{evidence&&!evidence.detailsComplete&&<> 상세 이벤트 일부를 수신하지 못했습니다. 누락 확인 {evidence.lostEvents}개, 마지막 처리 번호 {evidence.processedThrough} / {evidence.lastSequence}. 누적 집계와 탄착 분석의 수신 범위가 다를 수 있습니다.</>}</p>;
}
