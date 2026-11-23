import {describe,it,expect} from 'vitest';
import {Vector3} from 'three';
import {WEAPONS} from '../config/weapons';
import {Weapon} from '../engine/weapons/Weapon';
import {Movement} from '../engine/movement/Movement';
import {emptyInput} from '../engine/types';
import {spreadDirection} from '../engine/weapons/trajectory';

const dt=1/120;
const references=[['rifleA',.8],['rifleB',.8],['sheriff',.5]] as const;

describe('Independent crouch-moving accuracy calibration',()=>{
 for(const [id,reference] of references){
  it(`${id}: reaches the authored ${reference}° half-cone under actual crouch movement`,()=>{
   const movement=new Movement(),weapon=new Weapon(WEAPONS[id],73);
   for(let tick=1;tick<=150;tick++)movement.step({...emptyInput(),strafe:1,crouch:true},0,dt,tick*dt);
   expect(movement.crouch).toBe(1);expect(movement.grounded).toBe(true);
   expect(movement.speed).toBeCloseTo(movement.profile.maxSpeed*movement.profile.crouchModifier,12);
   const spread=weapon.calculateSpread(movement,false,false);
   expect(spread.total).toBeCloseTo(reference,12);
   expect(spread.base+spread.movement).toBeCloseTo(reference,12);
   expect(spread.bloom+spread.air+spread.landing).toBe(0);
   for(let sample=0;sample<128;sample++){const shot=weapon.calculateSpread(movement,false,false);expect(Math.hypot(shot.x,shot.y)).toBeLessThanOrEqual(reference+1e-12);}
   console.info(JSON.stringify({benchmark:'crouch-moving-cone',weapon:id,resolvedSpeed:movement.speed,halfConeDegrees:spread.total,fullConeDegrees:2*spread.total,nativeParityVerified:false}));
  });
  it(`${id}: preserves standing, walking, running and stationary crouch values`,()=>{
   const profile=WEAPONS[id],weapon=new Weapon(profile,7),movement=new Movement();
   expect(weapon.calculateSpread(movement,false,false).total).toBeCloseTo(profile.firstSpread,12);
   movement.speed=movement.profile.maxSpeed*movement.profile.walkModifier;
   expect(weapon.calculateSpread(movement,false,false).total).toBeCloseTo(profile.walkingSpread!,12);
   movement.speed=movement.profile.maxSpeed;
   expect(weapon.calculateSpread(movement,false,false).total).toBeCloseTo(profile.movementSpread,12);
   movement.speed=0;movement.crouch=1;
   expect(weapon.calculateSpread(movement,false,false).total).toBeCloseTo(profile.firstSpread*profile.crouchSpread,12);
  });
  it(`${id}: slowing and releasing input use resolved velocity rather than a crouch/key shortcut`,()=>{
   const movement=new Movement(),weapon=new Weapon(WEAPONS[id],19);
   for(let tick=1;tick<=150;tick++)movement.step({...emptyInput(),strafe:1,crouch:true},0,dt,tick*dt);
   movement.step({...emptyInput(),crouch:true},0,dt,151*dt);
   expect(movement.speed).toBeGreaterThan(movement.profile.accuracyVelocityThreshold);
   expect(weapon.calculateSpread(movement,false,false).movement).toBeGreaterThan(0);
   const released=weapon.spread.total;
   for(let tick=152;tick<=210;tick++)movement.step({...emptyInput(),crouch:true},0,dt,tick*dt);
   expect(movement.speed).toBe(0);expect(weapon.calculateSpread(movement,false,false).movement).toBe(0);
   expect(weapon.spread.total).toBeLessThan(released);
   movement.speed=movement.profile.maxSpeed;movement.crouch=1;
   expect(weapon.calculateSpread(movement,false,false).total).toBeGreaterThan(reference);
  });
 }
 it('blends crouch pose continuously and retains independent ADS, bloom, airborne and landing penalties',()=>{
  const profile=WEAPONS.rifleA,weapon=new Weapon(profile,27),movement=new Movement();movement.speed=movement.profile.maxSpeed*movement.profile.crouchModifier;
  movement.crouch=0;const standing=weapon.calculateSpread(movement,false,false).total;
  movement.crouch=1;const crouched=weapon.calculateSpread(movement,false,false).total;
  movement.crouch=.5;expect(weapon.calculateSpread(movement,false,false).total).toBeCloseTo((standing+crouched)/2,12);
  movement.crouch=1;weapon.bloom=.4;
  const hip={...weapon.calculateSpread(movement,false,false)},ads={...weapon.calculateSpread(movement,true,false)};
  expect(hip.total).toBeCloseTo(.8+.4*profile.crouchSpread,12);expect(ads.total).toBeCloseTo(hip.total*profile.adsSpread,12);
  movement.grounded=false;expect(weapon.calculateSpread(movement,false,false).air).toBe(profile.airSpread);
  movement.grounded=true;expect(weapon.calculateSpread(movement,false,true).landing).toBe(.35);
 });
 it('uses half-cone angles consistently with the existing physical trajectory API',()=>{
  const direction=spreadDirection(0,0,.8,0,new Vector3());
  expect(Math.atan2(direction.x,-direction.z)*180/Math.PI).toBeCloseTo(.8,12);
 });
});
