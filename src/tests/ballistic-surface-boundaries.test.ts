import {describe,it,expect} from 'vitest';
import {Box3,Ray,Vector3} from 'three';
import {traceBallisticRay,type BallisticTrace,type PenetrationSegment} from '../engine/collision/Ballistics';
import {registerStaticObstacles} from '../engine/collision/StaticBroadphase';
import type {Obstacle} from '../engine/collision/environment';
import {WEAPONS} from '../config/weapons';
import type {SurfaceId} from '../config/surfaces';

const panel=(front:number,back:number,material:SurfaceId):Obstacle=>({box:new Box3(new Vector3(-2,0,-back),new Vector3(2,3,-front)),kind:'wall',color:0,material});
const ray=(z=0)=>new Ray(new Vector3(0,1.5,z),new Vector3(0,0,-1));
const target=(distance=10)=>({zone:'head' as const,distance,point:{x:0,y:1.5,z:-distance}});
const current=(obstacles:Obstacle[],distance=10,origin=0,max=150)=>traceBallisticRay(ray(origin),WEAPONS.operator,target(distance),obstacles,max,'materials-v3');
const legacy=(obstacles:Obstacle[],distance=10,origin=0,max=150)=>traceBallisticRay(ray(origin),WEAPONS.operator,target(distance),obstacles,max,'legacy-v2');
const effects=(segments:PenetrationSegment[])=>segments.flatMap(s=>[...(s.entrySurface!==false?[{material:s.material,point:s.entry,normal:s.entryNormal,exit:false}]:[]),...(s.penetrated&&s.exitSurface!==false?[{material:s.material,point:s.exit,normal:s.exitNormal,exit:true}]:[])]);
function stripSurfaceFlags(trace:BallisticTrace){return{...trace,segments:trace.segments.map(({entrySurface,exitSurface,...s})=>s)};}

describe('Current ballistic material charges do not manufacture surface events',()=>{
 for(const scene of [
  {name:'overlapping',panels:[[3,3.4],[3.2,3.6]],exit:3.6},
  {name:'touching',panels:[[3,3.2],[3.2,3.4]],exit:3.4},
  {name:'duplicate',panels:[[3,3.4],[3,3.4]],exit:3.4},
 ])it(`emits only the exterior of ${scene.name} same-material modular solids`,()=>{
  const obstacles=scene.panels.map(([front,back])=>panel(front,back,'thinWood')),shot=current(obstacles);
  expect(stripSurfaceFlags(shot)).toEqual(legacy(obstacles));
  expect(effects(shot.segments).map(e=>[e.material,e.exit,e.point.z])).toEqual([
   ['thinWood',false,-3],['thinWood',true,-scene.exit]
  ]);
 });
 it('preserves same-material exterior events across author order and broadphase selection',()=>{
  const ordered=[panel(3,3.4,'thinWood'),panel(3.2,3.6,'thinWood')],reversed=[...ordered].reverse();
  const expected=effects(current(ordered).segments);
  expect(effects(current(reversed).segments)).toEqual(expected);
  registerStaticObstacles(reversed);expect(effects(current(reversed).segments)).toEqual(expected);
  expect(stripSurfaceFlags(current(reversed))).toEqual(legacy(reversed));
 });
 it('emits only the outer faces when a lower-resistance overlap partitions one slab',()=>{
  const obstacles=[panel(3,3.6,'thickWood'),panel(3.2,3.4,'glass')],shot=current(obstacles),old=legacy(obstacles);
  expect(shot.segments).toHaveLength(3);expect(shot.zone).toBe('head');
  expect(stripSurfaceFlags(shot)).toEqual(old);
  expect(effects(old.segments)).toHaveLength(6);
  expect(effects(shot.segments)).toEqual([
   {material:'thickWood',point:{x:0,y:1.5,z:-3},normal:{x:0,y:0,z:1},exit:false},
   {material:'thickWood',point:{x:0,y:1.5,z:-3.6},normal:{x:0,y:0,z:-1},exit:true}
  ]);
 });
 it('retains both real insert faces without inventing wood holes at resistance switches',()=>{
  const obstacles=[panel(3,3.4,'thinWood'),panel(3.1,3.2,'thinMetal')],shot=current(obstacles);
  expect(stripSurfaceFlags(shot)).toEqual(legacy(obstacles));
  expect(effects(shot.segments).map(e=>[e.material,e.exit,e.point.z])).toEqual([
   ['thinWood',false,-3],['thinMetal',false,-3.1],['thinMetal',true,-3.2],['thinWood',true,-3.4]
  ]);
 });
 it('keeps an origin-inside traversal and loss but emits only its actual exit face',()=>{
  const obstacles=[panel(3,3.4,'thinWood')],shot=current(obstacles,10,-3.2);
  expect(shot.segments[0].inside).toBe(true);expect(shot.segments[0].thickness).toBeCloseTo(.2);
  expect(stripSurfaceFlags(shot)).toEqual(legacy(obstacles,10,-3.2));
  expect(effects(shot.segments)).toHaveLength(1);expect(effects(shot.segments)[0]).toMatchObject({exit:true,point:{z:-3.4}});
 });
 it('does not put an exit decal or sound on a target that clips traversal inside a solid',()=>{
  const obstacles=[panel(3,3.6,'thinWood')],shot=current(obstacles,3.2);
  expect(shot.zone).toBe('head');expect(shot.stopReason).toBe('target');expect(shot.distance).toBe(3.2);
  expect(stripSurfaceFlags(shot)).toEqual(legacy(obstacles,3.2));
  expect(effects(shot.segments)).toHaveLength(1);expect(effects(shot.segments)[0]).toMatchObject({exit:false,point:{z:-3}});
 });
 it('preserves range and capacity stops without claiming a surface was exited',()=>{
  const glass=[panel(3,3.6,'glass')],ranged=current(glass,10,0,3.2);
  expect(ranged.stopReason).toBe('range');expect(ranged.segments[0].exitSurface).toBe(false);expect(effects(ranged.segments)).toHaveLength(1);
  expect(stripSurfaceFlags(ranged)).toEqual(legacy(glass,10,0,3.2));
  const steel=[panel(3,4,'thickMetal')],blocked=current(steel);
  expect(blocked.stopReason).toBe('capacity');expect(blocked.segments[0].penetrated).toBe(false);expect(blocked.segments[0].exitSurface).toBe(false);expect(effects(blocked.segments)).toHaveLength(1);
  expect(stripSurfaceFlags(blocked)).toEqual(legacy(steel));
 });
 it('keeps indexed and linear current traces identical, retaining author ties and real surface normals',()=>{
  const obstacles=[panel(3,3.6,'thinWood'),panel(3.2,3.3,'thinMetal'),panel(5,5.1,'glass')],linear=obstacles.map(o=>({...o,box:o.box.clone()}));
  registerStaticObstacles(obstacles);expect(current(obstacles)).toEqual(current(linear));
  for(const event of effects(current(obstacles).segments))expect(new Vector3(event.normal.x,event.normal.y,event.normal.z).length()).toBeCloseTo(1);
  for(const segment of legacy(obstacles).segments){expect(segment).not.toHaveProperty('entrySurface');expect(segment).not.toHaveProperty('exitSurface');}
 });
 it('retains floor authority while suppressing an exit fabricated at a clipped floor contact',()=>{
  const obstacle:Obstacle={box:new Box3(new Vector3(-2,-2,-4),new Vector3(2,2,-.5)),kind:'wall',color:0,material:'glass'},down=new Ray(new Vector3(0,1,0),new Vector3(0,-1,-1).normalize());
  const shot=traceBallisticRay(down,WEAPONS.rifleA,target(12),[obstacle],150,'materials-v3'),old=traceBallisticRay(down,WEAPONS.rifleA,target(12),[obstacle],150,'legacy-v2');
  expect(shot.stopReason).toBe('floor');expect(shot.point.y).toBeCloseTo(0);expect(shot.segments[0].exitSurface).toBe(false);expect(effects(shot.segments)).toHaveLength(1);expect(stripSurfaceFlags(shot)).toEqual(old);
 });
 it('preserves all four weapon budgets, damage and closest-target results for every boundary case',()=>{
  const scenes=[{obstacles:[panel(3,3.6,'thickWood'),panel(3.2,3.4,'glass')],distance:10,origin:0},{obstacles:[panel(3,3.4,'thinWood'),panel(3.1,3.2,'thinMetal')],distance:10,origin:0},{obstacles:[panel(3,3.6,'thinWood')],distance:3.2,origin:0},{obstacles:[panel(3,3.4,'thinWood')],distance:10,origin:-3.2}];
  for(const profile of Object.values(WEAPONS))for(const s of scenes){const r=ray(s.origin),t=target(s.distance);expect(stripSurfaceFlags(traceBallisticRay(r,profile,t,s.obstacles,150,'materials-v3'))).toEqual(traceBallisticRay(r,profile,t,s.obstacles,150,'legacy-v2'));}
 });
});
