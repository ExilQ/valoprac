import {afterEach,describe,expect,it} from 'vitest';
import {createElement as h} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {setLocale,missingTranslations,clearMissingTranslations,translateText} from '../i18n/locale';
import {PracticeControls} from '../ui/PracticeControls';
import {GameplayDiagnostics} from '../ui/GameplayDiagnostics';
import {Simulation} from '../engine/simulation/Simulation';
import {DEFAULT_SETTINGS} from '../config/settings';
import {emptyInput} from '../engine/types';
import {FIXED_DT} from '../engine/simulation/FixedClock';
import {useApp} from '../app/store';
import {BOT_STATE_LABELS} from '../ui/replayTransport';

afterEach(async()=>{await setLocale('ko');clearMissingTranslations();useApp.setState({settings:structuredClone(DEFAULT_SETTINGS)});});
describe('12.31 English coverage of bot respawn, infinite magazine and bot replay view',()=>{
 it('renders the new practice options and HUD in English without leftover Korean',async()=>{
  await setLocale('en');clearMissingTranslations();
  for(const patch of [{botRespawn:true,infiniteMagazine:true},{botRespawn:false,infiniteMagazine:false},{practiceMap:'complex'}]){
   useApp.setState({settings:{...structuredClone(DEFAULT_SETTINGS),practiceMap:'bind' as never,...patch} as never});
   renderToStaticMarkup(h(PracticeControls,{free:true,includeTactical:false}));
  }
  const s=new Simulation('free','rifleA',{...structuredClone(DEFAULT_SETTINGS),practiceMap:'bind' as never});s.running=true;for(let i=0;i<12;i++)s.step(FIXED_DT,emptyInput());
  for(const t of s.targets)if(t.enabled)(s as unknown as {eliminateTarget(t:unknown):void}).eliminateTarget(t);
  renderToStaticMarkup(h(GameplayDiagnostics,{runtime:{simulation:s,input:{diagnostics:{snapshot:()=>null}}} as never,placement:'training'}));
  expect(missingTranslations()).toEqual([]);
 });
 it('translates the replay bot view labels',async()=>{
  await setLocale('en');
  for(const text of ['봇 시점','봇','시점을 볼 봇','봇 2','봇 2 시점 · 쓰러짐 · 다시 나타날 때까지 대기 · 재실행 화면',...Object.values(BOT_STATE_LABELS).map(label=>`봇 1 시점 · ${label} · 재실행 화면`),'고정 방어각 3개 · 각마다 한 봇 · 쓰러진 봇은 2.5초 뒤 다시 나타납니다'])expect(translateText(text),text).not.toMatch(/[가-힣]/);
 });
});
