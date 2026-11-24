import {useMemo} from 'react';
import {validateScenario} from '../training/scenarios/validation';
import type {SessionData} from '../engine/types';
import {scenarioComparisonKey,sessionScenario} from '../training/scenarios/library';
import {withoutRecordedMotion} from '../training/scenarios/recordedMotion';
import type {ScenarioDefinition} from '../training/scenarios/types';
import './scenarios.css';

const mean=(sessions:SessionData[],measure:(session:SessionData)=>number)=>sessions.length
 ?(sessions.reduce((sum,session)=>sum+measure(session),0)/sessions.length).toFixed(1):'—';

export function pairedMotionSessions(session:SessionData,history:SessionData[]) {
 const current=sessionScenario(session);
 if(!current||session.runtime==='unreal')return null;
 const baselineKey=scenarioComparisonKey(session,true);
 const eligible=[session,...history.filter(record=>record.id!==session.id)].filter(record=>scenarioComparisonKey(record,true)===baselineKey);
 const hasMotion=current.bots.some(bot=>bot.motion);
 const comparison=hasMotion?session:eligible.find(record=>sessionScenario(record)?.bots.some(bot=>bot.motion));
 if(!comparison)return null;
 const movingKey=scenarioComparisonKey(comparison);
 const fixed=eligible.filter(record=>scenarioComparisonKey(record)===baselineKey).slice(0,5);
 const moving=eligible.filter(record=>scenarioComparisonKey(record)===movingKey).slice(0,5);
 const candidate=hasMotion?withoutRecordedMotion(current):sessionScenario(comparison)!;
 let next:ScenarioDefinition|null=null;
 try{next=validateScenario(candidate);}catch{/* The stored path can expose a bot whose anchor is hidden. */}
 return {fixed,moving,hasMotion,next};
}

export function MotionComparison({session,history,onStart}:{session:SessionData;history:SessionData[];onStart:(scenario:ScenarioDefinition)=>void}){
 const pair=useMemo(()=>pairedMotionSessions(session,history),[session,history]);
 if(!pair)return null;
 const next=pair.next;
 return <section className="data-card scenario-motion-comparison" aria-label="이동 재현 대조">
  <h3>같은 배치에서 이동과 고정 비교</h3>
  <p className="field-note">같은 초기 배치·시드·무기·측정 설정과 일치하는 최근 기록을 조건별로 최대 5회 보여줍니다.</p>
  <div className="table-wrap"><table>
   <thead><tr><th scope="col">수비수</th><th scope="col">기록</th><th scope="col">평균 각 클리어</th><th scope="col">평균 사망</th><th scope="col">사격한 훈련의 첫 발 헤드샷</th></tr></thead>
   <tbody>{([['고정',pair.fixed],['경로 재현',pair.moving]] as const).map(([label,rows])=><tr key={label}>
    <th scope="row">{label}</th><td>{rows.length}회</td><td>{mean(rows,row=>row.tactical?.clears??0)}</td><td>{mean(rows,row=>row.tactical?.deaths??0)}</td>
    <td>{rows.some(row=>row.summary.shots>0)?mean(rows.filter(row=>row.summary.shots>0),row=>row.summary.firstShotHeadshot)+'%':'—'}</td>
   </tr>)}</tbody>
  </table></div>
  {next?<div className="scenario-route-actions"><button type="button" className="primary-button" onClick={()=>onStart(next)}>{pair.hasMotion?'같은 배치에서 고정 수비수와 훈련':'같은 배치에서 경로 재현 수비수와 훈련'}</button></div>:<p className="field-note">고정판을 실행하려면 진입로에서 확인할 수 있는 위치에 수비수를 배치하세요.</p>}
 </section>;
}
