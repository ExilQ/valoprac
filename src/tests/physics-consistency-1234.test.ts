import {describe,expect,it} from 'vitest';
import {AIR_ACTIONS,GROUND_STATES,PHYSICS_DT,PHYSICS_WEAPONS,TAKEOFFS,groundPath,hopChain,jumpCase,type JumpCase} from '../benchmarks/physicsAudit';
import {CONSISTENCY_RULES} from '../engine/simulation/consistencyRules';
import {Simulation} from '../engine/simulation/Simulation';
import {DEFAULT_SETTINGS} from '../config/settings';
import {emptyInput,type WeaponId} from '../engine/types';
import {ReplayRecorder} from '../engine/replay/recording';
import {ReplayPlayer} from '../engine/replay/playback';
import {SeededRandom} from '../engine/simulation/random';

const RUN:Record<string,number>={rifleA:5.4,rifleB:5.4,sheriff:5.4,operator:5.13,knife:6.75};
/** The invariants every jump must satisfy (see docs/PHYSICS_CONSISTENCY_12.34.md). */
function violations(c:JumpCase){
 const out:string[]=[],eps=.01;
 if(c.takeoffSpeed<c.groundSpeed-eps)out.push('jump cuts ground speed');
 if(c.minAir<c.takeoffSpeed-eps)out.push('air speed drops');
 if(c.maxAir>Math.min(c.takeoffSpeed+.75,Math.max(c.takeoffSpeed,RUN[c.weapon]*1.05))+eps)out.push('air gain beyond the allowance');
 if(c.landingSpeed<c.minAir-eps||c.landingSpeed>c.maxAir+eps)out.push('landing speed outside the flight');
 const silentLanding=c.takeoff==='crouchRun'&&(c.air==='stand'||c.air==='crouchThenStand');
 if(c.landingSounds!==(silentLanding?0:1))out.push('landing sound');
 if(c.jumpSounds!==(c.takeoff==='crouchRun'?0:1))out.push('jump sound');
 return out;
}

describe('12.34 consistency-v9: every jump scenario',()=>{
 it('keeps speed through every takeoff and air action, for every weapon (360 cases, 0 violations)',()=>{
  const failures:string[]=[];
  for(const w of PHYSICS_WEAPONS)for(const t of TAKEOFFS)for(const a of AIR_ACTIONS){const c=jumpCase(w,t,a);for(const v of violations(c))failures.push(`${w}/${t}/${a}: ${v} ${JSON.stringify(c)}`);}
  expect(failures).toEqual([]);
 },120000);
 it('found the differences under the earlier rules, which recorded replays keep',()=>{
  // 12.22 (bunny-hop-v5): every knife jump was cut to 1.05 x 5.4 m/s.
  expect(jumpCase('knife','run','none','bunny-hop-v5').takeoffSpeed).toBeCloseTo(5.67,2);
  // 12.32 (audio-v8): backward and crouch-same knife jumps were still cut to 1.10 x 5.4 m/s.
  expect(jumpCase('knife','backward','none','audio-v8').takeoffSpeed).toBeCloseTo(5.94,2);
  expect(jumpCase('knife','crouchSame','none','audio-v8').takeoffSpeed).toBeCloseTo(5.94,2);
  expect(jumpCase('knife','backward','none').takeoffSpeed).toBeCloseTo(6.21,2);expect(jumpCase('knife','crouchSame','none').takeoffSpeed).toBeCloseTo(6.75,2);
 },60000);
});

describe('12.34 consistency-v9: silent crouch-jump landing',()=>{
 it('lands a crouched takeoff stood up in the air below the threshold, and every other jump above it',()=>{
  const normal=jumpCase('rifleA','run','none'),crouched=jumpCase('rifleA','crouchRun','none'),stood=jumpCase('rifleA','crouchRun','stand'),tucked=jumpCase('rifleA','run','crouch');
  expect(normal.impact!).toBeGreaterThan(CONSISTENCY_RULES.silentLandingBelow);expect(crouched.impact!).toBeGreaterThan(CONSISTENCY_RULES.silentLandingBelow);expect(tucked.impact!).toBeGreaterThan(CONSISTENCY_RULES.silentLandingBelow);
  expect(stood.landingSounds).toBe(0);expect(stood.impact).toBeNull();expect(stood.airtime).toBeLessThan(normal.airtime-.05);
  // Earlier rules hear every landing.
  expect(jumpCase('rifleA','crouchRun','stand','audio-v8').landingSounds).toBe(1);
 },60000);
});

describe('12.34 ground and chained-hop consistency',()=>{
 it('reaches the same steady speed whatever the previous state or weapon',()=>{
  for(const w of PHYSICS_WEAPONS){
   for(const to of GROUND_STATES){const direct=groundPath(w,'still',to);for(const from of GROUND_STATES)expect(groundPath(w,from,to),`${w} ${from}->${to}`).toBeCloseTo(direct,3);}
   for(const other of PHYSICS_WEAPONS)if(other!==w)expect(groundPath(w,'run','run',undefined,other),`${w}->${other}`).toBeCloseTo(RUN[other],3);
  }
 },120000);
 it('keeps each weapon\'s run speed through six perfectly timed hops',()=>{
  for(const w of PHYSICS_WEAPONS){const hops=hopChain(w,6);expect(hops).toHaveLength(6);for(const v of hops)expect(v,w).toBeCloseTo(RUN[w],3);}
 },60000);
});

describe('12.34 randomized movement sessions',()=>{
 const session=(weapon:WeaponId,seed:number,ticks:number,record=false)=>{
  const s=new Simulation('free',weapon,{...structuredClone(DEFAULT_SETTINGS),practiceMap:'range' as never,behavior:'stationary',targetCount:1});s.running=true;
  const recorder=record?new ReplayRecorder(s):null,rng=new SeededRandom(seed);let peak=0,held={forward:0,strafe:0,walk:false,crouch:false,ads:false};
  for(let n=0;n<ticks;n++){
   if(n%12===0)held={forward:Math.floor(rng.next()*3)-1,strafe:Math.floor(rng.next()*3)-1,walk:rng.next()<.25,crouch:rng.next()<.25,ads:rng.next()<.25};
   const jump=rng.next()<.03,scope=weapon==='operator'&&rng.next()<.01;
   if(n%40===0)s.look((rng.next()-.5)*400,0);// recorded mouse input, unlike a direct yaw write
   s.step(PHYSICS_DT,{...emptyInput(),...held,jump,jumpHeld:jump,jumpPresses:jump?1:0,scopePresses:scope?1:0});
   const v=s.movement.velocity;expect(Number.isFinite(v.x+v.y+v.z+s.movement.position.y)).toBe(true);peak=Math.max(peak,s.movement.speed);
  }
  return{peak,record:recorder?.finish()??null};
 };
 it('never exceeds 1.10 x the weapon run speed in 64 random sessions',()=>{
  for(const w of PHYSICS_WEAPONS)for(let seed=1;seed<=16;seed++)expect(session(w,seed*7919,480).peak,`${w} ${seed}`).toBeLessThanOrEqual(RUN[w]*1.10+1e-6);
 },120000);
 it('replays random sessions exactly',async()=>{
  for(const w of PHYSICS_WEAPONS){const {record}=session(w,4242,600,true);expect((await new ReplayPlayer(record!).verify()).passed,w).toBe(true);}
 },120000);
});
