import {afterEach,describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {useApp} from '../app/store';
import {DEFAULT_SETTINGS} from '../config/settings';
import {WEAPONS,WEAPON_ORDER} from '../config/weapons';
import {LEVEL_IDS,LEVEL_SPECS} from '../config/tactical';
import {PEEK_ZONES} from '../engine/tactical/complex';
import {ScopeOverlay} from '../components/ScopeOverlay';
import {WeaponSelection} from '../ui/WeaponSelection';
import {OperatorScopeControls,scopeBindingError} from '../ui/OperatorScopeControls';
import {PeekingMapSelection} from '../ui/PeekingMapSelection';
import {TacticalControls} from '../ui/TacticalControls';
import {GameHUD} from '../ui/GameHUD';
import {MainMenu} from '../ui/MainMenu';
import {DeathReplay,OperatorFeedback,PeekingFeedback} from '../ui/PeekingFeedback';
import {INITIAL_TELEMETRY} from '../engine/Runtime';
import type {PeekReport} from '../engine/tactical/DefenderAI';
import type {SessionData} from '../engine/types';

const initial={...useApp.getInitialState()};
const state=(patch:Partial<ReturnType<typeof useApp.getState>>)=>{Object.assign(useApp.getInitialState(),patch);useApp.setState(patch);};
afterEach(()=>{Object.assign(useApp.getInitialState(),initial);useApp.setState(initial);});
const peek=():PeekReport=>({health:150,deaths:0,clears:0,baits:0,recoveryExploits:0,heardEvents:0,enemyShots:99,exposure:0,maxVisibleFraction:0,distance:0,peakSpeed:0,episodes:[],lastDeath:null,path:[],operator:{scopedShots:0,scopedHits:0,unscopedShots:0,unscopedHits:0,scopeTransitionSum:0,holdingSeconds:0,firstShots:0,firstHits:0}});
const operator=():NonNullable<SessionData['operator']>=>({scopedShots:0,scopedHits:0,unscopedShots:0,unscopedHits:0,holdingSeconds:0,scopeTransitions:0,recoverySamples:0,recoverySum:0,highGroundShots:0,highGroundHits:0,missedRecoverySeconds:0});

describe('Operator and peeking interface contracts (server markup, not browser geometry QA)',()=>{
 it('keeps four actual inventory choices and describes sniper zoom separately from rifle ADS',()=>{
  state({weapon:'operator',settings:{...DEFAULT_SETTINGS}});
  const html=renderToStaticMarkup(<WeaponSelection compact/>);
  for(const id of WEAPON_ORDER)expect(html).toContain(WEAPONS[id].name);
  expect(html.match(/class="weapon-card\s*(?:selected)?"/g)).toHaveLength(4);
  expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
  const selected=html.slice(html.indexOf('class="weapon-card selected"'));
  expect(selected).toContain('2.5 / 5배');expect(selected).not.toContain('1.25배');
 });
 it('does not draw a scope when unscoped and labels the configured zoom binding',()=>{
  expect(renderToStaticMarkup(<ScopeOverlay amount={0} zoom={1}/>)).toBe('');
  const html=renderToStaticMarkup(<ScopeOverlay amount={1} zoom={5} state="scoped-5" zoomBinding="KeyP"/>);
  expect(html).toContain('오퍼레이터 스코프 5.0배');expect(html).toContain('scope-aperture');expect(html).toContain('scope-center');expect(html).toContain('P · 배율 전환');expect(html).not.toContain('V · 배율 전환');
 });
 it('validates a dedicated scope binding against actual movement bindings and reserves numbered weapon keys',()=>{
  expect(scopeBindingError('KeyP',DEFAULT_SETTINGS)).toBeNull();
  expect(scopeBindingError('KeyW',DEFAULT_SETTINGS)).toContain('사용 중');
  expect(scopeBindingError('Digit4',DEFAULT_SETTINGS)).toContain('영문 문자');
  expect(scopeBindingError('KeyP',{bindings:{...DEFAULT_SETTINGS.bindings,reload:'KeyP'}})).toContain('사용 중');
  state({settings:{...DEFAULT_SETTINGS,adsMode:'hold',operatorScopeMode:'toggle',operatorZoomBinding:'KeyP'}});
  const html=renderToStaticMarkup(<OperatorScopeControls/>);
  expect(html).toContain('value="P"');expect(html).toContain('토글 · 2.5');expect(html).toContain('소총 ADS 설정은 그대로 유지');
  expect(useApp.getState().settings.adsMode).toBe('hold');
 });
 it('offers all eight authored zones, Operator counterplay and connected free exploration',()=>{
  state({settings:{...DEFAULT_SETTINGS,practiceMap:'complex',peekScenario:'slicing'}});
  const html=renderToStaticMarkup(<PeekingMapSelection/>);
  for(const zone of PEEK_ZONES)expect(html).toContain(zone.name);
  expect(html).toContain('오퍼레이터 대응');expect(html).toContain('전체 전술 맵 — 자유 탐색');expect(html).toContain('선택한 구역 시작');
  expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
  state({settings:{...DEFAULT_SETTINGS,practiceMap:'range',peekScenario:'operator'}});
  expect(renderToStaticMarkup(<PeekingMapSelection/>)).not.toContain('aria-pressed="true"');
 });
 it('retains every existing tactical map and exposes a real timed-peeking configuration',()=>{
  state({settings:{...DEFAULT_SETTINGS,practiceMap:'complex',peekingTimed:true,duration:60}});
  const html=renderToStaticMarkup(<TacticalControls menu/>);
  for(const id of LEVEL_IDS)expect(html).toContain(LEVEL_SPECS[id].title);
  expect(html).toContain('기본 사격장');expect(html).toContain('기존 코너 피킹');
  const duration=html.slice(html.indexOf('aria-label="피킹 훈련 시간"'),html.indexOf('훈련 과제'));
  expect(duration).toContain('시간제 피킹');for(const n of [30,60,120])expect(duration).toContain(`${n}초`);
  expect(duration.match(/aria-pressed="true"/g)).toHaveLength(1);
  const hud=renderToStaticMarkup(<GameHUD runtime={null} settings={{...DEFAULT_SETTINGS,practiceMap:'complex',peekingTimed:true,duration:60}} telemetry={{...INITIAL_TELEMETRY,time:20}} mode="free" weapon="operator"/>);
  expect(hud).toContain('남은 시간');expect(hud).not.toContain('자유 훈련 · 경과 시간');
  const menu=renderToStaticMarkup(<MainMenu/>),config=menu.slice(menu.indexOf('class="session-config"'),menu.indexOf('class="start-button"'));expect(config).not.toContain('직접 종료할 때까지');expect(config).toContain('60초');
 });
 it('does not reveal unobserved enemy fire counts in the live HUD',()=>{
  const report=peek(),html=renderToStaticMarkup(<PeekingFeedback report={report} compact/>);
  expect(html).not.toContain('적 사격');expect(html).not.toContain('99');expect(html).not.toContain('관측한 저격 사격');
  Object.assign(report,{observedRecoveryUntil:13,currentTime:12});
  expect(renderToStaticMarkup(<PeekingFeedback report={report} compact/>)).toContain('관측한 저격 사격 · 회복 1.0초');
 });
 it('combines optional practice statistics with peeking feedback rather than stacking duplicate panels',()=>{
  const html=renderToStaticMarkup(<GameHUD runtime={null} settings={DEFAULT_SETTINGS} telemetry={{...INITIAL_TELEMETRY,peeking:peek(),summary:{shots:4,hitAccuracy:50} as never}} mode="free" weapon="operator"/>);
  expect(html).toContain('피킹 훈련 정보');expect(html).toContain('명중 50.0% · 4발');expect(html).not.toContain('class="practice-stat-hud"');
 });
 it('keeps absent sniper evidence empty and avoids invented accuracy for zero-shot categories',()=>{
  expect(renderToStaticMarkup(<OperatorFeedback report={operator()}/>)).toBe('');
  const html=renderToStaticMarkup(<OperatorFeedback report={{...operator(),scopedShots:2,scopedHits:1,recoverySamples:2,recoverySum:3.2}}/>);
  expect(html).toContain('50.0%');expect(html).toContain('1.60초');expect(html).toContain('적에게 실제로 노출된 시간을 의미하지 않습니다');expect(html).not.toMatch(/NaN|Infinity/);
 });
 it('renders Korean death evidence without invalid SVG bounds when a record has no path samples',()=>{
  const report=peek();report.lastDeath={bot:0,weapon:'operator',region:'head',cause:'shot',time:5,duration:.4,player:{x:0,y:0,z:0},defender:{x:0,y:2,z:20},line:[],path:[]};
  const html=renderToStaticMarkup(<DeathReplay report={report}/>);expect(html).toContain('오퍼레이터 · 머리');expect(html).not.toMatch(/NaN|Infinity/);expect(html).not.toContain('<svg');
 });
});
