import {describe,it,expect} from 'vitest';
import {Box3,Ray,Vector3} from 'three';
import {DEFAULT_SETTINGS} from '../config/settings';
import {DefenderAI,intersectPlayerBody,playerVisibilitySamples,type PlayerBody,type DefenderSector} from '../engine/tactical/DefenderAI';
import {Target} from '../engine/targets/Target';
import {SeededRandom} from '../engine/simulation/random';
import type {Obstacle} from '../engine/collision/environment';
import type {Settings,GunId,WeaponId} from '../engine/types';
import {standingSpace} from '../engine/tactical/levels';

const dt=1/120;
const player=(overrides:Partial<PlayerBody>={}):PlayerBody=>({position:{x:0,y:0,z:0},velocity:{x:0,y:0,z:0},eyeHeight:1.64,crouch:0,grounded:true,yaw:0,pitch:0,...overrides});
const wall=(x:number,z:number,w:number,d:number,h=3):Obstacle=>({box:new Box3(new Vector3(x-w/2,0,z-d/2),new Vector3(x+w/2,h,z+d/2)),kind:'wall',color:0});
function setup(weapon:GunId='operator',obstacles:Obstacle[]=[],settings:Partial<Settings>={},sectors:DefenderSector[]=[{facingYaw:0}]){
 const target=new Target(0,'stationary',new SeededRandom(2));target.spawn(0,-10,0);
 const ai=new DefenderAI([target],obstacles,{...DEFAULT_SETTINGS,exposureEnabled:false,defenderReposition:0,defenderReaction:.15,defenderAccuracy:.98,defenderWeapon:weapon,...settings},{x:0,y:0,z:0},73,sectors);
 return{ai,target};
}
function step(ai:DefenderAI,p:PlayerBody,seconds:number,start=0){for(let i=0;i<Math.round(seconds/dt);i++)ai.step(dt,start+i*dt,p);}

describe('Defender physical perception and player hit volumes',()=>{
 it('rotates shoulder samples with player yaw and lowers every human sample when crouched',()=>{
  const standing=playerVisibilitySamples(player()),turned=playerVisibilitySamples(player({yaw:Math.PI/2})),crouched=playerVisibilitySamples(player({eyeHeight:1.05,crouch:1}));
  expect(standing[4].x).toBeCloseTo(-.34);expect(turned[4].x).toBeCloseTo(0);expect(turned[4].z).toBeCloseTo(.34);
  expect(crouched[0].y).toBeLessThan(standing[0].y);expect(crouched[3].y).toBeLessThan(standing[3].y);expect(crouched[8].y).toBeLessThan(standing[8].y);
 });
 it('intersects head, torso, shoulder and leg at their actual translated position',()=>{
  const p=player({position:{x:3,y:2,z:5}}),out=new Vector3();
  for(const [x,y,region] of [[0,1.68,'head'],[0,1.15,'torso'],[.34,1.2,'arm'],[.13,.3,'leg']] as const){
   const hit=intersectPlayerBody(new Ray(new Vector3(3+x,2+y,0),new Vector3(0,0,1)),p,out);
   expect(hit?.region).toBe(region);expect(out.z).toBeGreaterThan(4.7);expect(out.z).toBeLessThan(5);
  }
  expect(intersectPlayerBody(new Ray(new Vector3(4,3.2,0),new Vector3(0,0,1)),p,out)).toBeNull();
 });
 it('yaw changes shoulder geometry and crouching physically removes the standing head volume',()=>{
  const out=new Vector3(),ray=new Ray(new Vector3(.34,1.2,-5),new Vector3(0,0,1));
  expect(intersectPlayerBody(ray,player(),out)?.region).toBe('arm');
  expect(intersectPlayerBody(ray,player({yaw:Math.PI/2}),out)).toBeNull();
  const headRay=new Ray(new Vector3(0,1.68,-5),new Vector3(0,0,1));
  expect(intersectPlayerBody(headRay,player({eyeHeight:1.05,crouch:1}),out)).toBeNull();
 });
 it('cannot acquire, fire or accumulate exposure through a solid wall',()=>{
  const {ai}=setup('operator',[wall(0,-5,4,1)],{exposureEnabled:true,exposureLimit:.5});
  step(ai,player(),3);expect(ai.shots).toHaveLength(0);expect(ai.memories[0].visible).toBe(0);expect(ai.memories[0].known).toBeNull();expect(ai.death).toBeNull();expect(ai.report.exposure).toBe(0);
 });
 it('requires a fresh unblocked physical sightline when firing between perception updates',()=>{
  const obstacles:Obstacle[]=[],{ai}=setup('operator',obstacles);const p=player();
  ai.step(dt,0,p);expect(ai.memories[0].visible).toBeGreaterThan(0);ai.memories[0].acquired=1;
  obstacles.push(wall(0,-5,4,1));ai.step(dt,.008,p);
  expect(ai.perceptionUpdates).toBe(1);expect(ai.shots).toHaveLength(0);expect(ai.memories[0].visible).toBe(0);
 });
 it('does not see a player behind its holding direction without a genuine audible observation',()=>{
  const {ai}=setup('operator',[],{},[{facingYaw:Math.PI}]);step(ai,player(),1);
  expect(ai.shots).toHaveLength(0);expect(ai.memories[0].known).toBeNull();
 });
});

describe('Defender information limits, cadence and navigation',()=>{
 it('records only actual in-range emitted footsteps and retains the old sound position behind cover',()=>{
  const {ai}=setup('operator',[wall(0,-5,4,1)]);
  ai.hear({id:1,timestamp:0,position:{x:0,y:0,z:0},radius:5,speed:5.4});expect(ai.report.heardEvents).toBe(0);
  ai.hear({id:2,timestamp:0,position:{x:0,y:0,z:0},radius:20,speed:5.4});expect(ai.report.heardEvents).toBe(1);
  step(ai,player({position:{x:.5,y:0,z:1}}),1);
  expect(ai.memories[0].known).toEqual({x:0,y:0,z:0});expect(ai.shots).toHaveLength(0);expect(ai.report.exposure).toBe(0);
  step(ai,player({position:{x:.5,y:0,z:1}}),2,1);expect(ai.memories[0].known).toBeNull();
 });
 it('Operator shots respect the real bolt recovery even during continuous exposure',()=>{
  const {ai}=setup();ai.health=1e6;step(ai,player(),7);const shots=ai.shots;
  expect(shots.length).toBeGreaterThanOrEqual(3);
  for(let i=1;i<shots.length;i++){expect(shots[i].time-shots[i-1].time).toBeGreaterThanOrEqual(1/.6-1e-9);expect(shots[i].time).toBeGreaterThanOrEqual(shots[i-1].recoveryUntil);}
  expect(ai.report.observedRecoveryUntil).toBeGreaterThan(0);
 });
 it('rifle burst cadence and deliberate Sheriff shots differ from Operator recovery',()=>{
  const gaps:Partial<Record<WeaponId,number[]>>={};for(const id of ['rifleA','sheriff','operator'] as const){const {ai}=setup(id);ai.health=1e6;step(ai,player(),4);gaps[id]=ai.shots.slice(1).map((s,i)=>s.time-ai.shots[i].time);expect(gaps[id]!.length).toBeGreaterThan(0);}
  expect(Math.min(...gaps.rifleA!)).toBeLessThan(.2);expect(Math.min(...gaps.sheriff!)).toBeGreaterThanOrEqual(.65);expect(Math.min(...gaps.operator!)).toBeGreaterThanOrEqual(1/.6);
 });
 it('moves continuously along valid cover routes without entering walls or exceeding speed limits',()=>{
  const obstacles=[wall(1,-10,.8,2)],{ai,target}=setup('operator',obstacles,{defenderReposition:1,targetSpeed:1},[{facingYaw:0,alternatives:[{x:3,y:0,z:-10}]}]);ai.health=1e6;
  let moved=0,firstSpeed:number|null=null,last=target.position.clone();for(let i=0;i<900;i++){ai.step(dt,i*dt,player());const distance=last.distanceTo(target.position);expect(distance).toBeLessThanOrEqual(3.2*dt+1e-7);expect(target.velocity.length()).toBeCloseTo(distance/dt,7);expect(standingSpace(obstacles,target.position,.3)).toBe(true);if(distance>0&&firstSpeed===null)firstSpeed=distance/dt;moved+=distance;last.copy(target.position);}
  expect(moved).toBeGreaterThan(1);expect(firstSpeed).toBeLessThan(.1);expect(target.velocity.length()).toBe(0);
 });
 it('cannot teleport from a platform across an unsupported vertical drop',()=>{
  const platform:Obstacle={box:new Box3(new Vector3(-1,0,-11),new Vector3(1,2.4,-9)),kind:'cover',color:0};const {ai,target}=setup('operator',[platform],{defenderReposition:1},[{facingYaw:0,alternatives:[{x:3,y:0,z:-10}]}]);target.spawn(0,-10,0,2.4);ai.retry();ai.health=1e6;step(ai,player(),5);expect(target.position.y).toBeCloseTo(2.4);expect(target.position.x).toBeCloseTo(0);
 });
 it('produces identical decisions for identical seeds and body motion',()=>{
  const a=setup('rifleA',[],{defenderReposition:1}),b=setup('rifleA',[],{defenderReposition:1});a.ai.health=b.ai.health=1e6;
  for(let i=0;i<600;i++){const p=player({position:{x:Math.sin(i/70),y:0,z:0}});a.ai.step(dt,i*dt,p);b.ai.step(dt,i*dt,p);}
  expect(a.ai.shots).toEqual(b.ai.shots);expect(a.target.position.toArray()).toEqual(b.target.position.toArray());
 });
 it('snapshots do not expose mutable report references and retries preserve session counters',()=>{
  const {ai}=setup();ai.health=1e6;step(ai,player({scoped:true}),.5);const snapshot=ai.snapshot();expect(snapshot.operator.holdingSeconds).toBeGreaterThan(.4);snapshot.path[0].x=999;snapshot.operator.holdingSeconds=999;
  expect(ai.report.path[0].x).toBe(0);expect(ai.report.operator.holdingSeconds).toBeLessThan(1);const count=ai.report.enemyShots;ai.retry();expect(ai.report.enemyShots).toBe(count);expect(ai.health).toBe(150);expect(ai.death).toBeNull();
 });
 it('counts current cleared and uncleared angles independently of historical retry totals',()=>{
  const {ai,target}=setup(),disabled=new Target(1,'stationary',new SeededRandom(3));disabled.enabled=false;disabled.active=false;ai.targets.push(disabled);
  const before=ai.snapshot();expect(before.totalAngles).toBe(1);expect(before.currentClears).toBe(0);expect(before.unclearedAngles).toBe(1);
  target.eliminate(0);ai.eliminated(0);const cleared=ai.snapshot();expect(cleared.totalAngles).toBe(1);expect(cleared.currentClears).toBe(1);expect(cleared.unclearedAngles).toBe(0);expect(cleared.clears).toBe(1);
  target.spawn(0,-10,1);ai.retry();const retried=ai.snapshot();expect(retried.currentClears).toBe(0);expect(retried.unclearedAngles).toBe(1);expect(retried.clears).toBe(1);
  expect(ai.report.totalAngles).toBeUndefined();expect(ai.report.currentClears).toBeUndefined();expect(ai.report.unclearedAngles).toBeUndefined();
  retried.currentClears=99;expect(ai.snapshot().currentClears).toBe(0);expect(cleared.currentClears).toBe(1);
 });
});
