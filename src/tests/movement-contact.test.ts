import {describe,it,expect} from 'vitest';
import {Box3,Vector3} from 'three';
import {CollisionController,type HorizontalCollisionOptions} from '../engine/movement/CollisionController';
import type {Obstacle} from '../engine/collision/environment';
import {LEVELS} from '../engine/tactical/levels';
const box=(min:readonly[number,number,number],max:readonly[number,number,number]):Obstacle=>({box:new Box3(new Vector3(...min),new Vector3(...max)),kind:'wall',color:0});
const options:HorizontalCollisionOptions={radius:.28,bodyHeight:1.85,grounded:true,stepHeight:.3,maxSlopeCos:Math.SQRT1_2};
describe('Shared profile-independent movement contacts',()=>{
 it('reports a true top-plane support and normal, independent of vertical velocity',()=>{
  const c=new CollisionController([box([-1,0,-1],[1,.7,1])]),p=new Vector3(0,.7,0);
  const contact=c.support(p,.71);expect(contact.height).toBe(.7);expect(contact.walkable).toBe(true);expect(contact.normal.toArray()).toEqual([0,1,0]);
  expect(c.support(p,.6).height).toBe(0);p.x=2;expect(c.support(p,10).height).toBe(0);
 });
 it('uses the authored sloped normal instead of the ramp bounding-box top',()=>{
  const ramp={...box([-1,0,-4],[1,2,0]),ramp:{axis:'z' as const,low:0,high:2,ascending:-1 as const}},c=new CollisionController([ramp]),contact=c.support(new Vector3(0,1,-2),1.01);
  expect(contact.height).toBeCloseTo(1);expect(contact.normal.y).toBeCloseTo(1/Math.sqrt(1.25));expect(contact.normal.z).toBeCloseTo(.5/Math.sqrt(1.25));expect(contact.walkable).toBe(true);
 });
 it('retains a steep physical contact but never marks it walkable or step-climbs its face',()=>{
  const ramp={...box([-1,0,-1],[1,3,0]),ramp:{axis:'z' as const,low:0,high:3,ascending:-1 as const}},c=new CollisionController([ramp]);const contact=c.support(new Vector3(0,2,-.5),2.1);
  expect(contact.height).toBe(1.5);expect(contact.walkable).toBe(false);expect(contact.normal.y).toBeLessThan(Math.SQRT1_2);
  const p=new Vector3(0,0,.5),v=new Vector3(0,0,-20);c.moveHorizontal(p,v,.1,options);expect(p.z).toBeCloseTo(.28);expect(v.z).toBe(0);expect(p.y).toBe(0);
 });
 it('sweeps through a complete thin-wall crossing while preserving tangential motion',()=>{
  const wall=box([0,0,-20],[.01,4,20]),c=new CollisionController([wall]),p=new Vector3(-1,0,0),v=new Vector3(1000,0,3);
  expect(c.moveHorizontal(p,v,.1,options)&1).toBe(1);expect(p.x).toBeCloseTo(-.28);expect(p.z).toBeCloseTo(.3);expect(v.x).toBe(0);expect(v.z).toBe(3);
 });
 it('does not snag a tangent slider or pull a body travelling away back into a wall',()=>{
  const c=new CollisionController([box([0,0,-5],[1,4,5])]),p=new Vector3(-.28,0,0),v=new Vector3(0,0,4);c.moveHorizontal(p,v,.1,options);expect(p.toArray()).toEqual([-.28,0,.4]);
  v.set(-4,0,0);c.moveHorizontal(p,v,.1,options);expect(p.x).toBeCloseTo(-.68);expect(v.x).toBe(-4);
 });
 it('stops both independent corner axes without penetrating either obstacle',()=>{
  const c=new CollisionController([box([0,0,-5],[.04,4,5]),box([-5,0,0],[5,4,.04])]),p=new Vector3(-1,0,-1),v=new Vector3(20,0,20);
  expect(c.moveHorizontal(p,v,.2,options)).toBe(3);expect(p.x).toBeCloseTo(-.28);expect(p.z).toBeCloseTo(-.28);expect(v.length()).toBe(0);
 });
 it('clips rising standing and crouched bodies against a crossed ceiling underside',()=>{
  const c=new CollisionController([box([-2,2,-2],[2,2.2,2])]);for(const height of[1.35,1.85]){const p=new Vector3(0,.8,0),v=new Vector3(0,5,0);expect(c.resolveCeiling(p,v,0,height,.28)).toBe(true);expect(p.y+height).toBeCloseTo(2);expect(v.y).toBe(0);}
  const p=new Vector3(0,.5,0),v=new Vector3(0,-3,0);expect(c.resolveCeiling(p,v,0,1.85,.28)).toBe(false);expect(p.y).toBe(.5);
 });
 it('prevents standing into a low ceiling without making an existing floor obstruct the head',()=>{
  const c=new CollisionController([box([-1,1.6,-1],[1,2,1])]);expect(c.canStand(new Vector3(0,0,0),1.35,1.85,.28)).toBe(false);expect(c.canStand(new Vector3(3,0,0),1.35,1.85,.28)).toBe(true);
  const floor=new CollisionController([box([-1,0,-1],[1,2,1])]);expect(floor.canStand(new Vector3(0,2,0),1.35,1.85,.28)).toBe(true);
 });
 it('keeps every existing authored tactical ramp walkable under the shared slope limit',()=>{
  for(const level of Object.values(LEVELS)){const c=new CollisionController(level.obstacles);for(const ramp of level.obstacles.filter(o=>o.ramp)){const p=ramp.box.getCenter(new Vector3()),contact=c.support(p,ramp.box.max.y+.01);expect(contact.walkable,level.id).toBe(true);expect(contact.normal.y).toBeGreaterThan(Math.SQRT1_2);}}
 });
 it('allows actual 20cm staircase steps but blocks a high platform side',()=>{
  const c=new CollisionController(LEVELS.tower.obstacles),p=new Vector3(0,0,2),v=new Vector3(0,0,-2.5);
  for(let tick=0;tick<400;tick++){v.z=-2.5;c.moveHorizontal(p,v,1/120,options);const support=c.support(p,p.y+.3);p.y=support.height;}
  expect(p.y).toBeCloseTo(1.2);expect(p.z).toBeLessThan(-6);
  const high=new CollisionController([box([0,0,-2],[3,2.4,2])]),q=new Vector3(-1,0,0),speed=new Vector3(20,0,0);high.moveHorizontal(q,speed,.1,options);expect(q.x).toBeCloseTo(-.28);expect(q.y).toBe(0);
 });
 it('rejects a step that would push a standing head through an overhead ceiling',()=>{
  const c=new CollisionController([box([-2,0,-2],[2,.2,0]),box([-2,2,-2],[2,2.3,0])]);
  const standing=new Vector3(0,0,1),a=new Vector3(0,0,-3);c.moveHorizontal(standing,a,.5,options);expect(standing.z).toBeCloseTo(.28);expect(a.z).toBe(0);
  const crouched=new Vector3(0,0,1),b=new Vector3(0,0,-3);c.moveHorizontal(crouched,b,.5,{...options,bodyHeight:1.35});expect(crouched.z).toBeLessThan(0);expect(c.support(crouched,.3).height).toBe(.2);
 });
});
