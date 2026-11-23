import {random,shuffled,clamp} from './math';
import {TASKS,trackingTask,type AimBlock,type AimPhase,type AimPlan,type AimSetup,type AimTask} from './types';
export function candidates(base:number,range=.2,count=3){const b=clamp(Number.isFinite(base)?base:.35,.01,5),r=clamp(Number.isFinite(range)?range:.2,.05,.5),a=new Set<number>([b]);for(let i=0;i<count;i++){const t=count===1?0:2*i/(count-1)-1;a.add(+clamp(b*(t<0?(1-r)**(-t):(1+r)**t),.01,5).toFixed(5));}return Array.from(a).sort((a,b)=>a-b);}
export function makePlan(setup:AimSetup,phase:AimPhase,fov:number,coefficient:number,seed=1947,tasks:AimTask[]=TASKS.slice(),level=1,overrides?:number[]):AimPlan{
 const id=globalThis.crypto?.randomUUID?.()??`aim-${Date.now()}-${seed}`,rng=random(seed),values=phase==='exploration'?(overrides??candidates(setup.base,setup.range)):phase==='verification'?[setup.base,clamp(setup.alternative,.01,5)]:[setup.base];
 const rounds=phase==='training'?2:clamp(Math.round(setup.rounds),2,6),blocks:AimBlock[]=[],initial=shuffled(values,rng),held=phase==='verification'||phase==='transfer',taskOrder=shuffled(tasks,rng);
 for(let round=0;round<rounds;round++){const order=round%2===0?initial:initial.slice().reverse();const taskSeq=setup.schedule==='mixed'?shuffled(taskOrder,rng):taskOrder;
  for(const task of taskSeq)for(let i=0;i<order.length;i++){const sensitivity=order[(i+Math.floor(round/2))%order.length],radius=(task==='large'?.85:task==='small'?.32:task==='micro'?.18:task==='switch'?.45:.75)*(held?.85:1)/Math.sqrt(level),amplitude=(task==='micro'?1.6:task==='large'?9:task==='switch'?12:7)*(held?1.12:1)*Math.sqrt(level),targetSeed=(seed+round*1009+TASKS.indexOf(task)*71+(held?400001:0))>>>0;
   blocks.push({id:`${id}-${blocks.length}`,experiment:id,session:id,task,phase,sensitivity,seed:targetSeed,round,pair:`${round}-${task}`,order:blocks.length,radius,amplitude,duration:trackingTask(task)?8:2.5,warmup:2,trials:trackingTask(task)?1:8,difficulty:level});}}
 if(phase==='training'&&setup.schedule==='blocked')blocks.sort((a,b)=>TASKS.indexOf(a.task)-TASKS.indexOf(b.task)||a.round-b.round);blocks.forEach((b,i)=>b.order=i);
 return {id,createdAt:Date.now(),kind:phase,base:setup.base,alternative:phase==='verification'?setup.alternative:null,fov:clamp(fov,60,120),coefficient,dpi:setup.dpi,blocks,schedule:setup.schedule,goal:setup.goal,seed};
}
export function conditionKey(block:AimBlock,plan:AimPlan){return JSON.stringify({algorithm:'aim-1.0.0',task:block.task,radius:block.radius,amplitude:block.amplitude,duration:block.duration,seed:block.seed,fov:plan.fov,coefficient:plan.coefficient,dpi:plan.dpi,renderer:'angular-canvas',warmup:block.warmup});}
export const GOAL_WEIGHTS={balanced:[1,1,1,1,1,1],precision:[1,2,2,.5,.5,1],tracking:[.5,.5,.5,2,2,1]} as const;
