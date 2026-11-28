import {describe,expect,it} from 'vitest';
import {Simulation} from '../engine/simulation/Simulation';
import {DEFAULT_SETTINGS} from '../config/settings';
import {emptyInput,type InputState} from '../engine/types';
import {CROUCH_REFERENCE as C,VALORANT_REFERENCE as REF} from '../config/valorantReference';
import {ReplayRecorder} from '../engine/replay/recording';
import {ReplayPlayer} from '../engine/replay/playback';
import {jumpCase} from '../benchmarks/physicsAudit';
import type {SimulationRulesId} from '../engine/simulation/rules';

const DT=1/120,TICK=1000/120;
const make=(rules?:SimulationRulesId)=>{const s=new Simulation('free','rifleA',{...structuredClone(DEFAULT_SETTINGS),practiceMap:'range' as never,behavior:'stationary',infiniteMagazine:true},{},rules);s.running=true;s.movement.position.set(0,0,9);s.movement.previous.copy(s.movement.position);for(let n=0;n<90;n++)s.step(DT,emptyInput());return s;};
const until=(s:Simulation,input:Partial<InputState>|((n:number)=>Partial<InputState>),done:()=>boolean,max=120)=>{for(let n=1;n<=max;n++){s.step(DT,{...emptyInput(),...(typeof input==='function'?input(n):input)});if(done())return n*TICK;}return Infinity;};
const running=(rules?:SimulationRulesId,strafe=false)=>{const s=make(rules);for(let n=0;n<120;n++)s.step(DT,{...emptyInput(),...(strafe?{strafe:-1}:{forward:1})});return s;};
const shot=(s:Simulation,i:Partial<InputState>)=>{const before=s.shots.length;for(let n=0;n<240&&s.shots.length===before;n++)s.step(DT,{...emptyInput(),...i,fire:true,firePresses:1});return s.shots.at(-1)!.spread.total;};

describe('12.37 braking-v12: crouch speed',()=>{
 it('takes 0.275 s to crouch and to stand, within one tick (VALORANT replay: 20 units at 72.8 units/s)',()=>{
  const s=make();const down=until(s,{crouch:true},()=>s.movement.crouch>=1),up=until(s,{},()=>s.movement.crouch<=0);
  for(const t of [down,up])expect(Math.abs(t-C.crouchSeconds*1000)).toBeLessThanOrEqual(TICK+1e-6);
  const old=make('reference-v11');expect(until(old,{crouch:true},()=>old.movement.crouch>=1)).toBeLessThanOrEqual(125+TICK);
 });
 it('reaches the replay\'s crouch depths at 86, 94 and 101 ms of crouch',()=>{
  for(const [ms,depth] of [[86,6.25],[94,6.82],[101,7.39]] as const){const s=make();for(let n=0;n<Math.round(ms/TICK);n++)s.step(DT,{...emptyInput(),crouch:true});expect(s.movement.crouch*20).toBeCloseTo(depth,0);}
 });
});

describe('12.37 braking-v12: braking techniques',()=>{
 it('tap braking: a short opposite-key tap stops the strafe no later than releasing, without pushing back',()=>{
  const release=running(undefined,true),relDz=until(release,{},()=>release.movement.speed<=release.movement.accuracyLimit),relStop=relDz+until(release,{},()=>release.movement.speed<1e-6);
  for(const ticks of [2,4,6,8,10,12,16]){
   const s=running(undefined,true);let reverse=0;const dz=until(s,n=>({strafe:n<=ticks?1:0}),()=>s.movement.speed<=s.movement.accuracyLimit);
   const stop=dz+until(s,n=>({strafe:n+Math.round(dz/TICK)<=ticks?1:0}),()=>{reverse=Math.max(reverse,s.movement.velocity.x);return s.movement.speed<1e-6;});
   expect(dz,`${ticks} ticks`).toBeLessThanOrEqual(relDz);expect(stop,`${ticks} ticks`).toBeLessThanOrEqual(relStop);expect(reverse).toBe(0);
  }
  // Holding the opposite key past the stop starts moving the other way.
  const held=running(undefined,true);for(let n=0;n<24;n++)held.step(DT,{...emptyInput(),strafe:1});expect(held.movement.velocity.x).toBeGreaterThan(.5);
 });
 it('walk, aim and crouch braking slow down like releasing the keys (Unreal), not with the slower acceleration',()=>{
  const time=(rules:SimulationRulesId|undefined,input:Partial<InputState>,target:number)=>{const s=running(rules);return until(s,input,()=>s.movement.speed<=target*1.01);};
  const release=(target:number)=>{const s=running();return until(s,{},()=>s.movement.speed<=target);};
  for(const [input,target] of [[{forward:1,walk:true},2.592],[{forward:1,ads:true},4.104]] as const){
   const now=time(undefined,input,target),before=time('reference-v11',input,target);
   expect(now).toBeLessThan(before);expect(now).toBeLessThanOrEqual(release(target)+TICK);
  }
  // Crouch braking follows the 0.275 s crouch: crouch speed when fully crouched.
  const crouch=time(undefined,{forward:1,crouch:true},1.944);expect(Math.abs(crouch-C.crouchSeconds*1000)).toBeLessThanOrEqual(2*TICK);
 });
 it('deadzone moving: crouch-walking and aimed crouch-moving stay inside the 27.5% deadzone and shoot without a movement penalty',()=>{
  for(const input of [{forward:1,crouch:true,walk:true},{forward:1,crouch:true,ads:true}] as const){
   const s=make();for(let n=0;n<60;n++)s.step(DT,{...emptyInput(),crouch:true,ads:'ads' in input});for(let n=0;n<120;n++)s.step(DT,{...emptyInput(),...input});
   expect(s.movement.speed).toBeLessThanOrEqual(s.movement.accuracyLimit);expect(s.movement.accurate).toBe(true);
   const first='ads' in input?REF.spread.rifleA.adsFirst:REF.spread.rifleA.first;expect(shot(s,input)).toBeCloseTo(first*REF.spread.rifleA.crouch,6);
  }
  const walk=make();for(let n=0;n<120;n++)walk.step(DT,{...emptyInput(),forward:1,walk:true});expect(shot(walk,{forward:1,walk:true})).toBeCloseTo(REF.spread.rifleA.first+REF.spread.rifleA.penalties.walk,6);
  // Taps of up to 67 ms from a standstill never leave the deadzone.
  for(const ticks of [4,6,8]){const s=make();let peak=0;for(let n=1;n<=40;n++){s.step(DT,{...emptyInput(),strafe:n<=ticks?1:0});peak=Math.max(peak,s.movement.speed);}expect(peak,`${ticks}`).toBeLessThanOrEqual(s.movement.accuracyLimit);}
 });
});

describe('12.37 braking-v12: crouch jumps',()=>{
 const jump=(leadTicks:number)=>{const s=make(),sounds:unknown[]=[];s.onJump=e=>sounds.push(e);for(let n=0;n<leadTicks;n++)s.step(DT,{...emptyInput(),crouch:true});for(let n=0;n<4;n++)s.step(DT,{...emptyInput(),jump:n===0,jumpHeld:n===0,jumpPresses:n===0?1:0,crouch:true});return{sounds:sounds.length,silent:s.silentJumps};};
 it('keeps the replay study\'s silent-jump boundary: 92 ms of crouch heard, 100 ms silent',()=>{expect(jump(11).sounds).toBe(1);expect(jump(12)).toEqual({sounds:0,silent:1});expect(jump(0).sounds).toBe(1);});
 it('jumps 2.5% slower from a full crouch (replay: 109.32 instead of 115.00 units high)',()=>{
  const apex=(lead:number)=>{const s=make();for(let n=0;n<lead;n++)s.step(DT,{...emptyInput(),crouch:true});const y0=s.movement.position.y;let peak=0;for(let n=0;n<120;n++){s.step(DT,{...emptyInput(),jump:n===0,jumpHeld:n===0,jumpPresses:n===0?1:0,crouch:lead>0});peak=Math.max(peak,s.movement.position.y-y0);}return peak;};
  expect(apex(60)/apex(0)).toBeCloseTo(109.32/115,2);
 });
 it('tucks the feet 0.2 m in the air and lands silently only after a crouched takeoff stood up in the air',()=>{
  const normal=jumpCase('rifleA','run','none'),tucked=jumpCase('rifleA','run','crouch'),crouched=jumpCase('rifleA','crouchRun','none'),stood=jumpCase('rifleA','crouchRun','stand');
  for(const c of [normal,tucked,crouched])expect(c.landingSounds,`${c.takeoff}/${c.air}`).toBe(1);expect(stood.landingSounds).toBe(0);
  expect(crouched.impact!).toBeGreaterThan(C.silentLandingBelow);expect(normal.impact!).toBeGreaterThan(C.silentLandingBelow);
  expect(tucked.airtime-normal.airtime).toBeGreaterThan(.01);expect(tucked.airtime-normal.airtime).toBeLessThan(.04);
 });
});

describe('12.37 braking-v12 replays',()=>{
 it('records and verifies crouch, walk and counter braking exactly',async()=>{
  const s=new Simulation('free','rifleA',{...structuredClone(DEFAULT_SETTINGS),practiceMap:'range' as never}),recorder=new ReplayRecorder(s);s.running=true;
  for(let n=0;n<420;n++)s.step(DT,{...emptyInput(),strafe:n<120?-1:n<126?1:0,forward:n>=180&&n<330?1:0,crouch:n>=220&&n<260,walk:n>=280,jump:n===350,jumpHeld:n===350,jumpPresses:n===350?1:0,fire:n%40<2,firePresses:n%40===0?1:0});
  const record=recorder.finish()!;expect(record.header.simulationRules).toBe('braking-v12');expect((await new ReplayPlayer(record).verify()).passed).toBe(true);
 });
});
