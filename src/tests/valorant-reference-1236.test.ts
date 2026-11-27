import {describe,expect,it} from 'vitest';
import {Simulation} from '../engine/simulation/Simulation';
import {DEFAULT_SETTINGS} from '../config/settings';
import {emptyInput,type InputState,type Settings,type WeaponId} from '../engine/types';
import {VALORANT_REFERENCE as REF} from '../config/valorantReference';
import {ReplayRecorder} from '../engine/replay/recording';
import {ReplayPlayer} from '../engine/replay/playback';
import type {SimulationRulesId} from '../engine/simulation/rules';

const DT=1/120,TICK=1000/120;
const make=(weapon:WeaponId,patch:Partial<Settings>={},rules?:SimulationRulesId)=>{const s=new Simulation('free',weapon,{...structuredClone(DEFAULT_SETTINGS),practiceMap:'range' as never,behavior:'stationary',infiniteMagazine:true,...patch},{},rules);s.running=true;s.movement.position.set(0,0,9);s.movement.previous.copy(s.movement.position);for(let n=0;n<150;n++)s.step(DT,emptyInput());return s;};
const hold=(s:Simulation,ticks:number,i:Partial<InputState>={})=>{for(let n=0;n<ticks;n++)s.step(DT,{...emptyInput(),...i});};
/** Spread (deg) of the next shot fired with `i` held. */
const shot=(s:Simulation,i:Partial<InputState>={})=>{const before=s.shots.length;for(let n=0;n<240&&s.shots.length===before;n++)s.step(DT,{...emptyInput(),...i,fire:true,firePresses:1});return s.shots.at(-1)!.spread.total;};

describe('12.36 reference-v11: braking matches Riot\'s published stop timings',()=>{
 const stop=(counter:boolean,rules?:SimulationRulesId)=>{const s=make('rifleB',{},rules);hold(s,120,{strafe:1});const at:Record<string,number>={};
  for(let n=1;n<=60;n++){s.step(DT,{...emptyInput(),strafe:counter&&s.movement.speed>1e-6?-1:0});for(const [k,f] of [['61',.61],['25',.25],['stop',0]] as const)if(at[k]===undefined&&s.movement.speed<=Math.max(1e-6,f*5.4))at[k]=n*TICK;}return at;};
 it('releasing the key: 25% in 0.110 s and stopped in 0.170 s, within one 120 Hz tick',()=>{const t=stop(false);expect(Math.abs(t['25']-110)).toBeLessThanOrEqual(TICK);expect(Math.abs(t.stop-170)).toBeLessThanOrEqual(TICK);});
 it('counter-strafing: 61% in 0.055 s, 25% in 0.104 s and stopped in 0.160 s, within one tick',()=>{const t=stop(true);expect(Math.abs(t['61']-55)).toBeLessThanOrEqual(TICK);expect(Math.abs(t['25']-104)).toBeLessThanOrEqual(TICK);expect(Math.abs(t.stop-160)).toBeLessThanOrEqual(TICK);});
 it('keeps the earlier braking for earlier rules',()=>{const t=stop(false,'acceleration-v10');expect(t['25']).toBeCloseTo(133.3,0);expect(t.stop).toBeCloseTo(191.7,0);});
});

describe('12.36 reference-v11: spread follows the official weapon tables',()=>{
 for(const weapon of ['rifleA','rifleB','sheriff','operator'] as const){
  const ref:import('../config/valorantReference').ReferenceSpread=REF.spread[weapon],p=ref.penalties;
  it(`${weapon}: first shot, crouch, movement, airborne and landing`,()=>{
   expect(shot(make(weapon))).toBeCloseTo(ref.first,6);
   let s=make(weapon);hold(s,40,{crouch:true});expect(shot(s,{crouch:true})).toBeCloseTo(ref.first*ref.crouch,6);
   for(const [state,input,penalty] of [['walk',{forward:1,walk:true},p.walk],['run',{forward:1},p.run],['crouch-moving',{forward:1,crouch:true},p.crouch]] as const){
    s=make(weapon);hold(s,90,input);const base=state==='crouch-moving'?ref.first*ref.crouch:ref.first;expect(shot(s,input),state).toBeCloseTo(base+penalty,6);}
   s=make(weapon);hold(s,20,{jump:true,jumpHeld:true,jumpPresses:1});expect(shot(s)).toBeCloseTo(ref.first+p.air,6);
   // Landing: +7 for 0.225 s, then nothing (binary, patch 1.09).
   s=make(weapon);let air=false;for(let n=0;n<200;n++){s.step(DT,{...emptyInput(),jump:n===0,jumpHeld:n===0,jumpPresses:n===0?1:0});if(!s.movement.grounded)air=true;if(air&&s.movement.grounded)break;}
   expect(shot(s)).toBeCloseTo(ref.first+REF.landing.spread,6);
   s=make(weapon);air=false;for(let n=0;n<200;n++){s.step(DT,{...emptyInput(),jump:n===0,jumpHeld:n===0,jumpPresses:n===0?1:0});if(!s.movement.grounded)air=true;if(air&&s.movement.grounded)break;}hold(s,Math.ceil(REF.landing.seconds/DT)+1);
   expect(shot(s)).toBeCloseTo(ref.first,6);
  });
  if(weapon!=='operator')it(`${weapon}: sustained fire grows to the official maximum and never beyond`,()=>{
   const s=make(weapon);let peak=0;for(let n=0;n<240;n++){s.step(DT,{...emptyInput(),fire:true,firePresses:weapon==='sheriff'||n===0?1:0});peak=Math.max(peak,s.shots.at(-1)?.spread.total??0);}
   expect(peak).toBeCloseTo(ref.max,6);
   if(ref.adsMax!==undefined){const a=make(weapon);hold(a,40,{ads:true});expect(shot(a,{ads:true})).toBeCloseTo(ref.adsFirst!,6);let adsPeak=0;for(let n=0;n<240;n++){a.step(DT,{...emptyInput(),ads:true,fire:true});adsPeak=Math.max(adsPeak,a.shots.at(-1)!.spread.total);}expect(adsPeak).toBeCloseTo(ref.adsMax,6);}
  });
 }
 it('operator: a scoped shot standing still is perfectly accurate',()=>{const s=make('operator');s.step(DT,{...emptyInput(),scopePresses:1});hold(s,120);expect(shot(s)).toBe(0);});
 it('has no movement penalty at the 27.5% deadzone, and keeps running accuracy while slowing from a run',()=>{
  for(const weapon of ['rifleA','operator'] as const){const ref=REF.spread[weapon],run=weapon==='operator'?5.13:5.4;
   let s=make(weapon);expect(s.movement.accuracyLimit).toBeCloseTo(REF.deadzone*run,9);
   hold(s,90,{forward:1});let k=0;while(s.movement.speed>s.movement.accuracyLimit&&k++<60)s.step(DT,emptyInput());expect(shot(s)).toBeCloseTo(ref.first,6);
   s=make(weapon);hold(s,90,{forward:1});k=0;while(s.movement.speed>.45*run&&k++<60)s.step(DT,emptyInput());expect(s.movement.speed).toBeGreaterThan(REF.deadzone*run);expect(shot(s)).toBeCloseTo(ref.first+ref.penalties.run,6);
  }
 });
 it('leaves the earlier spread model for earlier rules',()=>{expect(shot(make('rifleA',{},'acceleration-v10'))).toBeCloseTo(.25,6);const s=make('rifleA',{},'acceleration-v10');hold(s,90,{forward:1});expect(shot(s,{forward:1})).toBeCloseTo(6,6);});
});

describe('12.36 reference-v11: knife back hits and replays',()=>{
 it('doubles knife damage on a defender\'s back',async()=>{
  const {KNIFE_ATTACKS}=await import('../config/weapons');
  const hit=(behind:boolean)=>{const s=new Simulation('free','knife',{...structuredClone(DEFAULT_SETTINGS),practiceMap:'bind' as never,combatMode:'learning' as never});s.running=true;hold(s,90);
   const t=s.targets.find(x=>x.enabled&&x.active)!,m=s.defenders!.memories[t.id];m.face={x:0,y:0,z:1};
   s.movement.position.set(t.position.x,t.position.y,t.position.z+(behind?-1:1));s.movement.previous.copy(s.movement.position);
   s.yaw=behind?Math.PI:0;s.pitch=-.2;const before=t.health;let damage=0;s.onMelee=e=>{damage=e.damage;};
   (s as unknown as {melee(kind:'slash'|'stab'):void}).melee('slash');return{damage,lost:before-t.health};};
  const front=hit(false),back=hit(true);
  expect(front.damage).toBe(KNIFE_ATTACKS.slash.damage);expect(back.damage).toBe(KNIFE_ATTACKS.slash.damage*REF.knifeBackMultiplier);
 });
 it('records and verifies a session with movement, shots and landings exactly',async()=>{
  const s=new Simulation('free','rifleA',{...structuredClone(DEFAULT_SETTINGS),practiceMap:'range' as never}),recorder=new ReplayRecorder(s);s.running=true;
  for(let n=0;n<480;n++)s.step(DT,{...emptyInput(),strafe:n<100?1:n<130?-1:0,forward:n>=200&&n<320?1:0,walk:n>=260,jump:n===340,jumpHeld:n===340,jumpPresses:n===340?1:0,fire:n%30<3,firePresses:n%30===0?1:0});
  const record=recorder.finish()!;expect(record.header.simulationRules).toBe('reference-v11');expect((await new ReplayPlayer(record).verify()).passed).toBe(true);
 });
});

describe('12.36 reference-v11: Counter-Strike 2 option uses the CS2 server defaults',()=>{
 it('jumps with sv_jump_impulse 301.99 u/s and keeps the other defaults',async()=>{
  const {CS2_REFERENCE}=await import('../config/valorantReference');
  const s=make('rifleA',{movementPhysics:'counterStrike',csMovementPreset:'cs2'} as Partial<Settings>),p=s.movement.profile;
  expect(p.jumpImpulse).toBeCloseTo(7.6706,4);expect(p.airWishSpeedCap).toBeCloseTo(.762,6);expect(p.groundStopSpeed).toBeCloseTo(2.032,6);expect(p.stepHeight).toBeCloseTo(.4572,6);
  expect(p.gravity).toBeCloseTo(800*.0254,6);expect(p.groundAcceleration).toBe(5.5);expect(p.friction).toBe(5.2);expect(p.airAcceleration).toBe(12);expect(p.crouchModifier).toBe(.34);
  // Peak jump height 301.99^2 / (2 x 800) = 57.0 u = 1.448 m.
  const y0=s.movement.position.y;let peak=0;for(let n=0;n<120;n++){s.step(DT,{...emptyInput(),jump:n===0,jumpHeld:n===0,jumpPresses:n===0?1:0});peak=Math.max(peak,s.movement.position.y-y0);}
  expect(peak).toBeCloseTo(CS2_REFERENCE.jumpImpulse**2/(2*800*.0254),1);
  expect(make('rifleA',{movementPhysics:'counterStrike',csMovementPreset:'cs2'} as Partial<Settings>,'acceleration-v10').movement.profile.jumpImpulse).toBe(7.4);
 });
});

describe('12.36 reference-v11: the portable C++ core matches the browser simulation',()=>{
 it('reproduces braking, counter-strafing, bloom and the official spread exactly at every frame rate',async()=>{
  const {spawnSync}=await import('node:child_process'),{mkdtempSync,rmSync}=await import('node:fs'),{tmpdir}=await import('node:os'),{join}=await import('node:path');
  const {Movement}=await import('../engine/movement/Movement'),{Weapon}=await import('../engine/weapons/Weapon'),{WEAPONS,WEAPON_ORDER}=await import('../config/weapons');
  const dir=mkdtempSync(join(tmpdir(),'valoprac-reference-')),exe=join(dir,'core');
  try{
   const build=spawnSync('g++',['-std=c++20','-O2','-Wall','-Wextra','-Werror','-Iunreal/VALOPRAC/Source/VALOPRAC/Core','unreal/tests/core_probe.cpp','-o',exe],{encoding:'utf8'});expect(build.stderr).toBe('');expect(build.status).toBe(0);
   for(const fps of [30,60,144,240])for(const [id,weapon] of WEAPON_ORDER.filter(w=>w!=='operator').entries()){
    const native=JSON.parse(spawnSync(exe,[String(fps),String(id),'reference'],{encoding:'utf8'}).stdout);
    const m=new Movement(),w=new Weapon(WEAPONS[weapon],1947),input=emptyInput(),ref=REF.spread[weapon as 'rifleA'];w.autoReload=false;w.holdBloomWhileFiring=true;let time=0,count=0,sx=0,sy=0;
    for(let tick=0;tick<600;tick++){input.forward=0;input.strafe=0;if(tick<120)input.strafe=-1;else if(tick>=160&&tick<200)input.strafe=1;else if(tick>=220&&tick<300){input.forward=1;input.strafe=1;}input.fire=tick>=320&&tick<560;input.firePresses=tick===320?1:0;input.ads=tick>=400;time+=DT;m.step(input,0,DT,time);
     w.step(time,DT,input,()=>{const s=w.calculateReferenceSpread(m,input.ads,false,ref,false);sx+=s.x;sy+=s.y;w.recoil.kick(w.shotIndex,w.profile,w.recoilRng,m.crouch,time);count++;});}
    expect(native.position[0],`${weapon} ${fps}`).toBeCloseTo(m.position.x,10);expect(native.position[1]).toBeCloseTo(m.position.z,10);expect(native.speed).toBeCloseTo(m.speed,10);expect(native.shots).toBe(count);expect(native.spread[0]).toBeCloseTo(sx,10);expect(native.spread[1]).toBeCloseTo(sy,10);
   }
  }finally{rmSync(dir,{recursive:true,force:true});}
 },60000);
});
