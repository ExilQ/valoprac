import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {ScenarioEditor,initialScenarioEditorState} from '../ui/ScenarioEditor';
import {scenarioURL} from '../training/scenarios/codec';
import {ScenarioRoutes,routeComparisons} from '../ui/ScenarioRoutes';
import {createScenario,SCENARIO_ROUTES} from '../training/scenarios/templates';
import {Simulation} from '../engine/simulation/Simulation';
import {DEFAULT_SETTINGS} from '../config/settings';
import {ReplayRecorder} from '../engine/replay/recording';
import {ReplayPlayer} from '../engine/replay/playback';
import {emptyInput} from '../engine/types';

describe('A4/A5 actual training and compact Korean scenario interface',()=>{
 it('prefills a validated shared link without starting training and rejects malformed address data',()=>{
  const source=createScenario('vertical');source.seed=391;const loaded=initialScenarioEditorState(undefined,scenarioURL(source));expect(loaded.definition).toEqual(source);expect(loaded.message).toContain('시작 버튼');const invalid=initialScenarioEditorState(undefined,'https://valoprac.trade/tools.html#scenario=VP-S1.invalid!!!');expect(invalid.definition).toEqual(createScenario('long-lane'));expect(invalid.message).toContain('불러오지 못했습니다');
 });
 it('renders real route actions and empty comparisons without invented performance',()=>{
  const html=renderToStaticMarkup(<ScenarioRoutes onStart={()=>{}} history={[]}/>);for(const route of SCENARIO_ROUTES)expect(html).toContain(route.title);expect(html.match(/>훈련 시작</g)).toHaveLength(SCENARIO_ROUTES.length);expect(routeComparisons([]).every(row=>row.sessions===0&&row.clears===null&&row.headshot===null)).toBe(true);
 });
 it('renders all editable rules and coordinate alternatives with an audited initial layout',()=>{
  const html=renderToStaticMarkup(<ScenarioEditor onStart={()=>{}} initialScenario={createScenario('vertical')}/>);for(const label of ['시나리오 이름','시나리오 시드','수비 무기','수비 이동','시작 높이','진입 사선','노출 시간 사망','시간 무제한','시나리오 공유 코드','파일 불러오기'])expect(html).toContain(label);expect(html).toContain('엄폐·바닥·진입 사선 검증 통과');expect(html).not.toContain('disabled="" type="submit"');
 });
 for(const route of SCENARIO_ROUTES)it(`${route.id}: applies shared conditions and preserves complete simulation replay`,async()=>{
  const def=createScenario(route.id);def.rules.randomSpawns=true;
  const sim=new Simulation('free','rifleA',structuredClone(DEFAULT_SETTINGS),{scenario:def}),recorder=new ReplayRecorder(sim);sim.running=true;
  for(let n=0;n<120;n++)sim.step(1/120,emptyInput());const session=sim.snapshot(),replay=recorder.finish()!;
  expect(sim.practiceMap).toBe(def.template);expect(sim.targets.filter(t=>t.enabled)).toHaveLength(def.bots.length);expect(session.sessionOptions?.scenario?.routeId).toBe(route.id);expect((await new ReplayPlayer(replay).verify()).passed).toBe(true);
  const rows=routeComparisons([session]);expect(rows.find(row=>row.id===route.id)?.sessions).toBe(1);expect(rows.filter(row=>row.sessions>0)).toHaveLength(1);
 });
});
