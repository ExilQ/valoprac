import {describe,it,expect} from 'vitest';
import {DEFAULT_SETTINGS} from '../config/settings';
import {WEAPONS,WEAPON_ORDER} from '../config/weapons';
import {emptyInput} from '../engine/types';
import {Simulation} from '../engine/simulation/Simulation';
import {Weapon} from '../engine/weapons/Weapon';
import {standingSpace} from '../engine/tactical/levels';
const dt=1/120;
describe('Encounter ownership and full repeated-training reset',()=>{
 for(const id of WEAPON_ORDER)it(`${id} restores its configured ammunition, chamber, scope, spread and recoil`,()=>{
  const w=new Weapon(WEAPONS[id],16);w.ammo=0;w.reserve=0;w.bloom=3;w.shotIndex=17;w.magazineShot=22;w.recoil.pitch=12;w.recoil.yaw=3;w.recoil.cameraPitch=5;
  w.reloadingUntil=90;w.boltUntil=70;w.scopeLevel=2;w.scopeAmount=1;w.scopeZoom=5;w.nextShot=80;w.ads=true;
  w.resetForEncounter(4);expect(w.ammo).toBe(w.profile.magazine);expect(w.reserve).toBe(w.profile.reserve);expect(w.reloadingUntil).toBeNull();expect(w.boltUntil).toBe(0);expect(w.scopeLevel).toBe(0);expect(w.scopeZoom).toBe(1);expect(w.ads).toBe(false);expect(w.bloom).toBe(0);expect(w.shotIndex).toBe(0);expect(w.magazineShot).toBe(0);expect(w.recoil.pitch).toBe(0);expect(w.recoil.cameraPitch).toBe(0);
  let shots=0;const input={...emptyInput(),fire:true,firePresses:1};w.step(4,dt,input,()=>shots++);expect(shots).toBe(0);input.fire=false;input.firePresses=0;w.step(5.6,dt,input,()=>shots++);input.fire=true;input.firePresses=1;w.step(5.61,dt,input,()=>shots++);expect(shots).toBe(1);expect(w.ammo).toBe(w.profile.magazine-1);
 });
 for(const id of WEAPON_ORDER)it(`${id} retry clears all life-local state while retaining selection, preferences and session results`,()=>{
  const settings={...DEFAULT_SETTINGS,practiceMap:'complex' as const,sensitivity:.73,infiniteReserve:false};const s=new Simulation('free',id,settings);s.running=true;const input={...emptyInput(),forward:1,jump:true,jumpPresses:1};s.step(dt,input);
  for(const w of Object.values(s.weapons)){w.ammo=1;w.reserve=0;w.reloadingUntil=40;w.boltUntil=30;w.recoil.pitch=10;w.scopeLevel=2;w.scopeZoom=5;}
  s.movement.crouch=1;s.movement.eyeHeight=1.05;s.movement.grounded=false;s.movement.velocity.set(4,5,2);s.ads=true;s.adsAmount=1;s.previousAdsAmount=1;s.defenders!.health=0;s.defenders!.memories[0].known={x:3,y:0,z:2};s.stats.shots=13;s.footsteps.footstepAccumulation=.8;s.lastHitAt=s.time;
  const time=s.time,selection=s.weaponId,generation=s.lifeGeneration;s.captureFireView(100);s.retryTactical();
  expect(s.lifeGeneration).toBe(generation+1);expect(s.time).toBe(time);expect(s.weaponId).toBe(selection);expect(s.settings.sensitivity).toBe(.73);expect(s.stats.shots).toBe(13);expect(s.running).toBe(false);
  for(const w of Object.values(s.weapons)){expect(w.ammo).toBe(w.profile.magazine);expect(w.reserve).toBe(w.profile.reserve);expect(w.reloadingUntil).toBeNull();expect(w.boltUntil).toBe(0);expect(w.recoil.pitch).toBe(0);expect(w.scopeLevel).toBe(0);}
  expect(s.movement.velocity.length()).toBe(0);expect(s.movement.crouch).toBe(0);expect(s.movement.grounded).toBe(true);expect(s.movement.eyeHeight).toBe(1.64);expect(s.adsAmount).toBe(0);expect(s.previousAdsAmount).toBe(0);expect(s.defenders!.health).toBe(150);expect(s.defenders!.memories.every(m=>m.known===null)).toBe(true);expect(s.footsteps.footstepAccumulation).toBe(0);expect(s.footsteps.recent()).toHaveLength(0);expect(s.exposure.death).toBeNull();expect(standingSpace(s.obstacles,s.movement.position)).toBe(true);
  s.running=true;for(let i=0;i<240;i++)s.step(dt,input);expect(s.shots).toHaveLength(0);expect(input.forward).toBe(0);expect(input.jumpPresses).toBe(0);
 });
 it('clears the actual death-tick input even when it differs from the prior input object',()=>{
  const s=new Simulation('free','rifleA',{...DEFAULT_SETTINGS,practiceMap:'garage',combatMode:'exposure',exposureLimit:.001});s.running=true;s.step(dt,emptyInput());
  s.movement.position.set(0,0,5);s.movement.previous.copy(s.movement.position);const final={...emptyInput(),fire:true,firePresses:2,reload:true,jump:true,jumpPresses:1,ads:true,scopeHeld:true};
  for(let i=0;i<30&&!s.defenders!.death;i++)s.step(dt,final);expect(s.defenders!.death).not.toBeNull();s.retryTactical();expect(final).toEqual(emptyInput());s.running=true;for(let i=0;i<150;i++)s.step(dt,final);expect(s.shots).toHaveLength(0);
 });
 it('ignores obsolete render samples and isolates consecutive lives during active reload/bolt transitions',()=>{
  const s=new Simulation('free','operator',{...DEFAULT_SETTINGS,practiceMap:'complex'});for(let life=0;life<12;life++){s.running=true;s.step(dt,emptyInput());s.weapon.ammo=0;s.weapon.requestReload(s.time);s.weapon.boltUntil=s.time+5;s.retryTactical();expect(s.lifeGeneration).toBe(life+1);s.retryTactical();expect(s.lifeGeneration).toBe(life+1);expect(s.weapon.ammo).toBe(5);expect(s.weapon.reserve).toBe(10);expect(s.defenders!.death).toBeNull();expect(s.movement.hopSnapshot().events.length).toBeLessThanOrEqual(64);}
 });
});
