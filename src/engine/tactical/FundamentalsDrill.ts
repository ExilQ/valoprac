import {Vector3} from 'three';
import type {TacticalLevel} from './levels';
import {standingSpace,visibleBetween} from './levels';
import type {Target} from '../targets/Target';
import {SeededRandom} from '../simulation/random';
import {approachVelocity} from '../targets/locomotion';
import type {FundamentalsDrillKind} from '../../config/mapCourses';
import type {Vec3} from '../types';

/* Fundamentals drills (12.25), run on the original drill maps. Targets never
 * shoot back: each drill isolates one aiming skill and measures it.
 * - preaim: every position is held at head height from the start; the
 *   measurement is the angle between crosshair and head at the first moment
 *   the head becomes visible (good pre-aim = small).
 * - angles: positions are held with short timed shoulder peeks.
 * - flick: one target at a time, at least 35 degrees away from the crosshair.
 * - micro: up to three far targets strafing a few decimetres either way.
 * Everything is driven by the simulation clock and a seeded RNG, so replays
 * reproduce it exactly. */

export interface DrillView {time:number;eye:Vec3;direction:Vec3;}
export interface FundamentalsSnapshot {
  kind:FundamentalsDrillKind;round:number;cleared:number;total:number;
  /** Mean of the recorded values; null until the first sample. */
  preaimErrorDeg:number|null;reactionMs:number|null;flickDeg:number|null;roundSeconds:number|null;
  kills:number;misses:number;
}
const HEAD=1.6;
const ROUND_PAUSE=1.2,FLICK_TIMEOUT=2.6,FLICK_GAP=.28,MICRO_GAP=.35,MICRO_ACTIVE=3,MICRO_SPAN=.42;
const mean=(values:number[])=>values.length?values.reduce((a,b)=>a+b,0)/values.length:null;

export class FundamentalsDrill {
  round=1;kills=0;misses=0;completedAt:number|null=null;roundStarted=0;
  private seenAt=new Map<number,number>();private appearAt=new Map<number,number>();private sector=new Map<number,number>();
  private errors:number[]=[];private reactions:number[]=[];private flicks:number[]=[];private rounds:number[]=[];
  private peek:{until:number;offset:number}[];private strafe:{next:number;dir:number;speed:number}[];private queue:{at:number}[]=[];
  /** Called when a pre-aim/angles round is cleared and restarts at the spawn. */
  onRoundReset:(()=>void)|null=null;
  private readonly to=new Vector3();

  constructor(readonly kind:FundamentalsDrillKind,readonly level:TacticalLevel,private targets:Target[],private rng:SeededRandom){
    this.peek=targets.map(()=>({until:0,offset:0}));this.strafe=targets.map(()=>({next:0,dir:1,speed:1.6}));
  }
  get total(){return this.kind==='flick'?1:this.kind==='micro'?Math.min(MICRO_ACTIVE,this.level.angles.length):Math.min(this.level.angles.length,this.targets.length);}

  /** Start (or restart) a round: place every target for the drill. */
  reset(time:number){
    this.seenAt.clear();this.appearAt.clear();this.sector.clear();this.completedAt=null;this.roundStarted=time;this.queue=[];
    for(const t of this.targets){t.enabled=false;t.active=false;t.velocity.set(0,0,0);}
    if(this.kind==='preaim'||this.kind==='angles'){this.level.angles.forEach((_,i)=>{if(i<this.targets.length)this.place(this.targets[i],i,time);});return;}
    if(this.kind==='micro'){const order=this.shuffle(this.level.angles.map((_,i)=>i));for(let k=0;k<this.total;k++)this.place(this.targets[k],order[k],time);return;}
    this.queue=[{at:time+.6}];
  }
  private shuffle(items:number[]){for(let i=items.length-1;i>0;i--){const j=Math.floor(this.rng.next()*(i+1));[items[i],items[j]]=[items[j],items[i]];}return items;}
  private place(t:Target,sectorIndex:number,time:number){
    const a=this.level.angles[sectorIndex];t.scale=1;t.speedMultiplier=1;t.enabled=true;
    t.spawn(a.position.x,a.position.z,time,a.position.y);t.velocity.set(0,0,0);t.updatePose(time);
    this.sector.set(t.id,sectorIndex);this.appearAt.set(t.id,time);this.seenAt.delete(t.id);
    this.peek[t.id]={until:time+this.rng.range(.6,1.6),offset:0};this.strafe[t.id]={next:time,dir:this.rng.next()<.5?-1:1,speed:this.rng.range(1.2,2.4)};
  }
  private headOf(t:Target):Vec3{return {x:t.position.x,y:t.position.y+HEAD*t.scale,z:t.position.z};}
  private angleTo(view:DrillView,p:Vec3){this.to.set(p.x-view.eye.x,p.y-view.eye.y,p.z-view.eye.z).normalize();const d=view.direction;return Math.acos(Math.max(-1,Math.min(1,this.to.x*d.x+this.to.y*d.y+this.to.z*d.z)))*180/Math.PI;}

  /** One fixed simulation tick: motion, visibility measurements, respawns. */
  step(view:DrillView,dt:number){
    const time=view.time;
    if(this.completedAt!==null){if(time-this.completedAt>=ROUND_PAUSE){this.round++;this.reset(time);this.onRoundReset?.();}return;}
    for(const t of this.targets){t.previous.copy(t.position);if(!t.enabled||!t.active)continue;
      if(this.kind==='angles')this.stepPeek(t,time,dt);else if(this.kind==='micro')this.stepStrafe(t,time,dt);
      t.updatePose(time);
      // First moment the head is in line of sight: record pre-aim error.
      if(!this.seenAt.has(t.id)&&visibleBetween(this.level.obstacles,view.eye,this.headOf(t))){
        this.seenAt.set(t.id,time);
        if(this.kind==='preaim'||this.kind==='angles')this.errors.push(this.angleTo(view,this.headOf(t)));
      }
      if(this.kind==='flick'&&time-(this.appearAt.get(t.id)??time)>FLICK_TIMEOUT){t.eliminate(time);t.enabled=false;this.misses++;this.queue.push({at:time+FLICK_GAP});}
    }
    if(this.kind==='flick')for(let k=this.queue.length-1;k>=0;k--)if(time>=this.queue[k].at){this.queue.splice(k,1);this.spawnFlick(view);}
    if(this.kind==='micro')for(let k=this.queue.length-1;k>=0;k--)if(time>=this.queue[k].at){this.queue.splice(k,1);this.spawnMicro(time);}
  }
  private stepPeek(t:Target,time:number,dt:number){
    const a=this.level.angles[this.sector.get(t.id)!],p=this.peek[t.id];
    if(time>=p.until){p.offset=p.offset!==0?0:(this.rng.next()<.5?-1:1)*a.radius;p.until=time+(p.offset?this.rng.range(.35,.7):this.rng.range(.9,1.9));}
    this.moveX(t,t.anchor.x+p.offset,a.radius,dt,4.2);
  }
  private stepStrafe(t:Target,time:number,dt:number){
    const s=this.strafe[t.id];
    if(time>=s.next||Math.abs(t.position.x-t.anchor.x)>=MICRO_SPAN&&Math.sign(t.position.x-t.anchor.x)===s.dir){s.dir*=-1;s.next=time+this.rng.range(.22,.75);s.speed=this.rng.range(1.1,2.5);}
    this.moveX(t,t.anchor.x+s.dir*MICRO_SPAN,MICRO_SPAN,dt,s.speed);
  }
  private moveX(t:Target,goal:number,limit:number,dt:number,maxSpeed:number){
    const dx=goal-t.position.x,desired=Math.abs(dx)<.03?0:Math.sign(dx)*Math.min(maxSpeed,Math.sqrt(2*20*Math.abs(dx)));
    t.velocity.x=approachVelocity(t.velocity.x,desired,dt);const x=t.position.x+t.velocity.x*dt;
    if(Math.abs(x-t.anchor.x)<=limit+1e-6&&standingSpace(this.level.obstacles,{x,y:t.position.y,z:t.position.z},.4*t.scale))t.position.x=x;else t.velocity.x=0;
  }
  private spawnFlick(view:DrillView){
    const t=this.targets[0],visible=this.level.angles.map((a,i)=>({i,p:{x:a.position.x,y:a.position.y+HEAD,z:a.position.z}})).filter(c=>visibleBetween(this.level.obstacles,view.eye,c.p));
    const last=this.sector.get(t.id),far=visible.filter(c=>c.i!==last&&this.angleTo(view,c.p)>=35);
    const pool=far.length?far:visible.filter(c=>c.i!==last);if(!pool.length)return;
    const choice=pool[Math.floor(this.rng.next()*pool.length)];
    this.place(t,choice.i,view.time);this.seenAt.set(t.id,view.time);this.flicks.push(this.angleTo(view,choice.p));
  }
  private spawnMicro(time:number){
    const used=new Set([...this.targets].filter(t=>t.enabled&&t.active).map(t=>this.sector.get(t.id))),free=this.level.angles.map((_,i)=>i).filter(i=>!used.has(i));
    const slot=this.targets.slice(0,this.total).find(t=>!t.enabled||!t.active);if(!slot||!free.length)return;
    this.place(slot,free[Math.floor(this.rng.next()*free.length)],time);
  }

  /** The simulation eliminated a drill target. */
  eliminated(t:Target,time:number){
    if(!this.sector.has(t.id))return;this.kills++;
    const from=this.kind==='flick'||this.kind==='micro'?this.appearAt.get(t.id):this.seenAt.get(t.id);
    if(from!==undefined)this.reactions.push((time-from)*1000);
    t.enabled=false;
    if(this.kind==='flick'){this.queue.push({at:time+FLICK_GAP});return;}
    if(this.kind==='micro'){this.queue.push({at:time+MICRO_GAP});return;}
    if(this.targets.every(x=>!x.enabled||!x.active)){this.completedAt=time;this.rounds.push(time-this.roundStarted);}
  }
  snapshot():FundamentalsSnapshot{
    const cleared=this.kind==='preaim'||this.kind==='angles'?this.targets.filter(t=>this.sector.has(t.id)&&!t.enabled).length:this.kills;
    const r=(v:number|null,d=1)=>v===null?null:+v.toFixed(d);
    return {kind:this.kind,round:this.round,cleared,total:this.kind==='preaim'||this.kind==='angles'?this.sector.size:this.total,
      preaimErrorDeg:r(mean(this.errors.slice(-30))),reactionMs:r(mean(this.reactions.slice(-30)),0),flickDeg:r(mean(this.flicks.slice(-30))),roundSeconds:r(mean(this.rounds.slice(-5)),2),kills:this.kills,misses:this.misses};
  }
}
