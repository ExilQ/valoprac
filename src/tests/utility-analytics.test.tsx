import {afterEach,describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {useApp} from '../app/store';
import {setLocale} from '../i18n/locale';
import {Simulation} from '../engine/simulation/Simulation';
import {DEFAULT_SETTINGS} from '../config/settings';
import {ResultDetails,Results} from '../ui/Results';
import {SprayPlot} from '../ui/SprayPlot';
import {SeriesChart,SensitivityCurve} from '../aim/ui/AimCharts';
import type {CandidateResult} from '../aim/statistics';

const initial=useApp.getState(),initialServer={...useApp.getInitialState()};
afterEach(async()=>{Object.assign(useApp.getInitialState(),initialServer);useApp.setState(initial);await setLocale('ko');});
describe('Precision Utility measurement presentation',()=>{
 it('shows actual summary measurements before diagnostics without altering the session',async()=>{
  await setLocale('ko');const session=new Simulation('free','rifleA',structuredClone(DEFAULT_SETTINGS)).snapshot(),before=JSON.stringify(session);
  const html=renderToStaticMarkup(<ResultDetails session={session}/>);
  expect(html.indexOf('이번 훈련의 핵심 측정값')).toBeLessThan(html.indexOf('이동·정조준·고저차 분석'));
  expect(html).toContain('0.0');expect(html).toContain('사격 분석');expect(html).not.toMatch(/NaN|Infinity/);expect(JSON.stringify(session)).toBe(before);
  // React server rendering reads Zustand's initial snapshot rather than its
  // live browser snapshot. Supply the same completed session to both views.
  const resultState={result:session,history:[],notice:''};Object.assign(useApp.getInitialState(),resultState);useApp.setState(resultState);const result=renderToStaticMarkup(<Results/>);
  expect(result).toContain('<h1>훈련 결과</h1>');expect(result).toContain('다시 훈련하기');expect(result).not.toContain('오늘의 한 발이');
 });
 it('keeps empty analytics explicit and never fabricates a chart',()=>{
  const html=renderToStaticMarkup(<><SeriesChart values={[]} label="실제 측정"/><SensitivityCurve results={[]}/></>);
  expect(html).toContain('표시할 실제 측정값이 없습니다.');expect(html).toContain('빈 그래프를 추정 점수로 채우지 않습니다.');expect(html).not.toContain('<svg');
 });
 it('preserves actual candidate values and uncertainty while using theme-aware chart ink',()=>{
  const values:CandidateResult[]=[{sensitivity:.4,score:.43,interval:[.32,.54],blocks:8,rounds:2,tasks:1,precision:.11,taskResults:[],median:.43,variability:.1},{sensitivity:.5,score:.57,interval:[.45,.69],blocks:8,rounds:2,tasks:1,precision:.12,taskResults:[],median:.57,variability:.12}];
  const before=JSON.stringify(values),html=renderToStaticMarkup(<SensitivityCurve results={values} base={.5}/>);
  expect(html).toContain('0.500');expect(html).toContain('0.450–0.690');expect(html).toContain('var(--chart-primary,#146d73)');expect(html).toContain('세로선은 반복 묶음의 불확실성 구간');expect(JSON.stringify(values)).toBe(before);
  const session=new Simulation('spray','rifleA',structuredClone(DEFAULT_SETTINGS)).snapshot(),spray=renderToStaticMarkup(<SprayPlot session={session}/>);expect(spray).toContain('var(--chart-grid,#d7dfdf)');expect(spray).toContain('var(--chart-text,#53636d)');
 });
});
