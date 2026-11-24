import {describe,it,expect} from 'vitest';
import {MAP_COURSES} from '../config/mapCourses';
import {DEFAULT_SETTINGS,sanitizeSettings} from '../config/settings';
import {levelFor,standingSpace,visibleBetween} from '../engine/tactical/levels';
import {emptyInput} from '../engine/types';
import {Movement} from '../engine/movement/Movement';
import {Simulation} from '../engine/simulation/Simulation';
import {ReplayRecorder} from '../engine/replay/recording';
import {ReplayPlayer} from '../engine/replay/playback';
import {trainingMapTitle} from '../ui/trainingPresentation';

describe('Map courses',()=>{
 it('provides thirteen independent layouts and landmarks',()=>{
  expect(MAP_COURSES).toHaveLength(13);
  expect(new Set(MAP_COURSES.map(c=>c.rows.join(''))).size).toBe(13);
  expect(new Set(MAP_COURSES.map(c=>c.landmark)).size).toBe(13);
 });
 for(const course of MAP_COURSES)it(course.id+' persists, starts, and admits a continuous walk to all three defenders',()=>{
  const settings=sanitizeSettings({...DEFAULT_SETTINGS,practiceMap:course.id});
  expect(settings.practiceMap).toBe(course.id);expect(trainingMapTitle(settings)).toBe(course.title);
  const sim=new Simulation('free','rifleA',settings),level=levelFor(course.id)!;
  expect(sim.level).toBe(level);expect(sim.targets.filter(t=>t.enabled&&t.active)).toHaveLength(3);
  expect(standingSpace(level.obstacles,level.spawn)).toBe(true);
  expect(level.angles.map(a=>a.label).sort()).toEqual(['A','B','C']);
  expect(level.angles.filter(a=>visibleBetween(level.obstacles,{...level.spawn,y:1.6},{...a.position,y:a.position.y+1.6}))).toHaveLength(0);
  const front={x:level.spawn.x-10*Math.sin(sim.yaw),y:1.6,z:level.spawn.z-10*Math.cos(sim.yaw)};
  expect(visibleBetween(level.obstacles,{...level.spawn,y:1.6},front)).toBe(true);
  const m=new Movement(undefined,level.obstacles);m.reset(level.spawn);
  let tick=0;
  for(const p of level.route.slice(1)){
   let steps=0;
   while(Math.hypot(p.x-m.position.x,p.z-m.position.z)>.09&&steps++<600){
    const yaw=Math.atan2(m.position.x-p.x,m.position.z-p.z);
    m.step({...emptyInput(),forward:1},yaw,1/120,++tick/120);
   }
   expect(steps,'blocked at '+JSON.stringify(p)).toBeLessThan(600);
   expect(m.position.y).toBeCloseTo(p.y,0);
  }
  for(const [i,a] of level.angles.entries()){
   const target=sim.targets[i];expect(Math.hypot(target.position.x-a.position.x,target.position.z-a.position.z)).toBeLessThan(.25);
   expect(standingSpace(level.obstacles,target.position,.4)).toBe(true);
   expect(level.route.some(p=>Math.hypot(p.x-a.position.x,p.z-a.position.z)>2&&visibleBetween(level.obstacles,{...p,y:p.y+1.6},{...a.position,y:a.position.y+1.6}))).toBe(true);
  }
 });
 it('moves a player through the Bind gate once and clears interpolation at the exit',()=>{
  const sim=new Simulation('free','rifleA',{...DEFAULT_SETTINGS,practiceMap:'bind'}),gate=sim.level!.transfer!;
  sim.movement.reset(gate.entry);sim.running=true;sim.step(1/120,emptyInput());
  expect(sim.movement.position.toArray()).toEqual([gate.exit.x,0,gate.exit.z]);
  expect(sim.movement.previous.equals(sim.movement.position)).toBe(true);
  sim.step(1/120,emptyInput());expect(sim.movement.position.x).toBe(gate.exit.x);
 });
 it('records and verifies a session on a new map',async()=>{
  const sim=new Simulation('free','rifleA',{...DEFAULT_SETTINGS,practiceMap:'split'});
  const recorder=new ReplayRecorder(sim);sim.running=true;
  for(let i=0;i<90;i++)sim.step(1/120,{...emptyInput(),forward:1});
  const recording=recorder.finish()!;expect(recording.header.map).toBe('split');
  expect((await new ReplayPlayer(recording).verify()).passed).toBe(true);
 });
});
