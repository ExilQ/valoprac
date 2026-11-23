import {Tabs,Panel} from '../components/utility/Controls';
import {lazy,Suspense,useState} from 'react';
import {useApp} from '../app/store';
import {ExerciseSetup} from './ExerciseTraining';
import {ScenarioRoutes} from './ScenarioRoutes';
import {ScenarioEditor} from './ScenarioEditor';
import type {ScenarioDefinition} from '../training/scenarios/types';
import type {PracticeMap} from '../engine/types';
import {trainingMapTitle} from './trainingPresentation';
import './trainingPlatform.css';
const ReplayLibrary=lazy(()=>import('./ReplayViewer').then(m=>({default:m.ReplayLibrary})));
const TABS={warmup:'1분 워밍업',movement:'이동 도구',routes:'전술 경로',editor:'시나리오 편집',flash:'플래시 회피',replays:'리플레이'} as const;
export function TrainingPlatform(){
 const [tab,setTab]=useState<keyof typeof TABS>(()=>typeof location!=='undefined'&&(/(?:^|[?&#])scenario=/.test(location.search+location.hash))?'editor':'warmup'),[draft,setDraft]=useState<ScenarioDefinition|undefined>();
 const start=useApp(s=>s.startSession),settings=useApp(s=>s.settings),update=useApp(s=>s.updateSettings),history=useApp(s=>s.history);
 const tools=settings.movementTools;
 return <section className="training-platform"><header className="view-title"><p className="eyebrow">훈련 · 검토 · 직접 구성</p><h1>훈련 도구와 시나리오</h1><p>실제 이동·조준·판정을 사용하고, 호환되는 입력 기록으로 결과를 다시 확인합니다.</p></header>
  <Tabs items={Object.entries(TABS).map(([id,label])=>({id:id as keyof typeof TABS,label}))} value={tab} onChange={setTab} label="훈련 플랫폼 도구" prefix="platform-tab" panelId="platform-active-panel" className="platform-tabs"/>
  <section id="platform-active-panel" role="tabpanel" aria-labelledby={`platform-tab-${tab}`}>
   {tab==='warmup'&&<ExerciseSetup kind="warmup" onStart={(exercise,weapon)=>start({exercise},weapon)}/>}
   {tab==='flash'&&<ExerciseSetup kind="flash" onStart={(exercise,weapon)=>start({exercise},weapon)}/>}
   {tab==='routes'&&<ScenarioRoutes history={history} onStart={scenario=>start({scenario})} onEdit={scenario=>{setDraft(scenario);setTab('editor');}}/>}
   {tab==='editor'&&<ScenarioEditor initialScenario={draft} onStart={scenario=>start({scenario})}/>}
   {tab==='replays'&&<Suspense fallback={<p role="status">리플레이 보관함을 준비합니다…</p>}><ReplayLibrary sessions={history}/></Suspense>}
   {tab==='movement'&&<Panel className="movement-tool-setup"><h2>기존 맵에서 이동 연습</h2><p>점프와 공중 조향은 직접 조작합니다. 저장 위치·이륙점으로 돌아와 같은 구간을 다시 시도하고, 이전 시도를 고스트로 비교하세요.</p>
    <label className="toggle-field"><span>이동 도구 사용</span><input type="checkbox" checked={tools.enabled} onChange={e=>update({movementTools:{...tools,enabled:e.target.checked}})}/></label>
    <label className="practice-select">연습할 맵<select aria-label="이동 연습 맵" value={settings.practiceMap} onChange={e=>update({practiceMap:e.target.value as PracticeMap})}>{(['range','tactical','long','garage','site','mid','tower','multi','complex','bunny','wallbang'] as const).map(map=><option key={map} value={map}>{trainingMapTitle({practiceMap:map})}</option>)}</select></label>
    <p>위치 저장 {tools.bindings.save.replace('Key','')} · 복원 {tools.bindings.restore.replace('Key','')} · 이륙점 {tools.bindings.takeoff.replace('Key','')} · 시도 초기화 {tools.bindings.reset.replace('Key','')}</p>
    <p className="field-note">키 지정·속도 그래프·고스트 생성은 훈련 중 Esc 메뉴의 이동 도구에서 사용할 수 있습니다. 고스트와 검토 카메라는 충돌·명중 판정을 바꾸지 않습니다.</p>
    <button className="primary-button" onClick={()=>{update({movementTools:{...tools,enabled:true}});start({});}}>현재 맵에서 이동 연습 시작</button>
   </Panel>}
  </section>
 </section>;
}
