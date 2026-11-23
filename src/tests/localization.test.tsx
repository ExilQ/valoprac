import {afterEach,describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {DEFAULT_SETTINGS} from '../config/settings';
import {useApp} from '../app/store';
import {App} from '../app/App';
import {SettingsPanel} from '../ui/SettingsPanel';
import {WeaponSelection} from '../ui/WeaponSelection';
import {History} from '../ui/History';
import {Results} from '../ui/Results';
import {Simulation} from '../engine/simulation/Simulation';
import {ReplayRecorder} from '../engine/replay/recording';
import {ReplayPlayer} from '../engine/replay/playback';
import {simulationChecksum} from '../engine/replay/integrity';
import {emptyInput} from '../engine/types';
import {getLocale,setLocale,subscribeLocale,translateText,message,localeCatalogInfo,missingTranslations,clearMissingTranslations} from '../i18n/locale';
import {localizedHostProps} from '../i18n/host';
import english from '../i18n/catalog.en.json';

afterEach(async()=>{await setLocale('ko');clearMissingTranslations();});
describe('Optional local English presentation leaves canonical training data unchanged',()=>{
 it('defaults to Korean and validates the structured English catalog',()=>{
  expect(getLocale()).toBe('ko');const ids=new Set<string>();for(const e of english.entries){expect(e.id).toMatch(/^msg_[a-f0-9]{12}$/);expect(ids.has(e.id)).toBe(false);ids.add(e.id);expect(e.source.trim()).not.toBe('');expect(e.en.trim()).not.toBe('');expect(e.en).not.toMatch(/[가-힣]/);}
 });
 it('loads optional English, notifies subscribers and retains the exact Korean settings object',async()=>{
  const s=JSON.stringify(DEFAULT_SETTINGS);let changes=0;const remove=subscribeLocale(()=>changes++);await setLocale('en');remove();expect(getLocale()).toBe('en');expect(localeCatalogInfo().entries).toBeGreaterThanOrEqual(2091);expect(changes).toBeGreaterThan(0);expect(JSON.stringify(DEFAULT_SETTINGS)).toBe(s);expect(translateText('훈련 기록')).not.toMatch(/[가-힣]/);
 });
 it('ignores stale English selection after an explicit return to Korean',async()=>{const pending=setLocale('en');await setLocale('ko');await pending;expect(getLocale()).toBe('ko');});
 it('supports named parameters and leaves user values, handlers, URLs and literal names intact',async()=>{
  await setLocale('en');expect(message('rotation.counts',{count:10286})).toBe('10286 counts');const click=()=>{};
  const original={children:'훈련 기록',value:'훈련 기록',href:'/훈련',onClick:click,'aria-label':'훈련 기록'},localized=localizedHostProps('button',original) as typeof original;
  expect(localized.children).not.toBe(original.children);expect(localized.value).toBe(original.value);expect(localized.href).toBe(original.href);expect(localized.onClick).toBe(click);
  expect(localizedHostProps('option',{'data-locale':'literal',children:'훈련 기록'})).toEqual({'data-locale':'literal',children:'훈련 기록'});expect(localizedHostProps('code',{children:'훈련 기록'})).toEqual({children:'훈련 기록'});
  expect(renderToStaticMarkup(<p><>훈련 기록</></p>)).not.toMatch(/[가-힣]/);
 });
 it('renders primary application, all settings tabs, weapons and empty history in English',async()=>{
  await setLocale('en');useApp.setState({settings:structuredClone(DEFAULT_SETTINGS),mode:'free',activeTab:'training',screen:'menu',history:[],notice:''});
  const screens=[renderToStaticMarkup(<App/>),...(['general','controls','graphics','audio','crosshair','training'] as const).map(tab=>renderToStaticMarkup(<SettingsPanel initialTab={tab}/>)),renderToStaticMarkup(<WeaponSelection/>),renderToStaticMarkup(<History/>)];
  const residual=screens.flatMap((html,index)=>{const text=html.replace(/<[^>]*>/g,' ');return /[가-힣]/.test(text)?[{index,text:text.match(/[^<>.]{0,50}[가-힣][^<>.]{0,80}/g)}]:[];});
  console.log(JSON.stringify({benchmark:'english-primary-coverage',screens:screens.length,residual,missing:missingTranslations()}));expect(residual).toEqual([]);
 });
 it('keeps a real replay and canonical state identical across language changes',async()=>{
  const s=new Simulation('free','rifleA',structuredClone(DEFAULT_SETTINGS)),r=new ReplayRecorder(s);s.running=true;for(let n=0;n<120;n++)s.step(1/120,{...emptyInput(),fire:n%30===0,firePresses:n%30===0?1:0});
  const before=simulationChecksum(s);await setLocale('en');expect(simulationChecksum(s)).toBe(before);const record=r.finish()!;expect((await new ReplayPlayer(record).verify()).passed).toBe(true);await setLocale('ko');expect((await new ReplayPlayer(record).verify()).passed).toBe(true);
 });
 it('renders real result/history dates and event metrics without Korean interface fragments',async()=>{
  const s=new Simulation('free','rifleA',structuredClone(DEFAULT_SETTINGS));s.running=true;for(let n=0;n<120;n++)s.step(1/120,{...emptyInput(),fire:n%30===0,firePresses:n%30===0?1:0});const session=s.snapshot();await setLocale('en');useApp.setState({history:[session],result:session});
  const views=[renderToStaticMarkup(<Results/>),renderToStaticMarkup(<History/>)];const residual=views.map(html=>html.replace(/<[^>]*>/g,' ')).filter(text=>/[가-힣]/.test(text));console.log(JSON.stringify({benchmark:'english-result-history-coverage',residual,missing:missingTranslations()}));expect(residual).toEqual([]);
 });
});
