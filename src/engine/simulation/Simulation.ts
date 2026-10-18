import { Ray, Vector3, MathUtils } from 'three';
import type { Mode, Settings, WeaponId, InputState, ShotEvent, KillEvent, DirectionResponse, SessionData } from '../types';
import { Movement } from '../movement/Movement';
import { Braking } from '../movement/Braking';
import { Weapon } from '../weapons/Weapon';
import { Target } from '../targets/Target';
import { SeededRandom } from './random';
import { WEAPONS } from '../../config/weapons';
import { MODES } from '../../training/modes/modes';
import { castShot, type HitResult } from '../collision/shoot';
import { summarize } from '../../training/analytics/statistics';
const DEG=Math.PI/180;
export class Simulation {
  time=0;ticks=0;running=false;completed=false;movement=new Movement();braking=new Braking();weapon:Weapon;
  yaw=0;pitch=0;targets:Target[]=[];shots:ShotEvent[]=[];kills:KillEvent[]=[];reactions:DirectionResponse[]=[];
  tracking={samples:0,onHead:0,errorSquared:0};lastHitAt=-100;lastHit='miss';lastEarlyAt=-100;lastShotAt=-100;
  origin=new Vector3();direction=new Vector3();ray=new Ray();hit:HitResult={zone:'miss',target:null,point:new Vector3(),distance:150};
  private rng:SeededRandom;private targetPoint=new Vector3();private targetDirection=new Vector3();
  onShot:((shot:ShotEvent)=>void)|null=null;onKill:(()=>void)|null=null;onFinish:(()=>void)|null=null;
  private currentInput!:InputState;
  private pendingBrakeShot:ShotEvent|null=null;
  constructor(public mode:Mode,public weaponId:WeaponId,public settings:Settings){
    this.weapon=new Weapon(WEAPONS[weaponId],settings.seed);this.rng=new SeededRandom(settings.seed^0xF91);
    for(let i=0;i<(mode==='tracking'&&settings.behavior==='peek'?1:MODES[mode].count);i++){
      const behavior=mode==='tracking'?settings.behavior:'stationary';const t=new Target(i,behavior,new SeededRandom(settings.seed+i*139+1));this.targets.push(t);this.spawn(t);
    }
  }
  private spawn(t:Target){
    const positions=[[-6,-19],[-3,-15],[0,-21],[3,-17],[6,-23]];
    let x:number,z:number;
    if(this.mode==='spray'){x=-4;z=-19;}else if(this.mode==='tracking'){
      x=t.behavior==='peek'?6.4:([-7,-2.5,2.5,7][t.id]);z=t.behavior==='peek'?-18.5:-16-t.id*2.6;
    }else{[x,z]=positions[t.id%positions.length];x+=this.rng.range(-0.7,0.7);z+=this.rng.range(-1.8,1.8);}
    t.spawn(x,z,this.time);
  }
  look(deltaX:number,deltaY:number){
    const degrees=this.settings.degreesPerCount*this.settings.sensitivity;
    const [pitch,yaw]=this.weapon.recoil.compensate(-deltaY*degrees,-deltaX*degrees,this.weapon.profile.cameraScale);
    this.yaw+=yaw*DEG;this.pitch=MathUtils.clamp(this.pitch+pitch*DEG,-1.48,1.48);
  }
  get viewYaw(){return this.yaw+this.weapon.recoil.cameraYaw*DEG;}
  get viewPitch(){return MathUtils.clamp(this.pitch+this.weapon.recoil.cameraPitch*DEG,-1.55,1.55);}
  get bulletYaw(){return this.yaw+this.weapon.recoil.yaw*DEG;}
  get bulletPitch(){return this.pitch+this.weapon.recoil.pitch*DEG;}
  viewDirection(out:Vector3){const y=this.viewYaw,p=this.viewPitch;return out.set(-Math.sin(y)*Math.cos(p),Math.sin(p),-Math.cos(y)*Math.cos(p));}
  step(dt:number,input:InputState){
    if(!this.running||this.completed)return;
    this.ticks++;this.time=this.ticks*dt;
    this.braking.update(input,this.yaw,this.movement,this.time);
    this.movement.step(input,this.yaw,dt,this.time);
    this.braking.observe(this.movement,this.time);
    const pending=this.pendingBrakeShot,b=this.braking;
    if(pending&&pending.releaseTime===b.releaseTime){
      if(b.thresholdTime!==null&&pending.thresholdDelta===null){pending.thresholdDelta=pending.timestamp-b.thresholdTime;pending.brakingDuration=b.duration;}
      if(b.fullDuration!==null)pending.decelerationDuration=b.fullDuration;
      if(pending.thresholdDelta!==null&&pending.decelerationDuration!==null)this.pendingBrakeShot=null;
    }else if(pending)this.pendingBrakeShot=null;
    for(const t of this.targets){if(!t.active&&this.time-t.deadAt>0.55)this.spawn(t);t.step(this.time,dt);}
    this.currentInput=input;this.weapon.step(this.time,dt,input,this.fireShot);
    if(this.mode==='tracking')this.sampleTracking();
    input.jump=false;input.reload=false;
    if(this.time+1e-9>=this.settings.duration){this.completed=true;this.running=false;this.onFinish?.();}
  }
  private fireShot=()=>{
    const w=this.weapon,m=this.movement;const first=w.shotIndex===0;
    if(first){w.recoil.compensationPitch=0;w.recoil.compensationYaw=0;}
    const compensationPitch=w.recoil.compensationPitch,compensationYaw=w.recoil.compensationYaw;
    const spread=w.calculateSpread(m,this.currentInput.ads,this.time-m.landedAt<0.09);
    w.recoil.kick(w.shotIndex,w.profile,w.rng,m.crouch);
    const yaw=this.bulletYaw+spread.x*DEG,pitch=this.bulletPitch+spread.y*DEG;
    this.origin.copy(m.position);this.origin.y+=m.eyeHeight;
    this.direction.set(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));
    this.ray.set(this.origin,this.direction);castShot(this.ray,this.targets,this.hit);
    const t=this.hit.target,b=this.braking;
    const episode=b.active&&!b.shotRecorded&&b.releaseTime!==null;
    let angularError:number|null=null;
    if(t){t.headPosition(this.targetPoint);this.targetDirection.copy(this.targetPoint).sub(this.origin).normalize();angularError=Math.acos(MathUtils.clamp(this.targetDirection.dot(this.direction),-1,1))/DEG;}
    else if(this.mode==='spray'){this.targetDirection.set(0,1.64,-30).sub(this.origin).normalize();angularError=Math.acos(MathUtils.clamp(this.targetDirection.dot(this.direction),-1,1))/DEG;}
    if(angularError===null){
      for(const candidate of this.targets){if(!candidate.active)continue;candidate.headPosition(this.targetPoint);this.targetDirection.copy(this.targetPoint).sub(this.origin).normalize();const error=Math.acos(MathUtils.clamp(this.targetDirection.dot(this.direction),-1,1))/DEG;angularError=angularError===null?error:Math.min(angularError,error);}
    }
    const s:ShotEvent={timestamp:this.time,weapon:this.weaponId,shotIndex:w.shotIndex,magazineShot:w.magazineShot,firstShot:first,
      position:{x:m.position.x,y:m.position.y,z:m.position.z},velocity:{x:m.velocity.x,y:m.velocity.y,z:m.velocity.z},direction:{x:this.direction.x,y:this.direction.y,z:this.direction.z},aim:{yaw:this.yaw,pitch:this.pitch},
      recoil:{pitch:w.recoil.pitch,yaw:w.recoil.yaw},spread:{...spread},hit:this.hit.zone,impact:{x:this.hit.point.x,y:this.hit.point.y,z:this.hit.point.z},targetId:t?.id??null,targetPosition:t?{x:t.position.x,y:t.position.y,z:t.position.z}:null,targetState:t?.behavior??null,targetGeneration:t?.generation??null,
      playerCompensation:{pitch:compensationPitch,yaw:compensationYaw},accurate:m.accurate,releaseTime:episode?b.releaseTime:null,thresholdDelta:episode&&b.thresholdTime!==null?this.time-b.thresholdTime:null,brakingKind:episode?b.kind:null,initialSpeed:episode?b.initialSpeed:null,brakingDuration:episode?b.duration:null,decelerationDuration:episode?b.fullDuration:null,
      movementDirection:{x:this.currentInput.strafe*Math.cos(this.yaw)-this.currentInput.forward*Math.sin(this.yaw),z:-this.currentInput.forward*Math.cos(this.yaw)-this.currentInput.strafe*Math.sin(this.yaw)},angularError};
    if(episode){b.shotRecorded=true;if(s.thresholdDelta===null||s.decelerationDuration===null)this.pendingBrakeShot=s;}
    this.shots.push(s);this.lastShotAt=this.time;
    if(!m.accurate)this.lastEarlyAt=this.time;
    if(t){this.lastHitAt=this.time;this.lastHit=s.hit;if(s.hit==='head'){
      this.kills.push({timestamp:this.time,targetId:t.id,generation:t.generation,elapsed:this.time-t.spawnAt,firstShot:t.shotsReceived===0});t.eliminate(this.time);this.onKill?.();
    }t.shotsReceived++;}
    this.onShot?.(s);
  };
  private sampleTracking(){
    this.origin.copy(this.movement.position);this.origin.y+=this.movement.eyeHeight;this.viewDirection(this.direction);this.ray.set(this.origin,this.direction);
    let nearestError=Infinity;
    const hit=castShot(this.ray,this.targets,this.hit),onHead=hit.zone==='head';
    for(const t of this.targets){if(!t.active)continue;t.headPosition(this.targetPoint);this.targetDirection.copy(this.targetPoint).sub(this.origin).normalize();
      const angle=Math.acos(MathUtils.clamp(this.targetDirection.dot(this.direction),-1,1));nearestError=Math.min(nearestError,angle/DEG);
      if(onHead&&hit.target===t&&!t.reactionRecorded&&this.time-t.changeAt<2){this.reactions.push({targetId:t.id,changeTime:t.changeAt,latency:this.time-t.changeAt});t.reactionRecorded=true;}
    }
    if(Number.isFinite(nearestError)){this.tracking.samples++;this.tracking.errorSquared+=nearestError**2;if(onHead)this.tracking.onHead++;}
  }
  snapshot():SessionData{return {id:globalThis.crypto?.randomUUID?.()??`session-${Date.now()}-${this.settings.seed}`,createdAt:Date.now(),mode:this.mode,weapon:this.weaponId,duration:this.time,seed:this.settings.seed,settings:{...this.settings},shots:this.shots,kills:this.kills,reactions:this.reactions,tracking:{...this.tracking},summary:summarize(this.shots,this.kills,this.reactions,this.tracking)};}
}
