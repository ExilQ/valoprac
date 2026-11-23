import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {GameHUD} from '../ui/GameHUD';
import {FootstepHUD} from '../ui/FootstepHUD';
import {Simulation} from '../engine/simulation/Simulation';
import {simulationChecksum} from '../engine/replay/integrity';
import {emptyInput} from '../engine/types';
import {DEFAULT_SETTINGS} from '../config/settings';
import {INITIAL_TELEMETRY} from '../engine/Runtime';
import {InputDiagnostics} from '../engine/input/InputDiagnostics';

function fixture(patch={}){
 const s=new Simulation('free','rifleA',{...DEFAULT_SETTINGS,...patch});
 const input={diagnostics:new InputDiagnostics(),locked:false,rawConfirmation:'accepted',keyboardStatus:'idle'};
 const runtime={simulation:s,input} as Parameters<typeof GameHUD>[0]['runtime'];
 return {s,runtime,render:()=>renderToStaticMarkup(<GameHUD runtime={runtime} settings={s.settings} telemetry={{...INITIAL_TELEMETRY,time:s.time,summary:s.summary()}} mode="free" weapon="rifleA"/>)};
}

describe('Precision Utility gameplay readouts preserve the simulation boundary',()=>{
 it('renders compact summaries without changing settings or deterministic authority',()=>{
  const {s,render}=fixture();s.running=true;for(let n=0;n<180;n++)s.step(1/120,{...emptyInput(),forward:n<90?1:0});s.running=false;
  const settings=JSON.stringify(s.settings),before=simulationChecksum(s),html=render();
  expect(simulationChecksum(s)).toBe(before);expect(JSON.stringify(s.settings)).toBe(settings);
  expect(html).toContain('class="game-hud precision-hud"');
  expect(html).toContain('<details class="practice-stat-hud">');
  expect(html).toContain('<summary>누적 기준과 이동 여유</summary>');
  expect(html).toContain('<summary>제동 시점</summary>');
  expect(html).not.toContain('class="hud-diagnostics-disclosure"');
 });
 it('keeps explicitly enabled essential jump rows outside the collapsible secondary group',()=>{
  const {render}=fixture({physicsDiagnostics:true,inputDiagnostics:true});const html=render();
  const core=html.indexOf('class="movement-physics-diagnostics"'),group=html.indexOf('class="hud-diagnostics-disclosure"'),ammo=html.indexOf('class="ammo-hud"');
  expect(core).toBeGreaterThan(0);expect(group).toBeGreaterThan(core);expect(ammo).toBeGreaterThan(group);
  for(const name of ['최근 점프 · 착지','연속 점프 · 입력','공중 가속 · 입력 창'])expect(html.slice(core,group)).toContain(name);
  expect(html.slice(group,ammo)).toContain('입력 진단');
 });
 it('uses actual accumulation and audible events without fabricating sound or changing the meter',()=>{
  const {s}=fixture();s.footsteps.footstepAccumulation=.82;const before=s.footsteps.footstepAccumulation;
  const warning=renderToStaticMarkup(<FootstepHUD simulation={s} settings={s.settings}/>);
  expect(warning).toContain('step-caution');expect(warning).toContain('aria-valuenow="82"');expect(warning).toContain('발소리 임박');expect(warning).not.toContain('data-sound-event');
  expect(s.footsteps.footstepAccumulation).toBe(before);expect(s.footsteps.totalEvents).toBe(0);
  s.footsteps.footstepAccumulation=.1;
  const quiet=renderToStaticMarkup(<FootstepHUD simulation={s} settings={s.settings}/>);expect(quiet).not.toContain('step-caution');expect(quiet).toContain('aria-valuetext="10% · 정지 · 회복"');
 });
 it('shows actual airborne state rather than granting a ready indicator from a released key',()=>{
  const {s,render}=fixture();s.running=true;s.step(1/120,{...emptyInput(),jump:true,jumpHeld:true,jumpPresses:1});
  expect(s.movement.grounded).toBe(false);expect(render()).toContain('공중');
 });
 it('retains opt-out controls for both minimap and accumulation readout',()=>{
  const {s}=fixture({footstepHud:false,soundMinimap:false});
  expect(renderToStaticMarkup(<FootstepHUD simulation={s} settings={s.settings}/>)).toBe('');
 });
});
