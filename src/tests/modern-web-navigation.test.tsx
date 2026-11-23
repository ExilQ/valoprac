import {afterEach,describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {App} from '../app/App';
import {MainMenu} from '../ui/MainMenu';
import {History} from '../ui/History';
import {shouldNavigateLocally,TAB_PATHS} from '../app/navigation';
import {useApp} from '../app/store';
import {DEFAULT_SETTINGS} from '../config/settings';
const initial={...useApp.getInitialState()};
function state(patch:Partial<ReturnType<typeof useApp.getState>>){Object.assign(useApp.getInitialState(),patch);useApp.setState(patch);}
afterEach(()=>{Object.assign(useApp.getInitialState(),initial);useApp.setState(initial);});
const primary={button:0,ctrlKey:false,metaKey:false,shiftKey:false,altKey:false,defaultPrevented:false};
describe('Modern web navigation retains native browser behavior',()=>{
 it('intercepts only an unmodified primary click for local SPA navigation',()=>expect(shouldNavigateLocally(primary)).toBe(true));
 for(const patch of [{button:1},{button:2},{ctrlKey:true},{metaKey:true},{shiftKey:true},{altKey:true},{defaultPrevented:true}])it(`preserves native behavior for ${JSON.stringify(patch)}`,()=>expect(shouldNavigateLocally({...primary,...patch})).toBe(false));
 it('exposes one main landmark and real route links after a skip link',()=>{
  state({screen:'menu',activeTab:'training',mode:'free',settings:{...DEFAULT_SETTINGS,practiceMap:'range'}});
  const html=renderToStaticMarkup(<App/>),nav=html.slice(html.indexOf('<nav'),html.indexOf('</nav>'));
  expect(html.match(/<main\b/g)).toHaveLength(1);expect(html).toContain('href="#app-content"');expect(html.indexOf('class="skip-link"')).toBeLessThan(html.indexOf('<nav'));
  expect(html).toContain('id="app-content" class="utility-content" tabindex="-1"');
  for(const id of ['training','maps','weapons','aim','history','settings'] as const)expect(nav).toContain(`href="${TAB_PATHS[id]}"`);
  expect(nav).not.toContain('role="menu');expect(nav).not.toContain('tabindex');
 });
 it('does not mount the expensive game stage until preview or training is requested',()=>{
  state({mode:'free',settings:{...DEFAULT_SETTINGS,practiceMap:'complex'}});const html=renderToStaticMarkup(<MainMenu/>);
  expect(html).toContain('utility-map-plan');expect(html).toContain('3D 미리보기 켜기');expect(html).toContain('aria-expanded="false" aria-controls="training-space-preview"');
  expect(html).not.toContain('game-stage');expect(html).not.toContain('입체 훈련장을 준비');expect(html).toContain('훈련 시작');
 });
 it('uses a closed named native confirmation and keeps Cancel as the safe initial action',()=>{
  state({history:[]});const html=renderToStaticMarkup(<History/>),dialog=html.slice(html.indexOf('<dialog'));
  expect(dialog).toContain('aria-labelledby="delete-history-title"');expect(dialog).toContain('aria-describedby="delete-history-description"');expect(dialog).toContain('method="dialog"');
  expect(dialog).toContain('value="cancel" autofocus=""');expect(dialog).not.toContain('role="dialog"');expect(dialog).not.toContain('aria-modal');expect(dialog).not.toMatch(/<dialog[^>]*\bopen\b/);
 });
});
