import {lazy,Suspense,useState} from 'react';
import type {SessionData} from '../engine/types';
import {ShotTimeline} from './ShotTimeline';
import {SessionHighlights} from './SessionHighlights';

const ReplayViewer=lazy(()=>import('./ReplayViewer').then(m=>({default:m.ReplayViewer})));

/** Opening a recorded moment loads the viewer; ordinary results stay lightweight. */
export function SessionReplay({session}:{session:SessionData}){
 const [seek,setSeek]=useState<number|null>(null);
 return <>
  <ShotTimeline key={session.id} session={session} onSeek={session.replay ? setSeek : undefined}/>
  <SessionHighlights session={session} onSeek={session.replay?timestamp=>setSeek(timestamp):undefined}/>
  {session.replayIssue&&<p className="inline-notice" role="status">리플레이를 저장하지 못했습니다: {session.replayIssue}</p>}
  {session.replay&&<section className="data-card session-replay-entry"><h3>입력 리플레이</h3><p className="field-note">같은 버전의 시뮬레이션으로 입력·판정·점수를 다시 계산합니다. 영상 파일이 아니며 이 브라우저에 보관합니다.</p><button className="secondary-button" onClick={()=>setSeek(0)}>처음부터 다시 보기</button></section>}
  {session.replay&&seek!==null&&<Suspense fallback={<p role="status">리플레이를 준비합니다…</p>}><ReplayViewer key={seek} recording={session.replay} initialTime={seek} onClose={()=>setSeek(null)}/></Suspense>}
 </>;
}
