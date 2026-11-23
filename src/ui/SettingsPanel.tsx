import {useId,useState,useSyncExternalStore} from 'react';
import {MousePointer2,Monitor,RotateCcw,Maximize,Volume2,SlidersHorizontal,Gauge,Keyboard} from 'lucide-react';
import {rotationCounts} from '../engine/input/zoomSensitivity';
import {sensitivityUnits} from '../engine/input/sensitivity';
import {useApp} from '../app/store';
import {DEFAULT_SETTINGS} from '../config/settings';
import {resolveMovementPhysics} from '../config/movement';
import type {Settings} from '../engine/types';
import {CombatControls} from './CombatControls';
import {FootstepSettings} from './FootstepSettings';
import {ValorantSettingsImport} from './ValorantSettingsImport';
import {CrosshairDesigner} from './CrosshairDesigner';
import {MovementPhysicsSettings,movementPhysicsLabel} from './MovementPhysicsSettings';
import {AdvancedSettings} from './AdvancedSettings';
import {PracticeControls} from './PracticeControls';
import {Tabs} from '../components/utility/Controls';
import {ThemeSelector} from './theme/ThemeSelector';
import './settingsUtility.css';

export type SettingsTab='general'|'controls'|'sensitivity'|'crosshair'|'graphics'|'audio'|'training'|'advanced';
const TABS:Record<SettingsTab,string>={general:'일반',controls:'조작',sensitivity:'감도',crosshair:'조준점',graphics:'그래픽',audio:'사운드',training:'훈련',advanced:'고급'};
const SETTINGS_TABS=Object.entries(TABS).map(([id,label])=>({id:id as SettingsTab,label}));
const compactSettingsQuery='(max-width: 680px)';
function subscribeToCompactSettings(onChange:()=>void) {
 const media=window.matchMedia(compactSettingsQuery);
 media.addEventListener('change',onChange);
 return ()=>media.removeEventListener('change',onChange);
}
function isCompactSettings() {
 return window.matchMedia(compactSettingsQuery).matches;
}
function desktopSettings() {
 return false;
}
const DESCRIPTIONS:Record<SettingsTab,string>={
 general:'화면 테마와 훈련 중 표시할 정보를 정합니다.',
 controls:'이동 규칙과 키를 정합니다. 감도는 별도 탭에서 조절할 수 있습니다.',
 sensitivity:'기본 감도와 정조준 배율을 따로 조절하고 회전 거리를 확인합니다.',
 crosshair:'표적을 가리지 않는 조준선을 만들고 프로필로 보관합니다.',
 graphics:'화면의 선명함과 장치에 맞는 렌더링 품질을 정합니다.',
 audio:'발사·발소리·확인음의 균형을 맞춥니다.',
 training:'표적, 수비수, 탄약과 발소리 훈련 조건을 정합니다.',
 advanced:'입력 진단과 재현 가능한 훈련을 위한 세부 정보입니다.'
};
type NumericKeys={ [K in keyof Settings]:Settings[K] extends number?K:never }[keyof Settings];
type BooleanKeys={ [K in keyof Settings]:Settings[K] extends boolean?K:never }[keyof Settings];

/** Interface structure only; all controls retain the existing settings store. */
export function SettingsPanel({initialTab='general'}:{initialTab?:SettingsTab}){
 const s=useApp(x=>x.settings),update=useApp(x=>x.updateSettings);
 const [tab,select]=useState<SettingsTab>(initialTab),[reset,setReset]=useState(false),[message,setMessage]=useState('');
 const id=useId(),physics=resolveMovementPhysics(s),units=sensitivityUnits(s.sensitivity,s.dpi,s.degreesPerCount);
 const changeNumber=(key:NumericKeys,value:number)=>{if(Number.isFinite(value))update({[key]:value,...(key==='renderScale'?{autoGraphics:false}:{})});};
 const number=(key:NumericKeys,label:string,min:number,max:number,step:number,suffix='')=><div className="range-field settings-number-field">
  <div className="settings-field-heading"><label htmlFor={`${id}-${key}`}>{label}</label><output htmlFor={`${id}-${key}`}>{Number(s[key].toFixed(3))}{suffix&&<small>{suffix}</small>}</output></div>
  <div className="settings-control-pair"><input id={`${id}-${key}`} aria-label={label} type="range" min={min} max={max} step={step} value={s[key]} onChange={e=>changeNumber(key,+e.target.value)}/><input className="settings-value-input" aria-label={`${label} 값`} type="number" min={min} max={max} step={step} value={s[key]} onChange={e=>{if(e.target.value!=='')changeNumber(key,e.target.valueAsNumber);}}/></div>
 </div>;
 const toggle=(key:BooleanKeys,label:string)=><label className="toggle-field"><span>{label}</span><input type="checkbox" checked={s[key]} onChange={e=>update({[key]:e.target.checked})}/><i aria-hidden="true"/></label>;
 const compact=useSyncExternalStore(subscribeToCompactSettings,isCompactSettings,desktopSettings);
 return <div className="settings-view precision-settings">
  <header className="view-title settings-page-heading"><div><p className="eyebrow">훈련 환경</p><h1>설정</h1><p>변경한 설정은 자동 저장되며 훈련에 바로 적용됩니다.</p></div><span className="settings-save-status"><span aria-hidden="true"/>자동 저장</span></header>
  <div className="settings-layout">
   <Tabs items={SETTINGS_TABS} value={tab} onChange={select} label="설정 분류"
    prefix="settings-tab" className="settings-tabs" orientation={compact?'horizontal':'vertical'}/>
   <div role="tabpanel" id={`settings-panel-${tab}`} aria-labelledby={`settings-tab-${tab}`} className="settings-tab-content" tabIndex={0}>
    <header className="settings-section-heading"><h2>{TABS[tab]}</h2><p>{DESCRIPTIONS[tab]}</p></header>
    {tab==='general'&&<div className="settings-grid"><section className="settings-card settings-theme-card"><h3>화면 테마</h3><ThemeSelector/></section><section className="settings-card"><h3><SlidersHorizontal size={18}/> 훈련 화면</h3>{number('hudScale','훈련 정보 크기',.75,1.25,.05,'배')}{toggle('showHeadshotConfirmation','명중·헤드샷 확인 표시')}{toggle('showControlHints','하단 조작 도움말 표시')}{toggle('practiceHud','자유 훈련 사격 통계 표시')}{toggle('brakingHud','속도와 제동 피드백 표시')}{toggle('showPerformance','프레임 성능 표시')}<p className="field-note">상세 진단은 필요할 때만 켜세요. 기본 조준선과 표적 판정은 표시 설정의 영향을 받지 않습니다.</p></section><section className="settings-card"><h3>데이터 보관</h3><p className="field-note">설정과 훈련 기록은 이 브라우저에 저장됩니다. 계정이나 서버 업로드 없이 사용할 수 있습니다.</p><div className="setting-readout"><span>현재 훈련 엔진</span><strong>브라우저 입체 렌더링</strong></div><p className="field-note">자유 훈련은 시간 제한이 없습니다. 경과 시간은 훈련을 종료하지 않습니다.</p></section></div>}
    {tab==='controls'&&<><div className="settings-grid"><MovementPhysicsSettings/><section className="settings-card settings-input-note"><h3><MousePointer2 size={18}/> 마우스 입력</h3><p className="field-note">훈련 시작 시 원시 마우스 입력을 요청합니다. 브라우저가 수락해도 운영체제의 전체 센서 경로를 검증한 것은 아닙니다.</p><div className="setting-readout"><span>기본 앉기 키</span><strong>{s.bindings.crouch.replace('Key','').replace('Left',' 왼쪽').replace('Right',' 오른쪽')}</strong></div><p className="field-note">Esc로 마우스 잠금을 풀고 설정을 열 수 있습니다. Ctrl+W는 브라우저 탭을 닫을 수 있어 기본 앉기 키 C를 권장합니다.</p></section></div><div className="settings-subsection-label"><Keyboard size={17}/><h3>키 지정과 자세</h3></div><AdvancedSettings section="bindings"/></>}
    {tab==='sensitivity'&&<><div className="settings-grid"><section className="settings-card"><h3><Gauge size={18}/> 기본 감도</h3>{number('sensitivity','마우스 감도',.01,5,.01)}{number('dpi','마우스 해상도',100,32000,100)}<p className="field-note">발로란트 게임 감도를 그대로 입력하세요. 기본 계수는 0.07입니다. 실제 이동감은 브라우저와 마우스 환경에 따라 달라질 수 있습니다.</p><details className="settings-disclosure"><summary>고급 입력 보정</summary>{number('degreesPerCount','감도 계수',.005,.3,.005,'도/카운트')}<p className="field-note">다른 입력 보정이 필요한 경우에만 변경하세요.</p></details>{number('fov','수평 시야각',60,120,1,'도')}</section><section className="settings-card settings-rotation-summary"><h3>회전 기준</h3><div className="settings-calibration-values"><div><span>현재 감도 × 입력 DPI · eDPI</span><strong>{units.edpi?.toFixed(1)??'—'}</strong></div><div><span>입력한 DPI로 계산한 회전 거리 추정</span><strong>{units.cm360?.toFixed(1)??'—'}<small>센티미터</small></strong></div></div><div className="rotation-counts" aria-label="360도 회전 입력 카운트">{[[1,'비조준'],[1.25,'소총 1.25배'],[2.5,'스코프 2.5배'],[5,'스코프 5배']].map(([zoom,label])=><div className="setting-readout" key={zoom}><span>{label} · 360°</span><strong>{Math.round(rotationCounts(s,+zoom)??0).toLocaleString('ko-KR')}<small>카운트</small></strong></div>)}<p className="field-note">전달된 마우스 델타와 현재 감도·배율로 계산합니다. 실제 센서 카운트나 원시 입력 경로를 측정한 값은 아닙니다.</p></div></section></div><AdvancedSettings section="sensitivity"/></>}
    {tab==='sensitivity'&&<ValorantSettingsImport settings={s} update={update}/>}
    {tab==='crosshair'&&<CrosshairDesigner settings={s} update={update}/>}
    {tab==='graphics'&&<><div className="settings-grid"><section className="settings-card"><h3><Monitor size={18}/> 화면과 프레임</h3><button className="secondary-button" onClick={()=>{const action=document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen?.();if(!action){setMessage('전체 화면을 지원하지 않는 브라우저입니다.');return;}void action.catch(()=>setMessage('전체 화면 전환을 허용하지 않았습니다.'));}}><Maximize size={15}/> 전체 화면 전환</button><p className="field-note">해상도는 브라우저 창 크기를 따릅니다. 렌더링 배율은 입체 화면의 선명함과 그래픽 부하를 조절합니다.</p>{number('renderScale','렌더링 배율',.5,1.5,.05)}<label className="practice-select">최대 렌더링 프레임<select aria-label="최대 렌더링 프레임" value={s.frameLimit} onChange={e=>update({frameLimit:+e.target.value})}>{[0,60,120,144,165,240].map(n=><option value={n} key={n}>{n?`초당 ${n}프레임`:'제한 없음'}</option>)}</select></label>{toggle('antialias','윤곽선 부드럽게')}<p className="field-note">프레임 제한과 관계없이 시뮬레이션은 초당 120회 연산합니다. 프레임 설정은 실측 성능을 보장하지 않습니다.</p></section><section className="settings-card"><h3>장치에 맞는 품질</h3>{toggle('autoGraphics','소프트웨어·내장 그래픽 감지 시 낮음 자동 적용')}<p className="field-note">브라우저가 제공하는 그래픽 이름으로 추정합니다. 실제 성능 측정과 다를 수 있으며, 품질을 직접 선택하면 자동 적용을 끕니다.</p></section></div><AdvancedSettings section="graphics"/></>}
    {tab==='audio'&&<><section className="settings-card"><h3><Volume2 size={18}/> 사운드 균형</h3>{number('volume','전체 음량',0,1,.05)}{number('interfaceVolume','인터페이스 음량',0,1,.05)}{number('footstepVolume','발소리 음량',0,1,.05)}<p className="field-note">버튼을 누른 이후 소리가 활성화됩니다. 음량은 듣는 소리만 조절하며 봇의 청각 판정에는 영향을 주지 않습니다.</p></section><details className="settings-advanced"><summary>무기별 음량과 사용자 음원</summary><AdvancedSettings section="audio"/></details></>}
    {tab==='training'&&<><div className="settings-grid"><section className="settings-card"><h3>표적과 탄약</h3><PracticeControls free includeTactical={false}/></section><section className="settings-card"><h3>수비수와 교전</h3><CombatControls/></section></div><details className="settings-advanced"><summary>발소리 누적과 잠입 훈련</summary><FootstepSettings/></details></>}
    {tab==='advanced'&&<div className="settings-grid"><section className="settings-card"><h3>선택형 진단</h3>{toggle('inputDiagnostics','입력 진단 표시')}{toggle('physicsDiagnostics','이동 물리 진단 표시')}{toggle('botDiagnostics','개발자용 봇 조준 진단')}{toggle('showPerformance','프레임 성능 표시')}<p className="field-note">진단에는 실제 속도와 처리 시간이 표시됩니다. 운영체제 가속, 센서 주파수나 입력부터 화면까지의 지연을 직접 측정한 값은 아닙니다.</p></section><section className="settings-card"><h3>재현 가능한 훈련</h3>{number('jumpBufferMs','착지 전 점프 입력 버퍼',0,140,5,'밀리초')}<label className="number-field">훈련 난수 시드<input aria-label="훈련 난수 시드" type="number" min="1" value={s.seed} onChange={e=>{if(e.target.value!=='')update({seed:e.target.valueAsNumber});}}/></label><p className="field-note">같은 시드와 동일한 입력은 같은 산포와 배치를 만듭니다. 새 시드는 다음 훈련부터 적용됩니다.</p><details className="settings-disclosure"><summary>현재 이동 모델의 보정 수치</summary><div className="setting-readout"><span>현재 이동 물리엔진</span><strong>{movementPhysicsLabel(s)}</strong></div><div className="mechanics-values"><span>기본 지상 속도 <b>{physics.maxSpeed} 미터/초</b></span><span>{s.movementPhysics==='counterStrike'?'지상 가속 계수':'지상 가속도'} <b>{physics.groundAcceleration}{s.movementPhysics==='counterStrike'?'':' 미터/초²'}</b></span><span>마찰 계수 <b>{physics.friction} /초</b></span><span>공중 가속 {s.movementPhysics==='counterStrike'?'계수':''} <b>{physics.airAcceleration}{s.movementPhysics==='counterStrike'?'':' 미터/초²'}</b></span><span>중력 <b>{physics.gravity} 미터/초²</b></span><span>점프 충격 속도 <b>{physics.jumpImpulse} 미터/초</b></span><span>실제 점프 입력 창 <b>{Math.round((physics.jumpBufferSeconds??0)*1000)}밀리초</b></span><span>정확도 속도 기준 <b>{physics.accuracyVelocityThreshold} 미터/초</b></span></div><p className="field-note">독립 보정 모델이며 실제 게임의 비공개 상수와 동일함을 뜻하지 않습니다. 무기·걷기·앉기 조건은 최종 속도에, 연사·착지 오차는 사격에 별도로 적용됩니다.</p></details></section></div>}
   </div>
  </div>
  {message&&<p className="inline-notice" role="status">{message}</p>}
  <div className="settings-reset">{reset?<><span>테마를 제외한 훈련 설정을 기본값으로 되돌릴까요?</span><button className="settings-reset-confirm" onClick={()=>{update(DEFAULT_SETTINGS);setReset(false);}}>초기화</button><button onClick={()=>setReset(false)}>취소</button></>:<button onClick={()=>setReset(true)}><RotateCcw size={14}/> 기본 설정으로 되돌리기</button>}</div>
 </div>;
}
