import {describe,it,expect,vi} from 'vitest';
import {Simulation} from '../engine/simulation/Simulation';
import {ReplayRecorder} from '../engine/replay/recording';
import {ReplayPlayer} from '../engine/replay/playback';
import {simulationChecksum} from '../engine/replay/integrity';
import {DEFAULT_SETTINGS} from '../config/settings';
import {emptyInput} from '../engine/types';
function record(){const sim=new Simulation('free','rifleA',structuredClone({...DEFAULT_SETTINGS,targetCount:1,analysisWall:true})),recorder=new ReplayRecorder(sim);sim.running=true;for(let i=0;i<360;i++)sim.step(1/120,{...emptyInput(),strafe:i<180?1:-1});return recorder.finish()!;}
describe('Replay reconstruction cancels safely and always advances bounded chunks',()=>{
 it('rejects an already-aborted seek without replacing the current verified state',async()=>{
  const player=new ReplayPlayer(record());await player.seek(1);const authority=player.simulation,checksum=simulationChecksum(authority),controller=new AbortController();controller.abort();
  await expect(player.seek(2,{signal:controller.signal})).rejects.toMatchObject({name:'AbortError'});expect(player.simulation).toBe(authority);expect(simulationChecksum(player.simulation)).toBe(checksum);expect(player.time).toBe(1);
 });
 it('uses a finite fallback when a caller supplies NaN, instead of yielding forever',async()=>{
  const player=new ReplayPlayer(record());vi.useFakeTimers();
  try{const pending=player.seek(2,{chunkSize:NaN});await vi.runAllTimersAsync();expect((await pending).tick).toBe(240);expect(player.time).toBe(2);}finally{vi.useRealTimers();}
 });
 it('ignores an already-aborted newcomer without cancelling a valid in-flight reconstruction',async()=>{
  const player=new ReplayPlayer(record());vi.useFakeTimers();
  try{const pending=player.seek(2,{chunkSize:100}),controller=new AbortController();controller.abort();await expect(player.seek(0,{signal:controller.signal})).rejects.toMatchObject({name:'AbortError'});await vi.runAllTimersAsync();expect((await pending).tick).toBe(240);expect(player.time).toBe(2);}finally{vi.useRealTimers();}
 });
});
