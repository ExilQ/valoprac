import {afterEach,describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {useApp} from '../app/store';
import {DEFAULT_SETTINGS} from '../config/settings';
import {SettingsPanel,type SettingsTab} from '../ui/SettingsPanel';
import {AdvancedSettings} from '../ui/AdvancedSettings';
import {Simulation} from '../engine/simulation/Simulation';
import {simulationChecksum} from '../engine/replay/integrity';
import {setLocale} from '../i18n/locale';
const initial={...useApp.getInitialState()};
const tabs:SettingsTab[]=['general','controls','sensitivity','crosshair','graphics','audio','training','advanced'];
function settings(){const settings={...structuredClone(DEFAULT_SETTINGS),sensitivity:.5,dpi:800};Object.assign(useApp.getInitialState(),{settings});useApp.setState({settings});return settings;}
afterEach(async()=>{Object.assign(useApp.getInitialState(),initial);useApp.setState(initial);await setLocale('ko');});

describe('Precision Utility settings preserve gameplay controls',()=>{
 it('organizes every category around a distinct task and keeps advanced details collapsed',()=>{
  settings();const html=tabs.map(initialTab=>renderToStaticMarkup(<SettingsPanel initialTab={initialTab}/>));
  expect(html.every(s=>(s.match(/role="tab"/g)??[]).length===8)).toBe(true);
  expect(html[0]).toContain('화면 테마');expect(html[0]).not.toContain('인터페이스 언어');
  expect(html[1]).toContain('이동 물리엔진');expect(html[1]).toContain('aria-label="앞으로 키"');
  expect(html[2]).toContain('소총 1.25배 감도 배율');expect(html[2]).toContain('오퍼레이터 2.5배 감도 배율');expect(html[2]).toContain('오퍼레이터 5배 감도 배율');
  expect(html[6]).toContain('표적과 탄약');expect(html[6]).toContain('수비수와 교전');
  expect(html[7]).toContain('입력 진단 표시');expect(html[7]).toContain('훈련 난수 시드');
  expect(html[2]).toContain('<details class="settings-disclosure"><summary>고급 입력 보정');
  expect(html[5]).toContain('<details class="settings-advanced"><summary>무기별 음량과 사용자 음원');
 });
 it('shows real supplied sensitivity, DPI and zoom diagnostics with the original calculation',()=>{
  settings();const html=renderToStaticMarkup(<SettingsPanel initialTab="sensitivity"/>).replace(/<!--.*?-->/g,'');
  expect(html).toContain('400.0');expect(html).toContain('32.7');expect(html).toContain('10,286');
  for(const label of ['비조준 · 360°','소총 1.25배 · 360°','스코프 2.5배 · 360°','스코프 5배 · 360°','실제 센서 카운트'])expect(html).toContain(label);
  expect(html).toContain('aria-label="마우스 감도 값" type="number"');
  expect(html).toContain('aria-label="마우스 감도" type="range"');
 });
 it('does not mark an existing high-DPI or high-sensitivity preference outside the control range',()=>{
  const current={...settings(),sensitivity:4,dpi:16000,degreesPerCount:.25};Object.assign(useApp.getInitialState(),{settings:current});useApp.setState({settings:current});
  const html=renderToStaticMarkup(<SettingsPanel initialTab="sensitivity"/>);
  expect(html).toContain('aria-label="마우스 감도 값" type="number" min="0.01" max="5"');
  expect(html).toContain('aria-label="마우스 해상도 값" type="number" min="100" max="32000"');
  expect(html).toContain('aria-label="감도 계수 값" type="number" min="0.005" max="0.3"');
  expect(useApp.getState().settings).toEqual(current);
 });
 it('retains the legacy combined controls section while new categories avoid duplicate input groups',()=>{
  settings();const legacy=renderToStaticMarkup(<AdvancedSettings section="controls"/>),sensitivity=renderToStaticMarkup(<AdvancedSettings section="sensitivity"/>),bindings=renderToStaticMarkup(<AdvancedSettings section="bindings"/>);
  for(const label of ['소총 정조준 방식','오퍼레이터 스코프','앉기 방식','정조준 점 크기','입력 진단 표시','앞으로 키'])expect(legacy).toContain(label);
  expect(sensitivity).toContain('소총 정조준 방식');expect(sensitivity).not.toContain('aria-label="앞으로 키"');
  expect(bindings).toContain('aria-label="앞으로 키"');expect(bindings).not.toContain('소총 1.25배 감도 배율');expect(bindings).not.toContain('aria-label="정조준 점 크기"');
 });
 it('rendering all settings categories does not mutate selected mechanics or the live simulation',()=>{
  const s=settings(),simulation=new Simulation('free','rifleA',s),before=simulationChecksum(simulation),stored=JSON.stringify(useApp.getState().settings);
  for(const initialTab of tabs)renderToStaticMarkup(<SettingsPanel initialTab={initialTab}/>);
  expect(JSON.stringify(useApp.getState().settings)).toBe(stored);expect(simulationChecksum(simulation)).toBe(before);
 });
});
