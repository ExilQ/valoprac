import {Footsteps,type FootstepEvent} from '../footsteps/Footsteps';
import {footstepProfile} from '../../config/footsteps';
import {angularGain} from '../input/sensitivity';
import {TacticalHearing} from '../tactical/Hearing';
import {obstaclesFor} from '../tactical/map';
import { Ray, Vector3, MathUtils } from 'three';
import type { Mode, Settings, WeaponId, InputState, ShotEvent, KillEvent, DirectionResponse, SessionData } from '../types';
import { Movement } from '../movement/Movement';
import { Braking } from '../movement/Braking';
import { Weapon } from '../weapons/Weapon';
import { Target } from '../targets/Target';
import { SeededRandom } from './random';
import { WEAPONS, damageAt, WEAPON_ORDER } from '../../config/weapons';
import { MODES } from '../../training/modes/modes';
import { castShot, type HitResult } from '../collision/shoot';
import { summarize } from '../../training/analytics/statistics';
import { LifetimeStats } from '../../training/analytics/LifetimeStats';
export const DETAIL_LIMIT=2048;
const DEG=Math.PI/180;
export class Simulation {
  readonly practiceMap:'range'|'tactical';readonly obstacles;footsteps:Footsteps;hearing:TacticalHearing|null=null;
  onFootstep:((event:FootstepEvent)=>void)|null=null;

  private emptySummary=summarize([],[],[],{samples:0,onHead:0,errorSquared:0});
  stats=new LifetimeStats();ads=false;adsAmount=0;weapons:Record<WeaponId,Weapon>;time=0;ticks=0;running=false;completed=false;movement=new Movement();braking=new Braking();weapon:Weapon;
  yaw=0;pitch=0;targets:Target[]=[];shots:ShotEvent[]=[];kills:KillEvent[]=[];reactions:DirectionResponse[]=[];
  tracking={samples:0,onHead:0,errorSquared:0};lastHitAt=-100;lastHit='miss';lastEarlyAt=-100;lastShotAt=-100;
  origin=new Vector3();direction=new Vector3();ray=new Ray();hit:HitResult={zone:'miss',target:null,point:new Vector3(),distance:150};
  private rng:SeededRandom;private targetPoint=new Vector3();private targetDirection=new Vector3();
  onShot:((shot:ShotEvent)=>void)|null=null;onKill:(()=>void)|null=null;onFinish:(()=>void)|null=null;
  private currentInput!:InputState;
  private pendingBrakeShot:ShotEvent|null=null;
  constructor(public mode:Mode,public weaponId:WeaponId,public settings:Settings){
    this.settings={...settings,bindings:{...settings.bindings}};
    this.practiceMap=mode==='free'?settings.practiceMap:'range';this.settings.practiceMap=this.practiceMap;this.obstacles=obstaclesFor(this.practiceMap);this.movement.obstacles=this.obstacles;
    this.footsteps=new Footsteps(footstepProfile(this.settings));this.footsteps.onStep=e=>{this.hearing?.hear(e);this.onFootstep?.(e);};
    if(this.practiceMap==='tactical'){this.movement.position.set(-7,0,13);this.movement.previous.copy(this.movement.position);}

    this.weapons=Object.fromEntries(WEAPON_ORDER.map((id,i)=>[id,new Weapon(WEAPONS[id],settings.seed+i*907)])) as Record<WeaponId,Weapon>;this.weapon=this.weapons[weaponId];this.configureAmmo();this.rng=new SeededRandom(settings.seed^0xF91);
    for(let i=0;i<(mode==='free'?12:mode==='tracking'&&settings.behavior==='peek'?1:MODES[mode].count);i++){
      const behavior=mode==='tracking'||mode==='free'?settings.behavior:'stationary';const t=new Target(i,behavior,new SeededRandom(settings.seed+i*139+1));this.targets.push(t);if(this.practiceMap!=='tactical')this.spawn(t);if(mode==='free'){t.enabled=i<Math.min(settings.targetCount,settings.behavior==='peek'?1:12)&&!settings.analysisWall;t.active=t.enabled;}
    }
    if(this.practiceMap==='tactical'){this.hearing=new TacticalHearing(this.targets,new SeededRandom(settings.seed^0xF007));this.resetTargets();}
  }
  private spawn(t:Target){
    t.scale=this.mode==='free'?this.settings.targetSize:1;t.speedMultiplier=this.mode==='free'?this.settings.targetSpeed:1;
    if(this.hearing){this.hearing.spawn(t,this.time,this.movement.position.x,this.movement.position.z);return;}

    const positions=[[-6,-19],[-3,-15],[0,-21],[3,-17],[6,-23]];
    let x:number,z:number;
    t.scale=this.mode==='free'?this.settings.targetSize:1;t.speedMultiplier=this.mode==='free'?this.settings.targetSpeed:1;
    if(this.mode==='free'){
      x=t.behavior==='peek'?6.4:(t.id-(this.settings.targetCount-1)/2)*Math.min(2.6,17/this.settings.targetCount);z=5-this.settings.targetDistance+this.rng.range(-0.3,0.3);
      if(t.behavior==='peek')z=-18.5;
      if(t.behavior==='appearing'){x=this.rng.range(-8,8);z=5-this.settings.targetDistance+this.rng.range(-1,1);}
    }else if(this.mode==='spray'){x=-4;z=-19;}else if(this.mode==='tracking'){
      x=t.behavior==='peek'?6.4:([-7,-2.5,2.5,7][t.id]);z=t.behavior==='peek'?-18.5:-16-t.id*2.6;
    }else{[x,z]=positions[t.id%positions.length];x+=this.rng.range(-0.7,0.7);z+=this.rng.range(-1.8,1.8);}
    t.spawn(x,z,this.time);
  }
  look(deltaX:number,deltaY:number){
    const degrees=angularGain(this.settings,this.ads,this.weapon.profile.adsZoom);
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
    this.ads=input.ads&&this.weapon.profile.adsZoom>1&&this.weapon.reloadingUntil===null&&this.time>=this.weapon.equipUntil;
    this.adsAmount+=(Number(this.ads)-this.adsAmount)*(1-Math.exp(-18*dt));
    this.movement.speedModifier=this.ads?this.weapon.profile.adsMoveModifier:1;
    this.braking.update(input,this.yaw,this.movement,this.time);
    this.movement.step(input,this.yaw,dt,this.time);
    this.braking.observe(this.movement,this.time);
    this.footsteps.step(this.movement,input.walk,dt,this.time);
    const pending=this.pendingBrakeShot,b=this.braking;
    if(pending&&pending.releaseTime===b.releaseTime){
      pending.brakingKind=b.kind;
      if(b.thresholdTime!==null&&pending.thresholdDelta===null){pending.thresholdDelta=pending.timestamp-b.thresholdTime;pending.brakingDuration=b.duration;}
      if(b.fullDuration!==null)pending.decelerationDuration=b.fullDuration;
      if(pending.thresholdDelta!==null&&pending.decelerationDuration!==null){this.stats.settleBrake(pending);this.pendingBrakeShot=null;}
    }else if(pending){this.stats.settleBrake(pending);this.pendingBrakeShot=null;}
    for(const t of this.targets){if(!t.enabled)continue;
      if(this.mode==='free'&&t.behavior==='appearing'&&t.active&&this.time-t.spawnAt>2){t.eliminate(this.time);}
      if(!t.active&&this.time-t.deadAt>(this.mode==='free'?this.settings.spawnInterval:0.55))this.spawn(t);if(this.hearing)this.hearing.step(t,this.time,dt);else t.step(this.time,dt);
    }
    this.currentInput=input;const originalAds=input.ads;input.ads=this.ads;this.weapon.step(this.time,dt,input,this.fireShot);input.ads=originalAds;
    for(const id of WEAPON_ORDER){if(id!==this.weaponId){const w=this.weapons[id];w.recoil.recover(dt,w.profile,this.time-w.lastShot);w.bloom=Math.max(0,w.bloom-w.profile.bloomRecovery*dt);}}
    if(this.mode==='tracking'||this.mode==='free')this.sampleTracking();
    input.jump=false;input.reload=false;input.firePresses=0;
    if(this.mode!=='free'&&this.time+1e-9>=this.settings.duration){this.completed=true;this.running=false;this.onFinish?.();}
  }
  private fireShot=()=>{
    const w=this.weapon,m=this.movement;const first=w.shotIndex===0;
    if(first){w.recoil.compensationPitch=0;w.recoil.compensationYaw=0;}
    const compensationPitch=w.recoil.compensationPitch,compensationYaw=w.recoil.compensationYaw;
    const spread=w.calculateSpread(m,this.currentInput.ads,this.time-m.landedAt<0.09);
    const yaw=this.bulletYaw+spread.x*DEG,pitch=this.bulletPitch+spread.y*DEG;
    this.origin.copy(m.position);this.origin.y+=m.eyeHeight;
    this.direction.set(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));
    this.ray.set(this.origin,this.direction);castShot(this.ray,this.targets,this.hit,this.obstacles);
    // Fire along the pre-kick aim; recoil from this shot affects the next shot.
    w.recoil.kick(w.shotIndex,w.profile,w.recoilRng,m.crouch,this.time);
    const t=this.hit.target,b=this.braking;
    const episode=b.active&&!b.shotRecorded&&b.releaseTime!==null;
    let angularError:number|null=null;
    if(t){t.headPosition(this.targetPoint);this.targetDirection.copy(this.targetPoint).sub(this.origin).normalize();angularError=Math.acos(MathUtils.clamp(this.targetDirection.dot(this.direction),-1,1))/DEG;}
    else if(this.mode==='spray'){this.targetDirection.set(0,1.64,-30).sub(this.origin).normalize();angularError=Math.acos(MathUtils.clamp(this.targetDirection.dot(this.direction),-1,1))/DEG;}
    if(angularError===null){
      for(const candidate of this.targets){if(!candidate.active)continue;candidate.headPosition(this.targetPoint);this.targetDirection.copy(this.targetPoint).sub(this.origin).normalize();const error=Math.acos(MathUtils.clamp(this.targetDirection.dot(this.direction),-1,1))/DEG;angularError=angularError===null?error:Math.min(angularError,error);}
    }
    const s:ShotEvent={timestamp:this.time,weapon:this.weaponId,damage:damageAt(w.profile,this.hit.zone,this.hit.distance),ads:this.ads,accuracyState:!m.grounded?'airborne':this.time-m.landedAt<0.09?'landing':m.accurate?(m.crouch>0.5?'crouching':'stationary'):m.crouch>0.5?'crouchMoving':this.braking.active?'braking':this.currentInput.walk?'walking':'running',horizontalDirection:w.recoil.horizontalDirection,shotIndex:w.shotIndex,magazineShot:w.magazineShot,firstShot:first,
      position:{x:m.position.x,y:m.position.y,z:m.position.z},velocity:{x:m.velocity.x,y:m.velocity.y,z:m.velocity.z},direction:{x:this.direction.x,y:this.direction.y,z:this.direction.z},aim:{yaw:this.yaw,pitch:this.pitch},
      recoil:{pitch:w.recoil.pitch,yaw:w.recoil.yaw},spread:{...spread},hit:this.hit.zone,impact:{x:this.hit.point.x,y:this.hit.point.y,z:this.hit.point.z},targetId:t?.id??null,targetPosition:t?{x:t.position.x,y:t.position.y,z:t.position.z}:null,targetState:t?.behavior??null,targetGeneration:t?.generation??null,
      playerCompensation:{pitch:compensationPitch,yaw:compensationYaw},accurate:m.accurate,releaseTime:episode?b.releaseTime:null,thresholdDelta:episode&&b.thresholdTime!==null?this.time-b.thresholdTime:null,brakingKind:episode?b.kind:null,initialSpeed:episode?b.initialSpeed:null,brakingDuration:episode?b.duration:null,decelerationDuration:episode?b.fullDuration:null,
      movementDirection:{x:this.currentInput.strafe*Math.cos(this.yaw)-this.currentInput.forward*Math.sin(this.yaw),z:-this.currentInput.forward*Math.cos(this.yaw)-this.currentInput.strafe*Math.sin(this.yaw)},angularError};
    if(episode){b.shotRecorded=true;if(s.thresholdDelta===null||s.decelerationDuration===null)this.pendingBrakeShot=s;else this.stats.settleBrake(s);}
    this.stats.shot(s);this.shots.push(s);if(this.shots.length>DETAIL_LIMIT)this.shots.splice(0,512);this.lastShotAt=this.time;
    if(!m.accurate)this.lastEarlyAt=this.time;
    if(t){if(!t.reactionRecorded&&this.time-t.changeAt>=0&&this.time-t.changeAt<2){this.reactions.push({targetId:t.id,changeTime:t.changeAt,latency:this.time-t.changeAt});if(this.reactions.length>256)this.reactions.shift();t.reactionRecorded=true;}this.lastHitAt=this.time;this.lastHit=s.hit;t.health-=s.damage??0;const rule=this.mode==='free'?this.settings.eliminationRule:'head';if(s.hit==='head'||rule==='any'||rule==='damage'&&t.health<=0){
      const kill={timestamp:this.time,targetId:t.id,generation:t.generation,elapsed:this.time-t.spawnAt,firstShot:t.shotsReceived===0};this.kills.push(kill);this.stats.kill(kill);if(this.kills.length>256)this.kills.shift();t.eliminate(this.time);this.onKill?.();
    }t.shotsReceived++;}
    this.onShot?.(s);
  };
  private sampleTracking(){
    this.origin.copy(this.movement.position);this.origin.y+=this.movement.eyeHeight;this.viewDirection(this.direction);this.ray.set(this.origin,this.direction);
    let nearestError=Infinity;
    const hit=castShot(this.ray,this.targets,this.hit,this.obstacles),onHead=hit.zone==='head';
    for(const t of this.targets){if(!t.active)continue;t.headPosition(this.targetPoint);this.targetDirection.copy(this.targetPoint).sub(this.origin).normalize();
      const angle=Math.acos(MathUtils.clamp(this.targetDirection.dot(this.direction),-1,1));nearestError=Math.min(nearestError,angle/DEG);
      if(onHead&&hit.target===t&&!t.reactionRecorded&&this.time-t.changeAt<2){this.reactions.push({targetId:t.id,changeTime:t.changeAt,latency:this.time-t.changeAt});t.reactionRecorded=true;if(this.reactions.length>256)this.reactions.shift();}
    }
    if(Number.isFinite(nearestError)){this.tracking.samples++;this.tracking.errorSquared+=nearestError**2;if(onHead)this.tracking.onHead++;}
  }
  configureAmmo(){for(const id of WEAPON_ORDER){this.weapons[id].infiniteReserve=this.settings.infiniteReserve;this.weapons[id].autoReload=this.settings.autoReload;}}
  switchWeapon(id:WeaponId){if(id===this.weaponId)return;const old=this.weapon;old.reloadingUntil=null;this.weaponId=id;this.weapon=this.weapons[id];this.ads=false;this.weapon.equip(this.time);}
  configure(patch:Partial<Settings>){const targetChange=['targetCount','targetSize','targetSpeed','targetDistance','spawnInterval','behavior','analysisWall'].some(k=>k in patch&&(patch as unknown as Record<string,unknown>)[k]!== (this.settings as unknown as Record<string,unknown>)[k]);Object.assign(this.settings,patch);this.settings.practiceMap=this.practiceMap;this.footsteps.configure(footstepProfile(this.settings));this.configureAmmo();if(this.mode==='free'&&targetChange)this.resetTargets();}
  resetTargets(){for(const t of this.targets){if(this.mode==='free'){t.behavior=this.settings.behavior;t.enabled=t.id<Math.min(this.settings.targetCount,this.hearing?5:this.settings.behavior==='peek'?1:12)&&!(this.settings.analysisWall&&!this.hearing);}if(t.enabled)this.spawn(t);else t.active=false;}}
  resetStatistics(){this.stats=new LifetimeStats();this.shots.length=0;this.kills.length=0;this.reactions.length=0;this.tracking={samples:0,onHead:0,errorSquared:0};this.pendingBrakeShot=null;}
  hudSummary(){return this.stats.apply(this.emptySummary,this.pendingBrakeShot);}
  summary(){return this.stats.apply(summarize(this.shots,this.kills,this.reactions,this.tracking),this.pendingBrakeShot);}
  snapshot():SessionData{return {footsteps:{events:this.footsteps.totalEvents,botHeardEvents:this.hearing?.heardEvents??0,finalAccumulation:this.footsteps.footstepAccumulation,recent:this.footsteps.recent()},id:globalThis.crypto?.randomUUID?.()??`session-${Date.now()}-${this.settings.seed}`,createdAt:Date.now(),mode:this.mode,weapon:this.weaponId,duration:this.time,seed:this.settings.seed,settings:{...this.settings},shots:this.shots.slice(),kills:this.kills.slice(),reactions:this.reactions.slice(),tracking:{...this.tracking},summary:this.summary(),weaponTotals:structuredClone(this.stats.weapons),detailLimit:DETAIL_LIMIT};}
}
