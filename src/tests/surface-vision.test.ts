import {describe,expect,it} from 'vitest';
import {Box3,Ray,Vector3} from 'three';
import {DEFAULT_SETTINGS} from '../config/settings';
import {PENETRATION_WEAPONS} from '../config/penetration';
import {SURFACES,type SurfaceId} from '../config/surfaces';
import {WEAPONS} from '../config/weapons';
import {environmentOccluded,nearestEnvironmentHit,type Obstacle} from '../engine/collision/environment';
import {traceBallisticRay} from '../engine/collision/Ballistics';
import {CollisionController} from '../engine/movement/CollisionController';
import {SeededRandom} from '../engine/simulation/random';
import type {SimulationRulesId} from '../engine/simulation/rules';
import {DefenderAI,type PlayerBody} from '../engine/tactical/DefenderAI';
import {Exposure} from '../engine/tactical/Exposure';
import {visibleBetween} from '../engine/tactical/levels';
import {Target} from '../engine/targets/Target';

const dt=1/120,a={x:0,y:1.68,z:0},b={x:0,y:1.68,z:-10};
const panel=(surfaceId:SurfaceId):Obstacle=>({box:new Box3(new Vector3(-2,0,-5.2),new Vector3(2,3,-5)),kind:'wall',color:0,surfaceId});
const ray=()=>new Ray(new Vector3(a.x,a.y,a.z),new Vector3(0,0,-1));
const player:PlayerBody={position:{x:0,y:0,z:0},velocity:{x:0,y:0,z:0},eyeHeight:1.64,crouch:0,grounded:true,yaw:0,pitch:0};
function target(){const t=new Target(0,'stationary',new SeededRandom(2));t.spawn(0,-10,0);return t;}

describe('Versioned sight transmission uses physical surface rules',()=>{
 it('sees through glass only under current rules while concrete and explicit material overrides block sight',()=>{
  const glass=panel('glass');
  expect(visibleBetween([glass],a,b)).toBe(false);expect(visibleBetween([glass],a,b,'legacy-v2')).toBe(false);
  expect(environmentOccluded(ray(),10,[glass])).toBe(true);expect(environmentOccluded(ray(),10,[glass],'materials-v3')).toBe(false);
  expect(visibleBetween([glass],a,b,'materials-v3')).toBe(true);
  expect(visibleBetween([panel('concrete')],a,b,'materials-v3')).toBe(false);
  expect(visibleBetween([{...glass,material:'concrete'}],a,b,'materials-v3')).toBe(false);
  // Runtime audio uses the default geometric query, so the pane remains a sound barrier.
  expect(visibleBetween([glass],a,b)).toBe(false);
 });
 it('retains glass collision and the original penetration resistance budget',()=>{
  const glass=panel('glass'),position=new Vector3(0,0,-4),velocity=new Vector3(0,0,-20),collision=new CollisionController([glass]);
  collision.setSimulationRules('materials-v3');
  collision.moveHorizontal(position,velocity,.1,{radius:.28,bodyHeight:1.85,grounded:true,stepHeight:.3,maxSlopeCos:Math.SQRT1_2});
  expect(position.z).toBeCloseTo(-4.72);expect(velocity.z).toBe(0);
  expect(nearestEnvironmentHit(ray(),10,new Vector3(),[glass])).toBe(5);
  const trace=traceBallisticRay(ray(),WEAPONS.rifleA,{zone:'torso',distance:10,point:b},[glass],150,'materials-v3');
  const cost=.2*SURFACES.glass.penetrationResistance;
  expect(trace.zone).toBe('torso');expect(trace.segments[0].material).toBe('glass');expect(trace.segments[0].cost).toBeCloseTo(cost);
  expect(trace.remainingPower).toBeCloseTo(PENETRATION_WEAPONS.medium.power-cost);
  expect(trace.damageScale).toBeCloseTo(SURFACES.glass.penetrationRetention*Math.exp(-cost/PENETRATION_WEAPONS.medium.power*PENETRATION_WEAPONS.medium.loss));
  expect(traceBallisticRay(ray(),WEAPONS.rifleA,{zone:'torso',distance:10,point:b},[panel('concrete')],150,'materials-v3').stopReason).toBe('capacity');
 });
 for(const [surfaceId,rules,sees] of [['glass','materials-v3',true],['glass','legacy-v2',false],['concrete','materials-v3',false]] as const){
  it(`${surfaceId}/${rules}: defender acquisition and exposure use the same sight rule`,()=>{
   const t=target(),obstacles=[panel(surfaceId)],settings={...DEFAULT_SETTINGS,defenderReposition:0,combatMode:'learning' as const,exposureEnabled:true,exposureLimit:.5};
   const ai=new DefenderAI([t],obstacles,settings,{x:0,y:0,z:0},73,[{facingYaw:0}]);ai.setSimulationRules(rules as SimulationRulesId);ai.step(dt,0,player);
   expect(ai.memories[0].visible>0).toBe(sees);expect(ai.memories[0].known!==null).toBe(sees);
   const exposure=new Exposure(1);exposure.step([t],player.position,player.eyeHeight,obstacles,settings,dt,1,[],()=>0,rules);
   expect(exposure.values[0]>0).toBe(sees);
  });
 }
});
