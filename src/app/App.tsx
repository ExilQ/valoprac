import {LegalNotice} from '../ui/LegalNotice';
import {PatchNotes} from '../ui/PatchNotes';
import { lazy, Suspense, useEffect, useState } from 'react';
import { ChevronDown, Crosshair, SlidersHorizontal, History as HistoryIcon, ArrowUpRight, Infinity, Timer, Activity, Layers3, MoveHorizontal, ScanLine, Target } from 'lucide-react';
import { useNavigation } from './useNavigation';
import {selectedTraining,trainingChoice,type TrainingNavigation} from './trainingNavigation';
import { useApp } from './store';
import { Brand } from '../components/Brand';
import { MainMenu } from '../ui/MainMenu';
import { SettingsPanel } from '../ui/SettingsPanel';
import { History } from '../ui/History';
import { WeaponSelection } from '../ui/WeaponSelection';
import { GameStage } from '../components/LazyGameStage';
import { Results } from '../ui/Results';
import { useInterfaceAudio } from '../ui/useInterfaceAudio';
const AimDashboard=lazy(()=>import('../aim/ui/AimDashboard').then(m=>({default:m.AimDashboard})));
const StreamingStage=lazy(()=>import('../streaming/StreamingStage').then(m=>({default:m.StreamingStage})));
const TRAINING_LABELS:Record<TrainingNavigation,string>={free:'자유 훈련장',timed:'시간제 훈련',braking:'톡브레이킹 훈련',spray:'반동 연습',tactical:'각체크·피킹',vertical:'수직 각체크 훈련'};
const NAVIGATION_KEY='valoprac-training-navigation-open';
export function App(){
  useNavigation();useInterfaceAudio();
  const [navigationOpen,setNavigationOpen]=useState(()=>{try{return localStorage.getItem(NAVIGATION_KEY)!=='false';}catch{return true;}});
  const settings=useApp(s=>s.settings);
  const screen=useApp(s=>s.screen),tab=useApp(s=>s.activeTab),mode=useApp(s=>s.mode),setMode=useApp(s=>s.setMode),setTab=useApp(s=>s.setTab),refresh=useApp(s=>s.refreshHistory),notice=useApp(s=>s.notice);
  useEffect(()=>{void refresh();},[refresh]);
  if(screen==='training')return <GameStage/>;
  const activeTraining=tab==='training'&&screen==='menu'?selectedTraining(mode,settings):null;
  const navigationLabel=screen==='results'?'훈련 결과':tab==='training'?TRAINING_LABELS[selectedTraining(mode,settings)]:tab==='aim'?'에임 분석 · 감도 탐색':tab==='weapons'?'무기 선택':tab==='settings'?'설정':tab==='history'?'훈련 기록':'렌더링 환경';
  const selectTraining=(next:TrainingNavigation)=>{const choice=trainingChoice(next);useApp.getState().updateSettings(choice.settings);setMode(choice.mode);setTab('training');};
  return <div className="app-shell tactical-shell"><aside className="sidebar"><button className="brand-button" aria-label="훈련장 홈" onClick={()=>selectTraining('free')}><Brand/></button><details className="training-navigation" open={navigationOpen} onToggle={event=>{const open=event.currentTarget.open;setNavigationOpen(open);try{localStorage.setItem(NAVIGATION_KEY,String(open));}catch{/* The toggle works even when preferences cannot be saved. */}}}><summary className="training-navigation-toggle"><span>훈련장 종류</span><span className="training-navigation-current">{navigationLabel}</span><ChevronDown size={15} aria-hidden="true"/></summary><nav aria-label="주 메뉴"><span className="nav-section-label">개인 훈련</span>
    <button className={activeTraining==='free'?'active':''} onClick={()=>selectTraining('free')}><Infinity size={19}/> 자유 훈련장<span>01</span></button>
    <button className={activeTraining==='timed'?'active':''} onClick={()=>selectTraining('timed')}><Timer size={19}/> 시간제 훈련</button>
    <button className={activeTraining==='spray'?'active':''} onClick={()=>selectTraining('spray')}><Activity size={19}/> 반동 연습</button>
    <button className={activeTraining==='tactical'?'active':''} onClick={()=>selectTraining('tactical')}><ScanLine size={18}/> 각체크·피킹</button>
    <button className={activeTraining==='braking'?'active':''} onClick={()=>selectTraining('braking')}><MoveHorizontal size={18}/> 톡브레이킹 훈련</button>
    <button className={activeTraining==='vertical'?'active':''} onClick={()=>selectTraining('vertical')}><Layers3 size={18}/> 수직 각체크 훈련</button>
    <button className={tab==='aim'?'active':''} onClick={()=>setTab('aim')}><Target size={18}/> 에임 분석 · 감도 탐색</button>
    <span className="nav-section-label nav-separator">훈련 환경</span>
    <button className={tab==='weapons'?'active':''} onClick={()=>setTab('weapons')}><Crosshair size={19}/> 무기 선택</button>
    <button className={tab==='history'?'active':''} onClick={()=>setTab('history')}><HistoryIcon size={19}/> 훈련 기록</button>
    <button className={tab==='settings'?'active':''} onClick={()=>setTab('settings')}><SlidersHorizontal size={19}/> 설정</button>

    </nav></details><div className="sidebar-bottom"><div className="sidebar-hint"><p>PRACTICE WITH PURPOSE<br/><strong>반복으로 완성하는 기본기.</strong></p></div><a href="/guide.html" target="_blank" rel="noreferrer">조작 방법과 검증 현황<ArrowUpRight size={14}/></a><div className="build-label"><span className="status-dot"/> 브라우저 훈련 사용 가능</div></div></aside>
    <div className="main-shell"><header className="topbar"><span>{screen==='results'?'훈련 결과':tab==='training'?'개인 훈련장':tab==='settings'?'훈련 환경':tab==='weapons'?'무기고':tab==='stream'?'렌더링 환경':tab==='aim'?'정밀 감도 연구실':'훈련 기록'}</span><div><span className="local-badge"><i/> 계정 없이 바로 훈련</span><span className="avatar">개인</span><PatchNotes/></div></header>
    {notice&&screen!=='results'&&<div className="global-notice" role="status">{notice}</div>}
    {screen==='results'?<Results/>:tab==='training'?<MainMenu/>:tab==='settings'?<SettingsPanel/>:tab==='weapons'?<WeaponSelection/>:tab==='stream'?<Suspense fallback={<p className="stream-loading" role="status">연결 화면을 준비하고 있습니다…</p>}><StreamingStage/></Suspense>:tab==='aim'?<Suspense fallback={<p className="stream-loading" role="status">에임 분석을 준비합니다…</p>}><AimDashboard/></Suspense>:<History/>}
    <LegalNotice/></div></div>;
}
