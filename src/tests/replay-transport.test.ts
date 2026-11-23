import {describe,expect,it} from 'vitest';
import {Simulation} from '../engine/simulation/Simulation';
import {ReplayRecorder} from '../engine/replay/recording';
import {ReplayPlayer} from '../engine/replay/playback';
import {simulationChecksum} from '../engine/replay/integrity';
import {DEFAULT_SETTINGS} from '../config/settings';
import {emptyInput} from '../engine/types';
import type {ReplayEvent,ReplayProgress} from '../engine/replay/types';
import {inspectionCamera,ReplayTransport,timelineMarkers,type SeekableReplay} from '../ui/replayTransport';

class TestPlayer implements SeekableReplay {
 time=0;ended=false;advances:number[]=[];
 requests:{target:number;signal?:AbortSignal;resolve:(result:ReplayProgress)=>void;reject:(error:unknown)=>void}[]=[];
 constructor(readonly totalTicks=1200){}
 advanceToTick(tick:number){this.advances.push(tick);this.time=tick/120;this.ended=tick===this.totalTicks;return{tick,time:this.time,ended:this.ended,commands:tick};}
 seek(target:number,options?:{signal?:AbortSignal}){return new Promise<ReplayProgress>((resolve,reject)=>this.requests.push({target,signal:options?.signal,resolve:result=>{this.time=result.time;this.ended=result.ended;resolve(result);},reject}));}
}
const progress=(time:number):ReplayProgress=>({time,tick:time*120,ended:false,commands:time*120});

describe('A2 replay transport keeps presentation separate from the simulation clock',()=>{
 it('does not execute commands while paused and changes speed only by advancing more original ticks',()=>{
  const player=new TestPlayer(),transport=new ReplayTransport(player,10,1200);
  transport.advance(.1);expect(player.advances).toEqual([]);
  transport.play();transport.advance(.1);expect(player.advances).toEqual([12]);expect(transport.time).toBeCloseTo(.1,12);
  transport.pause();transport.advance(.2);expect(player.advances).toEqual([12]);
  transport.setSpeed(2);transport.setSpeed(8);expect(transport.speed).toBe(2);transport.play();transport.advance(.1);
  expect(player.advances).toEqual([12,36]);expect(transport.time).toBeCloseTo(.3,12);expect(player.time).toBeCloseTo(.3,12);
 });
 it('bounds background catch-up and rejects nonfinite or negative elapsed intervals without jumping ahead',()=>{
  const player=new TestPlayer(),transport=new ReplayTransport(player,10,1200);transport.setSpeed(2);transport.play();transport.advance(30);
  expect(transport.time).toBe(.5);expect(player.advances.at(-1)).toBe(60);
  transport.advance(Infinity);transport.advance(NaN);transport.advance(-1);expect(transport.time).toBe(.5);expect(player.time).toBe(.5);
 });
 it('keeps a fractional render cursor without inventing a fractional authority tick and stops at the final tick',()=>{
  const player=new TestPlayer(12),transport=new ReplayTransport(player,.1,12);transport.play();transport.advance(.001);
  expect(player.time).toBe(0);expect(transport.alpha).toBeCloseTo(.12,12);expect(transport.time).toBe(.001);
  transport.advance(.25);expect(player.advances.at(-1)).toBe(12);expect(transport.time).toBe(.1);expect(transport.playing).toBe(false);expect(transport.alpha).toBe(0);
  transport.play();expect(transport.playing).toBe(false);
 });
 it('cancels a superseded seek and does not let its stale completion replace the current cursor',async()=>{
  const player=new TestPlayer(),transport=new ReplayTransport(player,10,1200);transport.play();
  const first=transport.seek(1);expect(transport.playing).toBe(false);expect(transport.seeking).toBe(true);
  const second=transport.seek(2);expect(player.requests[0].signal?.aborted).toBe(true);expect(player.requests[1].signal?.aborted).toBe(false);
  player.requests[0].resolve(progress(1));expect(await first).toBe(false);expect(transport.time).toBe(0);expect(transport.seeking).toBe(true);
  player.requests[1].resolve(progress(2));expect(await second).toBe(true);expect(transport.time).toBe(2);expect(transport.seeking).toBe(false);
 });
 it('aborts work on disposal and clears seeking after a real failure',async()=>{
  const player=new TestPlayer(),transport=new ReplayTransport(player,10,1200);const pending=transport.seek(3);transport.dispose();
  expect(player.requests[0].signal?.aborted).toBe(true);player.requests[0].resolve(progress(3));expect(await pending).toBe(false);expect(transport.time).toBe(0);expect(transport.seeking).toBe(false);
  const failing=new TestPlayer(),second=new ReplayTransport(failing,10,1200),failure=second.seek(5);failing.requests[0].reject(new Error('damaged checkpoint'));
  await expect(failure).rejects.toThrow('damaged checkpoint');expect(second.seeking).toBe(false);expect(second.playing).toBe(false);
 });
 it('clamps requested seek times before passing them to the reconstruction engine',async()=>{
  const player=new TestPlayer(),transport=new ReplayTransport(player,10,1200),negative=transport.seek(-5);expect(player.requests[0].target).toBe(0);player.requests[0].resolve(progress(0));await negative;
  const late=transport.seek(100);expect(player.requests[1].target).toBe(10);player.requests[1].resolve(progress(10));await late;expect(transport.time).toBe(10);
 });
});

describe('A2 replay timeline and inspection camera remain bounded display data',()=>{
 it('keeps significant events and a bounded distributed shot sample in stable time order',()=>{
  const shots:ReplayEvent[]=Array.from({length:500},(_,i)=>({kind:'shot',time:i/50,label:`shot ${i}`}));
  const important:ReplayEvent[]=[{kind:'death',time:3,label:'death'},{kind:'kill',time:5,label:'kill'},{kind:'respawn',time:6,label:'retry'}];
  const invalid:ReplayEvent[]=[{kind:'shot',time:-1,label:'negative'},{kind:'death',time:11,label:'too late'},{kind:'kill',time:NaN,label:'not a time'}],events=[...shots,...important,...invalid],before=structuredClone(events);
  const markers=timelineMarkers(events,10,20);expect(markers).toHaveLength(20);expect(markers.filter(m=>m.kind!=='shot').map(m=>m.label)).toEqual(['death','kill','retry']);
  expect(markers.every((m,i)=>m.percent>=0&&m.percent<=100&&(i===0||markers[i-1].time<=m.time))).toBe(true);expect(new Set(markers.map(m=>m.id)).size).toBe(20);
  expect(timelineMarkers(events,10,20)).toEqual(markers);expect(events).toEqual(before);expect(timelineMarkers(events,10,0)).toEqual([]);
  expect(timelineMarkers(events,10,10000)).toHaveLength(200);
 });
 it('builds a separate top-down camera target without mutating the player pose',()=>{
  const position={x:4,y:1.2,z:-9},before={...position};expect(inspectionCamera(position,'first-person')).toBeNull();const camera=inspectionCamera(position,'top-down')!;
  expect(camera.position.y-position.y).toBe(24);expect(camera.target).toEqual(position);expect(camera.target).not.toBe(position);camera.target.x=500;expect(position).toEqual(before);expect(camera.fov).toBe(55);
 });
});

describe('A2 viewer transport drives the actual compatible simulation',()=>{
 it('reaches the same authoritative result at quarter and double speed and reconstructs a highlighted point',async()=>{
  const simulation=new Simulation('free','rifleA',{...structuredClone(DEFAULT_SETTINGS),behavior:'stationary',targetCount:1,analysisWall:false});
  const recorder=new ReplayRecorder(simulation);simulation.running=true;
  for(let tick=0;tick<240;tick++){
   if(tick%20===0)simulation.look(1,-.5);
   simulation.step(1/120,{...emptyInput(),strafe:tick>0&&tick<100?1:0,fire:tick===0||tick>=60&&tick<160,firePresses:tick===0||tick===60?1:0,jump:tick===120,jumpPresses:tick===120?1:0});
  }
  simulation.running=false;simulation.completed=true;const recording=recorder.finish();recorder.dispose();expect(recording).not.toBeNull();
  const results=[];
  for(const speed of[.25,2]){
   const player=new ReplayPlayer(recording!),transport=new ReplayTransport(player,recording!.duration,recording!.ticks);transport.setSpeed(speed);transport.play();
   let frames=0;while(transport.playing&&frames++<2000)transport.advance(1/60);
   expect(frames).toBeLessThan(2000);expect(player.ended).toBe(true);expect(simulationChecksum(player.simulation)).toBe(recording!.final.checksum);results.push({score:player.simulation.stats.eliminations,shots:player.simulation.stats.shots,position:player.simulation.movement.position.toArray()});
   await transport.seek(1);expect(transport.time).toBe(1);expect(player.simulation.ticks).toBe(120);expect(player.ended).toBe(false);expect(transport.playing).toBe(false);
   transport.play();while(transport.playing)transport.advance(1/60);expect(simulationChecksum(player.simulation)).toBe(recording!.final.checksum);
  }
  expect(results[0]).toEqual(results[1]);expect(results[0].shots).toBeGreaterThan(0);expect(results[0].score).toBeGreaterThan(0);
 });
});
