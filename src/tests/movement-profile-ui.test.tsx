import {afterEach,describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {useApp} from '../app/store';
import {DEFAULT_SETTINGS} from '../config/settings';
import {SettingsPanel} from '../ui/SettingsPanel';
import {MovementPhysicsSettings} from '../ui/MovementPhysicsSettings';
import {MovementProfileStatus,MovementPhysicsDiagnostics,MovementPhysicsDetails} from '../ui/MovementPhysicsFeedback';
import {Simulation} from '../engine/simulation/Simulation';
import {emptyInput} from '../engine/types';
const original={...useApp.getInitialState()};
function settings(patch:Partial<typeof DEFAULT_SETTINGS>={}){const settings={...DEFAULT_SETTINGS,...patch};Object.assign(useApp.getInitialState(),{settings});useApp.setState({settings});return settings;}
afterEach(()=>{Object.assign(useApp.getInitialState(),original);useApp.setState(original);});
describe('Selectable movement controls and honest live diagnostics',()=>{
 it('places the two real physics choices in the keyboard-addressable controls tab',()=>{
  settings();const html=renderToStaticMarkup(<SettingsPanel initialTab="controls"/>);
  expect(html).toContain('id="settings-panel-controls"');expect(html).toContain('aria-label="이동 물리엔진"');expect(html).toContain('value="valorant" selected=""');expect(html).toContain('발로란트 물리엔진');expect(html).toContain('카운터 스트라이크 물리엔진');expect(html).toContain('모든 기존 훈련과 맵에 적용');expect(html).toContain('감도와 무기 설정은 유지');expect(html).toContain('마우스 휠 점프');expect(html).toContain('이동 물리 진단 표시');expect(html).toContain('수평 속도와 대기 입력을 초기화');
 });
 it('identifies the optional permissive Source preset separately from the CS2 comparison model',()=>{
  settings({movementPhysics:'counterStrike',csMovementPreset:'sourceClassic'});const html=renderToStaticMarkup(<MovementPhysicsSettings/>);
  expect(html).toContain('value="sourceClassic" selected=""');expect(html).toContain('클래식 Source 버니합 · 별도 규칙');expect(html).toContain('일반 경쟁전 CS2 규칙과 구분');expect(html).not.toContain('실제 서브틱 엔진과 동일하다고 검증한 모델');
 });
 it('shows the effective CS2 jump buffer separately from the requested value',()=>{
  settings({movementPhysics:'counterStrike',csMovementPreset:'cs2',jumpBufferMs:80});const html=renderToStaticMarkup(<MovementPhysicsSettings/>);expect(html).toContain('점프 입력 버퍼');expect(html).toContain('적용되는 점프 입력 창');expect(html).toContain('<strong>40ms</strong>');
 });
 it('reports the authoritative active engine when a settings change has not yet reached the movement controller',()=>{
  const s=new Simulation('free','rifleA',{...DEFAULT_SETTINGS,movementPhysics:'valorant'});const selected={...s.settings,movementPhysics:'counterStrike' as const};
  const html=renderToStaticMarkup(<MovementProfileStatus settings={selected} movement={s.movement}/>);
  expect(html).toContain('data-movement-physics="valorant"');expect(html).toContain('물리 · 발로란트');expect(html).not.toContain('물리 · 카운터 스트라이크');
 });
 it('keeps physics internals absent by default, then renders actual airborne velocity and applied input on opt-in',()=>{
  const s=new Simulation('free','rifleA',{...DEFAULT_SETTINGS,physicsDiagnostics:false});expect(renderToStaticMarkup(<MovementPhysicsDiagnostics simulation={s}/>)).toBe('');
  s.settings.physicsDiagnostics=true;s.movement.velocity.set(0,0,-5);s.movement.speed=5;s.movement.step({...emptyInput(),jump:true,jumpPresses:1,strafe:-1},0,1/120,1/120);s.time=1/120;
  const html=renderToStaticMarkup(<MovementPhysicsDiagnostics simulation={s}/>);expect(html).toContain('aria-label="이동 물리 진단"');expect(html).toContain('physics-jump-times');expect(html).toContain('physics-chain-timing');const details=renderToStaticMarkup(<MovementPhysicsDetails simulation={s}/>);expect(html).toContain('공중');expect(details).toContain('공중 가속 기여');expect(details).toContain('실제 속도 벡터');expect(details).toContain('이동 벡터 · 세부 정보');expect(html).toContain(s.movement.velocity.y.toFixed(2));expect(html).not.toMatch(/NaN|Infinity|undefined/);
 });
});
