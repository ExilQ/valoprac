import {describe,expect,it} from 'vitest';
import {VALORANT_BUNNY_HOP} from '../config/movement';
import {Movement} from '../engine/movement/Movement';
import {FIXED_DT as dt} from '../engine/simulation/FixedClock';
import {AIR_STEERING_SIMULATION_RULES,type SimulationRulesId} from '../engine/simulation/rules';
import {emptyInput,type InputState} from '../engine/types';

function measureFlight(axes:Partial<InputState>,offset=8,sweep=18,turn=true,rules?:SimulationRulesId){
 const movement=new Movement(undefined,[]);
 if(rules)movement.setSimulationRules(rules);
 let tick=0,peakSpeed=0,peakHeight=0;
 const step=(input:Partial<InputState>,yaw=0)=>movement.step({...emptyInput(),...input},yaw,dt,++tick*dt);
 const pace=axes.walk?movement.profile.walkModifier:axes.crouch?movement.profile.crouchModifier:1;
 const runningSpeed=movement.profile.maxSpeed*pace;
 for(let n=0;n<120;n++)step({forward:1,...axes});
 const start=movement.position.clone(),startTick=tick;
 const hopTicks=Math.ceil(2*movement.profile.jumpImpulse/(movement.profile.gravity*dt));
 for(let hop=0;hop<10;hop++){
  const side=hop%2===0?1:-1;
  for(let n=0;n<120;n++){
   const progress=Math.min(1,n/(hopTicks-1));
   const wishAngle=side*(offset+sweep*(progress-.5))*Math.PI/180;
   const yaw=turn?side*Math.PI/4-wishAngle:0;
   step({forward:1,strafe:turn?side:0,jump:n===0,jumpPresses:n===0?1:0,...axes},yaw);
   peakSpeed=Math.max(peakSpeed,movement.speed);peakHeight=Math.max(peakHeight,movement.position.y);
   if(movement.grounded)break;
  }
 }
 return {runningSpeed,forwardPace:(start.z-movement.position.z)/((tick-startTick)*dt*runningSpeed),peakSpeed,peakHeight,hops:movement.hopSnapshot(),elapsed:(tick-startTick)*dt};
}

describe('Bunny hop calibration against public route and flight observations',()=>{
 it('uses the source gravity and takeoff speed to reconstruct the fixed-step flight',()=>{
  const after=measureFlight({},0,0,false),before=measureFlight({},0,0,false,AIR_STEERING_SIMULATION_RULES);
  const {gravity,jumpImpulse}=VALORANT_BUNNY_HOP.vertical,flight=2*jumpImpulse/gravity,height=jumpImpulse**2/(2*gravity);
  expect(after.peakHeight).toBeCloseTo(height,3);
  expect(Math.abs(after.elapsed/10-flight)).toBeLessThanOrEqual(dt);
  expect(after.elapsed).toBeGreaterThan(before.elapsed);
  expect(after.forwardPace).toBeCloseTo(1,9);
  expect(after.hops.jumps).toBe(10);
  expect(after.hops.chainedJumps).toBe(9);
  console.info(JSON.stringify({benchmark:'bunny-hop-flight',height,flight,fixedStep:after.elapsed/10,previousFixedStep:before.elapsed/10,peak:after.peakHeight}));
 });
 it('fits normalized route pace under explicit diagonal input assumptions',()=>{
  const target=427/400;
  const samples=[[5,16],[8,18],[10,20]].map(([offset,sweep])=>{
   const after=measureFlight({},offset,sweep),
    before=measureFlight({},offset,sweep,true,AIR_STEERING_SIMULATION_RULES);
   expect(after.hops.chainedJumps).toBe(9);
   expect(after.peakSpeed/after.runningSpeed).toBeLessThanOrEqual(1.1+1e-9);
   return {offset,sweep,before:before.forwardPace,after:after.forwardPace,peak:after.peakSpeed};
  });
  const mean=samples.reduce((total,row)=>total+row.after/samples.length,0);
  expect(Math.abs(mean-target)).toBeLessThan(.018);
  expect(mean).toBeGreaterThan(1.05);
  console.info(JSON.stringify({benchmark:'bunny-hop-route-fit',target,mean,samples}));
 });
 it('retains stance limits instead of making slow takeoffs qualify for the running cap',()=>{
  for(const axes of [{walk:true},{crouch:true}]){
   const sample=measureFlight(axes);
   expect(sample.peakSpeed).toBeLessThanOrEqual(sample.runningSpeed+.75+1e-9);
   expect(sample.peakSpeed).toBeLessThan(4);
  }
 });
});
