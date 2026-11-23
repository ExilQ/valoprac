import {afterEach,describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {App} from '../app/App';
import {MainMenu} from '../ui/MainMenu';
import {MapLibrary,TrainingMapPlan} from '../ui/MapLibrary';
import {parseRoute,TAB_PATHS} from '../app/navigation';
import {useApp} from '../app/store';
import {DEFAULT_SETTINGS} from '../config/settings';
import {LEVEL_IDS,LEVEL_SPECS} from '../config/tactical';
import {levelFor} from '../engine/tactical/levels';
import {PEEK_ZONES} from '../engine/tactical/complex';
const initial={...useApp.getInitialState()};
function state(patch:Partial<ReturnType<typeof useApp.getState>>){Object.assign(useApp.getInitialState(),patch);useApp.setState(patch);}
afterEach(()=>{Object.assign(useApp.getInitialState(),initial);useApp.setState(initial);});

describe('Precision Utility navigation preserves training routes and real map data',()=>{
 it('offers six primary destinations and keeps tools within the training section',()=>{
  for(const tab of ['training','maps','weapons','aim','history','settings','tools'] as const){
   state({screen:'menu',activeTab:tab,settings:structuredClone(DEFAULT_SETTINGS)});const html=renderToStaticMarkup(<App/>),nav=html.slice(html.indexOf('<nav aria-label="주 메뉴"'),html.indexOf('</nav>'));
   expect(nav.match(/<button/g)).toHaveLength(6);expect(nav.match(/aria-current="page"/g)).toHaveLength(1);
   for(const label of ['훈련','맵','무기','감도 연구실','기록','설정'])expect(nav).toContain(label);
   if(tab==='tools')expect(nav.match(/<button class="active"[^>]*>[\s\S]*?<\/button>/)?.[0]).toContain('훈련');
   expect(html).not.toContain('PRACTICE WITH PURPOSE');
  }
 });
 it('resolves the map deep link while preserving all previous entry paths',()=>{
  for(const path of ['/maps','/maps/','/maps.html'])expect(parseRoute(path)).toEqual({screen:'menu',activeTab:'maps'});
  expect(TAB_PATHS.maps).toBe('/maps.html');expect(parseRoute('/training.html')).toEqual({screen:'training',activeTab:'training'});expect(parseRoute('/tools.html').activeTab).toBe('tools');expect(parseRoute('/unreal.html').activeTab).toBe('stream');
 });
 it('keeps the current task start before advanced controls and allows quick target configuration',()=>{
  state({screen:'menu',activeTab:'training',mode:'free',settings:{...DEFAULT_SETTINGS,targetCount:4},history:[]});const html=renderToStaticMarkup(<MainMenu/>);
  expect(html).toContain('aria-label="빠른 표적 수"');expect(html).toContain('value="4"');expect(html.indexOf('class="start-button"')).toBeLessThan(html.indexOf('<details class="training-configuration"'));expect(html).toContain('훈련장 종류');expect(html).toContain('훈련 도구와 시나리오');expect(html).not.toContain('TRAINING GROUND');
 });
 it('lists every existing original map and all physical peeking sectors without changing their geometry',()=>{
  state({settings:{...DEFAULT_SETTINGS,practiceMap:'complex'}});const level=levelFor('complex')!,before=JSON.stringify(level),html=renderToStaticMarkup(<MapLibrary/>);
  for(const id of LEVEL_IDS)expect(html).toContain(LEVEL_SPECS[id].title);
  for(const z of PEEK_ZONES)expect(html).toContain(z.name);
  for(const name of ['기본 사격장','기존 코너 피킹','관성 이동 코스','재질 관통 사격장','오퍼레이터 대응'])expect(html).toContain(name);
  expect(JSON.stringify(level)).toBe(before);expect(html).toContain('원본 이동·충돌 정보');expect(html).not.toContain('COUNTERPLAY');
 });
 it('renders collision-derived plans without creating fake weapon or map statistics',()=>{
  for(const map of ['range','long','tower','complex','bunny','wallbang']){const plan=renderToStaticMarkup(<TrainingMapPlan map={map}/>);expect(plan).toContain('실제 엄폐물과 이동 경로 평면도');expect(plan).toContain('utility-plan-start');expect(plan).not.toContain('NaN');}
  expect(renderToStaticMarkup(<TrainingMapPlan map="tactical"/>)).toContain('노출 사망은 지원하지 않습니다.');
 });
});
