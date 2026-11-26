import {describe,expect,it} from 'vitest';
import {Simulation} from '../engine/simulation/Simulation';
import {DEFAULT_SETTINGS} from '../config/settings';
import {emptyInput,type InputState,type Settings} from '../engine/types';
import {ReplayRecorder} from '../engine/replay/recording';
import {ReplayPlayer} from '../engine/replay/playback';
import {TRAINING_RULES} from '../engine/simulation/trainingRules';
import type {SimulationRulesId} from '../engine/simulation/rules';
import type {Target} from '../engine/targets/Target';
import {Vector3} from 'three';
import {visibleBetween} from '../engine/tactical/levels';
import {simulationChecksum} from '../engine/replay/integrity';
const DEG=180/Math.PI;
const aim=(s:Simulation,point:Vector3)=>{const d=point.clone().sub(s.movement.position).sub(new Vector3(0,s.movement.eyeHeight,0)),yaw=Math.atan2(-d.x,-d.z),pitch=Math.atan2(d.y,Math.hypot(d.x,d.z)),gain=s.settings.sensitivity*s.settings.degreesPerCount;s.look(-(yaw-s.yaw)*DEG/gain,-(pitch-s.pitch)*DEG/gain);};

const DT=1/120;
const make=(patch:Partial<Settings>={},rules?:SimulationRulesId,weapon:'rifleA'|'rifleB'='rifleA')=>{const s=new Simulation('free',weapon,{...structuredClone(DEFAULT_SETTINGS),...patch},{},rules);s.running=true;return s;};
const run=(s:Simulation,seconds:number,input:Partial<InputState>|((n:number)=>Partial<InputState>)={})=>{for(let n=0;n<Math.round(seconds/DT);n++)s.step(DT,{...emptyInput(),...(typeof input==='function'?input(n):input)});};
const eliminate=(s:Simulation,t:Target)=>(s as unknown as {eliminateTarget(t:Target):void}).eliminateTarget(t);

describe('12.31 training-v7: bots return on training maps',()=>{
 it('brings an eliminated course bot back after the delay at its post or an alternative spot',()=>{
  const s=make({practiceMap:'bind' as never});run(s,.1);
  const t=s.targets.find(x=>x.enabled&&x.active)!;const generation=t.generation,post=s.level!.angles[t.id];
  eliminate(s,t);expect(t.active).toBe(false);
  run(s,DEFAULT_SETTINGS.botRespawnDelay-.2);expect(t.active).toBe(false);
  run(s,.4);expect(t.active).toBe(true);expect(t.generation).toBe(generation+1);
  const spots=[post.position,...(post.alternatives??[])];
  expect(spots.some(p=>Math.hypot(p.x-t.position.x,p.z-t.position.z)<1e-6)).toBe(true);
  expect(s.defenders!.memories[t.id].generation).toBe(t.generation);
 });
 it('keeps eliminated bots down when respawn is off, and under earlier rules',()=>{
  for(const [patch,rules] of [[{botRespawn:false},undefined],[{},'weapons-v6']] as const){
   const s=make({practiceMap:'bind' as never,...patch},rules);run(s,.1);const t=s.targets.find(x=>x.enabled&&x.active)!;eliminate(s,t);run(s,6);expect(t.active).toBe(false);
  }
 });
 it('honours the respawn delay setting',()=>{
  const s=make({practiceMap:'haven' as never,botRespawnDelay:1});run(s,.1);const t=s.targets.find(x=>x.enabled&&x.active)!;eliminate(s,t);run(s,1.1);expect(t.active).toBe(true);
 });
});

describe('12.31 training-v7: crouching in the air tucks the legs',()=>{
 const jump=(crouchInAir:boolean,rules?:SimulationRulesId)=>{
  const s=make({},rules);run(s,.2);let peakFeet=-Infinity,landedAt:number|null=null,airborne=false;const eyes:number[]=[];
  for(let n=0;n<240&&landedAt===null;n++){
   const jumpNow=n===0;s.step(DT,{...emptyInput(),jump:jumpNow,jumpHeld:n<3,crouch:crouchInAir&&n>=12});
   const m=s.movement;if(!m.grounded)airborne=true;if(airborne&&m.grounded)landedAt=s.time;peakFeet=Math.max(peakFeet,m.position.y);if(n>=10&&n<=20)eyes.push(m.position.y+m.eyeHeight);
  }
  return {landedAt:landedAt!,peakFeet,eyes,crouch:s.movement.crouch};
 };
 it('raises the feet so the jump lands later, without a sudden drop of the eyes',()=>{
  const plain=jump(false),tucked=jump(true);
  expect(tucked.crouch).toBeGreaterThan(.9);
  expect(tucked.peakFeet-plain.peakFeet).toBeGreaterThan(TRAINING_RULES.airCrouchTuck*.9);
  expect(tucked.landedAt-plain.landedAt).toBeGreaterThan(.05);
  // Eye height changes only by the small eye/hull difference, never by the full crouch drop.
  for(let i=1;i<tucked.eyes.length;i++)expect(Math.abs((tucked.eyes[i]-tucked.eyes[i-1])-(plain.eyes[i]-plain.eyes[i-1]))).toBeLessThan(.02);
 });
 it('keeps the earlier head-drop crouch under weapons-v6',()=>{
  const plain=jump(false,'weapons-v6'),tucked=jump(true,'weapons-v6');
  expect(Math.abs(tucked.landedAt-plain.landedAt)).toBeLessThan(1e-9);expect(Math.abs(tucked.peakFeet-plain.peakFeet)).toBeLessThan(1e-9);
 });
});

describe('12.31 training-v7: bots hear gunfire',()=>{
 const shootOutOfSight=(rules?:SimulationRulesId,weapon:'rifleA'|'rifleB'='rifleA')=>{
  const s=make({practiceMap:'bind' as never},rules,weapon);run(s,.1);s.yaw+=Math.PI;// look away from every post
  run(s,.05,{fire:true,firePresses:1});
  const live=s.targets.filter(t=>t.enabled&&t.active),p=s.movement.position;
  return live.map(t=>({heard:s.defenders!.memories[t.id].lastHeard>0,distance:Math.hypot(t.position.x-p.x,t.position.z-p.z)}));
 };
 it('alerts bots in earshot when the player fires, and not under earlier rules',()=>{
  const v7=shootOutOfSight();expect(v7.some(b=>b.heard)).toBe(true);
  for(const b of v7)if(b.distance>TRAINING_RULES.gunfireRadius)expect(b.heard).toBe(false);
  expect(shootOutOfSight('weapons-v6').some(b=>b.heard)).toBe(false);
 });
 it('carries the suppressed Phantom less far',()=>{
  const vandal=shootOutOfSight(undefined,'rifleA').filter(b=>b.heard).length,phantom=shootOutOfSight(undefined,'rifleB').filter(b=>b.heard).length;
  expect(phantom).toBeLessThanOrEqual(vandal);
 });
});

describe('12.31 infinite magazine option',()=>{
 it('keeps firing without emptying or reloading the magazine',()=>{
  const s=make({infiniteMagazine:true,behavior:'stationary'});run(s,4,{fire:true});
  expect(s.stats.shots).toBeGreaterThan(30);expect(s.weapon.ammo).toBe(s.weapon.profile.magazine);expect(s.weapon.reloadingUntil).toBeNull();
 });
 it('still empties the magazine by default',()=>{const s=make({behavior:'stationary'});run(s,2.4,{fire:true});expect(s.weapon.ammo).toBeLessThan(5);});
});

describe('12.31 training-v7 replays',()=>{
 it('records and verifies a real elimination, the respawn, gunfire alerts and an air crouch exactly',async()=>{
  // Recorded under the 12.31 rules (still accepted) and under the current rules.
  for(const rules of ['training-v7','audio-v8'] as const){let verified=false;
  for(const map of ['site','mid','multi','bind'] as const){
   const s=make({practiceMap:map as never,botRespawnDelay:1,botDifficulty:'easy'},rules),recorder=new ReplayRecorder(s),level=s.level!;let victim:Target|undefined,count=0;
   for(const destination of level.route.slice(1)){
    while(!victim&&Math.hypot(destination.x-s.movement.position.x,destination.z-s.movement.position.z)>.1&&count++<3000){
     const dx=destination.x-s.movement.position.x,dz=destination.z-s.movement.position.z;s.step(DT,{...emptyInput(),forward:1,movementYaw:Math.atan2(-dx,-dz)});
     const eye={x:s.movement.position.x,y:s.movement.position.y+s.movement.eyeHeight,z:s.movement.position.z};
     victim=s.targets.find(t=>t.enabled&&t.active&&visibleBetween(s.obstacles,eye,t.headPosition(new Vector3())));
    }
    if(victim)break;
   }
   if(!victim||!s.running)continue;
   for(let n=0;n<40;n++)s.step(DT,emptyInput());// stop moving so the first shot is accurate
   if(!victim.active||!s.running)continue;
   aim(s,victim.headPosition(new Vector3()));s.step(DT,{...emptyInput(),fire:true,firePresses:1});
   if(victim.active)continue;
   const generation=victim.generation;
   run(s,1.6,n=>({jump:n===20,jumpHeld:n>=20&&n<23,crouch:n>=32&&n<90}));
   expect(victim.generation).toBe(generation+1);
   const record=recorder.finish()!;expect(record.header.simulationRules).toBe(rules);
   const result=await new ReplayPlayer(record).verify();expect(result.passed).toBe(true);expect(result.checksum).toBe(simulationChecksum(s));
   verified=true;break;
  }
  if(!verified)throw new Error(`no map produced a clean first-shot elimination under ${rules}`);}
 });
});


describe('12.31 replay bot point of view',()=>{
 it('lists course bots and places the camera at the watched bot\'s eyes, along its actual aim',async()=>{
  const {replayBots,replayBotCamera}=await import('../ui/ReplayViewer');const {BOT_VIEW_OFFSET}=await import('../ui/replayTransport');
  const s=make({practiceMap:'bind' as never});run(s,.5);
  const bots=replayBots(s);expect(bots.length).toBe(s.targets.filter(t=>t.enabled).length);expect(bots.length).toBeGreaterThan(0);expect(bots.every(b=>typeof b.state==='string')).toBe(true);
  const t=s.targets.find(x=>x.id===bots[1].id)!,view=replayBotCamera(s,t.id)!;expect(view.index).toBe(s.targets.indexOf(t));
  const head=t.headPosition(new Vector3()),m=s.defenders!.memories[t.id],aim=m.motor.direction(new Vector3(),m.gun.recoil.pitch,m.gun.recoil.yaw);
  const position=new Vector3(view.camera.position.x,view.camera.position.y,view.camera.position.z),look=new Vector3(view.camera.target.x,view.camera.target.y,view.camera.target.z).sub(position).normalize();
  expect(position.distanceTo(head)).toBeCloseTo(BOT_VIEW_OFFSET,6);expect(look.angleTo(aim)).toBeLessThan(1e-6);expect(view.camera.fov).toBe(103);
  expect(replayBotCamera(s,999)).toBeNull();
 });
 it('offers no bot view where there are no bots, and faces the player when a bot has no aim',async()=>{
  const {replayBots}=await import('../ui/ReplayViewer');const {botViewCamera,inspectionCamera}=await import('../ui/replayTransport');
  expect(replayBots(make({practiceMap:'range' as never}))).toEqual([]);
  const camera=botViewCamera({x:0,y:1.6,z:0},{x:0,y:1.6,z:-10},null);expect(camera.position.z).toBeLessThan(0);expect(camera.target.z).toBeLessThan(camera.position.z);expect(camera.position.y).toBeCloseTo(1.6,9);
  expect(inspectionCamera({x:0,y:0,z:0},'bot')).toBeNull();
 });
});

describe('12.31 returning bots keep their placement settings',()=>{
 it('keeps the target size the map placed them with',()=>{
  const s=make({practiceMap:'site' as never,targetSize:1.5});run(s,.1);const t=s.targets.find(x=>x.enabled&&x.active)!;const scale=t.scale;
  eliminate(s,t);run(s,DEFAULT_SETTINGS.botRespawnDelay+.1);expect(t.active).toBe(true);expect(t.scale).toBe(scale);
 });
});
