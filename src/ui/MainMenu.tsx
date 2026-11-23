import {useState} from 'react';
import {localeTag} from '../i18n/locale';
import {SearchIntroduction} from './SearchIntroduction';
import {TacticalControls} from './TacticalControls';
import {TacticalMapSelection} from './TacticalMapSelection';
import {selectedTraining,trainingChoice,type TrainingNavigation} from '../app/trainingNavigation';
import {ArrowRight,ArrowUpRight,ChevronDown,Infinity,Timer,MoveHorizontal,Activity,ScanLine,Layers3,Crosshair,Target,ChartNoAxesCombined,SlidersHorizontal,Wrench} from 'lucide-react';
import {useApp} from '../app/store';
import {GameStage} from '../components/LazyGameStage';
import {PracticeControls} from './PracticeControls';
import {WEAPONS} from '../config/weapons';
import {trainingTitle,trainingDescription,trainingTimed,trainingMapTitle} from './trainingPresentation';
import {PEEK_ZONES,activeAngles} from '../engine/tactical/complex';
import type {PeekScenario} from '../engine/types';
import './homeUtility.css';
export const trainingStartLabel=trainingTitle;
const NAVIGATION_KEY='valoprac-training-navigation-open';
const TRAINING_ROWS=[
 {id:'free',name:'자유 훈련장',desc:'시간 제한 없는 기본기 연습',category:'기본기',Icon:Infinity},
 {id:'timed',name:'시간제 훈련',desc:'첫 발 정밀도와 표적 추적',category:'기본기',Icon:Timer},
 {id:'spray',name:'반동 연습',desc:'연사 탄착군과 보정 궤적',category:'기본기',Icon:Activity},
 {id:'braking',name:'톡브레이킹 훈련',desc:'이동 · 제동 · 발사 타이밍',category:'이동과 전술',Icon:MoveHorizontal},
 {id:'tactical',name:'각체크·피킹',desc:'엄폐와 노출을 이용한 각 분리',category:'이동과 전술',Icon:ScanLine},
 {id:'vertical',name:'수직 각체크 훈련',desc:'계단과 고저차의 머리 높이',category:'이동과 전술',Icon:Layers3},
 {id:'bunny',name:'버니합 훈련',desc:'착지 입력과 공중 관성',category:'이동과 전술',Icon:MoveHorizontal},
 {id:'wallbang',name:'월샷 훈련',desc:'재질과 두께에 따른 관통',category:'이동과 전술',Icon:Crosshair}
] as const;

export function MainMenu(){
 const mode=useApp(s=>s.mode),weapon=useApp(s=>s.weapon),setMode=useApp(s=>s.setMode),start=useApp(s=>s.start),s=useApp(x=>x.settings),update=useApp(x=>x.updateSettings),setTab=useApp(x=>x.setTab),history=useApp(s=>s.history);
 const [navigationOpen,setNavigationOpen]=useState(()=>{try{return localStorage.getItem(NAVIGATION_KEY)!=='false';}catch{return true;}});
 const selection=selectedTraining(mode,s),tactical=mode==='free'&&!['range','bunny','wallbang'].includes(s.practiceMap),timed=trainingTimed(mode,s),recent=history.find(h=>h.mode===mode),title=trainingTitle(mode,s);
 const chooseTraining=(id:TrainingNavigation)=>{const choice=trainingChoice(id);setMode(choice.mode);update(choice.settings);};
 const openAim=(section:'explore'|'analysis')=>{setTab('aim');if(typeof window!=='undefined'){try{window.history.replaceState(null,'',`/aim.html#${section}`);}catch{/* The overview remains reachable when history is restricted. */}}};
 const chooseSector=(scenario:PeekScenario)=>update({peekScenario:scenario,targetCount:Math.min(12,activeAngles(scenario).length),eliminationRule:'damage',analysisWall:false});
 return <main className="training-home precision-home">
  <header className="utility-page-heading"><div><p className="eyebrow">개인 훈련</p><h1>훈련 선택</h1><p>훈련을 고르고, 필요한 설정만 조정한 뒤 바로 시작하세요.</p></div><button className="secondary-button utility-tools-entry" onClick={()=>setTab('tools')}><Wrench size={16}/>훈련 도구와 시나리오<ArrowUpRight size={14}/></button></header>
  <div className="home-workspace utility-training-workspace">
   <section className="mode-section utility-mode-section">
    <details className="training-navigation utility-mode-disclosure" open={navigationOpen} onToggle={event=>{const open=event.currentTarget.open;setNavigationOpen(open);try{localStorage.setItem(NAVIGATION_KEY,String(open));}catch{/* Local persistence is optional. */}}}>
     <summary className="training-navigation-toggle"><span>훈련장 종류</span><span className="training-navigation-current">{title}</span><ChevronDown size={15} aria-hidden="true"/></summary>
     <div className="mode-grid utility-mode-list" aria-label="훈련 종류 선택">{['기본기','이동과 전술'].map(category=><div className="utility-mode-group" key={category}><p className="utility-group-label">{category}</p>{TRAINING_ROWS.filter(row=>row.category===category).map((row,index)=><button key={row.id} aria-pressed={selection===row.id} className={`mode-card ${selection===row.id?'selected':''}`} onClick={()=>chooseTraining(row.id)}><row.Icon size={17} strokeWidth={1.5} className="mode-icon"/><span className="mode-copy"><h3>{row.name}</h3><p>{row.desc}</p></span><span className="mode-index" aria-hidden="true">{String(TRAINING_ROWS.findIndex(r=>r.id===row.id)+1).padStart(2,'0')}</span></button>)}</div>)}
      <div className="utility-mode-group"><p className="utility-group-label">측정과 분석</p>{[{id:'sensitivity',name:'감도 탐색',desc:'같은 조건에서 후보 감도 비교',Icon:Target,action:()=>openAim('explore')},{id:'analysis',name:'에임 분석',desc:'플릭·추적·클릭 타이밍',Icon:ChartNoAxesCombined,action:()=>openAim('analysis')}].map(row=><button key={row.id} aria-pressed={false} className="mode-card" onClick={row.action}><row.Icon size={17} strokeWidth={1.5} className="mode-icon"/><span className="mode-copy"><h3>{row.name}</h3><p>{row.desc}</p></span><ArrowUpRight size={13}/></button>)}</div>
     </div>
    </details>
   </section>
   <div className="utility-session-column">
    <section className="utility-task-panel" aria-labelledby="selected-training-title"><div className="utility-task-heading"><span className="utility-selection-mark" aria-hidden="true"/><p className="eyebrow">선택한 훈련</p></div><h2 id="selected-training-title">{title}</h2><p className="utility-task-description">{trainingDescription(mode,s)}</p>
     {['precision','tracking'].includes(mode)&&<div className="timed-submodes" aria-label="시간제 세부 훈련"><button aria-pressed={mode==='precision'} onClick={()=>setMode('precision')}>헤드샷 정밀도</button><button aria-pressed={mode==='tracking'} onClick={()=>setMode('tracking')}>이동 표적 추적</button></div>}
     <div className="session-config"><div><span className="control-label">훈련 시간</span><div className="duration-options">{!timed?<span className="unlimited-label"><Infinity size={15}/>직접 종료할 때까지</span>:[30,60,120].map(n=><button key={n} aria-pressed={s.duration===n} className={s.duration===n?'active':''} onClick={()=>update({duration:n})}>{n}초</button>)}</div></div><button className="weapon-quick-select" onClick={()=>setTab('weapons')}><span className="control-label">장착 무기</span><strong>{WEAPONS[weapon].name}<ArrowUpRight size={14}/></strong></button></div>
     {mode==='free'&&s.practiceMap==='range'&&<div className="utility-quick-targets"><label htmlFor="home-target-count">표적 수</label><input id="home-target-count" aria-label="빠른 표적 수" type="number" min="1" max="12" step="1" value={s.targetCount} onChange={event=>{const n=Number(event.target.value);if(Number.isFinite(n)&&n>=1&&n<=12)update({targetCount:Math.round(n)});}}/><span>개</span><span className="utility-target-rule">{s.eliminationRule==='head'?'헤드샷만':s.eliminationRule==='any'?'모든 부위 한 발':'체력 150 · 피해량 누적'}</span></div>}
     {s.practiceMap==='complex'&&mode==='free'&&<label className="practice-select utility-sector-select">훈련 구역<select aria-label="빠른 피킹 구역" value={s.peekScenario} onChange={e=>chooseSector(e.target.value as PeekScenario)}><option value="free">전체 전술 맵 · 자유 탐색</option>{PEEK_ZONES.map(zone=><option key={zone.id} value={zone.scenario}>{zone.name}</option>)}<option value="operator">오퍼레이터 대응</option></select></label>}
     <button className="start-button" onClick={start}><span><strong>훈련 시작</strong><small>{trainingStartLabel(mode,s)} · {!timed?'시간 무제한':`${s.duration}초`}</small></span><ArrowRight size={20}/></button><p className="start-note">키보드와 마우스 사용 · 훈련 중 Esc로 설정</p>
    </section>
    <aside className="home-aside utility-preview-panel"><div className="range-card"><div className="range-card-header"><span>현재 훈련 공간</span><button onClick={()=>setTab('maps')}>맵 변경<ArrowUpRight size={13}/></button></div><GameStage preview key={`${mode}-${s.practiceMap}-${s.peekScenario}`}/><div className="utility-preview-caption"><strong>{trainingMapTitle(s)}</strong><span>{s.practiceMap==='range'?'표적과 사격 상태를 자유롭게 조정합니다.':s.practiceMap==='bunny'?'기존 이동 물리와 수동 점프를 사용합니다.':s.practiceMap==='wallbang'?'원본 엄폐물의 재질과 두께를 비교합니다.':'엄폐·사선·고저차가 실제 판정에 반영됩니다.'}</span></div><div className="range-card-footer"><span>선택한 훈련 공간</span><span>표적·장비 설정 연동</span></div></div></aside>
    <section className="utility-recent-strip"><div><p className="eyebrow">최근 같은 훈련</p>{recent?<><h3>{trainingTitle(recent.mode,recent.settings,recent.sessionOptions)}</h3><p>{new Date(recent.createdAt).toLocaleDateString(localeTag())} · 헤드샷 {recent.summary.headshotAccuracy.toFixed(1)}% · {recent.summary.eliminations}개 제거</p></>:<><h3>첫 기록을 준비하세요.</h3><p>훈련을 마치면 이 브라우저에 기록이 남습니다.</p></>}</div><button onClick={()=>setTab('history')}>기록 보기<ArrowUpRight size={14}/></button></section>
   </div>
  </div>
  {tactical&&<div className="utility-map-context"><TacticalMapSelection/></div>}
  <details className="training-configuration"><summary><span><SlidersHorizontal size={16}/>훈련 환경 세부 설정</span><span>표적 · 과제 · 봇 · 탄약</span></summary><div className="utility-advanced-layout"><TacticalControls menu/>{mode==='free'&&<section className="practice-menu-settings"><h3>표적 및 탄약 설정</h3><PracticeControls free includeTactical={false}/></section>}</div></details>
  <details className="utility-search-guide"><summary>훈련 소개와 사용 방법</summary><SearchIntroduction/></details>
  <footer className="home-footer"><span>이동·반동·판정은 공개한 보정 모델을 사용합니다.</span><button onClick={()=>setTab('settings')}>감도와 조준선 설정<ArrowUpRight size={14}/></button></footer>
 </main>;
}
