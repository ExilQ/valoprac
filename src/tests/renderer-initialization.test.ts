import {describe,it,expect,vi} from 'vitest';
vi.mock('three',async()=>{const actual=await vi.importActual<typeof import('three')>('three');return{...actual,WebGLRenderer:class{constructor(){throw new Error('WebGL unavailable');}}};});
vi.mock('../i18n/locale',async()=>{const actual=await vi.importActual<typeof import('../i18n/locale')>('../i18n/locale');return{...actual,subscribeLocale:vi.fn(actual.subscribeLocale)};});
import {RangeRenderer} from '../engine/rendering/RangeRenderer';
import {subscribeLocale} from '../i18n/locale';
import {DEFAULT_SETTINGS} from '../config/settings';
import type {Simulation} from '../engine/simulation/Simulation';
describe('Unavailable graphics does not retain abandoned renderers',()=>{
 it('does not add global locale listeners across repeated failed WebGL attempts',()=>{
  for(let i=0;i<20;i++)expect(()=>new RangeRenderer({} as HTMLElement,{} as Simulation,DEFAULT_SETTINGS)).toThrow('WebGL unavailable');
  expect(subscribeLocale).not.toHaveBeenCalled();
 });
});
