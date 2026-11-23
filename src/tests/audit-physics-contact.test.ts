import {afterAll,describe,expect,it} from 'vitest';
import {Box3,Vector3} from 'three';
import {CollisionController} from '../engine/movement/CollisionController';
import {Movement} from '../engine/movement/Movement';
import type {Obstacle} from '../engine/collision/environment';
import type {SimulationRulesId} from '../engine/simulation/rules';
import {emptyInput} from '../engine/types';

const dt=1/120,rows:Record<string,unknown>[]=[];
const box=(min:[number,number,number],max:[number,number,number]):Obstacle=>({kind:'wall',color:0,box:new Box3(new Vector3(...min),new Vector3(...max))});
afterAll(()=>console.info(JSON.stringify({benchmark:'audit-physics-contact-20261110',fixedHz:120,rows})));
function landingJump(rules:SimulationRulesId,ceiling=true){
 const m=new Movement(undefined,ceiling?[box([-2,1.86,-2],[2,2,2])]:[]);
 m.setSimulationRules(rules);m.configurePhysics({movementPhysics:'counterStrike',csMovementPreset:'cs2',jumpBufferMs:80});
 m.reset({x:0,y:.01,z:0});m.grounded=false;m.velocity.y=-2;
 m.step({...emptyInput(),jump:true,jumpPresses:1,jumpRequestedAt:.001},0,dt,dt);
 return m;
}
describe('Current physics contact audit regressions',()=>{
 it('clips the real within-tick buffered CS2 jump remainder against the ceiling',()=>{
  const current=landingJump('materials-v3'),legacy=landingJump('legacy-v2');
  // Legacy's final vertical pass already caught this case. The new airborne
  // branch must keep that protection for a jump created after its first sweep.
  expect(legacy.position.y+1.85).toBeCloseTo(1.86,12);
  expect(legacy.velocity.y).toBe(0);
  expect(current.position.y+1.85).toBeCloseTo(1.86,12);
  expect(current.velocity.y).toBe(0);expect(current.grounded).toBe(false);
  expect(current.hopSnapshot().jumps).toBe(1);expect(current.landingSerial).toBe(1);
  expect(current.lastLandingTime).toBeCloseTo(legacy.lastLandingTime,12);
  rows.push({probe:'buffered-cs2-jump-ceiling',beforeAuditHeadY:1.8772730601803775,legacyHeadY:legacy.position.y+1.85,currentHeadY:current.position.y+1.85,ceilingY:1.86,currentVerticalSpeed:current.velocity.y,contactTime:current.lastLandingTime});
 });
 it('lands after the blocked rebound without remaining inside the roof or inventing jumps',()=>{
  const m=landingJump('materials-v3');
  for(let tick=2;tick<=120;tick++){m.step(emptyInput(),0,dt,tick*dt);expect(m.position.y).toBeGreaterThanOrEqual(0);expect(m.position.y+1.85).toBeLessThanOrEqual(1.86+1e-8);}
  expect(m.grounded).toBe(true);expect(m.position.y).toBe(0);expect(m.velocity.y).toBe(0);
  expect(m.hopSnapshot().jumps).toBe(1);expect(m.landingSerial).toBe(2);
 });
 it('retains the unblocked rebound trajectory and original landing timestamp exactly',()=>{
  const current=landingJump('materials-v3',false),legacy=landingJump('legacy-v2',false);
  expect(current.position.toArray()).toEqual(legacy.position.toArray());
  expect(current.velocity.toArray()).toEqual(legacy.velocity.toArray());
  expect(current.hopSnapshot()).toEqual(legacy.hopSnapshot());
  expect(current.lastLandingTime).toBeCloseTo(.004609711124769515,12);
 });
 for(const axis of ['x','z'] as const)for(const ascending of [-1,1] as const)it(`checks the high footprint edge when restoring over a steep ${axis} ramp (${ascending})`,()=>{
  const wedge:Obstacle={...box([-1,0,-1],[1,3,1]),ramp:{axis,ascending,low:0,high:3}},position=new Vector3(0,1.6,0);
  const current=new CollisionController([wedge]),legacy=new CollisionController([wedge]);legacy.setSimulationRules('legacy-v2');
  expect(legacy.canOccupy(position,1.85,.28)).toBe(true);
  expect(current.canOccupy(position,1.85,.28)).toBe(false);
  expect(current.canOccupy(new Vector3(0,1.92,0),1.85,.28)).toBe(true);
  // An intentionally permissive slope uses its documented centre-plane anchor.
  expect(current.canOccupy(position,1.85,.28,.5)).toBe(true);
 });
 it('rejects an airborne saved pose intersecting the same steep collision volume without mutating live state',()=>{
  const wedge:Obstacle={...box([-1,0,-1],[1,3,1]),ramp:{axis:'z',ascending:1,low:0,high:3}},m=new Movement(undefined,[wedge]);
  m.reset({x:0,y:3.5,z:0});m.grounded=false;m.step(emptyInput(),0,dt,dt);
  const before=m.capturePracticePose('audit',0,0),invalid=structuredClone(before);invalid.position.y=1.6;
  const result=m.restorePracticePose(invalid,'audit',dt,[-2,-2,4,4]);
  expect(result.ok).toBe(false);expect(result.reason).toContain('벽이나 천장');
  expect(m.capturePracticePose('audit',0,0)).toEqual(before);
  rows.push({probe:'steep-restore-occupancy',centerPlaneMeters:1.5,footprintHighPlaneMeters:1.92,invalidFootMeters:1.6,restoreAccepted:result.ok});
 });
});
