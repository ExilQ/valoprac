import {MAP_COURSES} from '../config/mapCourses';
import {useApp} from '../app/store';
import {LEVEL_IDS,LEVEL_SPECS} from '../config/tactical';

/** The authored maps are always visible after entering tactical training. The
 * original sound-only prototype stays available in advanced controls. */
export function TacticalMapSelection({includeBase=false}:{includeBase?:boolean}){
 const s=useApp(x=>x.settings),update=useApp(x=>x.updateSettings),setMode=useApp(x=>x.setMode);
 const chooseComplex=()=>{setMode('free');update({practiceMap:'complex',peekScenario:'free',drill:'none',targetCount:11,eliminationRule:'damage',analysisWall:false,exposureEnabled:true});};
 return <section className={`tactical-map-selection ${includeBase?'advanced-map-selection':'primary-map-selection'}`} aria-label="전술 맵 선택"><header><h2>전술 맵 선택</h2><p>연결형 피킹 연구실 또는 여섯 집중 훈련 맵을 선택하세요.</p></header><div className="tactical-map-grid">
 <button aria-pressed={s.practiceMap==='complex'} onClick={chooseComplex}>전술 피킹 연구실<small>연결된 8구역 · 수동 피킹 · 노출 사망</small></button>
 {LEVEL_IDS.map(id=><button key={id} aria-pressed={s.practiceMap===id} onClick={()=>{setMode('free');update({practiceMap:id,drill:['mid','tower','multi'].includes(id)?'vertical':'corner',analysisWall:false,targetCount:3,exposureEnabled:true,eliminationRule:'damage'});}}>{LEVEL_SPECS[id].title}<small>{LEVEL_SPECS[id].family} · {LEVEL_SPECS[id].description}</small></button>)}
 {includeBase&&<><button aria-pressed={s.practiceMap==='range'} onClick={()=>{setMode('free');update({practiceMap:'range',drill:'none',analysisWall:false});}}>기본 사격장<small>무제한 자유 훈련</small></button><button aria-pressed={s.practiceMap==='tactical'} onClick={()=>{setMode('free');update({practiceMap:'tactical',drill:'none',analysisWall:false});}}>기존 코너 피킹<small>이전 발소리 시제품 · 노출 사망 미지원</small></button></>}
 </div><header><h2>맵별 전술 훈련</h2><p>맵의 특징을 살려 직접 설계한 VALOPRAC 훈련 코스입니다.</p></header>
 <div className="tactical-map-grid">{MAP_COURSES.map(course=><button key={course.id} aria-pressed={s.practiceMap===course.id} onClick={()=>{
  setMode('free');update({practiceMap:course.id,drill:'corner',targetCount:3,analysisWall:false,exposureEnabled:true,eliminationRule:'damage'});
 }}>{course.title}<small>{course.description}</small></button>)}</div></section>;
}
