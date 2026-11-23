import {ArrowRight,ArrowUpRight,MoveHorizontal,Crosshair} from 'lucide-react';
import {useApp} from '../app/store';
import {TacticalMapSelection} from './TacticalMapSelection';
import {trainingMapTitle} from './trainingPresentation';
import {trainingChoice} from '../app/trainingNavigation';
import {PEEK_ZONES,activeAngles} from '../engine/tactical/complex';
import {levelFor} from '../engine/tactical/levels';
import {TrainingMapPlan} from './TrainingMapPlan';
export {TrainingMapPlan} from './TrainingMapPlan';
import type {PeekScenario} from '../engine/types';
import {WEAPONS} from '../config/weapons';
import './homeUtility.css';

export function MapLibrary(){
 const s=useApp(x=>x.settings),update=useApp(x=>x.updateSettings),setMode=useApp(x=>x.setMode),start=useApp(x=>x.start),setTab=useApp(x=>x.setTab);
 const level=levelFor(s.practiceMap),title=trainingMapTitle(s);
 const chooseSector=(scenario:PeekScenario)=>{setMode('free');update({practiceMap:'complex',peekScenario:scenario,targetCount:Math.min(12,activeAngles(scenario).length),eliminationRule:'damage',analysisWall:false});};
 const chooseMechanics=(id:'bunny'|'wallbang')=>{const choice=trainingChoice(id);setMode(choice.mode);update(choice.settings);};
 return <section className="utility-map-library"><header className="utility-page-heading"><div><p className="eyebrow">공간과 훈련 목적</p><h1>맵</h1><p>사격장부터 연결형 전술 공간까지. 연습할 각도와 이동 경로를 고르세요.</p></div><button className="secondary-button" onClick={()=>setTab('tools')}>경로·시나리오 편집<ArrowUpRight size={14}/></button></header>
  <section className="utility-map-overview"><div className="utility-map-drawing"><TrainingMapPlan map={s.practiceMap}/><div className="utility-map-legend"><span><i className="start"/>시작 위치</span><span><i className="cover"/>실제 엄폐물</span>{level&&<span><i className="defender"/>설계된 수비각</span>}</div></div><div className="utility-map-selected"><p className="eyebrow">선택한 맵</p><h2>{title}</h2><p>{level?.description??(s.practiceMap==='tactical'?'발소리 정보와 엄폐물 피킹을 연습하는 기존 훈련 공간입니다.':'표적 수·행동·거리와 사격 상태를 자유롭게 조정하는 기본 공간입니다.')}</p><dl><div><dt>훈련 형태</dt><dd>{s.practiceMap==='complex'?'연결형 전술 시설':level?.family??'개별 사격 훈련'}</dd></div><div><dt>사선</dt><dd>{level?`${level.angles.length}개`:'사용자 표적 설정'}</dd></div><div><dt>기하 기준</dt><dd>원본 이동·충돌 정보</dd></div></dl><button className="primary-button" onClick={()=>{setMode('free');start();}}>현재 맵에서 훈련<ArrowRight size={18}/></button><button className="utility-text-link" onClick={()=>setTab('training')}>훈련 설정으로 돌아가기</button></div></section>
  <TacticalMapSelection includeBase/>
  <section className="utility-mechanics-maps"><header><h2>이동과 재질 훈련</h2><p>기존 물리와 충돌을 그대로 사용합니다.</p></header><div><button aria-pressed={s.practiceMap==='bunny'} onClick={()=>chooseMechanics('bunny')}><MoveHorizontal size={19}/><span><strong>관성 이동 코스</strong><small>수동 점프 · 경사로 · 착지 입력</small></span><ArrowUpRight size={14}/></button><button aria-pressed={s.practiceMap==='wallbang'} onClick={()=>chooseMechanics('wallbang')}><Crosshair size={19}/><span><strong>재질 관통 사격장</strong><small>엄폐물의 재질 · 두께 · 입사각</small></span><ArrowUpRight size={14}/></button></div></section>
  {s.practiceMap==='complex'&&<section className="utility-zone-library" aria-label="피킹 훈련 구역"><header><div><h2>피킹 훈련 구역</h2><p>하나의 시설 안에서 이어지는 여덟 구역입니다. 이동과 피킹은 직접 수행합니다.</p></div><button aria-pressed={s.peekScenario==='free'} className="secondary-button" onClick={()=>chooseSector('free')}>전체 전술 맵 · 자유 탐색</button></header><div className="utility-zone-grid">{PEEK_ZONES.map(zone=><button key={zone.id} aria-pressed={s.peekScenario===zone.scenario} onClick={()=>chooseSector(zone.scenario)}><span className="utility-zone-index">{zone.id}</span><span><h3>{zone.name}</h3><p>{zone.focus}</p><small>{zone.difficulty===1?'입문':zone.difficulty===3?'숙련':'보통'} · {zone.angles.length}개 사선 · 고저차 {zone.vertical}m · {WEAPONS[zone.recommended].name}</small></span></button>)}<button aria-pressed={s.peekScenario==='operator'} onClick={()=>chooseSector('operator')}><span className="utility-zone-index"><Crosshair size={17}/></span><span><h3>오퍼레이터 대응</h3><p>저격 사격을 유도하고 볼트 회복 중 재진입</p><small>숄더 구역 · 엄폐 복귀와 소리로 판단</small></span></button></div></section>}
  <p className="utility-map-origin-note">모든 맵은 자체 제작했습니다. 평면도는 기존 충돌·경로 정의에서 그리며, 맵 선택은 실제 게임의 판정이나 물리 규칙을 바꾸지 않습니다.</p>
 </section>;
}
