import type {SessionData} from '../engine/types';
import {highlightMetric,highlightTime,sessionHighlights,type SessionHighlight} from '../training/analytics/highlights';
import './sessionHighlights.css';

/** Seeking is offered only when a compatible replay viewer supplies onSeek. */
export function SessionHighlights({session,onSeek}:{session:SessionData;onSeek?:(timestamp:number,moment:SessionHighlight)=>void}){
 const moments=sessionHighlights(session);
 if(!moments.length)return null;
 return <section className="data-card session-highlights" aria-labelledby="session-highlights-heading">
  <h3 id="session-highlights-heading">다시 볼 순간 <span>{moments.length}개</span></h3>
  <p className="field-note">남아 있는 상세 이벤트에서 선정했습니다. 자료가 없는 순간은 만들지 않습니다.</p>
  <ol>{moments.map(moment=><li key={moment.id}>
   <time dateTime={`PT${moment.timestamp}S`}>{highlightTime(moment.timestamp)}</time>
   <div><strong>{moment.title}</strong><p>{moment.reason}</p></div>
   <span className="session-highlight-metric">{highlightMetric(moment)}</span>
   {onSeek&&<button type="button" aria-label={`${moment.title} ${highlightTime(moment.timestamp)} 다시 보기`} onClick={()=>onSeek(moment.timestamp,moment)}>이 순간 보기</button>}
  </li>)}</ol>
 </section>;
}
