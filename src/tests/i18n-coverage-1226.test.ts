import {afterEach,describe,expect,it} from 'vitest';
import {createElement as h} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {setLocale,missingTranslations,clearMissingTranslations,translateText} from '../i18n/locale';
import {KnifeSelection} from '../ui/KnifeSelection';
import {WeaponSelection} from '../ui/WeaponSelection';
import {TacticalMapSelection} from '../ui/TacticalMapSelection';
import {GraphicsQuality,GraphicsBenchmark,GraphicsDiagnostics} from '../ui/GraphicsQuality';
import {SettingsPanel} from '../ui/SettingsPanel';
import {GameplayDiagnostics} from '../ui/GameplayDiagnostics';
import {Simulation} from '../engine/simulation/Simulation';
import {DEFAULT_SETTINGS} from '../config/settings';
import {emptyInput} from '../engine/types';
import {FIXED_DT} from '../engine/simulation/FixedClock';

afterEach(async()=>{await setLocale('ko');clearMissingTranslations();});
describe('12.26 English coverage of the knife, graphics and fundamentals interfaces',()=>{
 it('renders every new screen in English without leftover Korean',async()=>{
  await setLocale('en');clearMissingTranslations();
  renderToStaticMarkup(h(KnifeSelection));renderToStaticMarkup(h(WeaponSelection,{}));renderToStaticMarkup(h(TacticalMapSelection,{includeBase:true}));
  renderToStaticMarkup(h(GraphicsQuality));renderToStaticMarkup(h(GraphicsBenchmark));renderToStaticMarkup(h(GraphicsDiagnostics));
  renderToStaticMarkup(h(SettingsPanel,{initialTab:'graphics'}));
  for(const map of ['fd-preaim','fd-angles','fd-flick','fd-micro']){
   const s=new Simulation('free','rifleA',{...DEFAULT_SETTINGS,practiceMap:map as never,drill:'none',targetCount:12});s.running=true;for(let i=0;i<30;i++)s.step(FIXED_DT,emptyInput());
   renderToStaticMarkup(h(GameplayDiagnostics,{runtime:{simulation:s,input:{diagnostics:{snapshot:()=>null}}} as never,placement:'training'}));
  }
  expect(missingTranslations()).toEqual([]);
 });
 it('composes dynamic readouts into readable English',async()=>{
  await setLocale('en');
  expect(translateText('각 체크 정원 · 각 체크 · 라운드 1 · 0/7')).toBe('Angle Garden · Angle checks · Round 1 · 0/7');
  expect(translateText('플릭 광장 · 플릭 · 12명 처치')).toBe('Flick Plaza · Flicks · 12 eliminations');
  expect(translateText('평균 플릭 52.1° · 평균 처치 380밀리초 · 놓침 2')).toBe('Avg flick 52.1° · Avg time to kill 380 ms · Missed 2');
  expect(translateText('약 31프레임/초 · 매우 느림')).toBe('about 31 FPS · very slow');
  expect(translateText('추천 품질(높음) 적용')).toBe('Apply recommended tier (High)');
  for(const text of ['칼','근접 무기','좌클릭 베기 · 우클릭 찌르기','무기 슬롯','주무기·보조·칼','훈련 중 1 주무기 · 2 보조무기 · 3 칼. 무기 교체에는 장착 시간이 적용됩니다.'])expect(translateText(text)).not.toMatch(/[가-힣]/);
 });
});
