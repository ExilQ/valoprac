import {VALORANT_REFERENCE} from '../../config/valorantReference';
import {motionPose,type RecordedMotion} from '../../training/scenarios/recordedMotion';
import type {DefenderPolicy} from '../../training/scenarios/defenderPolicy';
import {Box3,Matrix4,Ray,Sphere,Vector3} from 'three';
import {emptyInput,type Settings,type Vec3,type WeaponId,type ShotEvent} from '../types';
import type {Target} from '../targets/Target';
import type {Obstacle} from '../collision/environment';
import {surfaceHeight} from '../collision/environment';
import {traceBallisticRay,type PenetrationSegment} from '../collision/Ballistics';
import {Weapon} from '../weapons/Weapon';
import {Movement} from '../movement/Movement';
import {spreadDirection} from '../weapons/trajectory';
import {BotAimMotor,resolveBotProfile,wrapAngle,type BotControlProfile} from './BotAimMotor';
import {visibleBetween,standingSpace} from './levels';
import type {FootstepEvent} from '../footsteps/Footsteps';
import {Footsteps} from '../footsteps/Footsteps';
import {resolveGroundSurface} from '../footsteps/surfaceSelection';
import {SURFACES} from '../../config/surfaces';
import {zoneAt} from './complex';
import {SeededRandom} from '../simulation/random';
import {CURRENT_SIMULATION_RULES,usesCurrentWeapons,usesReferenceRules,type SimulationRulesId} from '../simulation/rules';
import {staticBroadphaseFor} from '../collision/StaticBroadphase';
import {damageAt,weaponProfilesFor} from '../../config/weapons';
import {BotMovementController,chooseStyle,type BotMovementStyleId} from './botMovementStyles';

export type DefenderState='holding'|'listening'|'alert'|'tracking'|'firing'|'recovering'|'repositioning'|'re-peeking'|'returning'|'eliminated';
export interface PlayerBody {position:Vec3;velocity:Vec3;eyeHeight:number;crouch:number;grounded:boolean;yaw:number;pitch:number;scoped?:boolean;}
/** These samples and hit volumes form the explicit human body proxy used by defender
 * perception and bullets. Sample fraction is not projected screen-space body area. */
export interface DefenderSector {facingYaw?:number;navigation?:Vec3[];alternatives?:Vec3[];weapon?:WeaponId;motion?:RecordedMotion;}
export type PerceptionPhase='unaware'|'detected'|'recognized'|'reacting'|'aiming'|'tracking'|'lost';
export interface DefenderFootstep extends FootstepEvent {bot:number;encounterGeneration:number;kind:'bot-step';}
export interface FirstShotTiming {preaimed:boolean;contactAngleDegrees:number;detectedAt:number;recognizedAt:number;reactionUntil:number;aimStartedAt:number;acquisitionUntil:number;triggerAt:number;firedAt:number;}
export interface DefenderShot {
 id?:number;time:number;bot:number;weapon:WeaponId;origin:Vec3;aim:Vec3;impact:Vec3;
 hit:'head'|'body'|'leg'|'miss';hitRegion?:'head'|'torso'|'arm'|'leg';observed:boolean;recoveryUntil:number;
 encounterGeneration?:number;targetGeneration?:number;direction?:Vec3;information?:'visual'|'memory'|'sound';angularError?:number;trajectoryAngularError?:number;shotIndex?:number;burstIndex?:number;ammoBefore?:number;
 recoilBefore?:{pitch:number;yaw:number};recoilAfter?:{pitch:number;yaw:number};compensation?:{pitch:number;yaw:number};
 spread?:{base:number;movement:number;bloom:number;air:number;landing:number;total:number;x:number;y:number};
 damage?:number;penetratedLayers?:number;penetration?:PenetrationSegment[];reactionTime?:number;aimAcquisitionTime?:number;detectedAt?:number;
 timing?:FirstShotTiming;
}
export interface DefenderDeath {/** 12.40: the bot's movement style, when one was active. */style?:BotMovementStyleId;bot:number;weapon:WeaponId;region:string;cause:'shot'|'exposure';time:number;duration:number;player:Vec3;defender:Vec3;line:Vec3[];path:Vec3[];reactionTime?:number;aimAcquisitionTime?:number;shotsFired?:number;hits?:number;penetratedLayers?:number;playerVisible?:boolean;playerShotVelocity?:number|null;}
export interface PeekEpisode {started:number;ended:number;duration:number;distance:number;peakSpeed:number;peakVisibleFraction:number;verticalDisplacement:number;shots:number;hits:number;shotVelocity:number|null;acquisitionTime:number|null;returnToCover:number|null;timeToCover?:number|null;}
export interface CombatSummary {shots:number;hits:number;firstShots:number;firstHits:number;followupShots:number;followupHits:number;damage:number;firstHitRate:number;followupHitRate:number;meanReaction:number;meanAcquisition:number;meanFirstShotDelay:number;recoilRms:number;residualRecoilRms:number;}
export interface PeekReport {combatSummary?:CombatSummary;health:number;deaths:number;clears:number;baits:number;recoveryExploits:number;heardEvents:number;enemyShots:number;exposure:number;maxVisibleFraction:number;distance:number;peakSpeed:number;episodes:PeekEpisode[];lastDeath:DefenderDeath|null;path:Vec3[];currentTime?:number;observedRecoveryUntil?:number;visibilityMethod?:string;totalAngles?:number;currentClears?:number;unclearedAngles?:number;operator:{scopedShots:number;scopedHits:number;unscopedShots:number;unscopedHits:number;scopeTransitionSum:number;holdingSeconds:number;firstShots:number;firstHits:number;};}
interface Observation {time:number;point:Vec3;position:Vec3;velocity:Vec3;}
interface RecoilObservation {time:number;pitch:number;yaw:number;}
/** Renderer compatibility fields (face/state/pose/lastShot) remain authoritative. */
export interface DefenderMemory {
 posture?:{crouchAt:number;crouchUntil:number;readyAt:number};
 state:DefenderState;weapon:WeaponId;visible:number;exposure:number;acquired:number;nextShot:number;lastSeen:number;known:Vec3|null;alertUntil:number;destination:Vec3|null;repeats:number;lastExposed:number;face:Vec3;decision:number;aim:Vec3|null;path:Vec3[];pathIndex:number;burst:number;lastShot:DefenderShot|null;holdingFace:Vec3;pose:number;
 gun:Weapon;motor:BotAimMotor;movement:Movement;footsteps:Footsteps;profile:BotControlProfile;rng:SeededRandom;generation:number;initialized:boolean;
 perceptionPhase:PerceptionPhase;detectedAt:number;recognizedAt:number;reactionUntil:number;aimStartedAt:number;acquisitionUntil:number;triggerAt:number;firstShotAt:number;
 preaimed:boolean;contactAngleDegrees:number;
 observations:Observation[];recoilHistory:RecoilObservation[];nextRecoilObservation:number;lastHeard:number;lastHeardPoint:Vec3|null;
 /** 12.40 movement style controller (undefined when styles are off). */
 style?:BotMovementController;
 preferHead:boolean;burstGoal:number;burstRemaining:number;pauseUntil:number;engagementShots:number;engagementHits:number;speculativeShots:number;pressureUntil:number;consecutiveMisses:number;uncertainty:Vec3;uncertaintyAt:number;
}
type Memory=DefenderMemory;
export interface BotDiagnostic {
 bot:number;state:DefenderState;phase:PerceptionPhase;weapon:WeaponId;visible:number;known:Vec3|null;lastSeen:number;lastHeard:number;uncertaintyMetres:number;
 detectedAt:number;recognizedAt:number;reactionUntil:number;aimStartedAt:number;acquisitionUntil:number;triggerAt:number;
 preaimed:boolean;contactAngleDegrees:number;
 ammo:number;reserve:number;reloadingUntil:number|null;nextShot:number;burstRemaining:number;recoil:{pitch:number;yaw:number};motor:ReturnType<BotAimMotor['snapshot']>;
}
const CONTROL_KEYS=['defenderSkill','botDifficulty','defenderReaction','defenderAimSpeed','defenderAimAcceleration','defenderStability','defenderFirstShotError','defenderRecoilControl','defenderTactics','defenderAccuracy'] as const;
const vec=(p:Vec3):Vec3=>({x:p.x,y:p.y,z:p.z});
const distance2=(a:Vec3,b:Vec3)=>Math.hypot(a.x-b.x,a.z-b.z);
const clamp=(n:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,n));
const bodyHit=new Vector3(),worldHit=new Vector3(),inverse=new Matrix4(),localRay=new Ray();
function localBody(p:PlayerBody){
 const c=clamp(p.crouch,0,1),torso=p.eyeHeight-.51+c*.09;
 return [
  {region:'torso' as const,box:new Box3(new Vector3(-.24,torso-.29,-.14),new Vector3(.24,torso+.29,.14))},
  {region:'torso' as const,box:new Box3(new Vector3(-.215,.63-c*.2,-.135),new Vector3(.215,.84-c*.2,.135))},
  ...[-1,1].map(sign=>({region:'arm' as const,box:new Box3(new Vector3(sign<0?-.425:.255,torso-.22,-.1),new Vector3(sign<0?-.255:.425,torso+.23,.1))})),
  ...[-1,1].map(sign=>({region:'leg' as const,box:new Box3(new Vector3(sign<0?-.22:.04,.03,-.1),new Vector3(sign<0?-.04:.22,.65-c*.18,.17))}))
 ];
}
function toWorld(p:PlayerBody,x:number,y:number,z=0,out:Vec3={x:0,y:0,z:0}):Vec3{const c=Math.cos(p.yaw),s=Math.sin(p.yaw);out.x=p.position.x+x*c+z*s;out.y=p.position.y+y;out.z=p.position.z-x*s+z*c;return out;}
export function playerVisibilitySamples(p:PlayerBody,out:Vec3[]=Array.from({length:9},()=>({x:0,y:0,z:0}))):Vec3[]{const torso=p.eyeHeight-.51+clamp(p.crouch,0,1)*.09;toWorld(p,0,p.eyeHeight+.04,0,out[0]);toWorld(p,-.12,p.eyeHeight+.04,0,out[1]);toWorld(p,.12,p.eyeHeight+.04,0,out[2]);toWorld(p,0,torso,0,out[3]);toWorld(p,-.34,torso+.12,0,out[4]);toWorld(p,.34,torso+.12,0,out[5]);toWorld(p,-.13,.3,0,out[6]);toWorld(p,.13,.3,0,out[7]);toWorld(p,0,.72-clamp(p.crouch,0,1)*.2,0,out[8]);return out;}
const visibilitySamples=Array.from({length:9},()=>({x:0,y:0,z:0})),groundCandidates:number[]=[],routeCandidates:number[]=[],navigationPoint=new Vector3();
/** First physical intersection with the current translated/yawed/crouched body. */
export function intersectPlayerBody(ray:Ray,p:PlayerBody,out:Vector3){
 inverse.makeRotationY(p.yaw);inverse.setPosition(p.position.x,p.position.y,p.position.z);inverse.invert();localRay.copy(ray).applyMatrix4(inverse);
 let region:'head'|'torso'|'arm'|'leg'|null=null,nearest=Infinity;
 const head=new Sphere(new Vector3(0,p.eyeHeight+.04,0),.17);
 if(localRay.intersectSphere(head,bodyHit)){worldHit.copy(bodyHit);inverse.invert();worldHit.applyMatrix4(inverse);inverse.invert();nearest=ray.origin.distanceTo(worldHit);out.copy(worldHit);region='head';}
 for(const part of localBody(p)){if(!localRay.intersectBox(part.box,bodyHit))continue;worldHit.copy(bodyHit);inverse.invert();worldHit.applyMatrix4(inverse);inverse.invert();const d=ray.origin.distanceTo(worldHit);if(d<nearest-1e-6){nearest=d;out.copy(worldHit);region=part.region;}}
 return region?{region,distance:nearest}:null;
}

export class DefenderAI {
 memories:Memory[]=[];shots:DefenderShot[]=[];health=150;death:DefenderDeath|null=null;onShot:((s:DefenderShot)=>void)|null=null;perceptionUpdates=0;
 onFootstep:((event:DefenderFootstep)=>void)|null=null;private footstepSequence=0;
 report:PeekReport={health:150,deaths:0,clears:0,baits:0,recoveryExploits:0,heardEvents:0,enemyShots:0,exposure:0,maxVisibleFraction:0,distance:0,peakSpeed:0,episodes:[],lastDeath:null,path:[],currentTime:0,observedRecoveryUntil:0,visibilityMethod:'Nine yawed human-body samples; approximate coverage, not projected body area',operator:{scopedShots:0,scopedHits:0,unscopedShots:0,unscopedHits:0,scopeTransitionSum:0,holdingSeconds:0,firstShots:0,firstHits:0}};
 private rules:SimulationRulesId=CURRENT_SIMULATION_RULES;
 private controlValues:unknown[]=[];private lastPlayerShotVelocity:number|null=null;private lastPlayerShotAt=-100;private combatTotals={timingContacts:0,shots:0,hits:0,firstShots:0,firstHits:0,damage:0,reaction:0,acquisition:0,firstShotDelay:0,recoilSquared:0,residualSquared:0};private epoch=0;private clock=0;private seed:number;private rng:SeededRandom;private current:PeekEpisode|null=null;private episodeOrigin:Vec3|null=null;private episodeLow=0;private episodeHigh=0;private returningAt:number|null=null;private last:Vec3|null=null;private pathAt=0;private perceptionAt=0;private head=new Vector3();private ray=new Ray();private hit=new Vector3();private sequence=0;private usedBaits=new Set<number>();private usedRecoveries=new Set<number>();
 constructor(public targets:Target[],public obstacles:Obstacle[],public settings:Settings,private holdingPoint:Vec3,seed=1947,private sectors:readonly DefenderSector[]=[],private readonly policy?:DefenderPolicy){this.seed=seed;this.rng=new SeededRandom(seed^0xd3f3);this.retry();}
 setSectors(sectors:readonly DefenderSector[]){this.sectors=sectors;}
 setSimulationRules(rules:SimulationRulesId){this.rules=rules;const profiles=weaponProfilesFor(usesCurrentWeapons(rules));
  // Memories (and their guns) are built in the constructor under the default
  // rules; a replayed ruleset must also restore that ruleset's firearm values.
  for(const m of this.memories){m.movement.setSimulationRules(rules);if(usesReferenceRules(rules))m.gun.holdBloomWhileFiring=true;else delete m.gun.holdBloomWhileFiring;if(m.gun.profile!==profiles[m.weapon]){m.gun.profile=profiles[m.weapon];m.gun.reserve=m.gun.profile.reserve;}}}
 retry(){
  this.epoch++;this.lastPlayerShotVelocity=null;this.lastPlayerShotAt=-100;this.health=150;this.death=null;this.current=null;this.last=null;this.episodeOrigin=null;this.returningAt=null;this.pathAt=0;this.perceptionAt=0;this.shots.length=0;this.report.health=150;this.report.path=[];this.report.observedRecoveryUntil=0;this.usedBaits.clear();this.usedRecoveries.clear();
  this.memories=this.targets.map((t,i)=>this.newMemory(t,i));
 }
 private newMemory(t:Target,i:number):Memory{
  const sector=this.sectors[i],yaw=sector?.facingYaw??(t.position.z>7?Math.PI:0),face={x:Math.sin(yaw),y:0,z:Math.cos(yaw)},weapon=this.settings.defenderWeapon==='mixed'?(sector?.weapon??(['rifleA','operator','sheriff','rifleB'] as WeaponId[])[i%4]):this.settings.defenderWeapon;
  const rng=new SeededRandom(this.seed^Math.imul(i+1,0x45d9f3b)^Math.imul(this.epoch,0x19a1)),gun=new Weapon(weaponProfilesFor(usesCurrentWeapons(this.rules))[weapon],this.seed^Math.imul(i+1,0x1f123bb5)^Math.imul(this.epoch,0x4417));
  gun.scopeMode='hold';gun.autoRescope=true;gun.infiniteReserve=this.settings.infiniteReserve;gun.autoReload=true;if(usesReferenceRules(this.rules))gun.holdBloomWhileFiring=true;
  const footsteps=new Footsteps();footsteps.onStep=e=>{if(this.memories[i]?.footsteps!==footsteps||!t.enabled||!t.active)return;if(this.rules==='legacy-v2')this.onFootstep?.({...e,id:++this.footstepSequence,position:vec(e.position),material:this.settings.practiceMap==='complex'?zoneAt(e.position)?.material??'concrete':'concrete',bot:i,encounterGeneration:this.epoch,kind:'bot-step'});else{const surfaceId=resolveGroundSurface(this.settings.practiceMap,this.obstacles,e.position,this.rules);this.onFootstep?.({...e,id:++this.footstepSequence,position:vec(e.position),material:SURFACES[surfaceId].footstepSoundProfile,surfaceId,bot:i,encounterGeneration:this.epoch,kind:'bot-step'});}};
  const movement=new Movement(undefined,this.obstacles);movement.setSimulationRules(this.rules);
  return{state:'holding',weapon,visible:0,exposure:0,acquired:0,nextShot:0,lastSeen:-100,known:null,alertUntil:0,destination:null,repeats:0,lastExposed:-100,face,holdingFace:{...face},decision:0,aim:null,path:[],pathIndex:0,burst:0,lastShot:null,pose:0,
   gun,motor:new BotAimMotor(wrapAngle(-yaw-Math.PI),rng),movement,footsteps,profile:resolveBotProfile(this.settings,weapon),rng,generation:t.generation,initialized:false,
   perceptionPhase:'unaware',detectedAt:-100,recognizedAt:Infinity,reactionUntil:Infinity,aimStartedAt:-100,acquisitionUntil:Infinity,triggerAt:Infinity,firstShotAt:-100,preaimed:false,contactAngleDegrees:0,
   observations:[],recoilHistory:[],nextRecoilObservation:0,lastHeard:-100,lastHeardPoint:null,preferHead:false,burstGoal:0,burstRemaining:0,pauseUntil:0,engagementShots:0,engagementHits:0,speculativeShots:0,pressureUntil:0,consecutiveMisses:0,uncertainty:{x:0,y:0,z:0},uncertaintyAt:-100,...(this.policy?.style==='crouch-counter'?{posture:{crouchAt:Infinity,crouchUntil:-Infinity,readyAt:0}}:{})};
 }
 hear(e:FootstepEvent){
  // No key state or current hidden player position reaches this memory. A sound is
  // a dated observation at its emitted location, attenuated by intervening cover.
  // Sound retains geometric occlusion, including transparent glass barriers.
  let heard=false;
  for(const t of this.targets){if(!t.enabled||!t.active)continue;const m=this.memories[t.id];if(!m)continue;t.headPosition(this.head);const source={...e.position,y:e.position.y+1};const clear=visibleBetween(this.obstacles,vec(this.head),source);if(Math.hypot(t.position.x-e.position.x,t.position.y-e.position.y,t.position.z-e.position.z)>e.radius*(clear?1:.7))continue;
   if(m.visible<=0){m.known=vec(e.position);m.lastHeard=e.timestamp;m.lastHeardPoint=vec(e.position);m.alertUntil=e.timestamp+2.2;m.uncertainty={x:m.rng.range(-1,1),y:m.rng.range(-.2,.2),z:m.rng.range(-1,1)};m.uncertaintyAt=e.timestamp;if(m.state==='holding')m.state='listening';}heard=true;
  }
  if(heard)this.report.heardEvents++;
 }
 eliminated(id:number){const m=this.memories[id];if(m&&m.state!=='eliminated'){m.state='eliminated';m.visible=0;m.destination=null;m.path=[];this.report.clears++;}}
 private visible(t:Target,p:PlayerBody,m:Memory,recordAim=true){
  t.headPosition(this.head);const from=this.head,dx=p.position.x-from.x,dz=p.position.z-from.z,d=Math.hypot(dx,dz);if(d>65)return 0;if((dx*m.face.x+dz*m.face.z)/Math.max(.001,d)<Math.cos(80*Math.PI/180))return 0;
  const points=playerVisibilitySamples(p,visibilitySamples);let n=0,selected:Vec3|null=null,best=Infinity;
  for(let i=0;i<points.length;i++){const point=points[i];if(!visibleBetween(this.obstacles,from,point,this.rules))continue;n++;const score=m.preferHead?Math.abs(point.y-(p.position.y+p.eyeHeight+.04))+Math.abs(i===0?0:point.x-p.position.x)*.1:Math.abs(point.y-(p.position.y+p.eyeHeight*.7));if(score<best){best=score;selected=point;}}
  if(recordAim&&selected)m.aim=vec(selected);return n/points.length;
 }
 private detect(t:Target,m:Memory,p:PlayerBody,time:number){
  const previous=m.visible;m.visible=this.visible(t,p,m);
  if(m.visible>0){
   const fresh=time-m.lastSeen>1.5||m.detectedAt<0;
   if(fresh){
    m.detectedAt=time;m.recognizedAt=time+m.profile.recognition;
    // Keep RNG order identical for every unchanged difficulty. The expert-only
    // shorter response is selected from the *current* observed angular error,
    // never from a hidden player position, rank label or assumed perfect aim.
    const responseJitter=m.rng.range(.88,1.14);
    m.aimStartedAt=-100;m.acquisitionUntil=Infinity;m.triggerAt=Infinity;m.engagementShots=0;m.engagementHits=0;m.firstShotAt=-100;m.observations=[];m.preferHead=this.policy?true:m.rng.next()<.12+m.profile.tactics*.35;this.visible(t,p,m);
    t.headPosition(this.head);const aim=m.aim,dx=(aim?.x??this.head.x)-this.head.x,dy=(aim?.y??this.head.y)-this.head.y,dz=(aim?.z??this.head.z)-this.head.z;
    const angle=m.motor.error(Math.atan2(-dx,-dz),Math.atan2(dy,Math.hypot(dx,dz)));m.contactAngleDegrees=angle*180/Math.PI;
    m.preaimed=aim!==null&&m.profile.heldReaction!==null&&angle<=m.profile.heldAngle;
    m.reactionUntil=m.recognizedAt+(m.preaimed?m.profile.heldReaction!:m.profile.reaction)*responseJitter;m.perceptionPhase='detected';
   }
   else if(previous<=0&&time-m.lastSeen>.18){m.repeats++;m.triggerAt=Math.max(m.triggerAt,time+.12);m.burstRemaining=0;}
   if(time-m.lastExposed>.18)m.repeats++;m.lastExposed=time;m.lastSeen=time;m.known=vec(p.position);m.speculativeShots=0;
   if(m.aim){m.observations.push({time,point:vec(m.aim),position:vec(p.position),velocity:vec(p.velocity)});if(m.observations.length>40)m.observations.shift();}
  }else if(previous>0)this.loseContact(m,time);
 }
 private loseContact(m:Memory,time:number){m.visible=0;m.perceptionPhase='lost';m.uncertainty={x:m.rng.range(-1,1),y:m.rng.range(-.25,.25),z:m.rng.range(-1,1)};m.uncertaintyAt=time;m.burstRemaining=0;}
 private rememberedAim(m:Memory,time:number):Vec3|null{
  if(m.visible>0&&m.observations.length){const deadline=time-(this.policy?Math.max(.14,m.profile.trackingDelay):m.profile.trackingDelay);let observation=m.observations[0];for(const candidate of m.observations){if(candidate.time>deadline)break;observation=candidate;}
   // Prediction is based only on an old visible observation. Direction changes
   // inside the perception/tracking delay remain unknown to the controller.
   const prediction=Math.min(.055,Math.max(0,time-observation.time)*.3);return{x:observation.point.x+observation.velocity.x*prediction,y:observation.point.y+observation.velocity.y*prediction,z:observation.point.z+observation.velocity.z*prediction};}
  if(m.aim&&time-m.lastSeen<1.5){const age=Math.max(0,time-m.lastSeen);return{x:m.aim.x+m.uncertainty.x*age*.65,y:m.aim.y+m.uncertainty.y*age*.4,z:m.aim.z+m.uncertainty.z*age*.65};}
  if(m.lastHeardPoint&&time<m.alertUntil){const age=Math.max(0,time-m.lastHeard),point=m.lastHeardPoint;return{x:point.x+m.uncertainty.x*(.35+age*.8),y:point.y+1.15+m.uncertainty.y,z:point.z+m.uncertainty.z*(.35+age*.8)};}
  return null;
 }
 step(dt:number,time:number,p:PlayerBody){
  if(this.death||!(dt>0))return;
  let controlsChanged=false;for(let i=0;i<CONTROL_KEYS.length;i++)if(this.controlValues[i]!==this.settings[CONTROL_KEYS[i]]){controlsChanged=true;break;}
  if(controlsChanged){this.controlValues=CONTROL_KEYS.map(key=>this.settings[key]);for(const memory of this.memories)memory.profile=resolveBotProfile(this.settings,memory.weapon);}
  this.clock=time;this.report.currentTime=time;let any=0;const perception=time+1e-9>=this.perceptionAt;if(perception){this.perceptionAt=time+.05;this.perceptionUpdates++;}
  const epoch=this.epoch;
  for(const t of this.targets){
   if(!t.enabled)continue;let m=this.memories[t.id];if(!m)continue;if(!t.active){this.eliminated(t.id);continue;}if(m.generation!==t.generation){m=this.newMemory(t,t.id);this.memories[t.id]=m;}
   if(!m.initialized){m.initialized=true;m.nextRecoilObservation=time;m.gun.resetForEncounter(time,true);}
   t.previous.copy(t.position);
   if(perception)this.detect(t,m,p,time);
   // A cheap current obstruction check invalidates a cached visible observation;
   // it never acquires a new concealed location between perception updates.
   else if(m.visible>0&&m.aim){t.headPosition(this.head);if(!visibleBetween(this.obstacles,vec(this.head),m.aim,this.rules)){this.loseContact(m,time);}}
   const seen=m.visible>0;any=Math.max(any,m.visible);
   if(seen){m.exposure+=dt;m.acquired+=dt;}else{m.acquired=Math.max(0,m.acquired-dt*2);m.exposure=this.settings.exposureMode==='continuous'?0:Math.max(0,m.exposure-dt*.65);}
   if(seen&&time>=m.recognizedAt&&time<m.reactionUntil)m.perceptionPhase=time<m.recognizedAt+dt?'recognized':'reacting';
   if(seen&&time>=m.reactionUntil&&m.aimStartedAt<0){m.aimStartedAt=time;m.motor.begin(time,m.profile);const point=this.rememberedAim(m,time);t.headPosition(this.head);const dx=(point?.x??0)-this.head.x,dy=(point?.y??0)-this.head.y,dz=(point?.z??0)-this.head.z,angle=m.motor.error(Math.atan2(-dx,-dz),Math.atan2(dy,Math.hypot(dx,dz)));
    // A held angle does not need another full fixed acquisition delay after
    // recognition and response. The small confirmation window scales with the
    // observed angular correction; the finite motor and fresh LOS still gate
    // the real shot, including surprises far from the held crosshair.
    m.acquisitionUntil=time+clamp(m.profile.acquisition*angle/(Math.PI/4),.008,m.profile.acquisition);m.triggerAt=m.acquisitionUntil+m.rng.range(.008,.02);}
   if(seen&&m.aimStartedAt>=0)m.perceptionPhase=time<m.acquisitionUntil?'aiming':'tracking';
   const look=this.rememberedAim(m,time);t.headPosition(this.head);const canAim=m.aimStartedAt>=0||!seen&&m.lastHeardPoint!==null;
   let yaw=wrapAngle(-Math.atan2(m.holdingFace.x,m.holdingFace.z)-Math.PI),pitch=0;
   if(canAim&&look){const dx=look.x-this.head.x,dy=look.y-this.head.y,dz=look.z-this.head.z;yaw=Math.atan2(-dx,-dz);pitch=Math.atan2(dy,Math.hypot(dx,dz));}
   // Angular motor uses bounded substeps even for external callers with a coarse
   // timestep. The production loop supplies fixed 120 Hz simulation steps.
   const n=Math.max(1,Math.ceil(dt/(1/120)));for(let k=0;k<n;k++)m.motor.step(dt/n,time-dt+(k+1)*dt/n,yaw,pitch,m.profile,m.burst/6);
   m.face={x:-Math.sin(m.motor.yaw),y:0,z:-Math.cos(m.motor.yaw)};
   const feedbackAt=time-m.profile.compensationDelay;let feedback:RecoilObservation|undefined;for(const sample of m.recoilHistory){if(sample.time>feedbackAt)break;feedback=sample;}m.motor.compensate(dt,feedback?.pitch??0,feedback?.yaw??0,m.profile);
   const recovering=time<m.nextShot||m.gun.reloadingUntil!==null;
   if(recovering){m.state='recovering';if(time>=m.decision&&!m.destination&&!this.sectors[t.id]?.motion&&!this.styleFor(t,m)){m.decision=time+.5;if(this.rng.next()<this.settings.defenderReposition)this.reposition(t,m,time);}}
   else if(seen)m.state='tracking';else if(m.destination)m.state=time-m.lastSeen<3?'repositioning':'returning';else m.state=m.alertUntil>time?'alert':'holding';
   this.move(t,m,dt,time);
   this.controlWeapon(t,m,p,time,dt,look,yaw,pitch);
   if(epoch!==this.epoch)return;
   if(!seen&&time-m.lastSeen>1.5&&time>m.alertUntil){m.known=null;m.aim=null;m.lastHeardPoint=null;m.perceptionPhase='unaware';m.aimStartedAt=-100;m.detectedAt=-100;}
   // Learning/exposure are timer-only; realistic gunfights are bullet-only.
   const timerMode=this.settings.combatMode!=='gunfight'&&(this.settings.combatMode==='exposure'||this.settings.exposureEnabled);
   if(timerMode&&m.exposure>=this.settings.exposureLimit&&!this.death&&this.visible(t,p,m,false)>0)this.kill(t,m,p,time,'exposure','노출 제한');
   if(this.death)break;
  }
  this.measure(dt,time,p,any);
 }
 private controlWeapon(t:Target,m:Memory,p:PlayerBody,time:number,dt:number,look:Vec3|null,yaw:number,pitch:number){
  const gun=m.gun,input=emptyInput(),speed=Math.hypot(t.velocity.x,t.velocity.z),distance=look?Math.hypot(look.x-t.position.x,look.z-t.position.z):Infinity;
  gun.infiniteReserve=this.settings.infiniteReserve;
  // Adapter exposes the actual collision-resolved bot velocity to the same
  // movement/spread code used by the player. It does not run a second physics loop.
  m.movement.position.copy(t.position);m.movement.velocity.copy(t.velocity);m.movement.speed=speed;m.movement.crouch=t.crouch;m.movement.grounded=true;
  input.ads=m.weapon!=='sheriff'&&distance>18;input.scopeHeld=true;
  // Holding scope through an empty-magazine reload does not create another
  // human input edge. Explicitly release/re-press once the bot has reloaded.
  if(m.weapon==='operator'&&gun.scopeLevel===0&&gun.reloadingUntil===null&&time>=gun.boltUntil&&time-gun.lastShot>1/gun.profile.fireRate)gun.updateScope(time,0,{...input,scopeHeld:false});
  gun.updateScope(time,dt,input);
  const heardReady=m.lastHeard>-90&&time>=m.lastHeard+Math.max(.45,m.profile.reaction+.2);
  const ready=(time>=m.triggerAt||m.visible===0&&heardReady)&&time>=m.pauseUntil&&time>=m.nextShot&&gun.reloadingUntil===null&&time>=gun.equipUntil&&time>=gun.boltUntil;
  const angularError=m.motor.error(yaw,pitch),tolerance=Math.max(.8*Math.PI/180,Math.atan2(.22,Math.max(1,distance)));
  let information:'visual'|'memory'|'sound'='visual',admit=false;
  const style=m.style,run=gun.profile.movementSpeed??5.4,deadzone=usesReferenceRules(this.rules)?VALORANT_REFERENCE.deadzone*run:.55;
  const settled=style?style.canShoot(speed,t.crouch,deadzone,run):speed<(m.weapon==='operator'?.5:m.profile.tactics<.4?1.4:.55);
  if(this.settings.combatMode==='gunfight'&&look&&ready&&settled){
   if(m.visible>0&&time>=m.acquisitionUntil&&angularError<tolerance*(m.burstRemaining?1.6:1)){
    // Fresh LOS gates ordinary shots. A memory wallbang has a separate explicit
    // admission path below and never changes this perception result.
    const fresh=this.visible(t,p,m,false);if(fresh>0)admit=true;else this.loseContact(m,time);
   }
   if(!admit&&m.visible===0&&m.speculativeShots<2&&(time>=m.triggerAt||heardReady)){
    const memory=time-m.lastSeen<.6&&time>=m.triggerAt,sound=time-m.lastHeard<1.1&&heardReady;
    if((memory||sound)&&angularError<tolerance*1.8&&time>=m.decision){m.decision=time+.25;
     t.headPosition(this.head);const direction=new Vector3(look.x-this.head.x,look.y-this.head.y,look.z-this.head.z),length=direction.length();this.ray.set(this.head.clone(),direction.normalize());
     const preview=traceBallisticRay(this.ray,gun.profile,{distance:length,zone:'torso',point:look},this.obstacles,150,this.rules);
     if(preview.stopReason==='target'&&preview.penetratedLayers>0&&m.rng.next()<m.profile.tactics*.32){admit=true;information=memory?'memory':'sound';}
    }
   }
  }
  // Operator only fires when its real scope transition is complete. Cadence,
  // bolt state, magazine and reload restrictions are still enforced by Weapon.
  if(gun.ammo===0)admit=false;
  if(m.weapon==='operator'&&(!gun.ads||gun.scopeAmount<.985||time<gun.scopeReadyAt))admit=false;
  const residual=Math.hypot(gun.recoil.pitch+m.motor.compensationPitch*180/Math.PI,gun.recoil.yaw+m.motor.compensationYaw*180/Math.PI);
  if(admit&&gun.profile.fireMode==='auto'&&(residual>(distance>18?2.2:6)||m.consecutiveMisses>=4&&distance>12)){m.burstRemaining=0;m.pauseUntil=time+gun.profile.resetTime+.06;m.consecutiveMisses=0;admit=false;}
  if(admit){
   if(m.burstRemaining<=0){m.burstGoal=m.style?.tapping?1:this.burstSize(m,distance,angularError,time);m.burstRemaining=m.burstGoal;m.burst=0;}
   input.fire=true;input.firePresses=gun.profile.fireMode==='auto'?0:1;m.state='firing';
  }
  const epoch=this.epoch;
  gun.step(time,dt,input,()=>{if(epoch!==this.epoch||m.generation!==t.generation||this.death)return;m.style?.shotFired();this.fire(t,m,p,time,information,yaw,pitch);});
  if(epoch!==this.epoch)return;
  if(time+1e-9>=m.nextRecoilObservation){m.nextRecoilObservation=time+.04;m.recoilHistory.push({time,pitch:gun.recoil.pitch,yaw:gun.recoil.yaw});if(m.recoilHistory.length>40)m.recoilHistory.shift();}
 }
 /** A supported floor height close enough to traverse without flying or climbing walls. */
 private ground(x:number,z:number,fromY:number):number|null{
  const index=staticBroadphaseFor(this.obstacles);if(index)index.queryAabb(x-.001,-Infinity,z-.001,x+.001,Infinity,z+.001,groundCandidates);
  let best:number|null=0<=fromY+.31&&0>=fromY-.31&&standingSpace(this.obstacles,{x,y:0,z},.3)?0:null;
  for(let i=0,n=index?groundCandidates.length:this.obstacles.length;i<n;i++){const o=this.obstacles[index?groundCandidates[i]:i],b=o.box;if((o.kind!=='cover'&&!o.ramp)||x<b.min.x-.001||x>b.max.x+.001||z<b.min.z-.001||z>b.max.z+.001)continue;const y=surfaceHeight(o,x,z);if(y<=fromY+.31&&y>=fromY-.31&&standingSpace(this.obstacles,{x,y,z},.3))best=best===null?y:Math.max(best,y);}
  return best;
 }
 private segment(a:Vec3,b:Vec3):Vec3[]|null{
  const d=distance2(a,b),n=Math.max(1,Math.ceil(d/.12));let y=a.y;const path:Vec3[]=[];
  for(let i=1;i<=n;i++){const x=a.x+(b.x-a.x)*i/n,z=a.z+(b.z-a.z)*i/n,next=this.ground(x,z,y);if(next===null)return null;y=next;path.push({x,y,z});}
  return Math.abs(y-b.y)<=.32?path:null;
 }
 /** Short visibility graph only when deciding to reposition, never per simulation tick. */
 private route(a:Vec3,b:Vec3):Vec3[]|null{
  const direct=this.segment(a,b);if(direct)return[b];
  const nodes:Vec3[]=[vec(a),vec(b)],nearby:Obstacle[]=[];navigationPoint.set(a.x,a.y,a.z);const index=staticBroadphaseFor(this.obstacles);if(index)index.queryAabb(a.x-5,a.y-5,a.z-5,a.x+5,a.y+5,a.z+5,routeCandidates);for(let i=0,n=index?routeCandidates.length:this.obstacles.length;i<n&&nearby.length<10;i++){const o=this.obstacles[index?routeCandidates[i]:i];if(o.box.distanceToPoint(navigationPoint)<5&&o.box.max.y>a.y+.35)nearby.push(o);}
  for(const o of nearby){for(const x of [o.box.min.x-.36,o.box.max.x+.36])for(const z of [o.box.min.z-.36,o.box.max.z+.36]){if(Math.hypot(x-a.x,z-a.z)>8)continue;const y=this.ground(x,z,a.y);if(y!==null)nodes.push({x,y,z});}}
  // L waypoints cover corridor turns without assuming endpoints can be connected.
  for(const point of [{x:a.x,y:a.y,z:b.z},{x:b.x,y:a.y,z:a.z}]){const y=this.ground(point.x,point.z,a.y);if(y!==null)nodes.push({...point,y});}
  const cost=nodes.map(()=>Infinity),prev=nodes.map(()=>-1),done=new Set<number>(),edges=new Map<string,boolean>();cost[0]=0;
  for(let count=0;count<nodes.length;count++){let at=-1;for(let i=0;i<nodes.length;i++)if(!done.has(i)&&(at<0||cost[i]<cost[at]))at=i;if(at<0||!Number.isFinite(cost[at]))break;if(at===1){const result:Vec3[]=[];for(let j=1;j>0;j=prev[j])result.unshift(nodes[j]);return result;}done.add(at);
   for(let j=1;j<nodes.length;j++){if(done.has(j)||distance2(nodes[at],nodes[j])>8)continue;const proposed=cost[at]+distance2(nodes[at],nodes[j]);if(proposed>=cost[j])continue;const key=`${at}:${j}`,valid=edges.get(key)??!!this.segment(nodes[at],nodes[j]);edges.set(key,valid);if(valid){cost[j]=proposed;prev[j]=at;}}
  }
  return null;
 }
 private reposition(t:Target,m:Memory,time:number){
  m.decision=time+1;if(!m.known)return;const sector=this.sectors[t.id],candidates:Vec3[]=(sector?.alternatives?.length?sector.alternatives:sector?.navigation?.length?sector.navigation:[-1,1,-2,2].map(d=>({x:t.anchor.x+d,y:t.anchor.y,z:t.anchor.z+this.rng.range(-.8,.8)}))).map(vec);
  // Repeated visible peeks change the chosen side; hidden movement never does.
  if(m.repeats>1)candidates.sort((a,b)=>Math.sign(m.repeats%2?1:-1)*(a.x-b.x));
  const routes=candidates.flatMap(p=>{if(distance2(t.position,p)<.25||!standingSpace(this.obstacles,p,.3))return[];const path=this.route(t.position,p);return path?[{p,path}]:[];});if(!routes.length)return;
  const hidden=routes.filter(({p})=>!visibleBetween(this.obstacles,{x:p.x,y:p.y+1.5,z:p.z},{x:m.known!.x,y:m.known!.y+1.4,z:m.known!.z},this.rules));const list=hidden.length?hidden:routes,selected=list[Math.floor(this.rng.next()*list.length)];m.path=selected.path;m.pathIndex=0;m.destination=vec(selected.p);
 }
 /** The bot's movement style for this life, chosen once (null: classic holding AI).
  * Recorded motions and scenario policies keep their own movement. */
 private styleFor(t:Target,m:Memory){
  if(m.style)return m.style;
  // Nothing is stored when styles are off: memory is part of the replay checksum.
  const choice=this.settings.botMovement;
  if(!choice||choice==='off'||this.sectors[t.id]?.motion||this.policy)return null;
  const style=chooseStyle(choice,m.rng);if(style)m.style=new BotMovementController(style);return m.style??null;
 }
 /** Style of a bot, for the HUD and death replay. */
 styleOf(id:number):BotMovementStyleId|null{return this.memories[id]?.style?.style.id??null;}
 private move(t:Target,m:Memory,dt:number,time:number){
  const motion=this.sectors[t.id]?.motion,posture=m.posture,style=this.styleFor(t,m);
  if(style){
   const gun=m.gun,run=gun.profile.movementSpeed??5.4;
   style.step(t,{time,dt,runSpeed:run,rng:m.rng,face:m.holdingFace,known:m.known,seen:m.visible>0,
    wantsShot:m.aimStartedAt>=0&&time>=m.acquisitionUntil&&time>=m.triggerAt&&time>=m.nextShot&&gun.reloadingUntil===null,deadzone:usesReferenceRules(this.rules)?VALORANT_REFERENCE.deadzone*run:.55},
    {ground:(x,z,y)=>this.ground(x,z,y),standing:p=>standingSpace(this.obstacles,p,.3),clear:(a,b)=>visibleBetween(this.obstacles,a,b,this.rules)});
  }else if(posture&&!motion){
   const crouch=time>=posture.crouchAt&&time<posture.crouchUntil?1:0;
   t.crouch+=clamp(crouch-t.crouch,-dt*7,dt*7);
  }
  if(motion){
   const pose=motionPose(t.anchor,motion,time-t.spawnAt);
   const y=this.ground(pose.x,pose.z,pose.y)??pose.y;
   t.velocity.set((pose.x-t.position.x)/dt,(y-t.position.y)/dt,(pose.z-t.position.z)/dt);
   t.position.set(pose.x,y,pose.z);t.crouch=pose.crouch;
  }else if(style){/* Position and velocity come from the movement style. */}
  else if(m.destination){let goal=m.path[m.pathIndex]??m.destination,d=distance2(t.position,goal);if(d<.008){m.pathIndex++;goal=m.path[m.pathIndex]??m.destination;d=distance2(t.position,goal);}
   if(d<.008&&m.pathIndex>=m.path.length){m.destination=null;m.path=[];m.state='re-peeking';t.velocity.set(0,0,0);}else{
    // Braking distance keeps turns at validated waypoints. Interpolating velocity
    // across a corner would cut through cover; each segment instead slows before
    // changing direction. Velocity always describes actual resolved displacement.
    const dx=(goal.x-t.position.x)/Math.max(.001,d),dz=(goal.z-t.position.z)/Math.max(.001,d),cap=clamp(this.settings.targetSpeed,0,1)*3.2*(posture?1-t.crouch*.48:1);
    const previous=Math.max(0,t.velocity.x*dx+t.velocity.z*dz),speed=Math.min(cap,previous+6*dt,Math.sqrt(2*8*d)),n=Math.min(d,speed*dt);
    const nx=t.position.x+dx*n,nz=t.position.z+dz*n,ny=this.ground(nx,nz,t.position.y);if(ny!==null){t.velocity.set((nx-t.position.x)/dt,(ny-t.position.y)/dt,(nz-t.position.z)/dt);t.position.set(nx,ny,nz);}else{m.destination=null;m.path=[];t.velocity.set(0,0,0);}
   }
  }else t.velocity.set(0,0,0);
  const ground=motion?t.position.y:this.ground(t.position.x,t.position.z,t.position.y),grounded=ground!==null&&Math.abs(ground-t.position.y)<.02;
  m.footsteps.step({previous:t.previous,position:t.position,velocity:t.velocity,grounded,crouch:t.crouch},false,dt,time);
  t.updatePose(time);const aim=['tracking','firing'].includes(m.state)?1:m.state==='recovering'?.8:m.destination?.25:m.state==='alert'||m.state==='listening'?.6:.35;m.pose+=(aim-m.pose)*(1-Math.exp(-dt*9));t.leftArm.rotation.set(-m.pose,.0,.4*m.pose);t.rightArm.rotation.set(-1.18*m.pose,0,-.4*m.pose);t.root.rotation.y=Math.atan2(m.face.x,m.face.z);t.root.updateMatrixWorld(true);for(const part of t.parts)part.inverse.copy(part.node.matrixWorld).invert();
 }
 /** Short utility policy: these inputs are all observed or owned state. No
  * concealed player position or future trajectory enters burst selection. */
 private burstSize(m:Memory,distance:number,error:number,time:number){
  if(m.weapon==='operator'||m.weapon==='sheriff')return 1;
  let count=distance>30?1:distance>18?2+Number(m.rng.next()<m.profile.tactics):distance>8?3+Math.floor(m.rng.next()*3):6+Math.floor(m.rng.next()*6);
  const observation=m.observations.at(-1),motion=observation?Math.hypot(observation.velocity.x,observation.velocity.z):0;
  const confidence=clamp(1-error/(2*Math.PI/180),0,1),residual=Math.hypot(m.gun.recoil.pitch+m.motor.compensationPitch*180/Math.PI,m.gun.recoil.yaw+m.motor.compensationYaw*180/Math.PI);
  if(distance>8&&(motion>2.5||confidence<.55||residual>1))count=Math.max(1,count-1);
  if(time<m.pressureUntil||m.repeats>3&&m.profile.tactics>.5)count=Math.max(1,count-1);
  if(m.profile.skill==='beginner'&&distance>8)count=Math.min(count,3);
  return Math.min(m.gun.ammo,Math.max(1,count));
 }
 private fire(t:Target,m:Memory,p:PlayerBody,time:number,information:'visual'|'memory'|'sound',desiredYaw:number,desiredPitch:number){
  const gun=m.gun,profile=gun.profile,recoilBefore={pitch:gun.recoil.pitch,yaw:gun.recoil.yaw};
  const reference=usesReferenceRules(this.rules)?VALORANT_REFERENCE.spread[m.weapon as keyof typeof VALORANT_REFERENCE.spread]:undefined;
  const spread={...(reference?gun.calculateReferenceSpread(m.movement,gun.ads,time-m.movement.landedAt<VALORANT_REFERENCE.landing.seconds,reference,false):gun.calculateSpread(m.movement,gun.ads,time-m.movement.landedAt<.16))};
  const direction=spreadDirection(m.motor.yaw+m.motor.compensationYaw+recoilBefore.yaw*Math.PI/180,m.motor.pitch+m.motor.compensationPitch+recoilBefore.pitch*Math.PI/180,spread.x,spread.y,new Vector3());
  t.headPosition(this.head);const origin=this.head.clone();this.ray.set(origin,direction);const playerHit=intersectPlayerBody(this.ray,p,this.hit),trace=traceBallisticRay(this.ray,profile,playerHit?{distance:playerHit.distance,zone:playerHit.region,point:vec(this.hit)}:null,this.obstacles,150,this.rules);
  const detail=trace.zone==='head'||trace.zone==='torso'||trace.zone==='arm'||trace.zone==='leg'?trace.zone:undefined,region:DefenderShot['hit']=detail==='head'?'head':detail==='leg'?'leg':detail?'body':'miss';
  // Exactly the player recoil profile and RNG streams affect the next ray.
  // Compensation lives in the motor and cannot erase the weapon's true recoil.
  gun.recoil.kick(gun.shotIndex,profile,gun.recoilRng,t.crouch,time);
  m.consecutiveMisses=region==='miss'?m.consecutiveMisses+1:0;m.burst++;m.burstRemaining--;m.engagementShots++;m.engagementHits+=Number(region!=='miss');if(m.firstShotAt<0)m.firstShotAt=time;
  const interval=1/(gun.ads?profile.adsFireRate:profile.fireRate);
  m.nextShot=time+interval;
  if(m.burstRemaining<=0){let pause=m.weapon==='operator'?interval+profile.adsTransition:m.weapon==='sheriff'?Math.max(.650001,profile.resetTime+.1):profile.resetTime+m.rng.range(.05,.18);if(this.policy?.playerTempo&&profile.fireMode==='auto')pause=Math.max(pause,this.policy.playerTempo.burstPauseMs/1000);
   m.pauseUntil=time+pause;m.nextShot=Math.max(m.nextShot,m.pauseUntil);}
  if(information!=='visual')m.speculativeShots++;
  else if(!this.sectors[t.id]?.motion&&m.burst===1&&profile.fireMode==='auto'&&m.known&&distance2(t.position,m.known)<22)this.queueCrouch(m,time);
  m.decision=time+.25;
  const distance=origin.distanceTo(new Vector3(p.position.x,p.position.y+p.eyeHeight,p.position.z)),playerEye={x:p.position.x,y:p.position.y+p.eyeHeight,z:p.position.z},observed=distance<=(m.weapon==='operator'?80:35)||visibleBetween(this.obstacles,playerEye,vec(origin),this.rules);
  const damage=detail?damageAt(profile,detail,trace.distance)*trace.damageScale:0;
  const visualContact=m.detectedAt>=0&&m.aimStartedAt>=0;
  const shot:DefenderShot={encounterGeneration:this.epoch,targetGeneration:t.generation,id:++this.sequence,time,bot:t.id,weapon:m.weapon,origin:vec(origin),aim:vec(origin.clone().addScaledVector(direction,Math.max(1,distance))),impact:vec(trace.point),direction:vec(direction),hit:region,hitRegion:detail,observed,recoveryUntil:m.nextShot,
   information,angularError:m.motor.error(desiredYaw,desiredPitch)*180/Math.PI,trajectoryAngularError:direction.angleTo(spreadDirection(desiredYaw,desiredPitch,0,0,new Vector3()))*180/Math.PI,shotIndex:gun.shotIndex,burstIndex:m.burst,ammoBefore:gun.ammo,recoilBefore,recoilAfter:{pitch:gun.recoil.pitch,yaw:gun.recoil.yaw},compensation:{pitch:m.motor.compensationPitch*180/Math.PI,yaw:m.motor.compensationYaw*180/Math.PI},spread,damage,penetratedLayers:trace.penetratedLayers,penetration:trace.segments,reactionTime:visualContact?m.aimStartedAt-m.detectedAt:undefined,aimAcquisitionTime:visualContact?time-m.aimStartedAt:undefined,detectedAt:visualContact?m.detectedAt:undefined,
   timing:visualContact?{preaimed:m.preaimed,contactAngleDegrees:m.contactAngleDegrees,detectedAt:m.detectedAt,recognizedAt:m.recognizedAt,reactionUntil:m.reactionUntil,aimStartedAt:m.aimStartedAt,acquisitionUntil:m.acquisitionUntil,triggerAt:m.triggerAt,firedAt:time}:undefined};
  const totals=this.combatTotals;totals.shots++;totals.hits+=Number(region!=='miss');totals.damage+=damage;totals.recoilSquared+=recoilBefore.pitch**2+recoilBefore.yaw**2;totals.residualSquared+=(recoilBefore.pitch+shot.compensation!.pitch)**2+(recoilBefore.yaw+shot.compensation!.yaw)**2;
  if(m.engagementShots===1){totals.firstShots++;totals.firstHits+=Number(region!=='miss');if(visualContact){totals.timingContacts++;totals.reaction+=shot.reactionTime!;totals.acquisition+=shot.aimAcquisitionTime!;totals.firstShotDelay+=time-m.detectedAt;}}
  this.report.combatSummary=this.combatSummary();
  m.lastShot=shot;this.shots.push(shot);if(this.shots.length>96)this.shots.shift();this.report.enemyShots++;
  if(observed&&m.weapon==='operator')this.report.observedRecoveryUntil=Math.max(this.report.observedRecoveryUntil??0,m.nextShot);
  if(damage>0){this.health-=damage;this.report.health=Math.max(0,this.health);if(this.health<=0)this.kill(t,m,p,time,'shot',detail??region,shot);}this.onShot?.(shot);
 }
 private queueCrouch(m:Memory,time:number,hit=false){
  const posture=m.posture;
  if(!posture||time<posture.readyAt||m.destination)return;
  const tempo=this.policy?.playerTempo;
  const chance=hit ? .8 : tempo ? tempo.crouchRate/100 : .58;
  const delay=m.rng.range(.16,.26),hold=tempo?tempo.crouchHoldMs/1000:m.rng.range(.35,.58);
  posture.readyAt=time+delay+hold+.55;
  if(m.rng.next()>=chance)return;
  posture.crouchAt=time+delay;
  posture.crouchUntil=posture.crouchAt+hold;
 }
 private combatSummary():CombatSummary{const t=this.combatTotals,followupShots=t.shots-t.firstShots,followupHits=t.hits-t.firstHits;return{shots:t.shots,hits:t.hits,firstShots:t.firstShots,firstHits:t.firstHits,followupShots,followupHits,damage:t.damage,firstHitRate:t.firstShots?t.firstHits/t.firstShots:0,followupHitRate:followupShots?followupHits/followupShots:0,meanReaction:t.timingContacts?t.reaction/t.timingContacts:0,meanAcquisition:t.timingContacts?t.acquisition/t.timingContacts:0,meanFirstShotDelay:t.timingContacts?t.firstShotDelay/t.timingContacts:0,recoilRms:t.shots?Math.sqrt(t.recoilSquared/t.shots):0,residualRecoilRms:t.shots?Math.sqrt(t.residualSquared/t.shots):0};}
 /** Debug data is returned only on explicit request; gameplay HUD must gate it
  * behind botDiagnostics so concealed opponent knowledge is not disclosed. */
 diagnostics():BotDiagnostic[]{return this.targets.filter(t=>t.active&&t.enabled).flatMap(t=>{const m=this.memories[t.id];if(!m)return[];return[{bot:t.id,state:m.state,phase:m.perceptionPhase,weapon:m.weapon,visible:m.visible,known:m.known?vec(m.known):null,lastSeen:m.lastSeen,lastHeard:m.lastHeard,uncertaintyMetres:m.visible>0?0:Math.max(0,this.clock-Math.max(m.lastSeen,m.lastHeard))*.8,detectedAt:m.detectedAt,recognizedAt:m.recognizedAt,reactionUntil:m.reactionUntil,aimStartedAt:m.aimStartedAt,acquisitionUntil:m.acquisitionUntil,triggerAt:m.triggerAt,preaimed:m.preaimed,contactAngleDegrees:m.contactAngleDegrees,ammo:m.gun.ammo,reserve:m.gun.reserve,reloadingUntil:m.gun.reloadingUntil,nextShot:m.nextShot,burstRemaining:m.burstRemaining,recoil:{pitch:m.gun.recoil.pitch,yaw:m.gun.recoil.yaw},motor:m.motor.snapshot()}];});}
 private kill(t:Target,m:Memory,p:PlayerBody,time:number,cause:'shot'|'exposure',region:string,shot?:DefenderShot){
  if(this.death)return;const path=[...this.report.path.slice(-59).map(vec),vec(p.position)];this.death={...(m.style?{style:m.style.style.id}:{}),bot:t.id,weapon:m.weapon,region,cause,time,playerVisible:m.visible>0,playerShotVelocity:time-this.lastPlayerShotAt<3?this.lastPlayerShotVelocity:null,duration:m.exposure,player:vec(p.position),defender:vec(t.position),reactionTime:shot?.reactionTime,aimAcquisitionTime:shot?.aimAcquisitionTime,shotsFired:m.engagementShots,hits:m.engagementHits,penetratedLayers:shot?.penetratedLayers,line:shot?[vec(shot.origin),vec(shot.impact)]:[{x:t.position.x,y:t.position.y+1.68,z:t.position.z},{x:p.position.x,y:p.position.y+p.eyeHeight,z:p.position.z}],path};this.report.lastDeath=this.death;this.report.deaths++;
 }
 private closeEpisode(time:number,covered:boolean){if(!this.current)return;const e=this.current;e.ended=time;e.duration=Math.max(0,time-e.started);e.timeToCover=covered?e.duration:null;e.returnToCover=covered&&this.returningAt!==null?time-this.returningAt:null;this.report.episodes.push({...e});if(this.report.episodes.length>64)this.report.episodes.shift();
  if(covered&&this.health>0)for(const shot of this.shots){const id=shot.id??0;if(shot.time<e.started||shot.time>time||shot.hit!=='miss'||shot.weapon!=='operator'||!shot.observed||shot.recoveryUntil<=time||this.usedBaits.has(id))continue;this.usedBaits.add(id);this.report.baits++;}this.current=null;this.episodeOrigin=null;this.returningAt=null;
 }
 private measure(dt:number,time:number,p:PlayerBody,visible:number){
  const distance=this.last?distance2(p.position,this.last):0,speed=Math.hypot(p.velocity.x,p.velocity.z);this.last=vec(p.position);if(time>=this.pathAt){this.pathAt=time+.1;this.report.path.push(vec(p.position));if(this.report.path.length>160)this.report.path.shift();}this.report.distance+=distance;this.report.peakSpeed=Math.max(this.report.peakSpeed,speed);this.report.maxVisibleFraction=Math.max(this.report.maxVisibleFraction,visible);if(p.scoped&&speed<.1&&p.grounded)this.report.operator.holdingSeconds+=dt;
  if(visible>0){this.report.exposure+=dt;if(!this.current){this.current={started:time,ended:time,duration:0,distance:0,peakSpeed:0,peakVisibleFraction:0,verticalDisplacement:0,shots:0,hits:0,shotVelocity:null,acquisitionTime:null,returnToCover:null,timeToCover:null};this.episodeOrigin=vec(p.position);this.episodeLow=this.episodeHigh=p.position.y;this.returningAt=null;}
   const e=this.current;e.ended=time;e.duration=time-e.started;e.distance+=distance;e.peakSpeed=Math.max(e.peakSpeed,speed);e.peakVisibleFraction=Math.max(e.peakVisibleFraction,visible);this.episodeLow=Math.min(this.episodeLow,p.position.y);this.episodeHigh=Math.max(this.episodeHigh,p.position.y);e.verticalDisplacement=this.episodeHigh-this.episodeLow;
   const start=this.episodeOrigin!,dx=p.position.x-start.x,dz=p.position.z-start.z;if(this.returningAt===null&&Math.hypot(dx,dz)>.04&&p.velocity.x*dx+p.velocity.z*dz<-.05)this.returningAt=time;
   if(e.acquisitionTime===null){const view=new Vector3(-Math.sin(p.yaw)*Math.cos(p.pitch),Math.sin(p.pitch),-Math.cos(p.yaw)*Math.cos(p.pitch)),origin=new Vector3(p.position.x,p.position.y+p.eyeHeight,p.position.z);for(const t of this.targets){if(!t.active||!t.enabled)continue;t.headPosition(this.head);const delta=this.head.clone().sub(origin);if(delta.lengthSq()<1e-8)continue;if(view.dot(delta.normalize())>Math.cos(.025)&&visibleBetween(this.obstacles,vec(origin),vec(this.head),this.rules)){e.acquisitionTime=time-e.started;break;}}}
  }else this.closeEpisode(time,!this.death);
  if(this.death)this.closeEpisode(time,false);
 }
 shot(s:ShotEvent){
  this.lastPlayerShotAt=s.timestamp;this.lastPlayerShotVelocity=Math.hypot(s.velocity.x,s.velocity.z);
  // A physical impact on this defender can cause caution without revealing the
  // shooter's hidden coordinates. The dated visual/sound memories stay intact.
  if(s.targetId!==null){const memory=this.memories[s.targetId];if(memory){memory.pressureUntil=s.timestamp+.8;if(memory.visible>0&&!this.sectors[s.targetId]?.motion)this.queueCrouch(memory,s.timestamp,true);}}
  const hit=['head','torso','arm','leg'].includes(s.hit);if(this.current){this.current.shots++;this.current.hits+=Number(hit);this.current.shotVelocity=Math.hypot(s.velocity.x,s.velocity.z);}
  if(hit&&s.targetId!==null){const m=this.memories[s.targetId],enemyShot=m?.lastShot,id=enemyShot?.id??0,t=this.targets[s.targetId];if(enemyShot&&m.weapon==='operator'&&enemyShot.observed&&s.timestamp>=enemyShot.time&&s.timestamp<enemyShot.recoveryUntil&&(s.targetGeneration===null||s.targetGeneration===undefined||s.targetGeneration===t?.generation)&&!this.usedRecoveries.has(id)){this.usedRecoveries.add(id);this.report.recoveryExploits++;}}
  if(s.weapon==='operator'){const o=this.report.operator;if(s.ads){o.scopedShots++;o.scopedHits+=Number(hit);o.scopeTransitionSum+=s.adsTransition??0;}else{o.unscopedShots++;o.unscopedHits+=Number(hit);}if(this.current?this.current.shots===1:s.firstShot){o.firstShots++;o.firstHits+=Number(hit);}}
  // Sets retain only the same bounded recent event horizon as the shot journal.
  const oldest=this.shots[0]?.id??0;for(const set of [this.usedBaits,this.usedRecoveries])for(const id of set)if(id<oldest)set.delete(id);
 }
 snapshot():PeekReport{const enabled=this.targets.filter(t=>t.enabled),unclearedAngles=enabled.filter(t=>t.active).length;return{...this.report,combatSummary:this.combatSummary(),totalAngles:enabled.length,currentClears:enabled.length-unclearedAngles,unclearedAngles,health:Math.max(0,this.health),episodes:[...this.report.episodes.map(e=>({...e})),...this.current?[{...this.current}]:[]],path:this.report.path.map(vec),lastDeath:this.report.lastDeath?{...this.report.lastDeath,player:vec(this.report.lastDeath.player),defender:vec(this.report.lastDeath.defender),line:this.report.lastDeath.line.map(vec),path:this.report.lastDeath.path.map(vec)}:null,operator:{...this.report.operator}};}
}
