import {afterAll,describe,expect,it} from 'vitest';
import {createHash} from 'node:crypto';
import {Box3,Vector3} from 'three';
import {Movement} from '../engine/movement/Movement';
import {solveAirMovement,wishMovement} from '../engine/movement/MovementSolvers';
import {MOVEMENT_CALIBRATION_EVIDENCE,VALORANT_PHYSICS,CS2_PHYSICS} from '../config/movement';
import {Simulation} from '../engine/simulation/Simulation';
import {DEFAULT_SETTINGS} from '../config/settings';
import {emptyInput} from '../engine/types';
import {LEVELS} from '../engine/tactical/levels';
import type {Obstacle} from '../engine/collision/environment';
const dt=1/120;
const measuredRows:Record<string,unknown>[]=[],reverseRows:Record<string,unknown>[]=[],csHashes:Record<string,unknown>[]=[];
afterAll(()=>console.info(JSON.stringify({benchmark:'roadmap-stage1-movement',schema:1,physicsVersion:'dual-movement-1.1.0',fixedHz:120,nativeGameMeasured:false,rows:measuredRows,reverseSteering:reverseRows,csTrajectories:csHashes})));
const cases=[
 {label:'running rifle',weapon:'rifleA',run:5.4,modifier:1,walk:false,crouch:false},
 {label:'walking rifle',weapon:'rifleA',run:5.4,modifier:1,walk:true,crouch:false},
 {label:'crouching rifle',weapon:'rifleA',run:5.4,modifier:1,walk:false,crouch:true},
 {label:'Operator',weapon:'operator',run:5.13,modifier:5.13/5.4,walk:false,crouch:false},
 {label:'rifle ADS',weapon:'rifleA',run:5.4,modifier:.76,walk:false,crouch:false},
 {label:'Operator scope',weapon:'operator',run:5.13,modifier:5.13/5.4*.72,walk:false,crouch:false}
] as const;
function settled(row:typeof cases[number]){
 const m=new Movement(undefined,[]);m.reset({x:0,y:0,z:0});m.speedModifier=row.modifier;m.setWeaponContext(row.weapon,row.run,row.label.includes('ADS')||row.label.includes('scope'));
 const input={...emptyInput(),forward:1,walk:row.walk,crouch:row.crouch};for(let n=1;n<=120;n++)m.step(input,0,dt,n*dt);return{m,input,time:1};
}
const box=(min:[number,number,number],max:[number,number,number]):Obstacle=>({box:new Box3(new Vector3(...min),new Vector3(...max)),kind:'wall',color:0});
describe('F1 — frozen takeoff budget and continuous tactical air steering',()=>{
 for(const row of cases)it(`${row.label}: preserves takeoff momentum and freezes state/weapon/calibrated budget`,()=>{
  const{m,input}=settled(row),takeoffSpeed=m.speed,before=m.velocity.clone();let time=1;
  m.step({...input,jump:true,jumpPresses:1},0,dt,time+=dt);
  const takeoff=m.physicsSnapshot().takeoff!;
  expect(takeoff.kind).toBe('jump');expect(takeoff.weapon).toBe(row.weapon);expect(takeoff.horizontalSpeed).toBeCloseTo(takeoffSpeed,12);expect(takeoff.velocity).toEqual({x:before.x,y:before.y,z:before.z});
  expect(takeoff.speedCap).toBeCloseTo(Math.min(takeoffSpeed+.75,row.run*1.05),12);expect(takeoff.calibration).toBe('report-provisional');
  const expectedState=row.crouch?'crouching':row.walk?'walking':'running';expect(takeoff.movementState).toBe(expectedState);
  let sum=0,count=0,height=0,peak=0;while(!m.grounded&&count<200){height=Math.max(height,m.position.y);peak=Math.max(peak,m.speed);expect(m.speed).toBeLessThanOrEqual(takeoffSpeed+.75+1e-9);expect(m.speed).toBeLessThanOrEqual(row.run*1.05+1e-9);sum+=m.speed;count++;m.step(input,0,dt,time+=dt);}
  expect(m.grounded).toBe(true);expect(sum/count).toBeCloseTo(takeoffSpeed,10);
  measuredRows.push({label:row.label,groundSpeed:takeoffSpeed,airMean:sum/count,airPeak:peak,height,duration:m.lastLandingTime-takeoff.time,impact:m.lastLandingImpactSpeed,airTicks:count,takeoff});
 });
 it('releasing walk/crouch or switching weapon midair does not refill a slow takeoff budget',()=>{
  for(const row of cases.filter(r=>r.walk||r.crouch)){
   const{m,input}=settled(row);let time=1;m.step({...input,jump:true,jumpPresses:1},0,dt,time+=dt);const takeoff=m.physicsSnapshot().takeoff!;
   m.setWeaponContext('sheriff',5.4,false);m.speedModifier=1;
   for(let n=0;n<50&&!m.grounded;n++){m.step({...emptyInput(),strafe:1},-n*.018,dt,time+=dt);expect(m.speed).toBeLessThanOrEqual(takeoff.speedCap!+1e-9);expect(m.physicsSnapshot().takeoff!.weapon).toBe('rifleA');expect(m.physicsSnapshot().takeoff!.speedCap).toBe(takeoff.speedCap);}
  }
 });
 it('a stationary jump cannot manufacture running speed while retaining directional control',()=>{
  const m=new Movement(undefined,[]);m.reset({x:0,y:0,z:0});m.step({...emptyInput(),jump:true,jumpPresses:1},0,dt,dt);
  expect(m.physicsSnapshot().takeoff!.speedCap).toBe(.75);for(let n=2;n<=32;n++)m.step({...emptyInput(),strafe:1},-.01*n,dt,n*dt);
  expect(m.speed).toBeLessThanOrEqual(.75+1e-9);expect(m.position.x).toBeGreaterThan(.1);expect(m.velocity.z).not.toBe(0);
 });
 for(const angle of[149,150,151,180])it(`reverse steering at ${angle} degrees applies a continuous bounded impulse`,()=>{
  const initial=new Vector3(0,0,-5.4),v=initial.clone(),out=new Vector3(),angleRad=angle*Math.PI/180,w=wishMovement(1,0,angleRad,5.4,1);
  solveAirMovement(v,w,VALORANT_PHYSICS,dt,out,5.67);const delta=v.clone().sub(initial);
  reverseRows.push({angleDegrees:angle,impulseMetersPerSecond:delta.length(),velocityBefore:initial.toArray(),velocityAfter:v.toArray()});
  expect(delta.length()).toBeCloseTo(10*dt*(angle>=150?.5:1),11);expect(v.z).toBeLessThan(-5.3);expect(v.length()).toBeGreaterThan(5.3);expect(out.clone().multiplyScalar(dt).distanceTo(delta)).toBeLessThan(1e-12);
 });
 it('captures real weapon identity through the production Simulation integration',()=>{
  const s=new Simulation('free','operator',{...DEFAULT_SETTINGS,targetCount:1});s.running=true;for(let n=0;n<120;n++)s.step(dt,{...emptyInput(),forward:1});s.step(dt,{...emptyInput(),forward:1,jump:true,jumpPresses:1});
  const t=s.movement.physicsSnapshot().takeoff!;expect(t.weapon).toBe('operator');expect(t.weaponRunSpeed).toBe(5.13);expect(t.speedCap).toBeCloseTo(5.13*1.05,12);
 });
 it('copies takeoff metadata rather than exposing mutable simulation vectors',()=>{
  const{m,input}=settled(cases[0]);m.step({...input,jump:true,jumpPresses:1},0,dt,1+dt);const t=m.physicsSnapshot().takeoff!;t.velocity.z=999;t.position.x=999;expect(m.physicsSnapshot().takeoff!.velocity.z).toBe(-5.4);expect(m.physicsSnapshot().takeoff!.position.x).toBe(0);
 });
});
describe('F2 — report-derived ballistic jump and physical contacts',()=>{
 for(const hz of[60,120,240])it(`${hz}Hz integration reaches 1.15±.02m with a .61–.68s ballistic flight`,()=>{
  const step=1/hz,m=new Movement(undefined,[]);m.reset({x:0,y:0,z:0});let peak=0,n=0;m.step({...emptyInput(),jump:true,jumpPresses:1},0,step,++n*step);
  while(!m.grounded&&n<hz*2){peak=Math.max(peak,m.position.y);m.step(emptyInput(),0,step,++n*step);}
  expect(peak).toBeGreaterThanOrEqual(1.13);expect(peak).toBeLessThanOrEqual(1.17);expect(n*step).toBeGreaterThanOrEqual(.61);expect(n*step).toBeLessThanOrEqual(.68);expect(m.position.y).toBe(0);expect(m.landingSerial).toBe(1);expect(m.hopSnapshot().jumps).toBe(1);
  expect(VALORANT_PHYSICS.jumpImpulse**2/(2*VALORANT_PHYSICS.gravity)).toBeCloseTo(1.15,12);
 });
 it('cannot pass through a low ceiling, double-jump, or create multiple landing events',()=>{
  const m=new Movement(undefined,[box([-3,2.1,-3],[3,2.3,3])]);m.reset({x:0,y:0,z:0});let peak=0;
  for(let n=1;n<=120;n++){m.step({...emptyInput(),jump:n===1||n===4,jumpPresses:n===1||n===4?1:0},0,dt,n*dt);peak=Math.max(peak,m.position.y);expect(m.position.y+1.85).toBeLessThanOrEqual(2.1+1e-9);}
  expect(peak).toBeCloseTo(.25,12);expect(m.grounded).toBe(true);expect(m.hopSnapshot().jumps).toBe(1);expect(m.landingSerial).toBe(1);
 });
 for(const map of['mid','tower'] as const)it(`${map}: existing elevated approach remains traversable with correctly grounded jumps`,()=>{
  const m=new Movement(undefined,LEVELS[map].obstacles);m.reset(map==='mid'?{x:10,y:0,z:2}:{x:0,y:0,z:2});const input={...emptyInput(),forward:1,walk:true,crouch:map==='tower'};
  for(let n=1;n<=1000;n++)m.step(input,0,dt,n*dt);expect(m.grounded).toBe(true);expect(m.position.y).toBeCloseTo(map==='mid'?2.4:1.2,7);
  const elevation=m.position.y;m.step({...emptyInput(),crouch:input.crouch,jump:true,jumpPresses:1},0,dt,1001*dt);let peak=0;for(let n=1002;n<=1120&&!m.grounded;n++){peak=Math.max(peak,m.position.y-elevation);m.step({...emptyInput(),crouch:input.crouch},0,dt,n*dt);}expect(m.grounded).toBe(true);expect(m.position.y).toBeCloseTo(elevation,12);expect(peak).toBeLessThanOrEqual(1.17);
 });
 it('integrates a terminal-speed transition without inventing an extra gravity displacement',()=>{
  const m=new Movement(undefined,[]);m.reset({x:0,y:100,z:0});m.grounded=false;m.velocity.y=-54.9;const accelerationTime=.1/22;
  const expected=-54.9*accelerationTime-.5*22*accelerationTime**2-55*(dt-accelerationTime);m.step(emptyInput(),0,dt,dt);expect(m.velocity.y).toBe(-55);expect(m.position.y-100).toBeCloseTo(expected,12);
  m.step(emptyInput(),0,dt,2*dt);expect(m.position.y-100-expected).toBeCloseTo(-55*dt,12);
 });
 it('keeps F1/F2 provisional and F9/F10 unchanged until direct reference measurements exist',()=>{
  expect(MOVEMENT_CALIBRATION_EVIDENCE.F1.nativeGameMeasured).toBe(false);expect(MOVEMENT_CALIBRATION_EVIDENCE.F2.category).toBe('provisional-calibration');expect(MOVEMENT_CALIBRATION_EVIDENCE.F9.changed).toBe(false);expect(MOVEMENT_CALIBRATION_EVIDENCE.F10.changed).toBe(false);expect(VALORANT_PHYSICS.walkModifier).toBe(.48);
 });
});
describe('F1/F2 — unchanged Counter-Strike trajectory fixtures from immutable09.01',()=>{
 for(const[preset,expected]of[['cs2','63483b858c8d3b210c78ca576d62fd8d14e7b540bcdf7725b4223a937d38f058'],['sourceClassic','d25ad9af42b2d0c7425c57026128797351eaf683a109052de5e27abc9f76ae7c']]as const)it(`${preset}: all600 resolved movement samples retain their original SHA256`,()=>{
  const m=new Movement(undefined,[]);m.configurePhysics({movementPhysics:'counterStrike',csMovementPreset:preset,jumpBufferMs:80});m.reset({x:0,y:0,z:0});const frames=[];
  for(let n=0;n<600;n++){m.step({...emptyInput(),forward:n<100?1:0,strafe:n>=100&&n<220?-1:n>=220&&n<340?1:0,jump:n===90||n===260,jumpPresses:n===90||n===260?1:0},n>=100?(n-100)*.008:0,dt,(n+1)*dt);frames.push([...m.position.toArray(),...m.velocity.toArray(),+m.grounded,m.landingSerial,m.hopSnapshot().jumps]);}
  const actual=createHash('sha256').update(JSON.stringify(frames)).digest('hex');csHashes.push({preset,sha256:actual,unchangedFrom0901:actual===expected});expect(actual).toBe(expected);expect(m.profile.airModel).toBe('projection');expect(m.profile.jumpImpulse).toBe(CS2_PHYSICS.jumpImpulse);
 });
});
