import {useState} from 'react';
import type {SessionData} from '../engine/types';
import {WEAPONS} from '../config/weapons';
import {createMotionScenario,createHeadlineScenario,createScenario,SCENARIO_ROUTES} from '../training/scenarios/templates';
import type {ScenarioDefinition,ScenarioRouteId} from '../training/scenarios/types';
import {saveDrill} from '../training/scenarios/library';
import {ScenarioPlan} from './ScenarioPlan';
import './scenarios.css';

export interface ScenarioRoutesProps {onStart:(definition:ScenarioDefinition)=>void;onEdit?:(definition:ScenarioDefinition)=>void;history?:SessionData[];}
export function routeComparisons(history:readonly SessionData[]){
 return SCENARIO_ROUTES.map(route=>{const sessions=history.filter(s=>s.sessionOptions?.scenario?.routeId===route.id||(s.replay?.header.initial.options?.scenario?.routeId===route.id&&!s.sessionOptions?.scenario));const n=sessions.length;return{id:route.id,title:route.title,sessions:n,clears:n?sessions.reduce((sum,s)=>sum+(s.tactical?.clears??0),0)/n:null,deaths:n?sessions.reduce((sum,s)=>sum+(s.tactical?.deaths??0),0)/n:null,headshot:n?sessions.reduce((sum,s)=>sum+s.summary.headshotAccuracy,0)/n:null};});
}
export function ScenarioRoutes({onStart,onEdit,history=[]}:ScenarioRoutesProps){
 const[message,setMessage]=useState('');
 const[selected,select]=useState<ScenarioRouteId>('long-lane'),route=SCENARIO_ROUTES.find(r=>r.id===selected)!,definition=createScenario(selected),comparisons=routeComparisons(history);
 return <section className="scenario-routes" aria-label="전술 경로 훈련"><header className="view-title"><p className="eyebrow">TACTICAL ROUTES / 실전 각체크</p><h2>전술 진입 경로 {SCENARIO_ROUTES.length}종</h2><p>연습할 사선을 고르고 평면도에서 시작 위치와 엄폐물을 확인하세요.</p></header>
 <section className="scenario-motion-entry">
  <div><h3>리플레이 경로 재현</h3><p>내가 움직인 구간을 수비수에게 연결하고, 같은 위치를 지키는 고정 수비수와 결과를 비교하세요.</p></div>
  <div className="scenario-route-actions">
   <button type="button" className="primary-button" onClick={()=>onStart(createMotionScenario())}>재현 수비수 훈련</button>
   {onEdit&&<button type="button" className="secondary-button" onClick={()=>onEdit(createMotionScenario())}>내 리플레이로 편집</button>}
  </div>
 </section>
 <section className="scenario-headline-drill">
  <div><h3>헤드라인·앉기 교전</h3><p>머리를 겨누는 수비수의 첫 탄을 앉아서 피하고, 수비수가 낮아지면 조준 높이를 바꿔보세요.</p></div>
  <div className="scenario-route-actions">
   <button type="button" className="primary-button" onClick={()=>onStart(createHeadlineScenario())}>헤드라인 훈련 시작</button>
   {onEdit&&<button type="button" className="secondary-button" onClick={()=>onEdit(createHeadlineScenario())}>배치와 봇 행동 편집</button>}
  </div>
 </section>
 <div className="scenario-route-list">{SCENARIO_ROUTES.map(r=><article className="scenario-route-row" key={r.id}><div><small>{r.difficulty} · 수비각 {r.sectorCount}개</small><h3>{r.title}</h3><p>추천 {WEAPONS[r.recommended].name}{r.verticalMeters>0?` · 고저차 ${r.verticalMeters.toFixed(1)}m`:''}</p></div><p>{r.objective}</p><div className="scenario-route-actions"><button type="button" className="secondary-button" aria-pressed={selected===r.id} onClick={()=>{select(r.id);setMessage('');}}>경로 보기</button><button type="button" className="primary-button" onClick={()=>onStart(createScenario(r.id))}>훈련 시작</button></div></article>)}</div>
 <div className="scenario-route-detail"><ScenarioPlan definition={definition}/><div><h3>{route.title}</h3><p>{route.description}</p><p className="field-note">점선은 확인할 진입 경로입니다. 이동은 직접 조작하며 수비수는 실제 사선과 엄폐를 보고 대응합니다.</p>{onEdit&&<button className="secondary-button" onClick={()=>onEdit(definition)}>이 경로의 배치 편집</button>}{definition.bots.length>1&&<button className="secondary-button" onClick={()=>onStart({...definition,rules:{...definition.rules,arrival:'after-clear',startOnEntry:true}})}>진입선 · 연속 교전 시작</button>}<button className="secondary-button" onClick={()=>{try{saveDrill(definition);setMessage('내 드릴에 저장했습니다.');}catch(error){setMessage(error instanceof Error?error.message:'드릴을 저장하지 못했습니다.');}}}>내 드릴에 저장</button>{message&&<p role="status">{message}</p>}</div></div>
 <section className="scenario-route-comparisons"><h3>경로별 내 기록</h3><p className="field-note">저장된 시나리오 세션의 평균입니다. 배치·무기·난이도가 다른 기록이 포함될 수 있습니다.</p><table><thead><tr><th>진입 경로</th><th>기록</th><th>완료한 각</th><th>사망</th><th>헤드샷 명중</th></tr></thead><tbody>{comparisons.map(row=><tr key={row.id}><th>{row.title}</th><td>{row.sessions}회</td><td>{row.clears===null?'—':row.clears.toFixed(1)}</td><td>{row.deaths===null?'—':row.deaths.toFixed(1)}</td><td>{row.headshot===null?'—':`${row.headshot.toFixed(1)}%`}</td></tr>)}</tbody></table></section>
 </section>;
}
