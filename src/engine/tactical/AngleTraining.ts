import type {TacticalLevel} from './levels';
import {standingSpace,visibleBetween} from './levels';
import type {Target} from '../targets/Target';
import type {Settings} from '../types';
import {SeededRandom} from '../simulation/random';
import type {FootstepEvent} from '../footsteps/Footsteps';
import {approachVelocity,BOT_DIFFICULTY} from '../targets/locomotion';
import {LEGACY_SIMULATION_RULES,type SimulationRulesId} from '../simulation/rules';
export class AngleTraining {
 clears=0;completed=false;heardEvents=0;private cleared=new Set<number>();
 readonly memories:{alertUntil:number;reactAt:number;heardX:number;heardZ:number;events:number}[];
 constructor(readonly level:TacticalLevel,private targets:Target[],private rng:SeededRandom,private settings:Settings){this.memories=targets.map(()=>({alertUntil:-100,reactAt:0,heardX:0,heardZ:0,events:0}));}
 spawn(t:Target,time:number,rules:SimulationRulesId=LEGACY_SIMULATION_RULES){const a=this.level.angles[t.id];if(!a){t.enabled=false;t.active=false;return;}t.enabled=true;
  for(let n=0;n<12;n++){const x=a.position.x+this.rng.range(-a.jitter,a.jitter),z=a.position.z+this.rng.range(-a.jitter,a.jitter),p={x,y:a.position.y,z};if(standingSpace(this.level.obstacles,p,.4*t.scale)&&this.level.route.some(v=>visibleBetween(this.level.obstacles,{x:v.x,y:v.y+1.64,z:v.z},{x:p.x,y:p.y+1.68*t.scale,z:p.z},rules))){t.spawn(x,z,time,p.y);break;}}
  Object.assign(this.memories[t.id],{alertUntil:-100,reactAt:time+BOT_DIFFICULTY[this.settings.botDifficulty].reaction,heardX:0,heardZ:0,events:0});
 }
 hear(e:FootstepEvent){let any=false;for(const t of this.targets){if(!t.enabled||!t.active)continue;const d=Math.hypot(t.position.x-e.position.x,t.position.y-e.position.y,t.position.z-e.position.z),clear=visibleBetween(this.level.obstacles,{x:t.position.x,y:t.position.y+1.6,z:t.position.z},{x:e.position.x,y:e.position.y+1.5,z:e.position.z});if(d>e.radius*(clear?1:.65))continue;const m=this.memories[t.id];m.alertUntil=e.timestamp+3;m.reactAt=e.timestamp+BOT_DIFFICULTY[this.settings.botDifficulty].reaction;m.heardX=e.position.x;m.heardZ=e.position.z;m.events++;any=true;}if(any)this.heardEvents++;}
 step(t:Target,time:number,dt:number){t.previous.copy(t.position);if(!t.enabled||!t.active)return;const a=this.level.angles[t.id],m=this.memories[t.id],difficulty=BOT_DIFFICULTY[this.settings.botDifficulty];
  // Never follows the live player through cover; only a bounded peek based on a real sound.
  const alert=time<m.alertUntil&&time>=m.reactAt,offset=alert?Math.sign(m.heardX-t.anchor.x)*a.radius*difficulty.reposition:0,goal=t.anchor.x+offset;
  const dx=goal-t.position.x,desired=Math.abs(dx)<.04?0:Math.sign(dx)*Math.min(5.4*Math.min(1,Math.max(0,t.speedMultiplier)),Math.sqrt(2*20*Math.abs(dx)));
  t.velocity.x=approachVelocity(t.velocity.x,desired,dt);const x=t.position.x+t.velocity.x*dt;
  if(Math.abs(x-t.anchor.x)<=a.radius&&standingSpace(this.level.obstacles,{x,y:t.position.y,z:t.position.z},.4*t.scale))t.position.x=x;else t.velocity.x=0;
  t.updatePose(time);
 }
 eliminated(id:number){if(this.cleared.has(id))return;this.cleared.add(id);this.clears++;this.completed=this.cleared.size===this.level.angles.length;}
 get progress(){return this.cleared.size;}
 reset(){this.cleared.clear();this.completed=false;}
}
