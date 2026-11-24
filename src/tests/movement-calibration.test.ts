import {AIR_STEERING_SIMULATION_RULES} from '../engine/simulation/rules';
import {describe,it,expect} from 'vitest';
import {MOVEMENT} from '../config/movement';
import {Movement} from '../engine/movement/Movement';
import {Footsteps} from '../engine/footsteps/Footsteps';
import {emptyInput} from '../engine/types';
import {FIXED_DT as dt} from '../engine/simulation/FixedClock';

const rounded=(value:number)=>Number(value.toFixed(6));
/** Software-only comparison from the same initial speed; this is deliberately
 * separate from any future capture-based comparison with a native game. */
function travel(mode:'run'|'single'|'chain'|'air-turn',cap=5.5){
 const m=new Movement({...MOVEMENT,hopSpeedCap:cap},[]);m.setSimulationRules(AIR_STEERING_SIMULATION_RULES);m.reset({x:0,y:0,z:0});m.velocity.z=-5.4;m.speed=5.4;
 let distance=0,lastRequest=-1,airborneTicks=0,contactTicks=0,largestTurn=0;const landings:number[]=[];
 for(let tick=0;tick<720;tick++){
  const i=emptyInput(),time=tick*dt,canChain=(mode==='chain'||mode==='air-turn')&&!m.grounded&&m.velocity.y<0&&m.position.y<.25&&time-lastRequest>.2;
  i.forward=1;i.jump=mode!=='run'&&(tick===0||canChain);if(i.jump)lastRequest=time;
  const before=Math.atan2(m.velocity.x,-m.velocity.z);m.step(i,mode==='air-turn'?time*.65:0,dt,time);distance+=Math.hypot(m.position.x-m.previous.x,m.position.z-m.previous.z);
  if(m.grounded)contactTicks++;else airborneTicks++;const after=Math.atan2(m.velocity.x,-m.velocity.z);largestTurn=Math.max(largestTurn,Math.abs(Math.atan2(Math.sin(after-before),Math.cos(after-before))));
  if(m.hopSnapshot().landings>landings.length)landings.push(time);
 }
 const h=m.hopSnapshot();return{mode,cap,seconds:6,pathMeters:rounded(distance),netMeters:rounded(Math.hypot(m.position.x,m.position.z)),peakSpeed:rounded(h.peakSpeed),finalSpeed:rounded(m.speed),jumps:h.jumps,chains:h.chainedJumps,landings:h.landings,meanLandingInterval:landings.length>1?rounded((landings.at(-1)!-landings[0])/(landings.length-1)):null,lastInputTimingMs:h.lastInputTimingMs===null?null:rounded(h.lastInputTimingMs),lastSpeedPreservation:h.speedPreservation===null?null:rounded(h.speedPreservation),groundTicks:contactTicks,airborneTicks,largestTurnDegrees:rounded(largestTurn*180/Math.PI)};
}
function brake(sign:number){
 const m=new Movement({...MOVEMENT},[]),f=new Footsteps();m.reset({x:0,y:0,z:0});m.velocity.x=5.4*sign;m.speed=5.4;f.footstepAccumulation=.7;f.graceRemaining=0;
 let firstRecovery:number|null=null,lastRecovery:number|null=null,minimum=1;
 for(let tick=0;tick<30;tick++){const i={...emptyInput(),strafe:-sign};m.step(i,0,dt,tick*dt);f.step(m,false,dt,tick*dt);if(f.brakingRecoveryActive){firstRecovery??=tick*dt;lastRecovery=tick*dt;}minimum=Math.min(minimum,f.footstepAccumulation);}
 return{direction:sign===1?'D-to-A':'A-to-D',firstRecoverySeconds:firstRecovery===null?null:rounded(firstRecovery),lastRecoverySeconds:lastRecovery===null?null:rounded(lastRecovery),recoveredByBraking:rounded(f.recoveredByBraking),minimumGauge:rounded(minimum),audibleEvents:f.totalEvents,eligibleMeters:rounded(f.eligibleDistance)};
}
describe('Reproducible provisional movement calibration',()=>{
 it('compares run, single jump, chained jump and air turning with a capped small momentum allowance',()=>{
  const rows=[travel('run'),travel('single'),travel('chain'),travel('air-turn',5.4),travel('air-turn',5.5)],braking=[brake(-1),brake(1)];
  expect(rows[0].pathMeters).toBeCloseTo(32.4,6);expect(rows[1].pathMeters).toBeCloseTo(rows[0].pathMeters,6);expect(rows[2].chains).toBeGreaterThan(8);expect(rows[2].pathMeters).toBeCloseTo(rows[0].pathMeters,6);
  expect(rows[3].peakSpeed).toBeLessThanOrEqual(5.4);expect(rows[4].peakSpeed).toBeLessThanOrEqual(5.5);expect(rows[4].pathMeters).toBeGreaterThan(rows[3].pathMeters);expect(rows[4].largestTurnDegrees).toBeLessThan(1);
  expect(braking[0].recoveredByBraking).toBeGreaterThan(0);expect({...braking[0],direction:''}).toEqual({...braking[1],direction:''});
  console.info(JSON.stringify({benchmark:'movement-software-calibration',physicsHz:120,nativeGameMeasured:false,gpuTested:false,rows,braking}));
 });
});
