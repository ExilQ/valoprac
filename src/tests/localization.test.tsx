import {afterEach,describe,it,expect,vi} from 'vitest';
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
import {getLocale,setLocale,initializeKoreanInterface,LOCALE_STORAGE_KEY,subscribeLocale,translateText,message,localeCatalogInfo,clearMissingTranslations} from '../i18n/locale';
import {localizedHostProps} from '../i18n/host';
import english from '../i18n/catalog.en.json';

const initialServerSnapshot={...useApp.getInitialState()},initialLiveSnapshot=useApp.getState();
function presentState(patch:Partial<ReturnType<typeof useApp.getState>>){Object.assign(useApp.getInitialState(),patch);useApp.setState(patch);}
afterEach(async()=>{Object.assign(useApp.getInitialState(),initialServerSnapshot);useApp.setState(initialLiveSnapshot);await setLocale('ko');clearMissingTranslations();vi.unstubAllGlobals();});
describe('Korean product presentation retains compatible localization utilities and canonical data',()=>{
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
 it('normalizes the retired English preference and renders the Korean application, eight settings tabs and inventory without changing settings',async()=>{
  const values=new Map<string,string>([[LOCALE_STORAGE_KEY,'en']]);vi.stubGlobal('localStorage',{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);}});
  await setLocale('en');const settings=structuredClone(DEFAULT_SETTINGS);presentState({settings,mode:'free',activeTab:'training',screen:'menu',history:[],notice:''});const before=JSON.stringify(settings);
  initializeKoreanInterface();expect(getLocale()).toBe('ko');expect(values.get(LOCALE_STORAGE_KEY)).toBe('ko');
  const screens=[renderToStaticMarkup(<App/>),...(['general','controls','sensitivity','crosshair','graphics','audio','training','advanced'] as const).map(tab=>renderToStaticMarkup(<SettingsPanel initialTab={tab}/>)),renderToStaticMarkup(<WeaponSelection/>),renderToStaticMarkup(<History/>)];
  const labels=['훈련','일반','조작','감도','조준점','그래픽','사운드','훈련','고급','밴달','훈련 기록'];
  for(let index=0;index<screens.length;index++){const visible=screens[index].replace(/<[^>]*>/g,' ');expect(visible).toContain(labels[index]);expect(screens[index]).not.toContain('aria-label="인터페이스 언어"');expect(screens[index]).not.toContain('>English<');}
  expect(useApp.getState().settings).toBe(settings);expect(JSON.stringify(settings)).toBe(before);
  console.log(JSON.stringify({benchmark:'korean-primary-coverage',screens:screens.length,settingsTabs:8,retiredEnglishPreferenceNormalized:true,settingsUnchanged:true}));
 });
 it('keeps a real replay and canonical state identical across language changes',async()=>{
  const s=new Simulation('free','rifleA',structuredClone(DEFAULT_SETTINGS)),r=new ReplayRecorder(s);s.running=true;for(let n=0;n<120;n++)s.step(1/120,{...emptyInput(),fire:n%30===0,firePresses:n%30===0?1:0});
  const before=simulationChecksum(s);await setLocale('en');expect(simulationChecksum(s)).toBe(before);const record=r.finish()!;expect((await new ReplayPlayer(record).verify()).passed).toBe(true);await setLocale('ko');expect((await new ReplayPlayer(record).verify()).passed).toBe(true);
 });
 it('renders real result/history dates and event metrics in Korean after product boot without changing the recorded session',async()=>{
  const s=new Simulation('free','rifleA',structuredClone(DEFAULT_SETTINGS));s.running=true;for(let n=0;n<120;n++)s.step(1/120,{...emptyInput(),fire:n%30===0,firePresses:n%30===0?1:0});const session=s.snapshot(),before=JSON.stringify(session);await setLocale('en');presentState({history:[session],result:session});
  initializeKoreanInterface();const views=[renderToStaticMarkup(<Results/>),renderToStaticMarkup(<History/>)],visible=views.map(html=>html.replace(/<[^>]*>/g,' '));expect(getLocale()).toBe('ko');expect(visible[0]).toContain('훈련 결과');expect(visible[1]).toContain('훈련 기록');for(const html of views){expect(html).toContain('헤드샷');expect(html).not.toContain('>Training results<');}expect(useApp.getState().result).toBe(session);expect(JSON.stringify(session)).toBe(before);
  console.log(JSON.stringify({benchmark:'korean-result-history-coverage',screens:views.length,sessionUnchanged:true}));
 });
});
