import {Vector3} from 'three';
import type {Simulation} from '../engine/simulation/Simulation';
import type {InputObserver} from '../engine/input/Input';
import type {ShotEvent,WeaponId} from '../engine/types';
import {adsFov,DEG} from '../engine/input/sensitivity';
import type {Target} from '../engine/targets/Target';
import {MouseTelemetry} from './Telemetry';
import {aimAnalysis} from './AnalysisService';
import {saveAimRecord,aimDataEpoch} from './storage';
import {calibrationFromSettings,calibrationFingerprint,type RawRequest} from './precision/calibration';
import {AIM_VERSION,GAME_VERSION,COLS,type AimMeta,type AimRecord} from './types';

export interface CombatAssessmentContext {
 experiment:string;session:string;blockId:string;condition:string;round:number;pair:string;order:number;
 weapon:WeaponId;expectedZoom:number;expectedTrials:number;warmupSeconds:number;assessmentFactor?:'sensitivity'|'adsMultiplier';assessmentValue?:number;
 onRecord?:(record:AimRecord)=>void;onError?:(message:string)=>void;persist?:boolean;
}
/** Returns the submitted model's head center, including an eliminated target
 * just hit in that frame. It never substitutes a later physics pose when a
 * renderer-attached frame is unavailable. */
export function combatTargetPoint(simulation:Simulation,target:Target,stamp:number|undefined,out:Vector3){
 const frame=simulation.renderedTargets.forShot(stamp);
 if(!frame){target.headPosition(out);return true;}
 const pose=frame.targets[target.id];
 if(!pose?.active||pose.generation!==target.generation||!pose.matrices[0])return false;
 out.setFromMatrixPosition(pose.matrices[0]);return true;
}
export function combatMissAttribution(shot:ShotEvent,aimHit:boolean|null){
 const causes:string[]=[];
 if(aimHit===false)causes.push('aim-or-click');
 if(['airborne','landing','running','walking','braking','crouchMoving'].includes(shot.accuracyState??''))causes.push('movement-inaccuracy');
 if(!shot.firstShot&&Math.abs(shot.recoil.pitch)>.1)causes.push('recoil');
 if(shot.spread.total>.3)causes.push('weapon-spread');
 if(shot.weapon==='operator'&&(!shot.ads||!shot.accurate))causes.push('scope-or-settling');
 return causes;
}
export class CombatCapture implements InputObserver {
 private telemetry=new MouseTelemetry(8192);private point=new Vector3();private target:Target|null=null;private generation=0;private began=0;private lastShot=-100;private count=0;private disposed=false;private issues=new Set<string>();private pending=new Set<Promise<unknown>>();
 private session=globalThis.crypto?.randomUUID?.()??`combat-${Date.now()}`;
 constructor(private simulation:Simulation,private rawMode:()=>string,private assessment?:CombatAssessmentContext,private rawRequest:()=>RawRequest=()=> 'unverified'){}
 frame(now:number){
  if(this.disposed||!this.simulation.settings.aimTelemetry||!this.simulation.running){this.telemetry.clear();this.target=null;return;}
  if(this.assessment&&this.simulation.time<this.assessment.warmupSeconds){this.telemetry.clear();this.target=null;return;}
  this.choose(now);this.capture(2,0,0,now,now,this.simulation.viewYaw,this.simulation.viewPitch);
 }
 private choose(now:number){
  const s=this.simulation,m=s.movement;let best:Target|null=null,error=Infinity;
  for(const t of s.targets){if(!t.active||!t.enabled||!combatTargetPoint(s,t,now,this.point))continue;this.point.sub(m.position);this.point.y-=m.eyeHeight;const yaw=Math.atan2(this.point.x,-this.point.z),pitch=Math.atan2(this.point.y,Math.hypot(this.point.x,this.point.z)),e=(yaw+s.viewYaw)**2+(pitch-s.viewPitch)**2;if(e<error){best=t;error=e;}}
  if(best!==this.target||best?.generation!==this.generation){this.target=best;this.generation=best?.generation??0;this.began=now;this.telemetry.clear();this.issues.clear();}
 }
 sample(kind:0|1,dx:number,dy:number,stamp:number,received:number,beforeYaw:number,beforePitch:number){
  if(this.disposed||!this.simulation.settings.aimTelemetry||!this.simulation.running||this.assessment&&this.simulation.time<this.assessment.warmupSeconds)return;
  if(!this.target)this.choose(stamp);this.capture(kind,dx,dy,stamp,received,beforeYaw,beforePitch);
 }
 private capture(kind:number,dx:number,dy:number,stamp:number,received:number,beforeYaw:number,beforePitch:number){
  const s=this.simulation,t=this.target;if(!t)return;const m=s.movement;
  if(!combatTargetPoint(s,t,stamp,this.point)){this.issues.add('rendered-pose-unavailable');return;}
  const tx=this.point.x-m.position.x,ty=this.point.y-m.position.y-m.eyeHeight,tz=this.point.z-m.position.z,d=Math.hypot(tx,ty,tz),yaw=Math.atan2(tx,-tz)/DEG,pitch=Math.atan2(ty,Math.hypot(tx,tz))/DEG;
  // Radius is an angular diagnostic approximation only. Actual damage is the
  // exact shared triangle raycast represented by ShotEvent.hit, never this cone.
  const radius=Math.atan2(.1411*t.scale,d)/DEG;
  this.telemetry.push((stamp-this.began)/1000,dx,dy,-s.viewYaw/DEG,s.viewPitch/DEG,yaw,pitch,radius,kind,Math.max(0,received-stamp),-(s.viewYaw-beforeYaw)/DEG,(s.viewPitch-beforePitch)/DEG,m.position.x,m.position.y,m.position.z,this.point.x,this.point.y,this.point.z,m.speed,s.weapon.recoil.pitch,Number(s.ads));
 }
 shot(shot:ShotEvent){
  const context=this.assessment,limit=context?.expectedTrials??50;
  if(this.disposed||!this.simulation.settings.aimTelemetry||this.count>=limit||!context&&shot.timestamp-this.lastShot<.5||context&&this.simulation.time<context.warmupSeconds)return;
  const s=this.simulation,now=performance.now();if(!this.target)this.choose(shot.inputTime??now);const t=this.target;if(!t)return;
  if(!context&&this.telemetry.count<6)return;
  this.lastShot=shot.timestamp;this.count++;const stamp=shot.inputTime??now;
  this.capture(4,0,0,stamp,now,s.viewYaw,s.viewPitch);
  if(!combatTargetPoint(s,t,stamp,this.point))this.issues.add('rendered-pose-unavailable');
  if(shot.targetId!==null&&shot.targetId!==t.id)this.issues.add('target-changed');
  if(context&&(shot.weapon!==context.weapon||Math.abs((shot.scopeZoom??1)-context.expectedZoom)>.04||shot.ads!==(context.expectedZoom>1)))this.issues.add('assessment-scope-mismatch');
  if(this.telemetry.count<6)this.issues.add('insufficient-samples');
  const distance=this.point.distanceTo(s.origin),radius=Math.atan2(.1411*t.scale,Math.max(distance,.01))/DEG,zoom=shot.ads?shot.scopeZoom??s.scopeZoom:1;
  const viewport:[number,number]=[typeof innerWidth==='number'?innerWidth:1920,typeof innerHeight==='number'?innerHeight:1080];
  const calibrationZoom=context&&Math.abs(zoom-context.expectedZoom)<.04?context.expectedZoom:zoom;
  const calibration=calibrationFromSettings(s.settings,{viewport,inputMode:this.rawMode(),rawRequest:this.rawRequest(),ads:shot.ads,weapon:shot.weapon,scopeZoom:calibrationZoom,fov:adsFov(s.settings.fov,calibrationZoom)});
  let preShotRecoil=shot.firstShot?0:shot.recoil.pitch;for(let i=this.telemetry.count-1;i>=0;i--)if(this.telemetry.data[i*COLS+8]===1){preShotRecoil=this.telemetry.data[i*COLS+20];break;}
  const issues=[...this.issues,...(this.telemetry.overflow?['buffer-overflow']:[]),...(this.telemetry.reordered?['timestamp-reordered']:[]),'intended-target-estimated','angular-head-radius-approximation'];
  const meta:AimMeta={schema:1,algorithm:AIM_VERSION,game:GAME_VERSION,id:`${context?.blockId??this.session}-${this.count}`,experiment:context?.experiment??this.session,session:context?.session??this.session,createdAt:Date.now(),task:context?'tactical':s.mode==='tracking'?'reactive':'small',phase:context?'transfer':'combat',sensitivity:s.settings.sensitivity,dpi:s.settings.dpi,dpiSource:'user-declared',coefficient:s.settings.degreesPerCount,fov:calibration.fov,ads:!!shot.ads,adsMultiplier:s.settings.adsSensitivity,scopeZoom:context&&Math.abs(zoom-context.expectedZoom)<.04?context.expectedZoom:zoom,rawMode:this.rawMode(),renderer:'browser-webgl',seed:s.settings.seed,round:context?.round??0,pair:context?.pair??`shot-${this.count}`,order:context?.order??this.count,radius,amplitude:0,duration:Math.max(0,(now-this.began)/1000),warmup:context?.warmupSeconds??0,condition:context?.condition??`combat-${s.mode}-${s.practiceMap}`,valid:!this.telemetry.overflow&&!this.telemetry.reordered&&this.telemetry.count>=6&&!this.issues.size,issues,appearanceKnown:false,monotonicStartMs:this.began,timeOriginMs:performance.timeOrigin,targetState:t.behavior,gameMode:s.mode,weapon:shot.weapon,moving:['airborne','landing','running','walking','braking','crouchMoving'].includes(shot.accuracyState??''),recoil:preShotRecoil,spread:shot.spread.total,hit:context?shot.hit==='head':['head','torso','arm','leg'].includes(shot.hit),shotTime:shot.timestamp,targetId:t.id,distance,targetDiameter:.2822*t.scale,movementState:shot.accuracyState,weaponState:s.weapon.reloadingUntil===null?'ready':'reload',viewport,renderScale:s.settings.renderScale,calibration,inputFingerprint:calibrationFingerprint(calibration),blockId:context?.blockId,expectedTrials:context?.expectedTrials,trialIndex:this.count-1,evaluationMode:context?.expectedZoom===1?'hip':context?.expectedZoom===1.25?'rifle-ads':context?.expectedZoom===2.5?'operator-2.5':context?.expectedZoom===5?'operator-5':undefined};
  Object.assign(meta,{headshot:shot.hit==='head',targetPoseSource:shot.targetPoseSource,renderedFrameTime:shot.renderedFrameTime,actualScopeZoom:zoom,assessmentFactor:context?.assessmentFactor,assessmentValue:context?.assessmentValue});
  const epoch=aimDataEpoch(),buffer=this.telemetry.snapshot();
  const job=aimAnalysis.run(buffer,meta).then(async record=>{
   const aimHit=record.metrics.hit,causes=combatMissAttribution(shot,aimHit);record.metrics.hit=meta.hit??null;
   if(context){record.metrics.score=null;Object.assign(record.metrics,{missAttribution:causes});}
   if(context?.persist!==false)await saveAimRecord(record,epoch);context?.onRecord?.(record);return record;
  }).catch(error=>context?.onError?.(error instanceof Error?error.message:'전술 분석을 저장하지 못했습니다.'));
  this.pending.add(job);void job.finally(()=>this.pending.delete(job));this.telemetry.clear();this.issues.clear();this.began=now;
 }
 flush(){return Promise.all([...this.pending]);}
 dispose(){this.disposed=true;this.telemetry.clear();this.target=null;}
}
