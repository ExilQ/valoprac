import {describe,it,expect} from 'vitest';
import {Vector3,PerspectiveCamera} from 'three';
import {Movement} from '../engine/movement/Movement';
import {solveAirMovement,wishMovement} from '../engine/movement/MovementSolvers';
import {VALORANT_PHYSICS,CS2_PHYSICS} from '../config/movement';
import {DEFAULT_SETTINGS} from '../config/settings';
import {WEAPONS,adsFov as weaponFov} from '../config/weapons';
import {Weapon} from '../engine/weapons/Weapon';
import {angularGain,adsFov as inputFov} from '../engine/input/sensitivity';
import {horizontalFov,verticalFovFromHorizontal,cameraVerticalFov} from '../engine/rendering/projection';
import {emptyInput,type InputState} from '../engine/types';
const dt=1/120;
describe('09.01 tactical air acceleration uses actual slow/weapon request speed',()=>{
 for(const row of[
  {label:'walking rifle',modifier:1,walk:true,crouch:false,expected:5.4*.48},
  {label:'crouching rifle',modifier:1,walk:false,crouch:true,expected:5.4*.36},
  {label:'Operator',modifier:5.13/5.4,walk:false,crouch:false,expected:5.13},
  {label:'rifle ADS',modifier:.76,walk:false,crouch:false,expected:5.4*.76},
  {label:'Operator scoped',modifier:5.13/5.4*.72,walk:false,crouch:false,expected:5.13*.72},
 ])it(`${row.label}: a held-forward jump does not accelerate beyond its grounded request`,()=>{
  const m=new Movement(undefined,[]);m.configurePhysics(DEFAULT_SETTINGS);m.reset({x:0,y:0,z:0});m.speedModifier=row.modifier;let time=0;const input={...emptyInput(),forward:1,walk:row.walk,crouch:row.crouch};
  for(let n=0;n<120;n++)m.step(input,0,dt,time+=dt);expect(m.speed).toBeCloseTo(row.expected,10);const groundSpeed=m.speed;
  m.step({...input,jump:true,jumpPresses:1},0,dt,time+=dt);expect(m.grounded).toBe(false);let airborneTicks=0,peak=m.speed;
  for(let n=0;n<150&&!m.grounded;n++){m.step(input,0,dt,time+=dt);if(!m.grounded){airborneTicks++;peak=Math.max(peak,m.speed);expect(m.speed).toBeLessThanOrEqual(groundSpeed+1e-8);}}
  expect(airborneTicks).toBeGreaterThan(40);expect(m.grounded).toBe(true);expect(peak).toBeCloseTo(groundSpeed,10);
 });
 it('preserves existing airborne momentum when walking is selected instead of abruptly clamping the whole velocity',()=>{
  const m=new Movement(undefined,[]);m.configurePhysics(DEFAULT_SETTINGS);m.reset({x:0,y:10,z:0});m.grounded=false;m.velocity.z=-5.4;m.speed=5.4;
  for(let n=0;n<20;n++){m.step({...emptyInput(),forward:1,walk:true},0,dt,(n+1)*dt);expect(m.grounded).toBe(false);expect(m.velocity.z).toBeCloseTo(-5.4,12);}
 });
 it('accounts for a fractional input once when approaching the slow wish-speed projection',()=>{
  const v=new Vector3(0,0,-1),air=new Vector3(),wish=wishMovement(.5,0,0,5.4,.48);solveAirMovement(v,wish,VALORANT_PHYSICS,.1,air);
  expect(v.z).toBeCloseTo(-1.296,12);expect(air.z).toBeLessThan(0);
  const full=new Vector3(),half=new Vector3();solveAirMovement(full,wishMovement(1,0,0,5.4,.48),VALORANT_PHYSICS,.01,new Vector3());solveAirMovement(half,wishMovement(.5,0,0,5.4,.48),VALORANT_PHYSICS,.01,new Vector3());expect(half.length()).toBeCloseTo(full.length()*.5,12);
 });
 it('retains CS2 projection acceleration and its uncapped airborne velocity independently',()=>{
  const v=new Vector3(8,0,0),out=new Vector3();solveAirMovement(v,wishMovement(1,0,0,5.4,.48),CS2_PHYSICS,.1,out);expect(v.x).toBe(8);expect(v.z).toBeCloseTo(-.8,12);expect(v.length()).toBeGreaterThan(8);
 });
});
describe('Shared horizontal-degree scoped camera and calibrated first-shot cones',()=>{
 for(const [zoom,expected]of[[1,103],[1.25,82.4],[2.5,41.2],[5,20.6]])it(`${zoom}x uses ${expected} horizontal degrees across world/input/weapon helpers`,()=>{
  expect(horizontalFov(103,zoom)).toBeCloseTo(expected,12);expect(weaponFov(103,zoom)).toBeCloseTo(expected,12);expect(inputFov(103,zoom)).toBeCloseTo(expected,12);
  for(const aspect of[4/3,16/9,3440/1440]){const c=new PerspectiveCamera(cameraVerticalFov(103,zoom,aspect),aspect,.1,100);const reconstructed=2*Math.atan(Math.tan(c.fov*Math.PI/360)*aspect)*180/Math.PI;expect(reconstructed).toBeCloseTo(expected,11);expect(c.fov).toBe(verticalFovFromHorizontal(expected,aspect));}
 });
 it('keeps legacy angular gain numbers and selects the requested independent scope multiplier',()=>{
  const legacy={degreesPerCount:.07,sensitivity:.35,adsSensitivity:.8};expect(angularGain(legacy,true,2.5)).toBeCloseTo(.07*.35*.8/2.5,12);
  const s={...DEFAULT_SETTINGS,adsSensitivity:1.2,scopeSensitivity25:.6,scopeSensitivity5:1.4};expect(angularGain(s,true,1.25)).toBeCloseTo(.07*.35*1.2/1.25,12);expect(angularGain(s,true,2.5)).toBeCloseTo(.07*.35*.6/2.5,12);expect(angularGain(s,true,5)).toBeCloseTo(.07*.35*1.4/5,12);expect(angularGain(s,true,1.4,1)).toBeCloseTo(.07*.35*.6/1.4,12);expect(angularGain(s,true,3,2)).toBeCloseTo(.07*.35*1.4/3,12);
 });
 for(const[id,expected]of[['rifleA',.1575],['rifleB',.11]]as const)it(`${id}: actual stationary ADS spread cone is ${expected} degrees`,()=>{
  const m=new Movement(undefined,[]);m.reset({x:0,y:0,z:0});const w=new Weapon(WEAPONS[id],1);const hip=w.calculateSpread(m,false,false).total;expect(hip).toBe(WEAPONS[id].firstSpread);expect(w.calculateSpread(m,true,false).total).toBeCloseTo(expected,12);expect(m.crouch).toBe(0);
 });
});
