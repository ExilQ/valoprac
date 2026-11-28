import {afterEach,describe,expect,it} from 'vitest';
import {createElement as h} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {setLocale,missingTranslations,clearMissingTranslations} from '../i18n/locale';
import {BotStyleControls} from '../ui/BotStyleControls';
import {DeathReplay} from '../ui/PeekingFeedback';
import {useApp} from '../app/store';
import {BOT_MOVEMENT_STYLE_IDS} from '../engine/tactical/botMovementStyles';

afterEach(async()=>{await setLocale('ko');clearMissingTranslations();});
describe('12.40 English coverage of bot movement and look',()=>{
 it('renders every choice, description and the death label in English',async()=>{
  await setLocale('en');clearMissingTranslations();
  for(const botMovement of ['off','random',...BOT_MOVEMENT_STYLE_IDS] as const){useApp.setState(s=>({settings:{...s.settings,botMovement}}));renderToStaticMarkup(h(BotStyleControls));}
  const report={lastDeath:{style:'poppin',bot:0,weapon:'rifleA',region:'head',cause:'shot',time:3,duration:.4,player:{x:0,y:0,z:0},defender:{x:1,y:0,z:1},line:[],path:[]}} as never;
  expect(renderToStaticMarkup(h(DeathReplay,{report}))).toContain('Poppin swing');
  expect(missingTranslations()).toEqual([]);
 });
});
