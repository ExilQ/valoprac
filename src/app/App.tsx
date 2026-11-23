import {useLocale} from '../i18n/locale';
import '../i18n/locale.css';
import {GraphicsNotice} from '../ui/GraphicsNotice';
import '../ui/graphicsNotice.css';
import {LegalNotice} from '../ui/LegalNotice';
import {PatchNotes} from '../ui/PatchNotes';
import {lazy,Suspense,useEffect} from 'react';
import {Crosshair,SlidersHorizontal,History as HistoryIcon,ArrowUpRight,Target,Map,LayoutGrid,Wrench} from 'lucide-react';
import {useNavigation} from './useNavigation';
import {useApp} from './store';
import {Brand} from '../components/Brand';
import {MainMenu} from '../ui/MainMenu';
import {SettingsPanel} from '../ui/SettingsPanel';
import {History} from '../ui/History';
import {WeaponSelection} from '../ui/WeaponSelection';
import {GameStage} from '../components/LazyGameStage';
import {Results} from '../ui/Results';
import {useInterfaceAudio} from '../ui/useInterfaceAudio';
import '../ui/homeUtility.css';
const MapLibrary=lazy(()=>import('../ui/MapLibrary').then(m=>({default:m.MapLibrary})));
const TrainingPlatform=lazy(()=>import('../ui/TrainingPlatform').then(m=>({default:m.TrainingPlatform})));
const AimDashboard=lazy(()=>import('../aim/ui/AimDashboard').then(m=>({default:m.AimDashboard})));
const StreamingStage=lazy(()=>import('../streaming/StreamingStage').then(m=>({default:m.StreamingStage})));
const PRIMARY_NAVIGATION=[
 {id:'training',label:'훈련',Icon:LayoutGrid},
 {id:'maps',label:'맵',Icon:Map},
 {id:'weapons',label:'무기',Icon:Crosshair},
 {id:'aim',label:'감도 연구실',Icon:Target},
 {id:'history',label:'기록',Icon:HistoryIcon},
 {id:'settings',label:'설정',Icon:SlidersHorizontal}
] as const;
const SECTION_TITLES={training:'훈련',maps:'맵',weapons:'무기',aim:'정밀 감도 연구실',history:'훈련 기록',settings:'설정',tools:'훈련 도구와 시나리오',stream:'렌더링 환경'} as const;

export function App(){
 useLocale();useNavigation();useInterfaceAudio();
 const screen=useApp(s=>s.screen),tab=useApp(s=>s.activeTab),setTab=useApp(s=>s.setTab),refresh=useApp(s=>s.refreshHistory),notice=useApp(s=>s.notice);
 useEffect(()=>{void refresh();},[refresh]);
 if(screen==='training')return <GameStage/>;
 const activeSection=screen==='results'?'history':tab==='tools'?'training':tab;
 return <div className="app-shell tactical-shell precision-shell">
  <aside className="sidebar utility-sidebar">
   <button className="brand-button" aria-label="훈련장 홈" onClick={()=>setTab('training')}><Brand/></button>
   <nav aria-label="주 메뉴" className="utility-primary-nav">{PRIMARY_NAVIGATION.map(({id,label,Icon},index)=><button key={id} className={activeSection===id?'active':''} aria-current={activeSection===id?'page':undefined} onClick={()=>setTab(id)}><Icon size={18} strokeWidth={1.6}/><span className="utility-nav-label">{label}</span><span className="utility-nav-index" aria-hidden="true">{String(index+1).padStart(2,'0')}</span></button>)}</nav>
   <div className="sidebar-bottom"><button className={`utility-tool-link ${tab==='tools'?'active':''}`} onClick={()=>setTab('tools')}><Wrench size={16}/><span>훈련 도구 · 시나리오</span><ArrowUpRight size={13}/></button><a href="/guide.html" target="_blank" rel="noreferrer">조작 방법과 검증 현황<ArrowUpRight size={13}/></a><p className="utility-local-note"><i aria-hidden="true"/>기록은 이 브라우저에 저장됩니다.</p></div>
  </aside>
  <div className="main-shell"><header className="topbar utility-topbar"><span>{screen==='results'?'훈련 결과':SECTION_TITLES[tab]}</span><div><span className="local-badge"><i/>계정 없이 바로 훈련</span><PatchNotes/></div></header>
   <GraphicsNotice/>{notice&&screen!=='results'&&<div className="global-notice" role="status">{notice}</div>}
   {screen==='results'?<Results/>:tab==='training'?<MainMenu/>:tab==='maps'?<Suspense fallback={<p className="utility-loading" role="status">맵을 준비합니다…</p>}><MapLibrary/></Suspense>:tab==='tools'?<Suspense fallback={<p className="utility-loading" role="status">훈련 도구를 준비합니다…</p>}><TrainingPlatform/></Suspense>:tab==='settings'?<SettingsPanel/>:tab==='weapons'?<WeaponSelection/>:tab==='stream'?<Suspense fallback={<p className="utility-loading" role="status">연결 화면을 준비하고 있습니다…</p>}><StreamingStage/></Suspense>:tab==='aim'?<Suspense fallback={<p className="utility-loading" role="status">감도 연구실을 준비합니다…</p>}><AimDashboard/></Suspense>:<History/>}
   <LegalNotice/>
  </div>
 </div>;
}
