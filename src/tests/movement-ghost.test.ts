import {describe,it,expect} from 'vitest';
import {Simulation} from '../engine/simulation/Simulation';
import {ReplayRecorder} from '../engine/replay/recording';
import {simulationChecksum} from '../engine/replay/integrity';
import {DEFAULT_SETTINGS} from '../config/settings';
import {emptyInput} from '../engine/types';
import {buildMovementGhost,sampleMovementGhost,compareMovementGhost,MAX_GHOST_SAMPLES} from '../training/movementTools/GhostFromReplay';

const DT=1/120;
function fixture(ticks=360){
 const sim=new Simulation('free','rifleA',structuredClone(DEFAULT_SETTINGS)),recorder=new ReplayRecorder(sim);sim.running=true;
 let distance=0,peakHeight=0,peakSpeed=0,landings=0,wasGrounded=true,previous=sim.movement.position.clone(),landing=null as {x:number;y:number;z:number}|null;
 for(let tick=0;tick<ticks;tick++){
  sim.step(DT,{...emptyInput(),forward:1,strafe:tick<180?.4:-.4,jump:tick===20||tick===160,jumpHeld:tick>=20&&tick<24||tick>=160&&tick<164});
  const m=sim.movement;distance+=Math.hypot(m.position.x-previous.x,m.position.z-previous.z);previous.copy(m.position);peakHeight=Math.max(peakHeight,m.position.y);peakSpeed=Math.max(peakSpeed,m.speed);
  if(!wasGrounded&&m.grounded){landings++;landing={x:m.position.x,y:m.position.y,z:m.position.z};}wasGrounded=m.grounded;
 }
 return{sim,recording:recorder.finish()!,distance,peakHeight,peakSpeed,landings,landing};
}

describe('A3 ghost review derives a bounded visual cache from the shared replay authority',()=>{
 it('reconstructs the same jump path twice without changing the live training state',async()=>{
  const f=fixture(),before=simulationChecksum(f.sim),segment={startTick:0,endTick:f.sim.ticks};
  const a=await buildMovementGhost(f.recording,segment),b=await buildMovementGhost(f.recording,segment);
  expect(a).toEqual(b);expect(simulationChecksum(f.sim)).toBe(before);expect(a.sourceFinalVerified).toBe(true);
  expect(a.samples.length).toBeLessThanOrEqual(MAX_GHOST_SAMPLES);expect(a.duration).toBe(3);expect(a.samples.at(-1)!.slice(1,4)).toEqual(f.sim.movement.position.toArray());
  // Summary measurements use every120Hz state, not the reduced display path.
  expect(a.distance).toBeCloseTo(f.distance,12);expect(a.peakHeight).toBeCloseTo(f.peakHeight,12);expect(a.peakSpeed).toBeCloseTo(f.peakSpeed,12);expect(a.landings).toBe(f.landings);expect(a.landing).toEqual(f.landing);expect(a.peakHeight).toBeGreaterThan(1.13);
  expect(Object.isFrozen(a)).toBe(true);expect(Object.isFrozen(a.samples[0])).toBe(true);
  console.log(JSON.stringify({benchmark:'movement-ghost-shared-replay',simulationHz:120,displaySamples:a.samples.length,duration:a.duration,distance:a.distance,peakHeight:a.peakHeight,peakSpeed:a.peakSpeed,landings:a.landings,repeatEqual:true,liveStateUnchanged:true,sourceFinalVerified:a.sourceFinalVerified,independentGhostRecorder:false}));
 });
 it('can inspect a prefix while distinguishing it from final outcome verification',async()=>{
  const f=fixture(),ghost=await buildMovementGhost(f.recording,{startTick:120,endTick:240});
  expect(ghost.duration).toBe(1);expect(ghost.samples[0][0]).toBe(0);expect(ghost.samples.at(-1)![0]).toBe(1);expect(ghost.sourceFinalVerified).toBe(false);
  const tampered=structuredClone(f.recording);tampered.final.score++;
  expect((await buildMovementGhost(tampered,{startTick:0,endTick:tampered.ticks})).sourceFinalVerified).toBe(false);
 });
 it('rejects invalid, out-of-record and over20-second segments before expensive reconstruction',async()=>{
  const f=fixture(120);
  for(const segment of [{startTick:-1,endTick:10},{startTick:0,endTick:0},{startTick:.5,endTick:10},{startTick:0,endTick:121},{startTick:NaN,endTick:10}])await expect(buildMovementGhost(f.recording,segment)).rejects.toThrow(/구간/);
  await expect(buildMovementGhost({...f.recording,ticks:3000},{startTick:0,endTick:2401})).rejects.toThrow(/20초/);
  const incompatible=structuredClone(f.recording);incompatible.header.gameVersion='incompatible';await expect(buildMovementGhost(incompatible,{startTick:0,endTick:120})).rejects.toThrow(/호환/);
 });
 it('includes both endpoints while enforcing the600-point budget for a full20-second review',async()=>{
  const f=fixture(2400),ghost=await buildMovementGhost(f.recording,{startTick:0,endTick:2400});
  expect(ghost.samples).toHaveLength(MAX_GHOST_SAMPLES);expect(ghost.samples[0][0]).toBe(0);expect(ghost.samples.at(-1)![0]).toBe(20);expect(ghost.duration).toBe(20);expect(ghost.sourceFinalVerified).toBe(true);
 });
 it('cancels both before work and at a bounded asynchronous yield',async()=>{
  const f=fixture(),early=new AbortController();early.abort();await expect(buildMovementGhost(f.recording,{startTick:0,endTick:360},{signal:early.signal})).rejects.toMatchObject({name:'AbortError'});
  const controller=new AbortController(),before=simulationChecksum(f.sim),pending=buildMovementGhost(f.recording,{startTick:0,endTick:360},{signal:controller.signal});setTimeout(()=>controller.abort(),0);
  await expect(pending).rejects.toMatchObject({name:'AbortError'});expect(simulationChecksum(f.sim)).toBe(before);
 });
 it('interpolates display pose only and compares real attempt metrics',async()=>{
  const f=fixture(),g=await buildMovementGhost(f.recording,{startTick:0,endTick:360}),a=g.samples[0],b=g.samples[1],pose=sampleMovementGhost(g,(a[0]+b[0])/2)!;
  expect(pose.position.x).toBeCloseTo((a[1]+b[1])/2,12);expect(pose.position.z).toBeCloseTo((a[3]+b[3])/2,12);expect(sampleMovementGhost(g,-1)?.time).toBe(0);expect(sampleMovementGhost(g,9)?.finished).toBe(true);expect(sampleMovementGhost(g,NaN)).toBeNull();
  const comparison=compareMovementGhost(g,{duration:g.duration+.25,distance:g.distance+1,peakSpeed:g.peakSpeed+.2,peakHeight:g.peakHeight,landing:g.landing});
  expect(comparison.elapsedDelta).toBe(.25);expect(comparison.distanceDelta).toBeCloseTo(1);expect(comparison.peakSpeedDelta).toBeCloseTo(.2);expect(comparison.peakHeightDelta).toBe(0);expect(comparison.landingDistance).toBe(0);
 });
});
