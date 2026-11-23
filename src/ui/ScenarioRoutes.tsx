import {useState} from 'react';
import type {SessionData} from '../engine/types';
import {WEAPONS} from '../config/weapons';
import {createScenario,SCENARIO_ROUTES} from '../training/scenarios/templates';
import type {ScenarioDefinition,ScenarioRouteId} from '../training/scenarios/types';
import {ScenarioPlan} from './ScenarioPlan';
import './scenarios.css';

export interface ScenarioRoutesProps {onStart:(definition:ScenarioDefinition)=>void;onEdit?:(definition:ScenarioDefinition)=>void;history?:SessionData[];}
export function routeComparisons(history:readonly SessionData[]){
 return SCENARIO_ROUTES.map(route=>{const sessions=history.filter(s=>s.sessionOptions?.scenario?.routeId===route.id||(s.replay?.header.initial.options?.scenario?.routeId===route.id&&!s.sessionOptions?.scenario));const n=sessions.length;return{id:route.id,title:route.title,sessions:n,clears:n?sessions.reduce((sum,s)=>sum+(s.tactical?.clears??0),0)/n:null,deaths:n?sessions.reduce((sum,s)=>sum+(s.tactical?.deaths??0),0)/n:null,headshot:n?sessions.reduce((sum,s)=>sum+s.summary.headshotAccuracy,0)/n:null};});
}
export function ScenarioRoutes({onStart,onEdit,history=[]}:ScenarioRoutesProps){
 const[selected,select]=useState<ScenarioRouteId>('long-lane'),route=SCENARIO_ROUTES.find(r=>r.id===selected)!,definition=createScenario(selected),comparisons=routeComparisons(history);
 return <section className="scenario-routes" aria-label="전술 경로 훈련"><header className="view-title"><p className="eyebrow">TACTICAL ROUTES / 실전 각체크</p><h2>다섯 가지 진입 경로</h2><p>장거리·근접·오프앵글·고저차·순차 진입을 각각 연습하세요.</p></header><div className="scenario-route-list">{SCENARIO_ROUTES.map((r,i)=><article className="scenario-route-row" key={r.id}><div><small>0{i+1} / {r.difficulty} · 수비각 {r.sectorCount}개</small><h3>{r.title}</h3><p>추천 {WEAPONS[r.recommended].name}{r.verticalMeters>0?` · 고저차 ${r.verticalMeters.toFixed(1)}m`:''}</p></div><p>{r.objective}</p><div className="scenario-route-actions"><button type="button" className="secondary-button" aria-pressed={selected===r.id} onClick={()=>select(r.id)}>경로 보기</button><button type="button" className="primary-button" onClick={()=>onStart(createScenario(r.id))}>훈련 시작</button></div></article>)}</div>
 <div className="scenario-route-detail"><ScenarioPlan definition={definition}/><div><h3>{route.title}</h3><p>{route.description}</p><p className="field-note">점선은 확인할 진입 경로입니다. 이동은 직접 조작하며 수비수는 실제 사선과 엄폐를 보고 대응합니다.</p>{onEdit&&<button className="secondary-button" onClick={()=>onEdit(definition)}>이 경로의 배치 편집</button>}</div></div>
 <section className="scenario-route-comparisons"><h3>경로별 내 기록</h3><p className="field-note">저장된 시나리오 세션의 평균입니다. 배치·무기·난이도가 다른 기록이 포함될 수 있습니다.</p><table><thead><tr><th>진입 경로</th><th>기록</th><th>완료한 각</th><th>사망</th><th>헤드샷 명중</th></tr></thead><tbody>{comparisons.map(row=><tr key={row.id}><th>{row.title}</th><td>{row.sessions}회</td><td>{row.clears===null?'—':row.clears.toFixed(1)}</td><td>{row.deaths===null?'—':row.deaths.toFixed(1)}</td><td>{row.headshot===null?'—':`${row.headshot.toFixed(1)}%`}</td></tr>)}</tbody></table></section>
 </section>;
}
