import type {Target} from '../targets/Target';
import type {FootstepEvent} from '../footsteps/Footsteps';
import {SeededRandom} from '../simulation/random';
import {TACTICAL_ZONES,canOccupy,lineClear} from './map';
export interface HearingMemory {heardAt:number;alertUntil:number;heardX:number;heardZ:number;goalX:number;goalZ:number;events:number;generation:number;reactAt:number;}
const PEEK_OFFSETS=[[1.7,0],[-1.7,0],[0,1.7],[0,-1.7],[1.2,1.2],[-1.2,-1.2]] as const;
export class TacticalHearing {
 readonly memories:HearingMemory[];heardEvents=0;
 constructor(private targets:Target[],private rng:SeededRandom){this.memories=targets.map(()=>({heardAt:-100,alertUntil:-100,heardX:0,heardZ:0,goalX:0,goalZ:0,events:0,generation:0,reactAt:0}));}
 spawn(target:Target,time:number,playerX:number,playerZ:number){const choices=TACTICAL_ZONES[target.id%TACTICAL_ZONES.length].filter(p=>canOccupy(p.x,p.z)&&Math.hypot(p.x-playerX,p.z-playerZ)>4);const p=choices[Math.floor(this.rng.next()*choices.length)]??TACTICAL_ZONES[target.id%TACTICAL_ZONES.length][0];target.spawn(p.x,p.z,time);const m=this.memories[target.id];Object.assign(m,{heardAt:-100,alertUntil:-100,goalX:p.x,goalZ:p.z,generation:target.generation,reactAt:0});}
 hear(e:FootstepEvent){let heard=false;
  for(const t of this.targets){if(!t.active||!t.enabled)continue;const distance=Math.hypot(e.position.x-t.position.x,e.position.z-t.position.z),radius=e.radius*(lineClear(e.position.x,e.position.z,t.position.x,t.position.z)?1:.65);if(distance>radius)continue;
   const m=this.memories[t.id];m.heardAt=e.timestamp;m.alertUntil=e.timestamp+3.3;m.heardX=e.position.x;m.heardZ=e.position.z;m.reactAt=e.timestamp+.18;m.events++;m.generation=t.generation;t.changeAt=e.timestamp;t.reactionRecorded=false;heard=true;
   // Investigate only the event's last-known position; never continuously read the player.
   let best=Infinity;for(const [dx,dz] of PEEK_OFFSETS){const x=t.anchor.x+dx,z=t.anchor.z+dz;if(!canOccupy(x,z)||!lineClear(t.position.x,t.position.z,x,z))continue;const score=Math.hypot(x-e.position.x,z-e.position.z)+(lineClear(x,z,e.position.x,e.position.z)?0:30);if(score<best){best=score;m.goalX=x;m.goalZ=z;}}
  }if(heard)this.heardEvents++;
 }
 step(t:Target,time:number,dt:number){const m=this.memories[t.id];t.previous.copy(t.position);if(!t.active)return;
  if(time>m.alertUntil){m.goalX=t.anchor.x;m.goalZ=t.anchor.z;}
  const dx=m.goalX-t.position.x,dz=m.goalZ-t.position.z,d=Math.hypot(dx,dz),amount=time<m.reactAt?0:Math.min(d,1.5*t.speedMultiplier*dt),x=t.position.x+(d?dx/d*amount:0),z=t.position.z+(d?dz/d*amount:0);
  t.velocity.set(d?dx/d*amount/dt:0,0,d?dz/d*amount/dt:0);if(canOccupy(x,z))t.position.set(x,0,z);else t.velocity.set(0,0,0);t.updatePose(time);
 }
}
