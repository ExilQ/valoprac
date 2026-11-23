import { describe,it,expect,afterEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { useApp } from '../app/store';
import { SettingsPanel } from '../ui/SettingsPanel';
import { History } from '../ui/History';
import { ResultDetails } from '../ui/Results';
import { Simulation } from '../engine/simulation/Simulation';
import { DEFAULT_SETTINGS } from '../config/settings';
import { MainMenu } from '../ui/MainMenu';
// Zustand server rendering reads its initial snapshot, independently of current client state.
// Set and restore that snapshot explicitly so these checks exercise the intended screen.
const initialSnapshot={...useApp.getInitialState()};
function serverState(patch:Partial<ReturnType<typeof useApp.getState>>){
  Object.assign(useApp.getInitialState(),patch);useApp.setState(patch);
}
afterEach(()=>{Object.assign(useApp.getInitialState(),initialSnapshot);useApp.setState(initialSnapshot);});
describe('Korean React screen rendering (server markup, not browser QA)',()=>{
  it('offers all nine training entry points with a selected state and a start control',()=>{
    serverState({screen:'menu',activeTab:'training',mode:'free',settings:{...DEFAULT_SETTINGS,practiceMap:'range'}});
    const html=renderToString(<MainMenu/>);
    for(const title of ['자유 훈련장','시간제 훈련','톡브레이킹 훈련','반동 연습','각체크·피킹','버니합 훈련','월샷 훈련','감도 탐색','에임 분석'])expect(html).toContain(`<h3>${title}</h3>`);
    const rows=html.match(/<button[^>]*aria-pressed="(?:true|false)"[^>]*class="mode-card[^"]*"/g)??[];
    expect(rows).toHaveLength(9);
    expect(rows.filter(row=>row.includes('aria-pressed="true"'))).toHaveLength(1);
    expect(html).toContain('훈련 시작');expect(html).toContain('직접 종료할 때까지');
  });
  for(const mode of ['precision','tracking'] as const)it(`keeps ${mode} available through the timed submode selector`,()=>{
    serverState({mode,screen:'menu',activeTab:'training',settings:{...DEFAULT_SETTINGS,practiceMap:'range'}});
    const html=renderToString(<MainMenu/>),submodes=html.slice(html.indexOf('aria-label="시간제 세부 훈련"'),html.indexOf('class="session-config"'));
    expect(submodes).toContain('헤드샷 정밀도');expect(submodes).toContain('이동 표적 추적');
    expect(submodes.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(submodes).toContain(`aria-pressed="true">${mode==='precision'?'헤드샷 정밀도':'이동 표적 추적'}`);
    for(const duration of [30,60,120])expect(html.replace(/<!--.*?-->/g,'' )).toContain(`${duration}초`);
  });
  it('exposes six keyboard-addressable settings tabs and renders each active panel',()=>{
    const tabs=[['general','일반'],['controls','조작'],['graphics','그래픽'],['audio','오디오'],['crosshair','조준점'],['training','훈련']] as const;
    for(const [id] of tabs){
      const html=renderToString(<SettingsPanel initialTab={id}/>);
      expect(html.match(/role="tab"/g)).toHaveLength(6);
      expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
      expect(html).toContain(`role="tabpanel" id="settings-panel-${id}" aria-labelledby="settings-tab-${id}"`);
      for(const [tabId,label] of tabs)expect(html).toContain(`id="settings-tab-${tabId}" aria-controls="settings-panel-${tabId}" aria-selected="${tabId===id}" tabindex="${tabId===id?0:-1}">${label}`);
    }
    const controls=renderToString(<SettingsPanel initialTab="controls"/>),graphics=renderToString(<SettingsPanel initialTab="graphics"/>),crosshair=renderToString(<SettingsPanel initialTab="crosshair"/>);
    expect(controls).toContain('마우스 감도');expect(controls).toContain('게임 감도를 그대로 입력하세요');
    expect(graphics).toContain('렌더링 배율');expect(crosshair).toContain('조준선 색상');expect(crosshair).toContain('선 두께');
  });
  it('renders the empty history screen without fake records',()=>{serverState({screen:'menu',activeTab:'history',history:[]});const html=renderToString(<History/>);expect(html).toContain('첫 번째 기록을 기다립니다.');expect(html).not.toContain('history-row-icon');});
  for(const mode of ['precision','braking','spray','tracking'] as const)it(`renders ${mode} results including zero-shot sessions`,()=>{const s=new Simulation(mode,'rifleA',DEFAULT_SETTINGS).snapshot();const html=renderToString(<ResultDetails session={s}/>);expect(html).toContain('사격 분석');expect(html).not.toContain('NaN');if(mode==='braking')expect(html).toContain('반대 입력 비교');if(mode==='spray')expect(html).toContain('스프레이 분석');if(mode==='tracking')expect(html).toContain('방향 전환 반응 분포');});
});
