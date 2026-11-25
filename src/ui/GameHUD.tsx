import {useState} from 'react';
import {MovementProfileStatus,MovementPhysicsDiagnostics,MovementPhysicsDetails} from './MovementPhysicsFeedback';
import {HopFeedback,WallbangFeedback,CombatDiagnostics} from './MechanicsFeedback';
import {COMBAT_MODE_LABELS} from './CombatControls';
import {PeekingFeedback} from './PeekingFeedback';
import type {Runtime,Telemetry} from '../engine/Runtime';
import type {Mode,WeaponId,Settings} from '../engine/types';
import {WEAPONS,KNIFE_SKINS,SIDEARM,slotOf} from '../config/weapons';
import {loadKnifeSkin} from '../config/weaponFinishes';
import {useApp} from '../app/store';
import {trainingTitle,trainingTimed,scenarioTitleIsLiteral,trainingKeyLabel} from './trainingPresentation';
import {FootstepHUD} from './FootstepHUD';
import {GameplayDiagnostics} from './GameplayDiagnostics';
import {LiveRecoil} from './LiveRecoil';
import './precisionHud.css';

export type HudRuntime=Pick<Runtime,'simulation'|'input'>;

/** Number-row loadout: 1 primary, 2 sidearm, 3 knife. */
function WeaponSlots({weapon}:{weapon:WeaponId}){
 const primary=useApp(s=>s.primaryWeapon),active=slotOf(weapon);
 const items:[1|2|3,string][]=[[1,WEAPONS[primary].name],[2,WEAPONS[SIDEARM].name],[3,'칼']];
 return <ol className="weapon-slots-hud" aria-label="무기 슬롯">{items.map(([slot,name])=><li key={slot} data-active={slot===active?'true':undefined}><kbd>{slot}</kbd><span>{name}</span></li>)}</ol>;
}

function KnifeReadout(){
 const [id]=useState(loadKnifeSkin),skin=KNIFE_SKINS.find(k=>k.id===id)??KNIFE_SKINS[0];
 return <div className="ammo-hud knife-hud" data-ammo-state="ready">
  <span>{skin.name}</span><small className="reserve-count">근접</small>
  <strong aria-label="근접 무기">칼</strong>
  <p>좌클릭 베기 · 우클릭 찌르기</p>
 </div>;
}

function Magazine({weapon,settings,telemetry}:{weapon:WeaponId;settings:Settings;telemetry:Telemetry}) {
 if(weapon==='knife')return <KnifeReadout/>;
 const profile=WEAPONS[weapon];
 const current=telemetry.weapon===weapon;
 const ammo=Math.max(0,Math.min(profile.magazine,current?telemetry.ammo:profile.magazine));
 const reserve=current?telemetry.reserve:profile.reserve;
 const reload=current?telemetry.reloading:null;
 const ads=current&&telemetry.ads;
 const low=ammo<=Math.ceil(profile.magazine*.2);
 const count=Math.min(profile.magazine,10);
 const segments=Array.from({length:count},(_,index)=>Math.max(0,Math.min(1,ammo/profile.magazine*count-index)));
 let action=weapon==='sheriff'?'단발 · 정조준 없음':ads?'정조준 1.25배':'우클릭 · 정조준';
 if(weapon==='operator'){
  if(current&&telemetry.operatorState==='bolt-cycling')action='볼트 회복 중';
  else if(ads)action=`스코프 ${(telemetry.scopeZoom??1).toFixed(1)}배`;
  else action=settings.operatorScopeMode==='hold'?'우클릭 유지 · 스코프':'우클릭 · 2.5 → 5 → 해제';
 }
 if(reload!==null)action=`재장전 ${reload.toFixed(1)}초`;
 else if(ammo===0)action=`${trainingKeyLabel(settings.bindings.reload)} · 재장전`;
 return <div className="ammo-hud" data-ammo-state={reload!==null?'reloading':low?'low':'ready'}>
  <span>{profile.name}</span><small className="reserve-count">예비 {settings.infiniteReserve?'∞':reserve}</small>
  <strong aria-label={`탄창 ${ammo} / ${profile.magazine}발`}>{String(ammo).padStart(2,'0')}<small> / {profile.magazine}</small></strong>
  <div className="ammo-segments" aria-hidden="true">{segments.map((filled,index)=><span key={index}><i style={{width:`${filled*100}%`}}/></span>)}</div>
  <p>{action}</p>
 </div>;
}

function HealthGauge({health}:{health:number}) {
 const value=Math.min(150,Math.max(0,Math.round(health)));
 return <div className="health-hud" data-health-state={value<=50?'low':'ready'}>
  <div><span>체력</span><strong>{value}<small> / 150</small></strong></div>
  <div className="health-hud-meter" role="meter" aria-label="현재 체력" aria-valuemin={0} aria-valuemax={150} aria-valuenow={value}>
   <i style={{width:`${value/150*100}%`}}/>
  </div>
 </div>;
}

export function GameHUD({runtime,settings,telemetry,mode,weapon}:{runtime:HudRuntime|null;settings:Settings;telemetry:Telemetry;mode:Mode;weapon:WeaponId}){
 const options=runtime?.simulation.options;
 const timed=trainingTimed(mode,settings,options);
 const duration=options?.exercise?.durationSeconds??options?.scenario?.rules.duration??settings.duration;
 const remaining=timed?Math.max(0,Math.ceil(duration-telemetry.time)):Math.floor(telemetry.time);
 const timeText=`${Math.floor(remaining/60).toString().padStart(2,'0')}:${(remaining%60).toString().padStart(2,'0')}`;
 const fraction=timed?Math.max(0,Math.min(1,(duration-telemetry.time)/duration)):0;
 const movement=runtime?.simulation.movement;
 const accuracySpeed=weapon==='operator'?5.13*.72*.15:movement?.profile.accuracyVelocityThreshold??.65;
 const meterMax=settings.practiceMap==='bunny'?movement?.profile.hopSpeedCap??5.5:movement?.profile.maxSpeed??5.4;
 const movementLabel=movement&&!movement.grounded?'공중':telemetry.accurate?'정확도 준비':runtime?.simulation.footsteps.state==='braking'?'제동 중':'이동 중';
 const optionalDiagnostics=settings.inputDiagnostics||settings.physicsDiagnostics||settings.botDiagnostics||settings.penetrationDiagnostics||settings.recoilAnalysis;
 const health=telemetry.health??telemetry.peeking?.health;
 const title=trainingTitle(mode,settings,options);
 const binding=settings.bindings;
 const keys=[binding.forward,binding.left,binding.backward,binding.right].map(trainingKeyLabel).join(' ');
 return <div className="game-hud precision-hud" aria-label="훈련 정보">
  <div className="hud-left-dock">
   <FootstepHUD simulation={runtime?.simulation??null} settings={settings}/>
   {settings.brakingHud&&<div className="braking-hud">
    <div className="hud-eyebrow">이동과 정확도</div>
    <div className="speed"><strong>{telemetry.speed.toFixed(2)}</strong><span>미터/초</span><b className={telemetry.accurate?'ready':'not-ready'}>{movementLabel}</b></div>
    <div className="speed-meter"><i style={{width:`${Math.min(100,telemetry.speed/meterMax*100)}%`}}/><b style={{left:`${accuracySpeed/meterMax*100}%`}}/></div>
    <details className="hud-braking-details">
     <summary>제동 시점</summary>
     <div className="braking-times">
      <span>키 해제 후 <b>{telemetry.release===null?'—':`${Math.round(telemetry.release*1000)} 밀리초`}</b></span>
      <span>준비까지 예상 <b>{telemetry.ready===null?'—':`${Math.round(telemetry.ready*1000)} 밀리초`}</b></span>
      <span>최근 제동 발사 시점 <b>{telemetry.thresholdDelta===null?'—':`${telemetry.thresholdDelta>=0?'+':''}${Math.round(telemetry.thresholdDelta*1000)} 밀리초`}</b></span>
     </div>
    </details>
   </div>}
  </div>
  <div className="hud-top-center">
   <div className="game-top">
    <div className="mode-pill" title={runtime?.simulation.defenders?COMBAT_MODE_LABELS[settings.combatMode]:undefined}>
     <span className="hud-mode-title" data-locale={scenarioTitleIsLiteral(options)?'literal':undefined} title={title}>{title}</span>
    </div>
    <div className={timed&&remaining<=10?'timer danger':'timer'}>
     <small>{timed?'남은 시간':'경과 시간'}</small><strong>{timeText}</strong>
     {timed&&<span className="hud-round-progress" aria-hidden="true"><i style={{width:`${fraction*100}%`}}/></span>}
    </div>
    <div className="kill-counter"><strong>{telemetry.exercise?.score??telemetry.score}</strong><small>{telemetry.exercise?.kind==='flash'?'회피 성공':'제거'}</small></div>
   </div>
   <MovementProfileStatus settings={settings} movement={movement}/>
   <GameplayDiagnostics runtime={runtime} placement="training"/>
  </div>
  <div className="hud-right-dock">
   {runtime&&<MovementPhysicsDiagnostics simulation={runtime.simulation}/>}
   <div className="hud-right-stack">
    {runtime?.simulation.practiceMap==='bunny'&&<HopFeedback compact h={runtime.simulation.movement.hopSnapshot()}/>}
    {runtime?.simulation.practiceMap==='wallbang'&&<WallbangFeedback simulation={runtime.simulation}/>}
    {telemetry.peeking&&<PeekingFeedback report={telemetry.peeking} compact showHealth={false} summary={settings.practiceHud?telemetry.summary:null}/>}
    {mode==='free'&&!telemetry.peeking&&settings.practiceHud&&telemetry.summary&&<details className="practice-stat-hud">
     <summary>사격 통계 <b>{telemetry.summary.hitAccuracy.toFixed(1)}%</b></summary>
     <div className="hud-practice-details">
      <span>발사 {telemetry.summary.shots} · 명중 {telemetry.summary.heads+telemetry.summary.bodies+telemetry.summary.limbs} · 빗나감 {telemetry.summary.misses}</span>
      <span>명중률 {telemetry.summary.hitAccuracy.toFixed(1)}% · 헤드샷 {telemetry.summary.headshotAccuracy.toFixed(1)}%</span>
     </div>
    </details>}
    {optionalDiagnostics&&<details className="hud-diagnostics-disclosure" open>
     <summary>선택한 상세 진단</summary>
     <div className="hud-diagnostics-content">
      {settings.recoilAnalysis&&mode==='free'&&<LiveRecoil compact runtime={runtime} telemetry={telemetry}/>}
      <GameplayDiagnostics runtime={runtime} placement="input"/>
      {runtime&&<><MovementPhysicsDetails simulation={runtime.simulation}/><CombatDiagnostics simulation={runtime.simulation}/></>}
     </div>
    </details>}
   </div>
   <WeaponSlots weapon={weapon}/>
   <Magazine weapon={weapon} settings={settings} telemetry={telemetry}/>
   {settings.combatMode==='gunfight'&&typeof health==='number'&&Number.isFinite(health)&&<HealthGauge health={health}/>}
  </div>
  <div className="hud-bottom-center">
   {settings.showControlHints&&<div className="game-bottom-center">
    <span><kbd>{keys}</kbd> 이동</span><span><kbd>{trainingKeyLabel(binding.walk)}</kbd> 걷기</span>
    <span><kbd>{trainingKeyLabel(binding.crouch)}</kbd> 앉기</span><span><kbd>{trainingKeyLabel(binding.reload)}</kbd> 재장전</span>
    {weapon==='operator'&&<span><kbd>{trainingKeyLabel(settings.operatorZoomBinding)}</kbd> 배율 전환</span>}
    <span><kbd>1·2·3</kbd> 주무기·보조·칼</span><span><kbd>Esc</kbd> 설정</span><span><kbd>{trainingKeyLabel(binding.weapons)}</kbd> 무기 선택</span>
   </div>}
   {settings.showPerformance&&<div className="performance-hud">{Math.round(telemetry.fps)} 프레임/초 <span>·</span> 지연 상위 5% {telemetry.p95.toFixed(1)} 밀리초 <span>·</span> 120회/초 연산 {telemetry.debt>0&&`· 대기 ${telemetry.debt}회`}</div>}
  </div>
 </div>;
}
