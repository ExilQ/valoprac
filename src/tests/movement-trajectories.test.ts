import {afterAll,describe,expect,it} from 'vitest';
import {Box3,Vector3} from 'three';
import {Movement} from '../engine/movement/Movement';
import {InputCommandBuffer,type MovementAxes} from '../engine/input/InputCommandBuffer';
import {FixedClock,FIXED_DT} from '../engine/simulation/FixedClock';
import {emptyInput,type InputState} from '../engine/types';
import type {Obstacle} from '../engine/collision/environment';
import {LEVELS} from '../engine/tactical/levels';
import type {MovementPhysicsId} from '../config/movement';

const dt=FIXED_DT,profiles:MovementPhysicsId[]=['valorant','counterStrike'];
const measuredRows:Record<string,unknown>[]=[],renderEquality:{profile:MovementPhysicsId;renderHz:number;fixedHz:number;samples:number;equal:boolean}[]=[];
afterAll(()=>console.info(JSON.stringify({benchmark:'dual-movement-trajectories',schema:1,fixedHz:120,rows:measuredRows,renderEquality})));
const create=(id:MovementPhysicsId,obstacles:Obstacle[]=[])=>{const m=new Movement(undefined,obstacles);m.configurePhysics({movementPhysics:id,csMovementPreset:'cs2',jumpBufferMs:80});m.reset({x:0,y:0,z:0});return m;};
function runner(id:MovementPhysicsId,obstacles:Obstacle[]=[]){const m=create(id,obstacles);let tick=0;return{m,get time(){return tick*dt;},step(patch:Partial<InputState>={},yaw=0){m.step({...emptyInput(),...patch},yaw,dt,++tick*dt);},run(seconds:number,patch:Partial<InputState>={},yaw=0){for(let i=0;i<Math.round(seconds/dt);i++)this.step(patch,yaw);}};}
function takeoff(id:MovementPhysicsId){const r=runner(id);r.run(.7,{forward:1});expect(r.m.speed).toBeGreaterThan(4);r.step({forward:1,jump:true,jumpPresses:1});expect(r.m.grounded).toBe(false);return r;}
const heading=(m:Movement)=>Math.atan2(m.velocity.x,-m.velocity.z);
const box=(min:readonly[number,number,number],max:readonly[number,number,number]):Obstacle=>({kind:'wall',color:0,box:new Box3(new Vector3(...min),new Vector3(...max))});

describe('Mandatory movement trajectories A–H using actual resolved positions and velocity',()=>{
 for(const id of profiles){
  for(const[side,label]of[[-1,'A — fixed-camera left'],[1,'B — fixed-camera right']]as const)it(`${id}: ${label} redirects the airborne trajectory`,()=>{
   const r=takeoff(id),origin=r.m.position.clone();r.run(.18,{strafe:side});
   expect(r.m.grounded).toBe(false);expect(r.m.velocity.x*side).toBeGreaterThan(.5);expect((r.m.position.x-origin.x)*side).toBeGreaterThan(.05);expect(Math.abs(heading(r.m))).toBeGreaterThan(.08);
   measuredRows.push({profile:id,scenario:label[0],airDuration:.18,displacement:r.m.position.clone().sub(origin).toArray(),velocity:r.m.velocity.toArray(),headingRadians:heading(r.m)});
  });
  for(const side of[-1,1])it(`${id}: C — mouse-assisted ${side<0?'left':'right'} steering updates the wish basis and curves the real path`,()=>{
   const fixed=takeoff(id),turned=takeoff(id),turn=-side*.65,frames=Math.round(.2/dt),positions:Vector3[]=[],wish:Vector3[]=[];
   for(let n=1;n<=frames;n++){fixed.step({strafe:side});turned.step({strafe:side},turn*n/frames);positions.push(turned.m.position.clone());wish.push(turned.m.desiredDirection.clone());}
   expect(wish[0].distanceTo(wish.at(-1)!)).toBeGreaterThan(.5);expect(turned.m.position.distanceTo(fixed.m.position)).toBeGreaterThan(.02);expect(turned.m.velocity.distanceTo(fixed.m.velocity)).toBeGreaterThan(.2);
   const first=positions[6].clone().sub(positions[0]),last=positions.at(-1)!.clone().sub(positions.at(-7)!);expect(Math.abs(first.x*last.z-first.z*last.x)).toBeGreaterThan(.0001);
   measuredRows.push({profile:id,scenario:'C',side,yawChangeRadians:turn,airDuration:.2,position:turned.m.position.toArray(),velocity:turned.m.velocity.toArray(),headingRadians:heading(turned.m),positionDifferenceFromFixedYaw:turned.m.position.distanceTo(fixed.m.position)});
  });
  it(`${id}: D — reversed airborne input changes velocity over time without a snap`,()=>{
   const r=takeoff(id);r.run(.12,{strafe:-1});const before=r.m.velocity.x,position=r.m.position.clone();expect(before).toBeLessThan(-.5);r.step({strafe:1});
   expect(r.m.velocity.x).toBeGreaterThan(before);expect(r.m.velocity.x).toBeLessThan(.001);expect(r.m.position.distanceTo(position)).toBeLessThan(.1);r.run(.14,{strafe:1});expect(r.m.velocity.x).toBeGreaterThan(.1);
   measuredRows.push({profile:id,scenario:'D',beforeLateralVelocity:before,afterLateralVelocity:r.m.velocity.x,position:r.m.position.toArray(),velocity:r.m.velocity.toArray()});
  });
  it(`${id}: E — no air input preserves horizontal momentum while gravity creates an apex and landing`,()=>{
   const r=takeoff(id),horizontal=new Vector3(r.m.velocity.x,0,r.m.velocity.z);let hadAscent=false,hadDescent=false,apexHeight=0;
   for(let n=0;n<160&&!r.m.grounded;n++){r.step();hadAscent||=r.m.velocity.y>0;hadDescent||=r.m.velocity.y<0;apexHeight=Math.max(apexHeight,r.m.position.y);if(!r.m.grounded){expect(r.m.velocity.x).toBeCloseTo(horizontal.x,12);expect(r.m.velocity.z).toBeCloseTo(horizontal.z,12);}}
   expect(hadAscent).toBe(true);expect(hadDescent).toBe(true);expect(apexHeight).toBeGreaterThan(.5);expect(r.m.grounded).toBe(true);expect(r.m.position.y).toBe(0);expect(r.m.landingSerial).toBe(1);
   measuredRows.push({profile:id,scenario:'E',apexHeight,horizontalVelocity:horizontal.toArray(),landingTime:r.m.lastLandingTime,landingImpactSpeed:r.m.lastLandingImpactSpeed,position:r.m.position.toArray()});
  });
  it(`${id}: F — discrete landing-timed requests chain real jumps but holding Space does not`,()=>{
   const r=takeoff(id);let queued=false,lastJumps=1;
   for(let n=0;n<400&&r.m.hopSnapshot().jumps<4;n++){
    const request=!queued&&!r.m.grounded&&r.m.velocity.y<0&&r.m.position.y<.09;
    r.step(request?{jump:true,jumpPresses:1,jumpRequestedAt:r.time+dt}:{});if(request)queued=true;
    const jumps=r.m.hopSnapshot().jumps;if(jumps>lastJumps){lastJumps=jumps;queued=false;}
   }
   expect(r.m.hopSnapshot().jumps).toBe(4);expect(r.m.hopSnapshot().chainedJumps).toBe(3);expect(r.m.hopSnapshot().landings).toBe(3);expect(r.m.landingSerial).toBe(3);expect(r.m.speed).toBeGreaterThan(4);expect(r.m.position.y).toBeGreaterThanOrEqual(0);
   const held=runner(id);for(let n=0;n<360;n++)held.step({jump:true,jumpPresses:n===0?1:0});expect(held.m.hopSnapshot().jumps).toBe(1);expect(held.m.grounded).toBe(true);
   measuredRows.push({profile:id,scenario:'F',jumps:r.m.hopSnapshot().jumps,chains:r.m.hopSnapshot().chainedJumps,landings:r.m.hopSnapshot().landings,speed:r.m.speed,heldSpaceJumps:held.m.hopSnapshot().jumps,lastInputTimingMs:r.m.hopSnapshot().lastInputTimingMs});
  });
  it(`${id}: H — an airborne wall collision keeps tangential momentum and lands without penetration`,()=>{
   const r=runner(id,[box([1,0,-20],[1.02,4,20])]);r.m.position.set(0,0,0);r.m.velocity.set(5,0,-3);r.step({jump:true,jumpPresses:1});let touched=false;
   for(let n=0;n<160;n++){r.step();if(r.m.position.x>=.719)touched=true;expect(r.m.position.x).toBeLessThanOrEqual(.720000001);expect(r.m.velocity.length()).toBeLessThan(15);}
   expect(touched).toBe(true);expect(r.m.grounded).toBe(true);expect(r.m.landingSerial).toBe(1);expect(r.m.velocity.x).toBe(0);expect(r.m.position.z).toBeLessThan(-1);
  });
  it(`${id}: H — jump contact with a low ceiling cannot produce a grounded apex or repeated launch`,()=>{
   const r=runner(id,[box([-10,2.1,-10],[10,2.3,10])]);let hitCeiling=false;
   for(let n=0;n<120;n++){r.step({jump:true,jumpPresses:n===0?1:0});expect(r.m.position.y+1.85).toBeLessThanOrEqual(2.10000001);if(r.m.position.y>.24&&r.m.velocity.y===0){hitCeiling=true;expect(r.m.grounded).toBe(false);}}
   expect(hitCeiling).toBe(true);expect(r.m.grounded).toBe(true);expect(r.m.hopSnapshot().jumps).toBe(1);expect(r.m.hopSnapshot().landings).toBe(1);
  });
  it(`${id}: H — walking up actual tower stairs and the authored ramp yields valid ground support`,()=>{
   const stairs=runner(id,LEVELS.tower.obstacles);stairs.m.reset({x:0,y:0,z:2});stairs.run(2.5,{forward:1});expect(stairs.m.position.y).toBeCloseTo(1.2);expect(stairs.m.grounded).toBe(true);expect(stairs.m.supportHeight).toBeCloseTo(1.2);
   const ramp:Obstacle={...box([-2,0,-6],[2,1.5,0]),ramp:{axis:'z',low:0,high:1.5,ascending:-1}},slope=runner(id,[ramp]);slope.m.reset({x:0,y:0,z:.5});let climbed=false;
   for(let n=0;n<150;n++){slope.step({forward:1});if(slope.m.position.z<-.5&&slope.m.position.z>-5){climbed=true;expect(slope.m.grounded).toBe(true);expect(slope.m.position.y).toBeCloseTo(-slope.m.position.z*.25,9);expect(slope.m.groundNormal.y).toBeGreaterThan(.9);}}
   expect(climbed).toBe(true);
  });
  it(`${id}: a zero landing buffer still accepts one genuinely grounded within-tick jump`,()=>{
   const m=create(id);m.configurePhysics({movementPhysics:id,csMovementPreset:'cs2',jumpBufferMs:0});m.step({...emptyInput(),jump:true,jumpPresses:1,jumpRequestedAt:dt*.3},0,dt,dt);
   expect(m.hopSnapshot().jumps).toBe(1);expect(m.grounded).toBe(false);expect(m.position.y).toBeGreaterThan(0);m.step(emptyInput(),0,dt,dt*2);expect(m.hopSnapshot().jumps).toBe(1);
  });
  it(`${id}: a stale timestamp cannot refresh an expired jump request`,()=>{
   const m=create(id);m.configurePhysics({movementPhysics:id,csMovementPreset:'cs2',jumpBufferMs:0});m.step({...emptyInput(),jump:true,jumpPresses:1,jumpRequestedAt:-.1},0,dt,dt);
   expect(m.hopSnapshot().jumps).toBe(0);expect(m.grounded).toBe(true);expect(m.position.y).toBe(0);
  });
  it(`${id}: adjacent ramp/platform footprint contact cannot snap the player back to the ramp entrance`,()=>{
   const ramp:Obstacle={...box([8.95,0,-6],[11.05,2.4,.5]),ramp:{axis:'z',low:0,high:2.4,ascending:-1}},platform=box([8.5,0,-12],[11.5,2.4,-6]),r=runner(id,[ramp,platform]);r.m.reset({x:10,y:0,z:2});
   for(let n=0;n<480;n++){const previous=r.m.position.clone();r.step({forward:1,walk:true});expect(Math.abs(r.m.position.z-previous.z)).toBeLessThan(.05);expect(Math.abs(r.m.position.y-previous.y)).toBeLessThan(.05);expect(r.m.grounded).toBe(true);}
   expect(r.m.position.z).toBeLessThan(-6.4);expect(r.m.position.y).toBeCloseTo(2.4);expect(r.m.landingSerial).toBe(0);
  });
  it(`${id}: adjacent platform headroom blocks standing traversal but permits actual crouch clearance`,()=>{
   const ramp:Obstacle={...box([8.95,0,-6],[11.05,2.4,.5]),ramp:{axis:'z',low:0,high:2.4,ascending:-1}},platform=box([8.5,0,-12],[11.5,2.4,-6]),ceiling=box([8.5,3.9,-12],[11.5,4.1,-6]),r=runner(id,[ramp,platform,ceiling]);r.m.reset({x:10,y:0,z:2});
   r.run(4,{forward:1,walk:true});expect(r.m.position.z).toBeGreaterThan(-6);expect(r.m.position.y).toBeLessThan(2.4);const stopped=r.m.position.clone();r.run(.5,{forward:1,walk:true});expect(r.m.position.distanceTo(stopped)).toBeLessThan(.01);
   r.run(3,{forward:1,walk:true,crouch:true});expect(r.m.crouch).toBe(1);expect(r.m.position.z).toBeLessThan(-6.4);expect(r.m.position.y).toBeCloseTo(2.4);expect(r.m.position.y+1.35).toBeLessThan(3.9);r.run(.5);expect(r.m.crouch).toBeGreaterThan(.5);
  });
  it(`${id}: one second of real crouch+walk input reaches its intended reduced ground speed`,()=>{
   const r=runner(id);r.run(1,{forward:1,crouch:true,walk:true});const requested=r.m.profile.maxSpeed*r.m.profile.crouchModifier*r.m.profile.walkModifier;
   expect(r.m.grounded).toBe(true);expect(r.m.crouch).toBe(1);expect(r.m.speed).toBeCloseTo(requested,5);expect(r.m.position.z).toBeLessThan(-requested*.5);
  });
  it(`${id}: a two-millisecond grounded pulse produces a fractional impulse without becoming a full tick of movement`,()=>{
   const q=new InputCommandBuffer(),pulse=runner(id),full=runner(id);q.setAxes(.002,{forward:1,strafe:0,walk:false,crouch:false,jumpHeld:false,yaw:0});q.setAxes(.004,{forward:0,strafe:0,walk:false,crouch:false,jumpHeld:false,yaw:0});const sample=q.consume(0,dt);
   pulse.step({forward:sample.forward});full.step({forward:1});expect(pulse.m.speed).toBeGreaterThan(0);expect(pulse.m.speed).toBeLessThan(full.m.speed*.4);expect(pulse.m.position.distanceTo(new Vector3())).toBeLessThan(full.m.position.distanceTo(new Vector3())*.4);expect(q.consume(dt,2*dt).forward).toBe(0);
  });
 }
 it('G — identical commands produce measurable displacement, turning, jump and braking differences',()=>{
  const probes=profiles.map(id=>{const r=takeoff(id);let airTime=0;for(let n=0;n<120&&!r.m.grounded;n++){r.step(n<22?{strafe:-1}:{});airTime+=dt;}const landingSpeed=r.m.speed,landingHeading=heading(r.m);for(let n=0;n<8;n++)r.step();const afterLanding=r.m.speed;let stop=0;while(r.m.speed>.05&&stop<120){r.step();stop++;}return{profile:id,scenario:'G',position:r.m.position.toArray(),landingHeadingRadians:landingHeading,airTime,landingSpeed,afterLanding,stopSeconds:stop*dt};});
  measuredRows.push(...probes);
  // F2 raises the tactical jump: the old >100ms flight / >30cm travel gaps are no longer intended. Compare normalized landing retention because entry speeds also changed.
  expect(Math.abs(probes[0].airTime-probes[1].airTime)).toBeGreaterThan(.03);expect(Math.abs(probes[0].position[2]-probes[1].position[2])).toBeGreaterThan(.1);expect(Math.abs(probes[0].landingHeadingRadians-probes[1].landingHeadingRadians)).toBeGreaterThan(.1);expect(Math.abs(probes[0].landingSpeed-probes[1].landingSpeed)).toBeGreaterThan(.01);expect(Math.abs(probes[0].afterLanding/probes[0].landingSpeed-probes[1].afterLanding/probes[1].landingSpeed)).toBeGreaterThan(.02);expect(Math.abs(probes[0].stopSeconds-probes[1].stopSeconds)).toBeGreaterThan(.02);
 });
 it('CS2 projection limits directional acceleration without clamping a valid airborne velocity vector',()=>{
  const r=runner('counterStrike');r.m.position.y=10;r.m.grounded=false;r.m.velocity.set(8,0,-8);const before=r.m.velocity.clone();r.step();expect(r.m.velocity.x).toBe(before.x);expect(r.m.velocity.z).toBe(before.z);expect(r.m.speed).toBeGreaterThan(10);
  r.step({strafe:1});expect(r.m.velocity.x).toBe(before.x);expect(r.m.velocity.z).toBe(before.z);r.step({strafe:-1});expect(r.m.velocity.x).toBeLessThan(before.x);expect(r.m.velocity.x).toBeGreaterThan(0);
 });
 it('CS2 applies a finite takeoff limit, narrower early buffer and jump-spam penalty',()=>{
  const r=runner('counterStrike');r.m.velocity.set(12,0,0);r.step({jump:true,jumpPresses:1});expect(r.m.speed).toBeLessThanOrEqual(5.940000001);expect(r.m.speed).toBeGreaterThan(5.8);expect(r.m.physicsSnapshot().effectiveJumpBufferMs).toBe(40);
  for(let n=0;n<150&&!r.m.grounded;n++)r.step({jump:true,jumpPresses:1,jumpRequestedAt:r.time+dt});expect(r.m.grounded).toBe(true);expect(r.m.hopSnapshot().jumps).toBe(1);expect(r.m.physicsSnapshot().jumpSpamBlockedUntil!).toBeGreaterThan(r.time);
 });
 it('classic Source is an explicitly different preset with airborne momentum and a finite contact cap',()=>{
  const m=create('counterStrike');m.configurePhysics({movementPhysics:'counterStrike',csMovementPreset:'sourceClassic',jumpBufferMs:80});m.velocity.set(30,0,0);m.step({...emptyInput(),jump:true,jumpPresses:1},0,dt,dt);expect(m.profile.preset).toBe('sourceClassic');expect(m.speed).toBeCloseTo(20);expect(m.physicsSnapshot().effectiveJumpBufferMs).toBe(80);
 });
});

const axes=(patch:Partial<MovementAxes>={}):MovementAxes=>({forward:0,strafe:0,walk:false,crouch:false,jumpHeld:false,yaw:0,...patch});
type Command={time:number;axes?:MovementAxes;yaw?:number;jump?:true};
const commands:Command[]=[{time:0,axes:axes({forward:1})},{time:.232,axes:axes({forward:1,strafe:-1})},{time:.256,axes:axes({forward:1})},{time:.7,jump:true},{time:.708,axes:axes({strafe:-1})},{time:.73,yaw:.1},{time:.75,yaw:.2},{time:.77,yaw:.3},{time:.79,yaw:.4},{time:.81,yaw:.5},{time:.832,axes:axes({strafe:1,yaw:.5})},{time:.873,axes:axes({yaw:.5})},{time:.901,axes:axes({forward:1,yaw:.5})},{time:1.3,axes:axes({yaw:.5})},{time:1.702,axes:axes({strafe:-1,yaw:.5})},{time:1.704,axes:axes({yaw:.5})},{time:1.8,jump:true}];
function renderReplay(id:MovementPhysicsId,fps:number){const m=create(id),clock=new FixedClock(),buffer=new InputCommandBuffer();let cursor=0,tick=0;const trajectory:number[][]=[];for(let frame=1;tick<300;frame++){const now=frame/fps;while(cursor<commands.length&&commands[cursor].time<=now+1e-12){const c=commands[cursor++];if(c.axes)buffer.setAxes(c.time,c.axes);if(c.yaw!==undefined)buffer.setYaw(c.time,c.yaw);if(c.jump)buffer.jump(c.time);}clock.advance(1/fps,()=>{if(tick>=300)return;const s=buffer.consume(tick*dt,(tick+1)*dt),input={...emptyInput(),forward:s.forward,strafe:s.strafe,walk:s.walk,crouch:s.crouch,jump:s.jumpHeld||s.jumpTimes.length>0,jumpPresses:s.jumpTimes.length,jumpRequestedAt:s.jumpTimes.at(-1)};m.step(input,s.yaw,dt,++tick*dt);trajectory.push([...m.position.toArray(),...m.velocity.toArray(),+m.grounded,m.landingSerial,m.hopSnapshot().jumps]);});}return trajectory;}
describe('Fixed 120 Hz movement replay under different render schedules',()=>{
 for(const id of profiles)for(const fps of[60,144,240])it(`${id}: ${fps} Hz rendering preserves every trajectory sample for timestamped short pulses, yaw and jump requests`,()=>{const actual=renderReplay(id,fps);expect(actual).toEqual(renderReplay(id,120));renderEquality.push({profile:id,renderHz:fps,fixedHz:120,samples:actual.length,equal:true});});
});
