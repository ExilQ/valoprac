import { describe,it,expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { App } from '../app/App';
import { useApp } from '../app/store';
import { SettingsPanel } from '../ui/SettingsPanel';
import { History } from '../ui/History';
import { ResultDetails } from '../ui/Results';
import { Simulation } from '../engine/simulation/Simulation';
import { DEFAULT_SETTINGS } from '../config/settings';
describe('Korean React screen rendering (server markup, not browser QA)',()=>{
  it('renders free practice and four timed training modes and the start control',()=>{useApp.setState({screen:'menu',activeTab:'training'});const html=renderToString(<App/>);expect(html).toContain('헤드샷 정밀도');expect(html).toContain('제동과 카운터 스트레이핑');expect(html).toContain('스프레이 제어');expect(html).toContain('이동 표적 추적');expect(html).toContain('훈련 시작');expect((html.match(/class="mode-card(?:\s[^"]*)?"/g)||[])).toHaveLength(5);});
  it('renders sensitivity, crosshair and graphic settings',()=>{useApp.setState({screen:'menu',activeTab:'settings'});const html=renderToString(<SettingsPanel initialTab="controls"/>)+renderToString(<SettingsPanel initialTab="graphics"/>);expect(html).toContain('마우스 감도');expect(html).toContain('조준선');expect(html).toContain('렌더링 배율');expect(html).toContain('게임 감도를 그대로 입력하세요');});
  it('renders the empty history screen without fake records',()=>{useApp.setState({screen:'menu',activeTab:'history',history:[]});const html=renderToString(<History/>);expect(html).toContain('첫 번째 기록을 기다립니다.');expect(html).not.toContain('history-row-icon');});
  for(const mode of ['precision','braking','spray','tracking'] as const)it(`renders ${mode} results including zero-shot sessions`,()=>{const s=new Simulation(mode,'rifleA',DEFAULT_SETTINGS).snapshot();const html=renderToString(<ResultDetails session={s}/>);expect(html).toContain('사격 분석');expect(html).not.toContain('NaN');if(mode==='braking')expect(html).toContain('반대 입력 비교');if(mode==='spray')expect(html).toContain('스프레이 분석');if(mode==='tracking')expect(html).toContain('방향 전환 반응 분포');});
});
