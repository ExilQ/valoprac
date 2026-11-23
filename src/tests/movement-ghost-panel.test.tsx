import {beforeAll,describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {Simulation} from '../engine/simulation/Simulation';
import {ReplayRecorder} from '../engine/replay/recording';
import {simulationChecksum} from '../engine/replay/integrity';
import {DEFAULT_SETTINGS} from '../config/settings';
import {emptyInput} from '../engine/types';
import {buildMovementGhost,type MovementGhost} from '../training/movementTools/GhostFromReplay';
import {MovementPracticePanel} from '../ui/MovementPracticePanel';

const dt=1/120,noop=()=>{};
function simulation(){const settings=structuredClone(DEFAULT_SETTINGS);settings.movementTools.enabled=true;const s=new Simulation('free','rifleA',settings);s.running=true;return s;}
function approach(s:Simulation,walk=false){for(let n=0;n<60;n++)s.step(dt,{...emptyInput(),forward:1,walk});s.step(dt,{...emptyInput(),forward:1,walk,jump:true,jumpHeld:true});}
function land(s:Simulation,walk=false){for(let n=0;n<120&&!s.movementPractice.snapshot().last;n++)s.step(dt,{...emptyInput(),forward:1,walk});expect(s.movementPractice.snapshot().last).not.toBeNull();}
function value(html:string,key:string){const match=html.match(new RegExp('data-movement-delta="'+key+'">([^<]+)'));expect(match).not.toBeNull();return match![1];}
let ghost:MovementGhost;
beforeAll(async()=>{const s=simulation(),recorder=new ReplayRecorder(s);approach(s);land(s);const a=s.movementPractice.snapshot().last!;ghost=await buildMovementGhost(recorder.finish()!,{startTick:a.startTick,endTick:a.endTick});});

describe('A3 paused ghost comparison uses measured attempt and replay data',()=>{
 it('shows signed speed and distance changes, endpoint separation and preservation without changing authority',()=>{
  const s=simulation();approach(s,true);land(s,true);const snapshot=s.movementPractice.snapshot(),a=snapshot.last!,before=simulationChecksum(s);
  expect(a.distance).toBeLessThan(ghost.distance);expect(a.peakSpeed).toBeLessThan(ghost.peakSpeed);
  const html=renderToStaticMarkup(<MovementPracticePanel settings={s.settings} snapshot={snapshot} ghost={ghost} ghostStatus="ready" onAction={noop} onSettings={noop}/>);
  const number=(key:string)=>parseFloat(value(html,key).replace(/,/g,''));
  expect(number('duration')).toBeCloseTo(a.duration-ghost.duration,2);
  expect(number('distance')).toBeCloseTo(a.distance-ghost.distance,2);expect(value(html,'distance')).toMatch(/^-/);
  expect(number('speed')).toBeCloseTo(a.peakSpeed-ghost.peakSpeed,2);expect(value(html,'speed')).toMatch(/^-/);
  expect(number('height')).toBeCloseTo(a.peakHeight-ghost.peakHeight,2);
  expect(number('landing')).toBeCloseTo(Math.hypot(a.landing!.x-ghost.landing!.x,a.landing!.y-ghost.landing!.y,a.landing!.z-ghost.landing!.z),2);
  const retention=ghost.samples.at(-1)![4]/ghost.samples[0][4];expect(number('preservation')).toBeCloseTo((a.speedPreservation!-retention)*100,2);
  expect(html).not.toContain('진행 중인 시도');expect(html).not.toMatch(/NaN|Infinity/);expect(simulationChecksum(s)).toBe(before);
 });
 it('marks an airborne attempt as incomplete and never invents landing or preservation values',()=>{
  const s=simulation();approach(s,true);const snapshot=s.movementPractice.snapshot();expect(snapshot.current).not.toBeNull();
  const html=renderToStaticMarkup(<MovementPracticePanel settings={s.settings} snapshot={snapshot} ghost={ghost} onAction={noop} onSettings={noop}/>);
  expect(html).toContain('진행 중인 시도입니다. 착지하면 최종 값을 확인하세요.');expect(value(html,'landing')).toBe('—');expect(value(html,'preservation')).toBe('—');
 });
 it('omits comparison rows until both an attempt and a real ghost exist',()=>{
  const s=simulation();approach(s);land(s);const props={settings:s.settings,snapshot:s.movementPractice.snapshot(),onAction:noop,onSettings:noop};
  expect(renderToStaticMarkup(<MovementPracticePanel {...props}/>)).not.toContain('data-movement-delta');
  expect(renderToStaticMarkup(<MovementPracticePanel {...props} snapshot={null} ghost={ghost}/>)).not.toContain('data-movement-delta');
  expect(renderToStaticMarkup(<MovementPracticePanel {...props} settings={{...s.settings,movementTools:{...s.settings.movementTools,enabled:false}}} ghost={ghost}/>)).not.toContain('data-movement-delta');
 });
});
