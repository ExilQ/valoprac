import {describe,expect,it,afterAll} from 'vitest';
import {Box3,Vector3} from 'three';
import {CollisionController,type HorizontalCollisionOptions} from '../engine/movement/CollisionController';
import {Movement} from '../engine/movement/Movement';
import {emptyInput} from '../engine/types';
import type {Obstacle} from '../engine/collision/environment';
import type {SimulationRulesId} from '../engine/simulation/rules';

const box=(min:[number,number,number],max:[number,number,number]):Obstacle=>({kind:'wall',color:0,box:new Box3(new Vector3(...min),new Vector3(...max))});
const options:HorizontalCollisionOptions={radius:.28,bodyHeight:1.85,grounded:true,stepHeight:.3,maxSlopeCos:Math.SQRT1_2,minLandingWidth:.1};
const rows:Record<string,unknown>[]=[];
afterAll(()=>console.info(JSON.stringify({benchmark:'physics-materials-collision',fixedHz:120,rows})));
function solver(obstacles:Obstacle[],rules:SimulationRulesId){const c=new CollisionController(obstacles);c.setSimulationRules(rules);return c;}

describe('Versioned square-footprint contact regressions',()=>{
 for(const ascending of [-1,1] as const)it(`sweeps the entire steep wedge before its far endpoint (ascending ${ascending})`,()=>{
  const wedge={...box([0,0,-2],[1,2,2]),ramp:{axis:'x' as const,low:0,high:2,ascending}};
  const current=solver([wedge],'materials-v3'),legacy=solver([wedge],'legacy-v2');
  const p=new Vector3(ascending===-1?-1:2,0,0),before=p.clone(),v=new Vector3(ascending===-1?100000:-100000,0,0),oldV=v.clone();
  const blocked=current.moveHorizontal(p,v,1,options);legacy.moveHorizontal(before,oldV,1,options);
  expect(blocked&1).toBe(1);expect(p.x).toBeCloseTo(ascending===-1?-.28:1.28,8);expect(v.x).toBe(0);
  expect(Math.abs(before.x)).toBeGreaterThan(1000);
  rows.push({probe:'high-speed-wedge',ascending,legacy:before.toArray(),current:p.toArray()});
 });
 it('sweeps simultaneous diagonal corner contact even beyond the subdivision cap',()=>{
  const obstacles=[box([0,0,0],[.01,4,.01])],p=new Vector3(-1,0,-1),old=p.clone(),v=new Vector3(100000,0,100000),oldV=v.clone();
  solver(obstacles,'legacy-v2').moveHorizontal(old,oldV,1,options);
  const blocked=solver(obstacles,'materials-v3').moveHorizontal(p,v,1,options);
  expect(blocked).toBe(3);expect(p.toArray()).toEqual([-.28,0,-.28]);expect(v.length()).toBe(0);expect(old.x).toBeGreaterThan(1000);
  rows.push({probe:'high-speed-diagonal-corner',legacy:old.toArray(),current:p.toArray()});
 });
 it('updates support between several risers crossed inside one movement tick',()=>{
  const stairs=[box([0,0,-1],[1,.2,1]),box([1,0,-1],[2,.4,1]),box([2,0,-1],[4,.6,1])],p=new Vector3(-1,0,0),old=p.clone(),v=new Vector3(50,0,0),oldV=v.clone();
  solver(stairs,'legacy-v2').moveHorizontal(old,oldV,.08,options);solver(stairs,'materials-v3').moveHorizontal(p,v,.08,options);
  expect(p.x).toBeCloseTo(3);expect(p.y).toBeCloseTo(.6);expect(v.x).toBe(50);expect(old.x).toBeLessThan(1);expect(old.y).toBe(0);
  rows.push({probe:'multiple-risers',legacy:old.toArray(),current:p.toArray()});
 });
 it('never lifts onto a distant step behind an earlier blocking wall regardless of array order',()=>{
  const wall=box([0,0,-1],[.2,.4,1]),step=box([1,0,-1],[2,.2,1]);
  for(const obstacles of [[wall,step],[step,wall]]){const p=new Vector3(-1,0,0),v=new Vector3(100000,0,0);solver(obstacles,'materials-v3').moveHorizontal(p,v,1,options);expect(p.x).toBeCloseTo(-.28);expect(p.y).toBe(0);expect(v.x).toBe(0);}
 });
 it('requires configured available tread width before stepping onto a narrow sliver',()=>{
  const tread=box([0,0,-1],[.01,.2,1]);
  const blocked=new Vector3(-.3,0,0),accepted=blocked.clone(),old=blocked.clone();
  solver([tread],'materials-v3').moveHorizontal(blocked,new Vector3(.6,0,0),.5,options);
  solver([tread],'materials-v3').moveHorizontal(accepted,new Vector3(.6,0,0),.5,{...options,minLandingWidth:.005});
  const legacy=solver([tread],'legacy-v2');legacy.moveHorizontal(old,new Vector3(.6,0,0),.5,options);
  expect(blocked.x).toBeCloseTo(-.28);expect(blocked.y).toBe(0);expect(accepted.x).toBeCloseTo(0);expect(accepted.y).toBe(.2);expect(legacy.support(old,.3).height).toBe(.2);
  rows.push({probe:'minimum-tread-width',widthMeters:.01,minWidthMeters:.1,legacySupport:legacy.support(old,.3).height,current:blocked.toArray(),narrowAllowed:accepted.toArray()});
 });
 it('supports a square-footprint ledge overhang until horizontal overlap is lost',()=>{
  const c=solver([box([-1,0,-1],[1,1,1])],'materials-v3');
  expect(c.support(new Vector3(1.01,1,0),1.01).height).toBe(0);
  expect(c.supportFootprint(new Vector3(1.01,1,0),1.01,.28).height).toBe(1);
  expect(c.supportFootprint(new Vector3(1.281,1,0),1.01,.28).height).toBe(0);
 });
 for(const id of ['valorant','counterStrike'] as const)it(`${id}: steep contact slides down instead of suspending an airborne body`,()=>{
  const wedge={...box([-1,0,-1],[1,3,0]),ramp:{axis:'z' as const,low:0,high:3,ascending:-1 as const}};
  const run=(rules:SimulationRulesId)=>{const m=new Movement(undefined,[wedge]);m.setSimulationRules(rules);m.configurePhysics({movementPhysics:id,csMovementPreset:'cs2',jumpBufferMs:80});m.reset({x:0,y:2.34,z:-.5});m.grounded=false;for(let i=1;i<=180;i++)m.step(emptyInput(),0,1/120,i/120);return m;};
  const legacy=run('legacy-v2'),current=run('materials-v3');
  expect(current.position.z).toBeGreaterThan(-.2);expect(current.position.y).toBeLessThan(legacy.position.y);expect(current.grounded).toBe(true);expect(current.hopSnapshot().jumps).toBe(0);
  rows.push({probe:'steep-slide',profile:id,legacy:legacy.position.toArray(),current:current.position.toArray()});
 });
 it('clips a rising body crossing a ceiling corner between both tick endpoints',()=>{
  const ceiling=box([0,1.99,0],[.01,2.1,.01]);
  const run=(rules:SimulationRulesId)=>{const m=new Movement(undefined,[ceiling]);m.setSimulationRules(rules);m.configurePhysics({movementPhysics:'counterStrike',csMovementPreset:'sourceClassic',jumpBufferMs:80});m.reset({x:-.35,y:.11,z:.2});m.grounded=false;m.velocity.set(20,7,20);m.step(emptyInput(),0,1/120,1/120);return m;};
  const legacy=run('legacy-v2'),current=run('materials-v3');
  expect(legacy.position.y+1.85).toBeGreaterThan(1.99);expect(legacy.velocity.y).toBeGreaterThan(6);
  expect(current.position.y+1.85).toBeCloseTo(1.99,10);expect(current.velocity.y).toBe(0);expect(current.grounded).toBe(false);expect(current.landingSerial).toBe(0);
  expect(current.position.x).toBeCloseTo(legacy.position.x,12);expect(current.position.z).toBeCloseTo(legacy.position.z,12);
  rows.push({probe:'transient-ceiling-corner',legacy:legacy.position.toArray(),legacyVerticalSpeed:legacy.velocity.y,current:current.position.toArray(),currentVerticalSpeed:current.velocity.y});
 });
 it('rejects stair elevation when its real raised body intersects an overhead ceiling',()=>{
  const obstacles=[box([0,0,-1],[2,.2,1]),box([0,2,-1],[2,2.4,1])];
  const standing=new Vector3(-1,0,0),crouched=standing.clone();
  solver(obstacles,'materials-v3').moveHorizontal(standing,new Vector3(20,0,0),.1,options);
  solver(obstacles,'materials-v3').moveHorizontal(crouched,new Vector3(20,0,0),.1,{...options,bodyHeight:1.35});
  expect(standing.x).toBeCloseTo(-.28);expect(standing.y).toBe(0);expect(crouched.x).toBeCloseTo(1);expect(crouched.y).toBe(.2);expect(crouched.y+1.35).toBeLessThan(2);
 });
});
