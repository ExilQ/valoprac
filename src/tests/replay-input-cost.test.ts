import {describe,it,expect} from 'vitest';
import {Simulation} from '../engine/simulation/Simulation';
import {ReplayRecorder} from '../engine/replay/recording';
import {DEFAULT_SETTINGS} from '../config/settings';

describe('Replay appends delivered look input without copying gameplay state per event',()=>{
 it('retains all12000 look events and measures the CPU-only append cost',()=>{
  const samples:{recording:boolean;events:number;totalMs:number;microsecondsPerEvent:number}[]=[],events=12000;
  for(let run=0;run<10;run++){
   const recording=run%2===1,s=new Simulation('free','rifleA',structuredClone(DEFAULT_SETTINGS)),r=recording?new ReplayRecorder(s):null;
   const start=performance.now();for(let n=0;n<events;n++)s.look((n%7)-3,(n%5)-2);const totalMs=performance.now()-start;
   samples.push({recording,events,totalMs,microsecondsPerEvent:totalMs/events*1000});
   if(r){const snapshot=r.finish()!;expect(snapshot.commands.filter(c=>c[0]===1)).toHaveLength(events);expect(snapshot.commands[0]).toEqual([1,-3,-2]);r.dispose();}
   expect(Number.isFinite(s.yaw)).toBe(true);
  }
  const median=(recording:boolean)=>samples.filter(x=>x.recording===recording).map(x=>x.microsecondsPerEvent).sort((a,b)=>a-b)[2];
  console.log(JSON.stringify({benchmark:'replay-look-cpu',eventsPerRun:events,runs:samples.length,unrecordedMedianMicroseconds:median(false),recordedMedianMicroseconds:median(true),samples,physicalInputLatencyVerified:false,description:'Alternating real Simulation.look loops; CPU event append only, excludes browser delivery/GPU/scanout/peripheral delay.'}));
 });
});
