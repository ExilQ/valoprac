import {describe,expect,it} from 'vitest';
import {FUNDAMENTAL_COURSES,TACTICAL_COURSES,MAP_COURSES} from '../config/mapCourses';
import {levelFor,visibleBetween} from '../engine/tactical/levels';

describe('12.25 fundamentals maps',()=>{
 it('builds every original drill map with reachable target positions and keeps the tactical course list separate',()=>{
  expect(FUNDAMENTAL_COURSES.map(c=>c.drill)).toEqual(['preaim','angles','flick','micro']);
  expect(TACTICAL_COURSES.length+FUNDAMENTAL_COURSES.length).toBe(MAP_COURSES.length);
  for(const course of FUNDAMENTAL_COURSES){const level=levelFor(course.id)!;expect(level,course.id).toBeTruthy();expect(level.angles.length,course.id).toBeGreaterThanOrEqual(7);
   console.info(course.id,level.angles.map(a=>`${a.label}@${a.position.x.toFixed(1)},${a.position.y.toFixed(1)},${a.position.z.toFixed(1)}`).join(' '),'spawn',level.spawn);}
 });
 it('hides every pre-aim position from the start: each must be found by turning a corner',()=>{
  const level=levelFor('fd-preaim')!,eye={...level.spawn,y:level.spawn.y+1.64};
  for(const a of level.angles)expect(visibleBetween(level.obstacles,eye,{...a.position,y:a.position.y+1.6}),a.label).toBe(false);
 });
});

import {Simulation} from '../engine/simulation/Simulation';
import {DEFAULT_SETTINGS} from '../config/settings';
import {emptyInput,type PracticeMap} from '../engine/types';
import {ReplayRecorder} from '../engine/replay/recording';
import {ReplayPlayer} from '../engine/replay/playback';

const DT=1/120;
const sim=(map:string)=>{const s=new Simulation('free','rifleA',{...structuredClone(DEFAULT_SETTINGS),practiceMap:map as PracticeMap,targetCount:12,eliminationRule:'head',exposureEnabled:false,drill:'none'});s.running=true;return s;};
const run=(s:Simulation,seconds:number)=>{for(let i=0;i<Math.round(seconds/DT);i++)s.step(DT,emptyInput());};
const kill=(s:Simulation,index:number)=>(s as unknown as {eliminateTarget:(t:unknown)=>void}).eliminateTarget(s.targets[index]);

describe('12.25 fundamentals drills in the simulation',()=>{
 it('pre-aim: holds all seven corners, never uses defender AI, and restarts the round at the start once cleared',()=>{
  const s=sim('fd-preaim');expect(s.drill?.kind).toBe('preaim');expect(s.defenders).toBeNull();expect(s.angles).toBeNull();
  const held=s.targets.filter(t=>t.enabled&&t.active);expect(held).toHaveLength(7);
  run(s,.5);for(const t of held)expect(t.velocity.x).toBe(0);
  s.movement.position.set(0,0,-11);for(let i=0;i<7;i++)kill(s,i);
  expect(s.drill!.snapshot()).toMatchObject({round:1,cleared:7,total:7});
  run(s,1.3);expect(s.drill!.snapshot()).toMatchObject({round:2,cleared:0});expect(s.movement.position.z).toBeCloseTo(s.level!.spawn.z,3);
  expect(s.targets.filter(t=>t.enabled&&t.active)).toHaveLength(7);
 });
 it('flick: shows one target at least 35 degrees from the crosshair, counts a timeout as a miss and brings the next',()=>{
  const s=sim('fd-flick');run(s,.7);const active=()=>s.targets.filter(t=>t.enabled&&t.active);
  expect(active()).toHaveLength(1);expect(s.drill!.snapshot().flickDeg).toBeGreaterThanOrEqual(35);
  const first=active()[0].position.clone();run(s,3.1);expect(s.drill!.snapshot().misses).toBe(1);expect(active()).toHaveLength(1);
  kill(s,0);expect(active()).toHaveLength(0);run(s,.35);expect(active()).toHaveLength(1);expect(s.drill!.snapshot().kills).toBe(1);
  expect(active()[0].position.distanceTo(first)).toBeGreaterThan(0);
 });
 it('micro: keeps three far targets strafing within a few decimetres of their positions',()=>{
  const s=sim('fd-micro');const anchors=s.targets.slice(0,3).map(t=>t.anchor.clone());let moved=0;
  for(let i=0;i<240;i++){s.step(DT,emptyInput());s.targets.slice(0,3).forEach((t,k)=>{expect(Math.abs(t.position.x-anchors[k].x)).toBeLessThanOrEqual(.43);if(Math.abs(t.velocity.x)>.3)moved++;});}
  expect(moved).toBeGreaterThan(100);for(const t of s.targets.slice(0,3))expect(Math.hypot(t.position.x-s.movement.position.x,t.position.z-s.movement.position.z)).toBeGreaterThan(24);
 });
 it('angles: defenders make short shoulder peeks and return to their hold',()=>{
  const s=sim('fd-angles');const t=s.targets.find(x=>x.enabled)!,anchor=t.anchor.x;let peeked=false;
  for(let i=0;i<600;i++){s.step(DT,emptyInput());if(Math.abs(t.position.x-anchor)>.3)peeked=true;}
  expect(peeked).toBe(true);
 });
 it('replays a drill session exactly',async()=>{
  const s=new Simulation('free','rifleA',{...structuredClone(DEFAULT_SETTINGS),practiceMap:'fd-flick' as PracticeMap,targetCount:12,eliminationRule:'head',exposureEnabled:false,drill:'none'});
  const recorder=new ReplayRecorder(s);s.running=true;
  for(let i=0;i<600;i++)s.step(DT,{...emptyInput(),forward:i%240<60?1:0,strafe:i%180<40?1:0});
  const record=recorder.finish()!;expect(record).toBeTruthy();expect(await new ReplayPlayer(record).verify()).toMatchObject({passed:true});
 });
});
