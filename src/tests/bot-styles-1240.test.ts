import {describe,expect,it} from 'vitest';
import {Simulation} from '../engine/simulation/Simulation';
import {DEFAULT_SETTINGS} from '../config/settings';
import {emptyInput,type Settings} from '../engine/types';
import {BOT_KINEMATICS,BOT_MOVEMENT_STYLE_IDS,type BotMovementChoice,type BotMovementStyleId} from '../engine/tactical/botMovementStyles';
import {standingSpace,visibleBetween} from '../engine/tactical/levels';
import {ReplayRecorder} from '../engine/replay/recording';
import {ReplayPlayer} from '../engine/replay/playback';
import {VALORANT_REFERENCE} from '../config/valorantReference';
import {characterPartSourceGeometry} from '../engine/rendering/CharacterGeometry';
import {applyBotAppearance,BOT_PALETTE} from '../engine/rendering/BotAppearance';
import {Color} from 'three';

const DT=1/120;
function arena(botMovement:BotMovementChoice,patch:Partial<Settings>={}){
 const s=new Simulation('free','rifleA',{...structuredClone(DEFAULT_SETTINGS),practiceMap:'site' as never,combatMode:'learning',exposureEnabled:false,botMovement,seed:3,targetCount:1,infiniteReserve:true,...patch});
 s.running=true;const ai=s.defenders!,bot=s.targets.find(t=>t.enabled)!,m=ai.memories[bot.id];
 // Stand in clear view of the held angle so the bot fights.
 for(const d of [11,9,13]){const p={x:bot.anchor.x+m.holdingFace.x*d,y:0,z:bot.anchor.z+m.holdingFace.z*d};if(standingSpace(s.obstacles,p,.3)&&visibleBetween(s.obstacles,{x:p.x,y:1.6,z:p.z},{x:bot.anchor.x,y:1.5,z:bot.anchor.z})){s.movement.position.set(p.x,p.y,p.z);s.movement.previous.set(p.x,p.y,p.z);break;}}
 return {s,ai,bot,m};
}
interface Signature {fight:number;moveSegment:number;stop:number;flipsPerSecond:number;lateralRange:number;crouchMoving:number;crouchStill:number;closest:number;maxSpeed:number;invalid:number}
function fight(style:BotMovementStyleId,seconds=20):Signature{
 const {s,bot,m}=arena(style),lx=-m.holdingFace.z,lz=m.holdingFace.x,segments:number[]=[],stops:number[]=[],lateral:number[]=[];
 let run=0,still=0,fightTime=0,flips=0,last=0,moving=0,stillTime=0,crouchMoving=0,crouchStill=0,closest=Infinity,maxSpeed=0,invalid=0;
 for(let i=0;i<seconds*120;i++){s.step(DT,emptyInput());
  const v=Math.hypot(bot.velocity.x,bot.velocity.z);maxSpeed=Math.max(maxSpeed,v);if(!standingSpace(s.obstacles,bot.position,.29))invalid++;
  if((m.style as unknown as {phase:string}).phase!=='fight')continue;fightTime+=DT;
  lateral.push((bot.position.x-bot.anchor.x)*lx+(bot.position.z-bot.anchor.z)*lz);closest=Math.min(closest,Math.hypot(bot.position.x-s.movement.position.x,bot.position.z-s.movement.position.z));
  const dir=Math.sign(bot.velocity.x*lx+bot.velocity.z*lz);if(v>1&&dir&&dir!==last){flips++;last=dir;}
  if(v>1.6){run+=DT;if(still){stops.push(still);still=0;}moving+=DT;if(bot.crouch>.5)crouchMoving+=DT;}else{still+=DT;if(run){segments.push(run);run=0;}stillTime+=DT;if(bot.crouch>.5)crouchStill+=DT;}
 }
 const median=(a:number[])=>a.length?[...a].sort((x,y)=>x-y)[Math.floor(a.length/2)]:0;
 return {fight:fightTime,moveSegment:median(segments),stop:median(stops),flipsPerSecond:flips/Math.max(1,fightTime),lateralRange:Math.max(...lateral)-Math.min(...lateral),crouchMoving:crouchMoving/Math.max(.01,moving),crouchStill:crouchStill/Math.max(.01,stillTime),closest,maxSpeed,invalid};
}

describe('12.40 bot movement styles',()=>{
 const results=Object.fromEntries(BOT_MOVEMENT_STYLE_IDS.map(id=>[id,fight(id)])) as Record<BotMovementStyleId,Signature>;
 it('every style fights, stays inside walkable space and never exceeds the weapon run speed',()=>{
  for(const id of BOT_MOVEMENT_STYLE_IDS){const r=results[id];expect(r.fight,id).toBeGreaterThan(10);expect(r.invalid,id).toBe(0);expect(r.maxSpeed,id).toBeLessThanOrEqual(5.4+1e-6);}
 });
 it('shows each style\'s signature',()=>{
  const r=results;
  expect(r.closeRush.closest).toBeLessThan(5);expect(r.closeRush.moveSegment).toBeLessThan(.3);expect(r.closeRush.crouchStill).toBeGreaterThan(.3);
  expect(r.wideSwing.moveSegment).toBeGreaterThan(.45);expect(r.wideSwing.lateralRange).toBeGreaterThan(2.5);
  expect(r.poppin.lateralRange).toBeGreaterThan(6);expect(r.poppin.flipsPerSecond).toBeLessThan(1);expect(r.poppin.stop).toBeLessThan(.15);
  expect(r.flashback.crouchMoving).toBeGreaterThan(.9);
  expect(r.karon.crouchStill).toBeGreaterThan(.8);expect(r.karon.crouchMoving).toBeLessThan(.4);
  expect(r.primmie.crouchStill).toBeGreaterThan(.2);expect(r.primmie.crouchStill).toBeLessThan(.8);
  expect(r.texture.stop).toBeLessThan(.14);expect(r.texture.closest).toBeGreaterThan(6.4);expect(r.texture.closest).toBeLessThan(10.5);
  expect(r.jiggleCrouch.lateralRange).toBeLessThan(1.2);expect(r.jiggleCrouch.crouchStill).toBeGreaterThan(.1);
  for(const id of ['wideSwing','poppin','texture'] as const)expect(results[id].crouchStill+results[id].crouchMoving,id).toBe(0);
 });
 it('12.41 Something style: short peek, rough-brake tap, then a wide swipe the same way and a full stop',()=>{
  const {s,bot,m}=arena('something'),lx=-m.holdingFace.z,lz=m.holdingFace.x;
  const cycles:{peekSign:number;peekTime:number;swipeSign:number;swipeTime:number}[]=[];let current:{peekSign:number;peekTime:number;swipeSign:number;swipeTime:number}|null=null;
  for(let i=0;i<120*15;i++){s.step(DT,emptyInput());const c=m.style as unknown as {tapStep:number;moving:boolean;phase:string};if(c.phase!=='fight'||!c.moving)continue;const v=bot.velocity.x*lx+bot.velocity.z*lz;
   if(c.tapStep===0){if(!current||current.swipeTime>0){if(current)cycles.push(current);current={peekSign:0,peekTime:0,swipeSign:0,swipeTime:0};}current.peekTime+=DT;if(Math.abs(v)>1)current.peekSign=Math.sign(v);}
   if(c.tapStep===2&&current){current.swipeTime+=DT;if(Math.abs(v)>1)current.swipeSign=Math.sign(v);}}
  expect(cycles.length).toBeGreaterThan(8);
  for(const k of cycles){expect(k.swipeSign).toBe(k.peekSign);expect(k.swipeTime).toBeGreaterThan(k.peekTime*1.8);expect(k.peekTime).toBeLessThan(.25);}
  // Consecutive cycles alternate sides.
  expect(cycles.slice(1).filter((k,i)=>k.peekSign!==cycles[i].peekSign).length).toBeGreaterThanOrEqual(cycles.length-3);
  // In a gunfight the tap is fired while still sliding (not fully stopped) and is a single shot.
  const g=arena('something',{combatMode:'gunfight',defenderSkill:'beginner'});let tapShots=0,tapSpeed=0;
  g.ai.onShot=()=>{if((g.m.style as unknown as {tapping:boolean}).tapping){tapShots++;tapSpeed=Math.max(tapSpeed,Math.hypot(g.bot.velocity.x,g.bot.velocity.z));}};
  for(let i=0;i<120*8&&!g.ai.death;i++)g.s.step(DT,emptyInput());
  expect(tapShots).toBeGreaterThan(0);expect(tapSpeed).toBeGreaterThan(.3);expect(tapSpeed).toBeLessThanOrEqual(VALORANT_REFERENCE.deadzone*5.4+1e-6);
 });
 it('12.43 Canezerra style decides after each shot: keep shooting on a hit, shift once or fall back to cover on a miss',()=>{
  const r=results.canezerra;expect(r.crouchMoving+r.crouchStill).toBe(0);
  type State={phase:string;step2:string;moving:boolean;coverSide:number};
  // Open ground, a strafing player: hits hold position, misses shift one way, no shot while moving.
  const g=arena('canezerra',{combatMode:'gunfight',defenderSkill:'beginner'}),lx=-g.m.holdingFace.z,lz=g.m.holdingFace.x;let hits=0,misses=0,shiftFlips=0,lastShiftSign=0;
  g.ai.onShot=e=>{const c=g.m.style as unknown as State;expect(c.moving).toBe(false);if(e.hit==='miss')misses++;else hits++;};
  for(let i=0;i<120*8&&!g.ai.death;i++){g.s.step(DT,{...emptyInput(),strafe:Math.floor(i/40)%2?1:-1});const c=g.m.style as unknown as State;
   if(c.phase==='fight'&&c.step2==='follow')expect(Math.hypot(g.bot.velocity.x,g.bot.velocity.z)).toBeLessThan(1.5);
   if(c.phase==='fight'&&c.step2==='shift'&&c.moving){const v=g.bot.velocity.x*lx+g.bot.velocity.z*lz;if(Math.abs(v)>1){const sg=Math.sign(v);if(lastShiftSign&&sg!==lastShiftSign)shiftFlips++;lastShiftSign=sg;}}else lastShiftSign=0;}
  expect(hits).toBeGreaterThan(0);expect(misses).toBeGreaterThan(0);expect(shiftFlips).toBe(0);
  // Next to cover (garage, bot 1): a miss sends it fully behind cover before it fights again.
  const s=new Simulation('free','rifleA',{...structuredClone(DEFAULT_SETTINGS),practiceMap:'garage' as never,combatMode:'gunfight',botMovement:'canezerra',seed:3,defenderSkill:'beginner'});s.running=true;
  for(const t of s.targets)if(t.id!==1)t.enabled=false;const bot=s.targets[1],m=s.defenders!.memories[1];
  for(const d of [12,10,14,8]){const p={x:bot.anchor.x+m.holdingFace.x*d,y:bot.anchor.y,z:bot.anchor.z+m.holdingFace.z*d};if(standingSpace(s.obstacles,p,.3)&&visibleBetween(s.obstacles,{x:p.x,y:p.y+1.6,z:p.z},{x:bot.anchor.x,y:bot.anchor.y+1.5,z:bot.anchor.z})){s.movement.position.set(p.x,p.y,p.z);s.movement.previous.set(p.x,p.y,p.z);break;}}
  let returns=0,reachedHide=0,prev='';
  for(let i=0;i<120*8&&!s.defenders!.death;i++){s.step(DT,{...emptyInput(),strafe:Math.floor(i/40)%2?1:-1});const c=m.style as unknown as State;expect(c.coverSide).not.toBe(0);
   if(c.phase!==prev){if(c.phase==='return')returns++;if(prev==='return'){expect(c.phase).toBe('hide');reachedHide++;}prev=c.phase;}}
  expect(returns).toBeGreaterThan(0);expect(reachedHide).toBeGreaterThan(0);
 });
 it('only shoots accurately: stopped below the deadzone, or crouch-walking',()=>{
  for(const id of BOT_MOVEMENT_STYLE_IDS){
   const {s,ai,bot}=arena(id,{combatMode:'gunfight'});let shots=0;const deadzone=VALORANT_REFERENCE.deadzone*5.4;
   ai.onShot=()=>{shots++;const v=Math.hypot(bot.velocity.x,bot.velocity.z);expect(v<=deadzone+1e-6||bot.crouch>.5&&v<=5.4*BOT_KINEMATICS.crouchSpeed+.05,`${id} ${v}`).toBe(true);};
   for(let i=0;i<120*6&&!ai.death;i++)s.step(DT,emptyInput());expect(shots,id).toBeGreaterThan(0);
  }
 });
 it('is deterministic, records the style on a death and replays exactly',async()=>{
  const run=()=>{const {s,ai,bot}=arena('random',{combatMode:'gunfight'});const path:number[]=[];for(let i=0;i<600&&!ai.death;i++){s.step(DT,emptyInput());path.push(bot.position.x,bot.position.z,bot.crouch);}return {path,death:ai.death,shots:ai.shots.length};};
  const a=run(),b=run();expect(a.path).toEqual(b.path);expect(a.shots).toBe(b.shots);expect(a.death?.style).toBeDefined();expect(BOT_MOVEMENT_STYLE_IDS).toContain(a.death!.style);
  const s=new Simulation('free','rifleA',{...structuredClone(DEFAULT_SETTINGS),practiceMap:'site' as never,combatMode:'gunfight',botMovement:'poppin',seed:9}),recorder=new ReplayRecorder(s);s.running=true;
  for(let n=0;n<600;n++)s.step(DT,{...emptyInput(),strafe:n%90<40?1:n%90<45?-1:0,fire:n%30<2,firePresses:n%30===0?1:0});
  const record=recorder.finish()!;expect(JSON.stringify(record)).toContain('"botMovement":"poppin"');expect((await new ReplayPlayer(record).verify()).passed).toBe(true);
 });
 it('random gives bots different styles; off keeps the classic AI unchanged',()=>{
  const seen=new Set<string>();for(const seed of [1,2,3,4,5,6]){const s=new Simulation('free','rifleA',{...structuredClone(DEFAULT_SETTINGS),practiceMap:'site' as never,botMovement:'random',seed});s.running=true;s.step(DT,emptyInput());for(const t of s.targets)if(t.enabled)seen.add(s.defenders!.styleOf(t.id)!);}
  expect(seen.size).toBeGreaterThanOrEqual(5);
  const classic=(withKey:boolean)=>{const settings={...structuredClone(DEFAULT_SETTINGS),practiceMap:'site' as never,combatMode:'gunfight' as const,seed:4} as Partial<Settings>;if(!withKey)delete settings.botMovement;const s=new Simulation('free','rifleA',settings as Settings);s.running=true;const out:number[]=[];for(let i=0;i<480;i++){s.step(DT,{...emptyInput(),strafe:i<200?1:-1});for(const t of s.targets)out.push(t.position.x,t.position.z);}return {out,shots:s.defenders!.shots.length};};
  expect(classic(true)).toEqual(classic(false));
  // Off stores nothing in defender memory, which is part of the replay checksum.
  const off=new Simulation('free','rifleA',{...structuredClone(DEFAULT_SETTINGS),practiceMap:'site' as never,botMovement:'off'});off.running=true;for(let i=0;i<60;i++)off.step(DT,emptyInput());for(const m of off.defenders!.memories)expect(Object.hasOwn(m,'style')).toBe(false);
 });
});

describe('12.40 training-bot look',()=>{
 it('recolours every authored finish without touching the hit triangles',()=>{
  const authored=new Set([...BOT_PALETTE.keys()].map(hex=>{const c=new Color(hex);return [c.r,c.g,c.b].map(v=>Math.round(v*255)).join(',');}));
  for(let part=0;part<11;part++){
   const source=characterPartSourceGeometry(part),copy=source.clone(),before=Array.from(copy.getAttribute('position').array);
   const colors=copy.getAttribute('color').array as Uint8Array;for(let i=0;i<colors.length;i+=3)expect(authored.has(`${colors[i]},${colors[i+1]},${colors[i+2]}`),`part ${part}`).toBe(true);
   applyBotAppearance(copy,'trainingBot');expect(Array.from(copy.getAttribute('position').array)).toEqual(before);expect(copy.index!.array).toEqual(source.index!.array);
   expect(Array.from(copy.getAttribute('color').array)).not.toEqual(Array.from(source.getAttribute('color').array));
   const agent=source.clone();applyBotAppearance(agent,'agent');expect(Array.from(agent.getAttribute('color').array)).toEqual(Array.from(source.getAttribute('color').array));
  }
 });
});
