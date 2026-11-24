import {describe,expect,it} from 'vitest';
import {DEFAULT_SETTINGS} from '../config/settings';
import {Movement} from '../engine/movement/Movement';
import {ReplayPlayer} from '../engine/replay/playback';
import {ReplayRecorder} from '../engine/replay/recording';
import {FIXED_DT as dt} from '../engine/simulation/FixedClock';
import {Simulation} from '../engine/simulation/Simulation';
import {CURRENT_SIMULATION_RULES,AIR_STEERING_SIMULATION_RULES,MATERIALS_SIMULATION_RULES,type SimulationRulesId} from '../engine/simulation/rules';
import {emptyInput,type InputState} from '../engine/types';

function flight(rules:SimulationRulesId, side:number, turnDegrees:number){
 const movement=new Movement(undefined,[]);
 movement.setSimulationRules(rules);
 let tick=0;
 const step=(input:Partial<InputState>,yaw=0)=>movement.step({...emptyInput(),...input},yaw,dt,++tick*dt);
 for(let i=0;i<36;i++)step({forward:1});
 const start=movement.position.clone();
 step({jump:true,jumpPresses:1});
 let airborneTicks=1,peak=movement.speed,maxHeadingDelta=0,lastHeading=0;
 while(!movement.grounded&&airborneTicks<100){
  step({strafe:side},-side*turnDegrees*Math.PI/180*Math.min(1,airborneTicks/60));
  const heading=Math.atan2(movement.velocity.x,-movement.velocity.z);
  maxHeadingDelta=Math.max(maxHeadingDelta,Math.abs(heading-lastHeading));
  lastHeading=heading;peak=Math.max(peak,movement.speed);airborneTicks++;
 }
 return {movement,heading:lastHeading*180/Math.PI,sideTravel:movement.position.x-start.x,maxHeadingDelta,peak,airborneTicks};
}

describe('VALORANT air steering',()=>{
 for(const side of [-1,1])it('curves the movement trajectory with synchronized mouse and strafe input, side '+side,()=>{
  const before=flight(MATERIALS_SIMULATION_RULES,side,65),after=flight(AIR_STEERING_SIMULATION_RULES,side,65);
  expect(side*after.heading).toBeGreaterThan(75);
  expect(side*(after.heading-before.heading)).toBeGreaterThan(20);
  expect(side*after.sideTravel).toBeGreaterThan(1.7);
  expect(after.maxHeadingDelta).toBeLessThan(.04);
  expect(after.peak).toBeLessThanOrEqual(5.67+1e-9);
  expect(after.airborneTicks).toBe(before.airborneTicks);
  console.info(JSON.stringify({benchmark:'tactical-air-steering',side,before:before.heading,after:after.heading,sideTravel:after.sideTravel,peak:after.peak}));
 });
 it('uses strafe input on its own and preserves heading without directional input',()=>{
  expect(flight(CURRENT_SIMULATION_RULES,1,0).heading).toBeGreaterThan(60);
  const neutral=flight(CURRENT_SIMULATION_RULES,0,65);
  expect(neutral.sideTravel).toBe(0);
  expect(neutral.heading).toBe(0);
 });
 it('rebuilds a chain of alternating hops and round-trips playback under both rule versions',async()=>{
  for(const rules of [MATERIALS_SIMULATION_RULES,AIR_STEERING_SIMULATION_RULES,CURRENT_SIMULATION_RULES]){
   const simulation=new Simulation('free','rifleA',{...DEFAULT_SETTINGS,targetCount:1}, {},rules);
   const recorder=new ReplayRecorder(simulation);
   simulation.running=true;
   for(let i=0;i<35;i++)simulation.step(dt,{...emptyInput(),forward:1});
   const heading=()=>Math.atan2(simulation.movement.velocity.x,-simulation.movement.velocity.z);
   for(const side of [1,-1,1]){
    const takeoffHeading=heading();
    simulation.step(dt,{...emptyInput(),jump:true,jumpPresses:1});
    expect(simulation.movement.grounded).toBe(false);
    for(let n=0;n<100&&!simulation.movement.grounded;n++){
     simulation.look(side*28,0);
     simulation.step(dt,{...emptyInput(),strafe:side,movementYaw:simulation.yaw});
    }
    expect(simulation.movement.grounded).toBe(true);
    if(rules===CURRENT_SIMULATION_RULES){
     const turn=heading()-takeoffHeading;
     expect(side*Math.atan2(Math.sin(turn),Math.cos(turn))).toBeGreaterThan(Math.PI/6);
    }
   }
   const hops=simulation.movement.hopSnapshot();
   expect(hops.jumps).toBe(3);expect(hops.chainedJumps).toBe(2);
   const recording=recorder.finish()!;
   const result=await new ReplayPlayer(recording).verify();
   expect(result.passed).toBe(true);
   expect(result.checksum).toBe(recording.final.checksum);
  }
 });
});
