import {describe,it,expect} from 'vitest';
import {Box3,Vector3} from 'three';
import {DEFAULT_SETTINGS} from '../config/settings';
import {DefenderAI,type PlayerBody} from '../engine/tactical/DefenderAI';
import {Target} from '../engine/targets/Target';
import {SeededRandom} from '../engine/simulation/random';
import {Movement} from '../engine/movement/Movement';
import {emptyInput,type Settings} from '../engine/types';
import type {Obstacle} from '../engine/collision/environment';
import evidence from '../../docs/roadmap/F4_MEASUREMENTS.json';

const dt=1/120,skills=['beginner','normal','advanced','expert'] as const;
const median=(values:number[])=>{const n=values.slice().sort((a,b)=>a-b);return(n[(n.length-1)>>1]+n[n.length>>1])/2;};
function body(x=0,vx=0):PlayerBody{return{position:{x,y:0,z:0},velocity:{x:vx,y:0,z:0},eyeHeight:1.64,crouch:0,grounded:true,yaw:0,pitch:0};}
function fixture(settings:Partial<Settings>,seed:number,obstacles:Obstacle[]=[]){
 const target=new Target(0,'stationary',new SeededRandom(seed));target.spawn(0,-20,0);
 const ai=new DefenderAI([target],obstacles,{...DEFAULT_SETTINGS,defenderWeapon:'rifleA',defenderReposition:0,exposureEnabled:false,combatMode:'gunfight',...settings},{x:0,y:0,z:0},seed,[{facingYaw:0}]);
 return{ai,target,obstacles};
}
function first(settings:Partial<Settings>,seed:number,x=0){const{ai}=fixture(settings,seed);ai.health=1e6;for(let i=0;i<360&&!ai.shots.length;i++)ai.step(dt,i*dt,body(x));return ai;}
function timingRows(){return[false,true].flatMap(minimum=>skills.map(defenderSkill=>{const samples=Array.from({length:64},(_,i)=>first({defenderSkill,...minimum?{defenderReaction:.15}:{}},i+1).shots[0]?.time??Infinity);return{skill:defenderSkill,minimum,count:samples.length,median:median(samples),min:Math.min(...samples),max:Math.max(...samples),samples};}));}
const cover:Obstacle={box:new Box3(new Vector3(-10,0,-1.2),new Vector3(0,4,-.8)),kind:'wall',material:'concrete',color:0};
function movementRoute(kind:'jiggle'|'wide-return'|'overstay'){
 const movement=new Movement(undefined,[cover]);movement.reset({x:kind==='jiggle'?-.65:-1,y:0,z:0});
 const out:PlayerBody[]=[],outTime=kind==='jiggle'?.2:.34,hold=kind==='overstay'?.9:0,start=movement.position.x;let returned=false;
 for(let i=0;i<Math.ceil((outTime*2+hold+.7)/dt);i++){
  const time=i*dt,input=emptyInput();if(time>=outTime+hold&&movement.position.x<=start)returned=true;input.strafe=time<outTime?1:time<outTime+hold?0:returned?0:-1;
  movement.step(input,0,dt,time);out.push({position:{...movement.position},velocity:{...movement.velocity},eyeHeight:movement.eyeHeight,crouch:movement.crouch,grounded:movement.grounded,yaw:0,pitch:0});
 }
 return out;
}
const routes=(['jiggle','wide-return','overstay']as const).map(name=>({name,samples:movementRoute(name)}));
function survivalRows(){return skills.flatMap(defenderSkill=>routes.map(route=>{
 const samples=Array.from({length:64},(_,i)=>{const{ai}=fixture({defenderSkill},i+1,[cover]);for(let n=0;n<route.samples.length&&!ai.death;n++)ai.step(dt,n*dt,route.samples[n]);return{seed:i+1,survived:!ai.death,health:Math.max(0,ai.health),shots:ai.report.enemyShots,exposure:ai.report.exposure,deathCause:ai.death?.cause??null,firstShot:ai.shots[0]?.time??null};});
 return{skill:defenderSkill,route:route.name,survivalRate:samples.filter(s=>s.survived).length/samples.length,shots:samples.reduce((n,s)=>n+s.shots,0),meanExposure:samples.reduce((n,s)=>n+s.exposure,0)/samples.length,samples};
}));}

describe('F4 evidence-based held-angle response',()=>{
 it('measures held-angle timing and ballistic survival without a human-equivalence claim',()=>{
  const rows=timingRows(),survival=survivalRows();
  if(process.env.VALOPRAC_F4_CAPTURE)console.info('F4_EVIDENCE '+JSON.stringify({capturedAt:new Date().toISOString(),environment:{fixedHz:120,seeds:64,weapon:'rifleA',distanceMetres:20,simulationOnly:true,nativeVALORANTMeasured:false,humanSurvivalMeasured:false},rows,survival}));
  expect(rows.every(row=>row.samples.every(Number.isFinite))).toBe(true);
  expect(rows.find(row=>row.skill==='expert'&&!row.minimum)!.median).toBeLessThanOrEqual(.3);
  expect(rows.find(row=>row.skill==='expert'&&row.minimum)!.median).toBeLessThanOrEqual(.22);
  for(const row of rows.filter(row=>row.skill!=='expert'))expect(row.samples).toEqual(evidence.before.rows.find(old=>old.skill===row.skill&&old.minimum===row.minimum)!.samples);
  expect(survival.every(row=>row.samples.every(s=>s.deathCause===null||s.deathCause==='shot'))).toBe(true);
  expect(survival.find(row=>row.skill==='beginner'&&row.route==='jiggle')!.survivalRate).toBe(1);
  // Frozen09.01 samples are intentionally kept: faster expert practice must not
  // quietly make ordinary beginner/normal ballistic peeks harder.
  for(const row of survival.filter(row=>row.skill==='beginner'||row.skill==='normal'))expect(row.samples).toEqual(evidence.before.survival.find(old=>old.skill===row.skill&&old.route===row.route)!.samples);
 });
 it('records finite detection, recognition, response, motor confirmation and trigger stages',()=>{
  for(let seed=1;seed<=64;seed++)for(const defenderReaction of [.42,.15]){
   const ai=first({defenderSkill:'expert',defenderReaction},seed),shot=ai.shots[0],timing=shot.timing!;
   expect(timing.preaimed).toBe(true);expect(timing.contactAngleDegrees).toBeLessThanOrEqual(3);
   expect(timing.recognizedAt-timing.detectedAt).toBeCloseTo(.035,10);
   expect(timing.reactionUntil).toBeGreaterThan(timing.recognizedAt+.1);
   expect(timing.aimStartedAt).toBeGreaterThanOrEqual(timing.reactionUntil);
   expect(timing.acquisitionUntil).toBeGreaterThan(timing.aimStartedAt);
   expect(timing.triggerAt).toBeGreaterThan(timing.acquisitionUntil);
   expect(shot.time).toBeGreaterThanOrEqual(timing.triggerAt);
   expect(timing.firedAt).toBe(shot.time);expect(shot.angularError!).toBeLessThan(.81);
   expect(ai.memories[0].motor.peakSpeed).toBeLessThanOrEqual(ai.memories[0].profile.maxSpeed+1e-9);
   expect(ai.memories[0].motor.peakAcceleration).toBeLessThanOrEqual(ai.memories[0].profile.maxAcceleration+1e-9);
  }
 });
 it('does not grant the held-angle response to a surprise or an ordinary difficulty',()=>{
  const held=first({defenderSkill:'expert'},19),surprise=first({defenderSkill:'expert'},19,20);
  expect(held.shots[0].timing!.preaimed).toBe(true);expect(surprise.shots[0].timing!.preaimed).toBe(false);
  const a=held.shots[0].timing!,b=surprise.shots[0].timing!;
  expect(b.contactAngleDegrees).toBeGreaterThan(40);expect(surprise.shots[0].time).toBeGreaterThan(held.shots[0].time+.1);
  expect((b.reactionUntil-b.recognizedAt)/(a.reactionUntil-a.recognizedAt)).toBeCloseTo(.55/.49,8);
  for(const defenderSkill of ['beginner','normal','advanced']as const)expect(first({defenderSkill},19).shots[0].timing!.preaimed).toBe(false);
 });
 it('loses firing permission behind cover before the shortened trigger window completes',()=>{
  const{ai,obstacles}=fixture({defenderSkill:'expert',defenderReaction:.15},17);ai.health=150;
  for(let n=0;n<10;n++)ai.step(dt,n*dt,body());
  const known={...ai.memories[0].known!};obstacles.push({box:new Box3(new Vector3(-10,0,-10.2),new Vector3(10,4,-9.8)),kind:'wall',material:'concrete',color:0});
  for(let n=10;n<120;n++)ai.step(dt,n*dt,body(6));
  expect(ai.shots).toHaveLength(0);expect(ai.health).toBe(150);expect(ai.memories[0].visible).toBe(0);expect(ai.memories[0].known).toEqual(known);
 });
});
