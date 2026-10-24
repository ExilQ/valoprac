import {PatchNotes} from '../ui/PatchNotes';
import { lazy, Suspense, useEffect } from 'react';
import { Crosshair, SlidersHorizontal, History as HistoryIcon, ArrowUpRight, Infinity, Timer, Activity, Layers3 } from 'lucide-react';
import { useNavigation } from './useNavigation';
import { useApp } from './store';
import { Brand } from '../components/Brand';
import { MainMenu } from '../ui/MainMenu';
import { SettingsPanel } from '../ui/SettingsPanel';
import { History } from '../ui/History';
import { WeaponSelection } from '../ui/WeaponSelection';
import { GameStage } from '../components/LazyGameStage';
import { Results } from '../ui/Results';
import { useInterfaceAudio } from '../ui/useInterfaceAudio';
const StreamingStage=lazy(()=>import('../streaming/StreamingStage').then(m=>({default:m.StreamingStage})));
export function App(){
  useNavigation();useInterfaceAudio();
  const practiceMap=useApp(s=>s.settings.practiceMap);
  const screen=useApp(s=>s.screen),tab=useApp(s=>s.activeTab),mode=useApp(s=>s.mode),setMode=useApp(s=>s.setMode),setTab=useApp(s=>s.setTab),refresh=useApp(s=>s.refreshHistory),notice=useApp(s=>s.notice);
  useEffect(()=>{void refresh();},[refresh]);
  if(screen==='training')return <GameStage/>;
  const selectTraining=(next:typeof mode)=>{setMode(next);setTab('training');};
  return <div className="app-shell tactical-shell"><aside className="sidebar"><button className="brand-button" aria-label="훈련장 홈" onClick={()=>selectTraining('free')}><Brand/></button><nav aria-label="주 메뉴"><span className="nav-section-label">개인 훈련</span>
    <button className={tab==='training'&&mode==='free'&&practiceMap==='range'&&screen==='menu'?'active':''} onClick={()=>{useApp.getState().updateSettings({practiceMap:'range'});selectTraining('free');}}><Infinity size={19}/> 자유 훈련장<span>01</span></button>
    <button className={tab==='training'&&['precision','braking','tracking'].includes(mode)&&screen==='menu'?'active':''} onClick={()=>selectTraining('precision')}><Timer size={19}/> 시간제 훈련</button>
    <button className={tab==='training'&&mode==='spray'&&screen==='menu'?'active':''} onClick={()=>selectTraining('spray')}><Activity size={19}/> 반동 연습</button>
    <button className={tab==='training'&&mode==='free'&&practiceMap==='tactical'&&screen==='menu'?'active':''} onClick={()=>{useApp.getState().updateSettings({practiceMap:'tactical'});selectTraining('free');}}>코너 피킹 훈련장</button>
    <span className="nav-section-label nav-separator">훈련 환경</span>
    <button className={tab==='weapons'?'active':''} onClick={()=>setTab('weapons')}><Crosshair size={19}/> 무기 선택</button>
    <button className={tab==='history'?'active':''} onClick={()=>setTab('history')}><HistoryIcon size={19}/> 훈련 기록</button>
    <button className={tab==='settings'?'active':''} onClick={()=>setTab('settings')}><SlidersHorizontal size={19}/> 설정</button>
    <button className={tab==='stream'?'active':''} onClick={()=>setTab('stream')}><Layers3 size={19}/> 엔진 연결 상태</button>
    </nav><div className="sidebar-bottom"><div className="sidebar-hint"><p>한 발의 정확도.<br/><strong>반복으로 완성하는 기본기.</strong></p></div><a href="/guide.html" target="_blank" rel="noreferrer">조작 방법과 검증 현황<ArrowUpRight size={14}/></a><div className="build-label"><span className="status-dot"/> 브라우저 훈련 사용 가능</div></div></aside>
    <div className="main-shell"><header className="topbar"><span>{screen==='results'?'훈련 결과':tab==='training'?'개인 훈련장':tab==='settings'?'훈련 환경':tab==='weapons'?'무기고':tab==='stream'?'렌더링 환경':'훈련 기록'}</span><div><span className="local-badge"><i/> 계정 없이 바로 훈련</span><span className="avatar">개인</span><PatchNotes/></div></header>
    {notice&&screen!=='results'&&<div className="global-notice" role="status">{notice}</div>}
    {screen==='results'?<Results/>:tab==='training'?<MainMenu/>:tab==='settings'?<SettingsPanel/>:tab==='weapons'?<WeaponSelection/>:tab==='stream'?<Suspense fallback={<p className="stream-loading" role="status">연결 화면을 준비하고 있습니다…</p>}><StreamingStage/></Suspense>:<History/>}
    </div></div>;
}
