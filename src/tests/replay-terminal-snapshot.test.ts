import {describe,it,expect} from 'vitest';
import {Simulation} from '../engine/simulation/Simulation';
import {ReplayRecorder} from '../engine/replay/recording';
import {ReplayPlayer} from '../engine/replay/playback';
import {validateReplay} from '../engine/replay/validation';
import {DEFAULT_SETTINGS} from '../config/settings';
import {emptyInput} from '../engine/types';
const dt=1/120;
const create=()=>new Simulation('free','rifleA',structuredClone({...DEFAULT_SETTINGS,targetCount:1,analysisWall:true}));
describe('A finished replay remains a defensive terminal snapshot',()=>{
 it('keeps repeated finish and snapshot outcomes fixed after actual live input, shooting and disposal',async()=>{
  const sim=create(),recorder=new ReplayRecorder(sim);sim.running=true;
  try{
   for(let i=0;i<120;i++)sim.step(dt,{...emptyInput(),strafe:i<60?1:-1});
   const first=recorder.finish()!,expected=structuredClone(first);
   sim.look(30,-5);sim.step(dt,{...emptyInput(),fire:true,firePresses:1});
   expect(sim.ticks).toBe(expected.ticks+1);expect(sim.stats.shots).toBe(1);
   first.commands.length=0;first.header.initial.settings.sensitivity=99;first.final.score=999;
   const second=recorder.finish()!,third=recorder.snapshot()!;
   expect(second).toEqual(expected);expect(third).toEqual(expected);expect(second).not.toBe(third);
   second.final.checksum='0000000000000000';expect(recorder.snapshot()).toEqual(expected);
   validateReplay(third);expect((await new ReplayPlayer(third).verify()).passed).toBe(true);
   recorder.dispose();sim.step(dt,emptyInput());expect(recorder.finish()).toEqual(expected);expect(recorder.snapshot()).toEqual(expected);
  }finally{recorder.dispose();}
 });
 it('does not synthesize a new final result after a recording was disposed without finishing',()=>{
  const sim=create(),recorder=new ReplayRecorder(sim);sim.running=true;sim.step(dt,emptyInput());recorder.dispose();
  sim.step(dt,{...emptyInput(),fire:true,firePresses:1});expect(sim.stats.shots).toBe(1);
  expect(recorder.snapshot()).toBeNull();expect(recorder.finish()).toBeNull();expect(recorder.status.state).toBe('stopped');
 });
});
