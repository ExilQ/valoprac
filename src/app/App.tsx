import { useEffect } from 'react';
import { Crosshair, SlidersHorizontal, History as HistoryIcon, CircleHelp, ArrowUpRight } from 'lucide-react';
import { useNavigation } from './useNavigation';
import { installDeploymentRecovery } from './deploymentRecovery';
import { useApp } from './store';
import { Brand } from '../components/Brand';
import { MainMenu } from '../ui/MainMenu';
import { SettingsPanel } from '../ui/SettingsPanel';
import { History } from '../ui/History';
import { GameStage } from '../components/LazyGameStage';
import { Results } from '../ui/Results';
export function App(){const screen=useApp(s=>s.screen),tab=useApp(s=>s.activeTab),setTab=useApp(s=>s.setTab),refresh=useApp(s=>s.refreshHistory),notice=useApp(s=>s.notice);
  useNavigation();
  useEffect(installDeploymentRecovery,[]);
  useEffect(()=>{void refresh();},[refresh]);
  if(screen==='training')return <GameStage/>;
  return <div className="app-shell"><aside className="sidebar"><Brand/><nav aria-label="주 메뉴"><span className="nav-section-label">트레이닝</span><button className={tab==='training'&&screen==='menu'?'active':''} onClick={()=>{setTab('training');}}><Crosshair size={19}/> 훈련장<span>01</span></button><button className={tab==='history'&&screen==='menu'?'active':''} onClick={()=>{setTab('history');}}><HistoryIcon size={19}/> 훈련 기록</button><button className={tab==='settings'&&screen==='menu'?'active':''} onClick={()=>{setTab('settings');}}><SlidersHorizontal size={19}/> 설정</button></nav><div className="sidebar-bottom"><div className="sidebar-hint"><CircleHelp size={19}/><p>좋은 한 발은<br/><strong>좋은 정지에서 시작됩니다.</strong></p></div><a href="/guide.html" target="_blank" rel="noreferrer">조작 방법과 검증 현황<ArrowUpRight size={14}/></a><div className="build-label"><span className="status-dot"/> 1단계 · 기초 훈련</div></div></aside><div className="main-shell"><header className="topbar"><span>{screen==='results'?'훈련 결과':tab==='training'?'개인 훈련장':tab==='settings'?'훈련 환경':'성장 기록'}</span><div><span className="local-badge"><i/> 로컬 기록 저장</span><span className="avatar">조준</span></div></header>{notice&&screen!=='results'&&<div className="global-notice">{notice}</div>}{screen==='results'?<Results/>:tab==='training'?<MainMenu/>:tab==='settings'?<SettingsPanel/>:<History/>}</div></div>;
}
