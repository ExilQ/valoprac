import {afterEach,describe,expect,it} from 'vitest';
import {createElement as h} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {setLocale,missingTranslations,clearMissingTranslations} from '../i18n/locale';
import {FootstepHUD} from '../ui/FootstepHUD';
import {Simulation} from '../engine/simulation/Simulation';
import {DEFAULT_SETTINGS} from '../config/settings';
import {emptyInput} from '../engine/types';

afterEach(async()=>{await setLocale('ko');clearMissingTranslations();});
describe('12.32 English coverage of the footstep gauge',()=>{
 it('renders the gauge and the sound map in English for steps, jumps and landings',async()=>{
  await setLocale('en');clearMissingTranslations();
  const settings={...structuredClone(DEFAULT_SETTINGS),footstepHud:true,soundMinimap:true},s=new Simulation('free','knife',settings);s.running=true;
  renderToStaticMarkup(h(FootstepHUD,{simulation:s,settings}));
  for(let n=0;n<200;n++){s.step(1/120,{...emptyInput(),forward:1,jump:n===40,jumpHeld:n===40,jumpPresses:n===40?1:0});if(n===41||n===130||n%20===0)renderToStaticMarkup(h(FootstepHUD,{simulation:s,settings}));}
  expect(s.jumpSoundEvents).toBe(1);expect(missingTranslations()).toEqual([]);
 });
});
