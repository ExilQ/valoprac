import {afterEach,describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {selectedTraining,trainingChoice} from '../app/trainingNavigation';
import {App} from '../app/App';
import {MainMenu} from '../ui/MainMenu';
import {useApp} from '../app/store';
import {DEFAULT_SETTINGS} from '../config/settings';
import {LEVEL_IDS,LEVEL_SPECS} from '../config/tactical';
import type {Mode,Settings} from '../engine/types';

const initial={...useApp.getInitialState()};
function state(mode:Mode,patch:Partial<Settings>={}){const next={mode,screen:'menu' as const,activeTab:'training' as const,settings:{...DEFAULT_SETTINGS,...patch}};Object.assign(useApp.getInitialState(),next);useApp.setState(next);}
afterEach(()=>{Object.assign(useApp.getInitialState(),initial);useApp.setState(initial);});

describe('Named training entry points and visible tactical-map selection',()=>{
 it('opens the connected peeking map with actual exposure training even after old map preferences',()=>{
  const old={...DEFAULT_SETTINGS,practiceMap:'tactical' as const,exposureEnabled:false,analysisWall:true,drill:'vertical' as const};
  const choice=trainingChoice('tactical'),settings={...old,...choice.settings};
  expect(choice.mode).toBe('free');expect(settings).toMatchObject({practiceMap:'complex',peekScenario:'free',targetCount:11,exposureEnabled:true,eliminationRule:'damage',analysisWall:false,drill:'none'});
  expect(selectedTraining(choice.mode,settings)).toBe('tactical');
 });
 const cases:[Mode,Partial<Settings>,string][]=[
  ['free',{practiceMap:'range'},'자유 훈련장'],['free',{practiceMap:'bunny',drill:'bunny'},'버니합 훈련'],['free',{practiceMap:'wallbang',drill:'wallbang'},'월샷 훈련'],['precision',{},'시간제 훈련'],['tracking',{},'시간제 훈련'],
  ['braking',{drill:'tapAD'},'톡브레이킹 훈련'],['spray',{},'반동 연습'],
  ['free',{practiceMap:'mid',drill:'vertical'},'수직 각체크 훈련'],
  ['free',{practiceMap:'garage',drill:'corner'},'각체크·피킹'],['free',{practiceMap:'complex',drill:'none'},'각체크·피킹']
 ];
 for(const[mode,settings,label]of cases)it(`highlights only ${label} for ${mode}/${settings.practiceMap??'range'}`,()=>{
  state(mode,settings);const html=renderToStaticMarkup(<App/>),nav=html.slice(html.indexOf('<nav aria-label="주 메뉴"'),html.indexOf('</nav>'));
  const active=nav.match(/<button class="active"[^>]*>[\s\S]*?<\/button>/g)??[];expect(active).toHaveLength(1);expect(active[0]).toContain(label);
 });
 it('keeps the six authored maps outside the collapsed advanced settings',()=>{
  state('free',{practiceMap:'complex'});const html=renderToStaticMarkup(<MainMenu/>),advanced=html.indexOf('<details class="training-configuration"');
  const visible=html.slice(0,advanced);expect(visible).toContain('aria-label="전술 맵 선택"');
  for(const id of LEVEL_IDS)expect(visible).toContain(LEVEL_SPECS[id].title);
  expect(visible).toContain('전술 피킹 연구실');expect(visible).not.toContain('기존 코너 피킹');
 });
 it('enters dedicated movement and material training without inheriting lethal bot settings',()=>{
  for(const id of ['bunny','wallbang'] as const){const c=trainingChoice(id),settings={...DEFAULT_SETTINGS,...c.settings};expect(c.mode).toBe('free');expect(settings.practiceMap).toBe(id);expect(settings.drill).toBe(id);expect(settings.combatMode).toBe('learning');expect(settings.exposureEnabled).toBe(false);expect(selectedTraining(c.mode,settings)).toBe(id);}
 });
 it('keeps each timed or recoil task on the range instead of inheriting a tactical preview',()=>{
  for(const id of['timed','spray','braking']as const){const c=trainingChoice(id);expect(c.settings.practiceMap).toBe('range');expect(selectedTraining(c.mode,{...DEFAULT_SETTINGS,...c.settings})).toBe(id);}
 });
});
