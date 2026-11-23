import {describe,it,expect,vi} from 'vitest';
// Exercise the real public recorder/player with smaller injectable budgets.
// This keeps exact-limit tests cheap without synthesizing private journal state.
vi.mock('../engine/replay/types',async importOriginal=>({...await importOriginal<typeof import('../engine/replay/types')>(),MAX_REPLAY_COMMANDS:30_000,MAX_REPLAY_SECONDS:20}));
import {Simulation} from '../engine/simulation/Simulation';
import {ReplayRecorder} from '../engine/replay/recording';
import {ReplayPlayer} from '../engine/replay/playback';
import {MAX_REPLAY_COMMANDS,MAX_REPLAY_SECONDS,type ReplayRecording} from '../engine/replay/types';
import {validateReplay} from '../engine/replay/validation';
import {DEFAULT_SETTINGS} from '../config/settings';
import {emptyInput} from '../engine/types';
const dt=1/120;
const settings=()=>structuredClone({...DEFAULT_SETTINGS,targetCount:1,analysisWall:true});
describe('Replay export boundaries preserve a valid final control command',()=>{
 it('exports the last admissible journal, then stops recording before consuming its final slot',async()=>{
  const sim=new Simulation('free','rifleA',settings()),recorder=new ReplayRecorder(sim);
  for(let i=0;i<MAX_REPLAY_COMMANDS-1;i++)sim.look(0,0);
  const last=recorder.snapshot()!;expect(last.commands).toHaveLength(MAX_REPLAY_COMMANDS);validateReplay(last);expect((await new ReplayPlayer(last).verify()).passed).toBe(true);
  sim.look(0,0);expect(recorder.status.state).toBe('failed');expect(recorder.snapshot()).toBeNull();
  sim.running=true;sim.step(dt,{...emptyInput(),fire:true,firePresses:1});expect(sim.weapon.ammo).toBe(24);expect(sim.stats.shots).toBe(1);recorder.dispose();
 });
 it('fails recording on the first over-duration tick while unlimited live training continues',async()=>{
  const sim=new Simulation('free','rifleA',settings()),recorder=new ReplayRecorder(sim);sim.running=true;
  for(let i=0;i<MAX_REPLAY_SECONDS*120;i++)sim.step(dt,emptyInput());
  const atLimit=recorder.snapshot()!;validateReplay(atLimit);expect((await new ReplayPlayer(atLimit).verify()).passed).toBe(true);
  sim.step(dt,{...emptyInput(),fire:true,firePresses:1});expect(sim.time).toBe((MAX_REPLAY_SECONDS*120+1)*dt);expect(sim.running).toBe(true);expect(sim.stats.shots).toBe(1);expect(recorder.status.state).toBe('failed');expect(recorder.snapshot()).toBeNull();recorder.dispose();
 });
 it('rejects a timed final-shot backfill that would exceed the event envelope',()=>{
  const sim=new Simulation('precision','rifleA',{...settings(),duration:15}),recorder=new ReplayRecorder(sim);
  for(let i=0;i<20_000;i++)sim.configure({});
  let finished:ReplayRecording|null|undefined;sim.onFinish=()=>{finished=recorder.finish();};sim.running=true;
  for(let i=0;i<1800;i++)sim.step(dt,{...emptyInput(),fire:i===1799,firePresses:i===1799?1:0});
  expect(sim.completed).toBe(true);expect(sim.stats.shots).toBe(1);expect(finished).toBeNull();expect(recorder.status.state).toBe('failed');expect(recorder.status.reason).toContain('이벤트 한도');recorder.dispose();
 });
});
