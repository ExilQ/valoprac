import {Movement} from '../engine/movement/Movement';
import {Footsteps} from '../engine/footsteps/Footsteps';
import {FixedClock} from '../engine/simulation/FixedClock';
import {emptyInput,type Settings} from '../engine/types';
import {footstepProfile} from '../config/footsteps';
export function compareFootstepRecovery(settings:Settings,fps:number){
 const measure=(stop:boolean):{retained:number;distance:number|null}=>{const m=new Movement(),f=new Footsteps(footstepProfile(settings)),clock=new FixedClock();m.position.x=-11;m.previous.copy(m.position);let tick=0,phase=0,at=0,entry=0,events=0,retained=0,distance:number|null=null;
  const restTicks=Math.ceil((f.profile.stationaryDelay+f.profile.threshold/f.profile.stationaryDecay+.5)*120);
  for(let frame=0;frame<fps*20&&distance===null;frame++)clock.advance(1/fps,dt=>{if(distance!==null)return;
   if(phase===0&&f.footstepAccumulation>=f.profile.threshold*.85){phase=1;at=tick;}
   if(phase===1&&tick-at>=(stop?restTicks:1)){phase=2;entry=m.position.x;events=f.totalEvents;retained=f.footstepAccumulation;}
   const input={...emptyInput(),strafe:phase===1&&stop?0:1,walk:phase===1&&!stop};tick++;m.step(input,0,dt,tick/120);f.step(m,input.walk,dt,tick/120);
   if(phase===2&&f.totalEvents>events)distance=f.journal[events%f.journal.length].position.x-entry;
  });return {retained,distance};
 };
 return {fps,walk:measure(false),stop:measure(true),exactGameParityVerified:false};
}
