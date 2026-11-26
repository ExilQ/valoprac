import {validateSessionOptions,type SimulationOptions} from '../../training/platform/SessionOptions';
import {Exercises} from '../../training/exercises/Exercises';
import {compileScenario,selectScenarioPlacements} from '../../training/scenarios/compile';
import {crossesEntryGate} from '../../training/scenarios/entryGate';
import type {CompiledScenario} from '../../training/scenarios/types';
import {MovementPractice} from '../../training/movementTools/MovementPractice';
import {isMovementAction,type MovementAction,type MovementActionResult} from '../../training/movementTools/types';
import {RenderedTargets,headPositionInFrame,poseForTarget,type RenderedTargetFrame} from '../collision/RenderedTargets';
import {DefenderAI} from '../tactical/DefenderAI';
import {activeAngles,zoneForScenario,zoneAt} from '../tactical/complex';
import {BOT_DIFFICULTY} from '../targets/locomotion';
import {TapDrill} from '../../training/modes/TapDrill';
import {levelFor,standingSpace,visibleBetween,type TacticalLevel} from '../tactical/levels';
import {AngleTraining} from '../tactical/AngleTraining';
import {FundamentalsDrill} from '../tactical/FundamentalsDrill';
import {courseFor} from '../../config/mapCourses';
import {Exposure} from '../tactical/Exposure';
import {spreadDirection} from '../weapons/trajectory';
import {Footsteps,type FootstepEvent} from '../footsteps/Footsteps';
import {Landings,type LandingSoundEvent} from '../footsteps/Landings';
import {resolveGroundSurface} from '../footsteps/surfaceSelection';
import {SURFACES,SURFACE_CALIBRATION_VERSION} from '../../config/surfaces';
import {CURRENT_SIMULATION_RULES,LEGACY_SIMULATION_RULES,usesAudioRules,usesCurrentWeapons,usesTrainingRules,type SimulationRulesId} from './rules';
import {AUDIO_RULES} from './audioRules';
import {TRAINING_RULES} from './trainingRules';
import {FIELD_CHARACTER_GEOMETRY,LEGACY_CHARACTER_GEOMETRY,type CharacterGeometryVersion} from '../targets/characterProfile';
import {footstepProfile} from '../../config/footsteps';
import {angularGain} from '../input/sensitivity';
import {TacticalHearing} from '../tactical/Hearing';
import {obstaclesFor} from '../tactical/map';
import { Ray, Vector3, MathUtils } from 'three';
import type { Mode, Settings, PracticeMap, WeaponId, InputState, ShotEvent, KillEvent, DirectionResponse, SessionData, HitZone, MeleeEvent, GunId } from '../types';
import { Movement } from '../movement/Movement';
import { Braking } from '../movement/Braking';
import { Weapon } from '../weapons/Weapon';
import { Target } from '../targets/Target';
import { SeededRandom } from './random';
import { damageAt, WEAPON_ORDER, EQUIP_ORDER, KNIFE_ATTACKS, weaponProfilesFor, type KnifeAttack } from '../../config/weapons';
import { MODES } from '../../training/modes/modes';
import { castWeaponShot,castShot, type HitResult } from '../collision/shoot';
import { summarize } from '../../training/analytics/statistics';
import { LifetimeStats } from '../../training/analytics/LifetimeStats';
import {emptyInput} from '../types';
export const DETAIL_LIMIT=2048;
const DEG=Math.PI/180;
/** audio-v8: the push-off of a jump, heard like a footstep. */
export interface JumpSoundEvent extends FootstepEvent {kind:'jump';}
export class Simulation {
  readonly options:SimulationOptions;readonly scenario:CompiledScenario|null;exercise:Exercises|null=null;readonly movementPractice=new MovementPractice();private practiceBounds:readonly number[]=[];
  readonly renderedTargets=new RenderedTargets();private pendingFireFrame:RenderedTargetFrame|undefined;private pendingFireStamp:number|null=null;
  captureFireView(stamp:number){this.pendingFireStamp=stamp;this.pendingFireFrame=this.renderedTargets.copyForShot(stamp);}
  clearFireView(){this.pendingFireFrame=undefined;this.pendingFireStamp=null;}
  defenders:DefenderAI|null=null;lifeGeneration=0;private retrySignature='';
  clearMovementInput(){this.movement.clearJumpInput();}
 get scopeZoom(){return this.weaponId==='operator'?this.weapon.scopeZoom:1+(this.weapon.profile.adsZoom-1)*this.adsAmount;}
 get scopeLevel(){return this.weaponId==='operator'?this.weapon.scopeLevel:0;}
 readonly practiceMap:PracticeMap;level:TacticalLevel|null=null;angles:AngleTraining|null=null;
  /** Fundamentals drill on the 12.25 drill maps (replaces angle/defender logic there). */
  drill:FundamentalsDrill|null=null;exposure:Exposure;tap:TapDrill;adsChangedAt=0;stoppedAt:number|null=null;readonly obstacles;footsteps:Footsteps;hearing:TacticalHearing|null=null;
  onFootstep:((event:FootstepEvent)=>void)|null=null;
  landings=new Landings();onLanding:((event:LandingSoundEvent)=>void)|null=null;
  /** audio-v8 jump push-off sounds (display journal; bots hear them through `hear`). */
  onJump:((event:JumpSoundEvent)=>void)|null=null;jumpSounds:JumpSoundEvent[]=[];jumpSoundEvents=0;silentJumps=0;

  operatorStats={scopedShots:0,scopedHits:0,unscopedShots:0,unscopedHits:0,holdingSeconds:0,scopeTransitions:0,recoverySamples:0,recoverySum:0,highGroundShots:0,highGroundHits:0,missedRecoverySeconds:0};private operatorLastShot:number|null=null;
  private emptySummary=summarize([],[],[],{samples:0,onHead:0,errorSquared:0});
  stats=new LifetimeStats();ads=false;adsAmount=0;previousAdsAmount=0;weapons:Record<WeaponId,Weapon>;time=0;ticks=0;running=false;completed=false;movement=new Movement();braking=new Braking();weapon:Weapon;
  yaw=0;pitch=0;targets:Target[]=[];shots:ShotEvent[]=[];kills:KillEvent[]=[];reactions:DirectionResponse[]=[];
  tracking={samples:0,onHead:0,errorSquared:0};lastHitAt=-100;lastHit='miss';lastEarlyAt=-100;lastShotAt=-100;
  origin=new Vector3();direction=new Vector3();ray=new Ray();hit:HitResult={zone:'miss',target:null,point:new Vector3(),distance:150};
  private exposureLabels:string[]=[];private readyAt=(id:number)=>(this.targets[id]?.spawnAt??0)+BOT_DIFFICULTY[this.settings.botDifficulty].reaction;private rng:SeededRandom;private targetPoint=new Vector3();private targetDirection=new Vector3();
  onShot:((shot:ShotEvent)=>void)|null=null;onKill:(()=>void)|null=null;onFinish:(()=>void)|null=null;
  /** Knife attacks: readiness, last attack and a presentation callback. Melee never creates a ShotEvent. */
  meleeReadyAt=0;meleeSerial=0;lastMelee:MeleeEvent|null=null;onMelee:((event:MeleeEvent)=>void)|null=null;
  private currentInput!:InputState;
  private pendingBrakeShot:ShotEvent|null=null;
  private physicsTransitions:{time:number;profile:string;preset:string|null}[]=[];
  constructor(public mode:Mode,public weaponId:WeaponId,public settings:Settings,options:SimulationOptions={},readonly rules:SimulationRulesId=CURRENT_SIMULATION_RULES,
    readonly characterGeometry:CharacterGeometryVersion=rules===LEGACY_SIMULATION_RULES?LEGACY_CHARACTER_GEOMETRY:FIELD_CHARACTER_GEOMETRY){
    this.movement.setSimulationRules(rules);
    this.options=validateSessionOptions(options);this.scenario=this.options.scenario?compileScenario(this.options.scenario):null;
    if(this.options.exercise||this.scenario)this.mode='free';
    if(this.scenario)this.weaponId=this.scenario.weapon;
    this.settings={...settings,...this.scenario?.settingsPatch,...(this.options.exercise?{practiceMap:'range' as const,duration:60,drill:'none' as const,targetCount:1,analysisWall:false}:{}),bindings:{...settings.bindings}};
    mode=this.mode;weaponId=this.weaponId;settings=this.settings;
    this.practiceMap=mode==='free'?settings.practiceMap:'range';this.settings.practiceMap=this.practiceMap;this.obstacles=obstaclesFor(this.practiceMap);this.movement.obstacles=this.obstacles;this.movement.configurePhysics(this.settings,0);
    this.physicsTransitions.push({time:0,profile:this.movement.profile.id,preset:this.movement.profile.preset});
    this.footsteps=new Footsteps(footstepProfile(this.settings));this.footsteps.onStep=e=>{
      if(this.rules==='legacy-v2')e.material=this.practiceMap==='complex'?zoneAt(e.position)?.material:undefined;
      else{e.surfaceId=resolveGroundSurface(this.practiceMap,this.obstacles,e.position,this.rules,this.movement.profile);e.material=SURFACES[e.surfaceId].footstepSoundProfile;}
      this.hearing?.hear(e);this.angles?.hear(e);this.defenders?.hear(e);this.onFootstep?.(e);
    };
    this.landings.resetEncounter(this.movement);this.landings.onLanding=e=>{if(this.rules!=='legacy-v2'){e.surfaceId=resolveGroundSurface(this.practiceMap,this.obstacles,e.position,this.rules,this.movement.profile);e.material=SURFACES[e.surfaceId].footstepSoundProfile;}this.hearing?.hear(e);this.angles?.hear(e);this.defenders?.hear(e);this.onLanding?.(e);};
    if(this.practiceMap==='tactical'){this.movement.position.set(-7,0,13);this.movement.previous.copy(this.movement.position);}

    this.level=levelFor(this.practiceMap);this.exposureLabels=this.level?.angles.map(a=>a.label)??[];if(this.level){this.yaw=this.level.entryYaw??0;this.movement.position.set(this.level.spawn.x,this.level.spawn.y,this.level.spawn.z);this.movement.previous.copy(this.movement.position);}
    this.tap=new TapDrill(settings.drill);
    const profiles=weaponProfilesFor(usesCurrentWeapons(rules));this.weapons=Object.fromEntries(EQUIP_ORDER.map((id,i)=>[id,new Weapon(profiles[id],settings.seed+i*907)])) as Record<WeaponId,Weapon>;this.weapon=this.weapons[weaponId];this.configureAmmo();this.rng=new SeededRandom(settings.seed^0xF91);
    for(let i=0;i<(mode==='free'?12:mode==='tracking'&&settings.behavior==='peek'?1:MODES[mode].count);i++){
      const behavior=mode==='tracking'||mode==='free'||settings.drill==='stopMoving'?settings.behavior:'stationary';const t=new Target(i,behavior,new SeededRandom(settings.seed+i*139+1),this.characterGeometry);this.targets.push(t);if(this.practiceMap!=='tactical')this.spawn(t);if(mode==='free'){t.enabled=i<Math.min(settings.targetCount,settings.behavior==='peek'?1:12)&&!settings.analysisWall;t.active=t.enabled;}
    }
    this.exposure=new Exposure(this.targets.length);
    const drillKind=(courseFor(this.practiceMap) as {drill?:import('../../config/mapCourses').FundamentalsDrillKind}|undefined)?.drill;
    if(this.level&&!this.scenario&&drillKind){this.drill=new FundamentalsDrill(drillKind,this.level,this.targets,new SeededRandom(settings.seed^0xD411));this.drill.onRoundReset=()=>this.restartDrillRound();this.drill.reset(this.time);}
    if(this.level&&!this.scenario&&!this.drill&&this.practiceMap!=='complex'){this.angles=new AngleTraining(this.level,this.targets,new SeededRandom(settings.seed^0xA661),this.settings);this.resetTargets();}
    if(!this.scenario&&this.practiceMap==='complex'){const zone=zoneForScenario(settings.peekScenario);if(zone){this.movement.position.set(zone.entry.x,zone.entry.y,zone.entry.z);this.movement.previous.copy(this.movement.position);this.yaw=zone.center.z>0?Math.PI:0;}this.resetTargets();this.defenders=new DefenderAI(this.targets,this.obstacles,this.settings,this.level!.spawn,settings.seed,activeAngles(settings.peekScenario).slice(0,settings.targetCount));}
    if(this.practiceMap==='tactical'){this.hearing=new TacticalHearing(this.targets,new SeededRandom(settings.seed^0xF007));this.resetTargets();}
    if(this.level&&!this.scenario&&!this.drill&&this.level.angles.length&&this.practiceMap!=='complex')this.defenders=new DefenderAI(this.targets,this.obstacles,this.settings,this.level.spawn,settings.seed,this.level.angles);
    const minX=Math.min(...this.obstacles.map(o=>o.box.min.x)),minZ=Math.min(...this.obstacles.map(o=>o.box.min.z));
    this.practiceBounds=this.level?.bounds??[minX,minZ,Math.max(...this.obstacles.map(o=>o.box.max.x))-minX,Math.max(...this.obstacles.map(o=>o.box.max.z))-minZ];
    if(this.scenario){this.angles=null;this.hearing=null;this.movement.reset(this.scenario.spawn,0,true);this.yaw=this.scenario.yaw;this.pitch=this.scenario.pitch;this.applyScenarioTargets();}
    this.defenders?.setSimulationRules(this.rules);
    if(this.options.exercise){this.exercise=new Exercises(this.options.exercise,this.settings.seed);this.exercise.initialize(this);}
  }
  private movementContext(){return{movement:this.movement,map:this.practiceMap,bounds:this.practiceBounds,yaw:this.yaw,pitch:this.pitch,time:this.time,ticks:this.ticks};}
  trainingAction(action:MovementAction):MovementActionResult{
    if(!isMovementAction(action)||!this.settings.movementTools?.enabled)return{ok:false,message:'이동 연습 도구를 먼저 켜세요.'};
    const result=this.movementPractice.action(action,this.movementContext());
    if(result.ok&&result.restored){
      this.yaw=result.restored.yaw;this.pitch=result.restored.pitch;this.braking=new Braking();this.pendingBrakeShot=null;this.stoppedAt=null;
      this.clearFireView();this.renderedTargets.clear();this.footsteps.resetEncounter();this.landings.resetEncounter(this.movement);
      if(this.currentInput)Object.assign(this.currentInput,emptyInput());
    }
    return result;
  }
  trainingState(){return{options:this.options,exercise:this.exercise?.integrityState()??null,movement:this.movementPractice.trainingState()};}
  private scenarioSectors:ReturnType<typeof selectScenarioPlacements>=[];
  private applyScenarioTargets(){
    if(!this.options.scenario||!this.scenario)return;
    const sectors=selectScenarioPlacements(this.options.scenario,this.lifeGeneration);
    this.exposureLabels=sectors.map(a=>a.label);
    this.scenarioSectors=sectors;
    const chained=this.options.scenario.rules.arrival==='after-clear';
    for(const target of this.targets){
      target.enabled=false;
      target.active=false;
      if(!this.scenario.entryGate&&(!chained||target.id===0))this.activateScenarioTarget(target.id);
    }
    if(this.defenders){this.defenders.setSectors(sectors);this.defenders.retry();}
    else this.defenders=new DefenderAI(this.targets,this.obstacles,this.settings,this.scenario.spawn,this.settings.seed,sectors,this.options.scenario.rules.defenderPolicy);
    this.defenders.setSimulationRules(this.rules);this.exposure.reset();
  }
  private activateScenarioTarget(index:number){
    const sector=this.scenarioSectors[index],target=this.targets[index];
    if(!sector||!target||target.enabled)return;
    target.enabled=true;
    target.scale=1;
    target.behavior='stationary';
    target.speedMultiplier=1;
    target.spawn(sector.position.x,sector.position.z,this.time,sector.position.y);
  }
  /** training-v7: on training maps eliminated bots come back after the set
   * delay (scenario drills and exercises keep their own rules). */
  get botsReturn(){return usesTrainingRules(this.rules)&&this.settings.botRespawn&&!this.scenario&&!this.exercise&&!this.drill&&!!(this.defenders||this.angles);}
  /** A returning bot takes its post or one of the post's alternative spots,
   * so the player cannot pre-aim the exact same pixel every time. */
  private respawnBot(t:Target){
    // Angle-only maps reuse their own spawn, which also resets the bot's memory.
    if(!this.defenders&&this.angles){this.angles.spawn(t,this.time,this.rules);if(!t.active&&t.enabled){const a=this.level!.angles[t.id];t.spawn(a.position.x,a.position.z,this.time,a.position.y);}return;}
    const post=this.practiceMap==='complex'?activeAngles(this.settings.peekScenario).slice(0,this.settings.targetCount)[t.id]:this.level?.angles[t.id];
    if(!post){t.enabled=false;return;}
    const options=[post.position,...(post.alternatives??[])].filter(p=>standingSpace(this.obstacles,p,.4));
    const spot=options.length?options[Math.floor(this.rng.next()*options.length)]:post.position;
    // Scale and speed stay as the map placed them (e.g. the target size setting).
    t.difficulty=this.settings.botDifficulty;t.spawn(spot.x,spot.z,this.time,spot.y);
  }
  /** training-v7: gunfire is loud. Bots that cannot see the player hear the
   * shot at the shooter's position (the suppressed Phantom carries less far)
   * and react through the same sound memory as footsteps. */
  /** Footstep audibility threshold for this tick. audio-v8 scales it with the
   * held weapon's run speed, so walking is silent with every weapon (knife
   * walking is 3.24 m/s, above the rifle-based 2.7 m/s). */
  get footstepAudibleVelocity(){const base=this.footsteps.profile.audibleVelocity;if(!usesAudioRules(this.rules))return base;const reference=this.movement.weaponSpeedReference;return base*(this.weapon.profile.movementSpeed??reference)/reference;}
  /** audio-v8: a jump pushes off audibly, unless the player was already
   * crouched (depth at takeoff >= silentTakeoffCrouch). */
  private emitJumpSound(){
    const hop=this.movement.lastJump();if(!hop)return;
    if(this.movement.crouch>=AUDIO_RULES.silentTakeoffCrouch){this.silentJumps++;return;}
    const position={...hop.position},surfaceId=resolveGroundSurface(this.practiceMap,this.obstacles,position,this.rules,this.movement.profile);
    const e:JumpSoundEvent={kind:'jump',id:++this.jumpSoundEvents,timestamp:hop.time,position,radius:this.settings.stepHearingRadius,speed:hop.speed,surfaceId,material:SURFACES[surfaceId].footstepSoundProfile};
    this.jumpSounds.push(e);if(this.jumpSounds.length>16)this.jumpSounds.shift();
    this.hearing?.hear(e);this.angles?.hear(e);this.defenders?.hear(e);this.onJump?.(e);
  }
  private hearGunfire(){
    if(!usesTrainingRules(this.rules)||!(this.defenders||this.angles))return;
    const p=this.movement.position,radius=this.weaponId==='rifleB'?TRAINING_RULES.suppressedGunfireRadius:TRAINING_RULES.gunfireRadius;
    const e={id:-1,timestamp:this.time,position:{x:p.x,y:p.y,z:p.z},radius,kind:'gunfire'} as unknown as FootstepEvent;
    if(this.defenders)this.defenders.hear(e);else this.angles?.hear(e);
  }
  private spawn(t:Target){
    t.difficulty=this.settings.botDifficulty;t.scale=this.mode==='free'?this.settings.targetSize:1;t.speedMultiplier=this.mode==='free'?this.settings.targetSpeed:1;
    if(this.angles){this.angles.spawn(t,this.time,this.rules);return;}
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
    const degrees=angularGain(this.settings,this.ads,this.weaponId==='operator'?this.scopeZoom:this.weapon.profile.adsZoom,this.weaponId==='operator'&&this.scopeLevel>0?this.scopeLevel as 1|2:undefined);
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
    this.currentInput=input;
    this.ticks++;this.time=this.ticks*dt;
    this.weapon.configureScope(this.settings);this.weapon.updateScope(this.time,dt,input);
    const wasAds=this.ads;this.ads=(this.weaponId==='operator'?this.weapon.ads:input.ads&&this.weapon.profile.adsZoom>1)&&this.weapon.reloadingUntil===null&&this.time>=this.weapon.equipUntil;
    if(wasAds!==this.ads){this.adsChangedAt=this.time;if(this.weaponId==='operator'&&this.ads)this.operatorStats.scopeTransitions++;}if(this.weaponId==='operator'&&this.ads&&this.movement.speed<.1&&this.movement.grounded)this.operatorStats.holdingSeconds+=dt;
    this.previousAdsAmount=this.adsAmount;this.adsAmount+=(Number(this.ads)-this.adsAmount)*(1-Math.exp(-Math.log(10)/Math.max(.04,this.weapon.profile.adsTransition)*dt));
    this.movement.setWeaponContext(this.weaponId,this.weapon.profile.movementSpeed??this.movement.weaponSpeedReference,this.ads);
    this.movement.speedModifier=(this.weapon.profile.movementSpeed??this.movement.weaponSpeedReference)/this.movement.weaponSpeedReference*(this.ads?this.weapon.profile.adsMoveModifier:1);
    const movementYaw=input.movementYaw??this.yaw;
    this.braking.update(input,movementYaw,this.movement,this.time,this.weaponId==='operator'?5.13*.72*.15:this.movement.profile.accuracyVelocityThreshold);
    if(this.settings.movementTools?.enabled)this.movementPractice.beforeStep(this.movementContext());
    const jumpsBefore=this.movement.jumpCount;
    this.movement.step(input,movementYaw,dt,this.time);
    const transfer=this.level?.transfer,position=this.movement.position;
    if(transfer&&position.y<1.2&&Math.hypot(position.x-transfer.entry.x,position.z-transfer.entry.z)<.86){
      this.movement.reset(transfer.exit,this.time,true);this.footsteps.resetEncounter();this.landings.resetEncounter(this.movement);
      this.braking=new Braking();this.pendingBrakeShot=null;this.stoppedAt=this.time;this.clearFireView();this.renderedTargets.clear();
    }
    const gate=this.scenario?.entryGate;
    if(gate&&!this.targets[0].enabled&&crossesEntryGate(gate,this.movement.previous,this.movement.position)){
      const count=this.options.scenario?.rules.arrival==='after-clear'?1:this.scenarioSectors.length;
      for(let index=0;index<count;index++)this.activateScenarioTarget(index);
    }
    if(this.settings.movementTools?.enabled)this.movementPractice.afterStep(this.movementContext());
    this.landings.step(this.movement,this.time,dt,this.rules==='legacy-v2'?p=>this.practiceMap==='complex'?zoneAt(p)?.material:undefined:undefined,this.settings.stepHearingRadius);
    this.braking.observe(this.movement,this.time,this.weaponId==='operator'?5.13*.72*.15:this.movement.profile.accuracyVelocityThreshold);if(this.movement.speed<=.035&&this.movement.grounded){this.stoppedAt??=this.time;}else this.stoppedAt=null;
    this.footsteps.step(this.movement,input.walk,dt,this.time,this.footstepAudibleVelocity);
    if(this.movement.jumpCount>jumpsBefore&&usesAudioRules(this.rules))this.emitJumpSound();
    const pending=this.pendingBrakeShot,b=this.braking;
    if(pending&&pending.releaseTime===b.releaseTime){
      pending.brakingKind=b.kind;
      if(b.thresholdTime!==null&&pending.thresholdDelta===null){pending.thresholdDelta=pending.timestamp-b.thresholdTime;pending.brakingDuration=b.duration;}
      if(b.fullDuration!==null)pending.decelerationDuration=b.fullDuration;
      if(pending.thresholdDelta!==null&&pending.decelerationDuration!==null){this.stats.settleBrake(pending);this.pendingBrakeShot=null;}
    }else if(pending){this.stats.settleBrake(pending);this.pendingBrakeShot=null;}
    this.exercise?.beforeTargets(this,dt);
    if(this.drill){this.origin.copy(this.movement.position);this.origin.y+=this.movement.eyeHeight;this.drill.step({time:this.time,eye:this.origin,direction:this.viewDirection(this.direction)},dt);}
    for(const t of this.targets){if(this.drill)break;t.difficulty=this.settings.botDifficulty;if(!t.enabled)continue;
      if(this.mode==='free'&&t.behavior==='appearing'&&t.active&&this.time-t.spawnAt>2){t.eliminate(this.time);}
      if(!t.active&&this.botsReturn&&this.time-t.deadAt>=this.settings.botRespawnDelay)this.respawnBot(t);
      if(!this.exercise&&!this.defenders&&!this.angles&&!t.active&&this.time-t.deadAt>(this.mode==='free'?this.settings.spawnInterval:0.55))this.spawn(t);if(this.defenders)continue;if(this.angles)this.angles.step(t,this.time,dt);else if(this.hearing)this.hearing.step(t,this.time,dt);else {t.step(this.time,dt);if(!standingSpace(this.obstacles,t.position,.4*t.scale)){t.position.copy(t.previous);t.velocity.set(0,0,0);t.direction*=-1;t.updatePose(this.time);}}
    }
    this.exercise?.afterTargets(this,dt);
    if(this.defenders){this.defenders.step(dt,this.time,{position:this.movement.position,velocity:this.movement.velocity,eyeHeight:this.movement.eyeHeight,crouch:this.movement.crouch,grounded:this.movement.grounded,yaw:this.viewYaw,pitch:this.viewPitch,scoped:this.weaponId==='operator'&&this.ads});for(let i=0;i<this.defenders.memories.length;i++){const value=this.defenders.memories[i].exposure;this.exposure.values[i]=value;this.exposure.max=Math.max(this.exposure.max,value);}if(this.defenders.death){const d=this.defenders.death;this.exposure.death={bot:d.bot,angle:`${d.weapon} · ${d.region}`,duration:d.duration,time:d.time,player:d.player,defender:d.defender};this.exposure.deaths=this.defenders.report.deaths;this.running=false;return;}}
    if(this.level&&!this.defenders&&!this.drill){this.exposure.step(this.targets,this.movement.position,this.movement.eyeHeight,this.obstacles,this.settings,dt,this.time,this.exposureLabels,this.readyAt,this.rules);if(this.exposure.death){this.running=false;return;}}
    this.currentInput=input;if(this.weaponId==='knife')this.stepKnife(input);else{const originalAds=input.ads;input.ads=this.ads;this.weapon.step(this.time,dt,input,this.fireShot);input.ads=originalAds;}this.clearFireView();
    for(const id of WEAPON_ORDER){if(id!==this.weaponId){const w=this.weapons[id];w.recoil.recover(dt,w.profile,this.time-w.lastShot);w.bloom=Math.max(0,w.bloom-w.profile.bloomRecovery*dt);}}
    if(this.mode==='tracking'||this.mode==='free')this.sampleTracking();
    input.jump=false;input.jumpPresses=0;input.reload=false;input.firePresses=0;input.scopePresses=0;input.zoomPresses=0;
    this.exercise?.afterStep(this,dt);
    const limit=this.scenario?this.options.scenario!.rules.duration:this.mode!=='free'||this.practiceMap==='complex'&&this.settings.peekingTimed?this.settings.duration:null;
    if(this.exercise?.completed||!this.exercise&&limit!==null&&this.time+1e-9>=limit){this.completed=true;this.running=false;this.onFinish?.();}
  }
  private fireShot=()=>{
    const frame=this.pendingFireStamp!==null?this.pendingFireFrame:this.renderedTargets.forShot();
    const w=this.weapon,m=this.movement;const first=w.profile.fireMode==='bolt'||w.shotIndex===0;
    if(first){w.recoil.compensationPitch=0;w.recoil.compensationYaw=0;}
    const compensationPitch=w.recoil.compensationPitch,compensationYaw=w.recoil.compensationYaw;
    const spread=w.calculateSpread(m,this.currentInput.ads,this.time-m.landedAt<(this.weaponId==='operator'?.225:.09));
    const yaw=this.bulletYaw,pitch=this.bulletPitch;
    this.origin.copy(m.position);this.origin.y+=m.eyeHeight;
    spreadDirection(yaw,pitch,spread.x,spread.y,this.direction);
    this.ray.set(this.origin,this.direction);castWeaponShot(this.ray,this.targets,this.hit,w.profile,this.obstacles,frame,this.rules);
    // Fire along the pre-kick aim; recoil from this shot affects the next shot.
    w.recoil.kick(w.shotIndex,w.profile,w.recoilRng,m.crouch,this.time);
    const t=this.hit.target,b=this.braking,shown=t&&frame?poseForTarget(t,frame):undefined,targetPosition=t?(shown?.position??t.position):null;
    const episode=b.active&&!b.shotRecorded&&b.releaseTime!==null;
    let angularError:number|null=null;
    if(t){headPositionInFrame(t,frame,this.targetPoint);this.targetDirection.copy(this.targetPoint).sub(this.origin).normalize();angularError=Math.acos(MathUtils.clamp(this.targetDirection.dot(this.direction),-1,1))/DEG;}
    else if(this.mode==='spray'){this.targetDirection.set(0,1.64,-30).sub(this.origin).normalize();angularError=Math.acos(MathUtils.clamp(this.targetDirection.dot(this.direction),-1,1))/DEG;}
    if(angularError===null){
      for(const candidate of this.targets){if(!headPositionInFrame(candidate,frame,this.targetPoint))continue;this.targetDirection.copy(this.targetPoint).sub(this.origin).normalize();const error=Math.acos(MathUtils.clamp(this.targetDirection.dot(this.direction),-1,1))/DEG;angularError=angularError===null?error:Math.min(angularError,error);}
    }
    const s:ShotEvent={timestamp:this.time,lifeGeneration:this.lifeGeneration,targetPoseSource:frame?'rendered-frame':'simulation',renderedFrameTime:frame?.submittedAt,inputTime:this.pendingFireStamp??undefined,weapon:this.weaponId as GunId,damage:damageAt(w.profile,this.hit.zone,this.hit.distance)*(this.hit.penetrationScale??1),penetratedLayers:this.hit.penetratedLayers??0,penetrationSegments:this.hit.segments??[],penetrationStop:this.hit.stopReason,ads:this.ads,scopeZoom:this.scopeZoom,recoveryUntil:this.time+1/w.profile.fireRate,accuracyState:!m.grounded?'airborne':this.time-m.landedAt<(this.weaponId==='operator'?.225:.09)?'landing':(this.weaponId==='operator'?m.speed<=5.13*.72*.15:m.accurate)?(m.crouch>0.5?'crouching':'stationary'):m.crouch>0.5?'crouchMoving':this.braking.active?'braking':this.currentInput.walk?'walking':'running',horizontalDirection:w.recoil.horizontalDirection,shotIndex:w.shotIndex,magazineShot:w.magazineShot,firstShot:first,
      adsTransition:this.ads?this.time-this.adsChangedAt:undefined,targetElevation:targetPosition?targetPosition.y-m.position.y:undefined,stoppedFor:this.stoppedAt===null?0:this.time-this.stoppedAt,position:{x:m.position.x,y:m.position.y,z:m.position.z},velocity:{x:m.velocity.x,y:m.velocity.y,z:m.velocity.z},direction:{x:this.direction.x,y:this.direction.y,z:this.direction.z},aim:{yaw:this.yaw,pitch:this.pitch},
      recoil:{pitch:w.recoil.pitch,yaw:w.recoil.yaw},spread:{...spread},hit:this.hit.zone,impact:{x:this.hit.point.x,y:this.hit.point.y,z:this.hit.point.z},targetId:t?.id??null,targetPosition:targetPosition?{x:targetPosition.x,y:targetPosition.y,z:targetPosition.z}:null,targetState:t?.behavior??null,targetGeneration:t?.generation??null,
      playerCompensation:{pitch:compensationPitch,yaw:compensationYaw},accurate:this.weaponId==='operator'?this.ads&&w.scopeAmount>.98&&m.grounded&&m.speed<=5.13*.72*.15&&this.time-m.landedAt>=.225:m.accurate,releaseTime:episode?b.releaseTime:null,thresholdDelta:episode&&b.thresholdTime!==null?this.time-b.thresholdTime:null,brakingKind:episode?b.kind:null,initialSpeed:episode?b.initialSpeed:null,brakingDuration:episode?b.duration:null,decelerationDuration:episode?b.fullDuration:null,
      movementDirection:{x:m.desiredDirection.x,z:m.desiredDirection.z},angularError};
    if(episode){b.shotRecorded=true;if(s.thresholdDelta===null||s.decelerationDuration===null)this.pendingBrakeShot=s;else this.stats.settleBrake(s);}
    if(this.weaponId==='operator'){const o=this.operatorStats,hit=Number(['head','torso','arm','leg'].includes(s.hit));if(s.ads){o.scopedShots++;o.scopedHits+=hit;}else{o.unscopedShots++;o.unscopedHits+=hit;}if(this.operatorLastShot!==null){o.recoverySamples++;o.recoverySum+=this.time-this.operatorLastShot;}this.operatorLastShot=this.time;if(!hit)o.missedRecoverySeconds+=1/w.profile.fireRate;if((s.targetElevation??0)>.4){o.highGroundShots++;o.highGroundHits+=hit;}}
    this.defenders?.shot(s);this.hearGunfire();this.tap.shot(s,b.initialVX);this.stats.shot(s);this.shots.push(s);if(this.shots.length>DETAIL_LIMIT)this.shots.splice(0,512);this.lastShotAt=this.time;
    if(!m.accurate)this.lastEarlyAt=this.time;
    if(t){if(!t.reactionRecorded&&this.time-t.changeAt>=0&&this.time-t.changeAt<2){this.reactions.push({targetId:t.id,changeTime:t.changeAt,latency:this.time-t.changeAt});if(this.reactions.length>256)this.reactions.shift();t.reactionRecorded=true;}this.lastHitAt=this.time;this.lastHit=s.hit;t.health-=s.damage??0;const rule=this.mode==='free'?this.settings.eliminationRule:'head';if(s.hit==='head'&&(this.weaponId!=='operator'||rule!=='damage'||t.health<=0)||rule==='any'||rule==='damage'&&t.health<=0){
      this.eliminateTarget(t);
    }t.shotsReceived++;}
    this.onShot?.(s);
  };
  private eliminateTarget(t:Target){
    const kill={timestamp:this.time,targetId:t.id,generation:t.generation,elapsed:this.time-t.spawnAt,firstShot:t.shotsReceived===0};this.kills.push(kill);this.stats.kill(kill);if(this.kills.length>256)this.kills.shift();t.eliminate(this.time);this.angles?.eliminated(t.id);this.drill?.eliminated(t,this.time);this.defenders?.eliminated(t.id);if(this.options.scenario?.rules.arrival==='after-clear')this.activateScenarioTarget(t.id+1);this.onKill?.();
  }
  /** Hold primary fire to keep slashing; secondary fire (the scope input) stabs.
   * Both wait for the equip animation and the previous attack's recovery. */
  private stepKnife(input:InputState){
    const w=this.weapon;w.ads=false;
    if(this.time+1e-9<w.equipUntil||this.time+1e-9<this.meleeReadyAt)return;
    const stab=(input.scopePresses??0)>0||!!input.scopeHeld,slash=(input.firePresses??0)>0||input.fire;
    if(stab)this.melee('stab');else if(slash)this.melee('slash');
  }
  private melee(kind:KnifeAttack){
    const spec=KNIFE_ATTACKS[kind],m=this.movement,frame=this.renderedTargets.forShot();
    this.meleeReadyAt=this.time+spec.recovery;
    this.origin.copy(m.position);this.origin.y+=m.eyeHeight;this.viewDirection(this.direction);this.ray.set(this.origin,this.direction);
    castShot(this.ray,this.targets,this.hit,this.obstacles,frame);
    let target:Target|null=null,zone:HitZone='miss',distance=Infinity;
    if(this.hit.target&&this.hit.target.active&&this.hit.zone!=='wall'&&this.hit.zone!=='miss'&&this.hit.distance<=spec.range){target=this.hit.target;zone=this.hit.zone;distance=this.hit.distance;}
    else{
      // A blade sweeps an arc: accept the nearest visible head inside the
      // attack cone so a near-miss at arm's length still connects.
      const limit=Math.cos(spec.cone*DEG);
      for(const candidate of this.targets){if(!candidate.enabled||!candidate.active||!headPositionInFrame(candidate,frame,this.targetPoint))continue;
        this.targetPoint.y-=.25*candidate.scale;const d=this.targetPoint.distanceTo(this.origin);if(d>spec.range||d>=distance)continue;
        this.targetDirection.copy(this.targetPoint).sub(this.origin).normalize();if(this.targetDirection.dot(this.direction)<limit)continue;
        if(this.hit.zone==='wall'&&this.hit.distance<d)continue;
        // weapons-v6: the blade must reach the candidate itself, not just miss
        // the wall under the crosshair (a target behind a wall edge stays safe).
        if(usesCurrentWeapons(this.rules)&&!visibleBetween(this.obstacles,this.origin,this.targetPoint,this.rules))continue;
        target=candidate;zone='torso';distance=d;}
    }
    let killed=false;
    if(target){
      target.health-=spec.damage;this.lastHitAt=this.time;this.lastHit=zone;
      const rule=this.mode==='free'?this.settings.eliminationRule:'head';
      if(target.health<=0||rule==='any'){this.eliminateTarget(target);killed=true;}
      target.shotsReceived++;
    }
    const impact=target?{x:this.origin.x+this.direction.x*distance,y:this.origin.y+this.direction.y*distance,z:this.origin.z+this.direction.z*distance}:this.hit.zone==='wall'&&this.hit.distance<=spec.range?{x:this.hit.point.x,y:this.hit.point.y,z:this.hit.point.z}:null;
    const event:MeleeEvent={serial:++this.meleeSerial,timestamp:this.time,kind,hit:target?zone:impact?'wall':'miss',targetId:target?.id??null,damage:target?spec.damage:0,killed,impact,lifeGeneration:this.lifeGeneration};
    this.lastMelee=event;this.onMelee?.(event);
  }
  /** A cleared pre-aim/angles round restarts from the map's start. */
  private restartDrillRound(){
    const level=this.level;if(!level)return;
    this.movement.reset(level.spawn,this.time,true);this.footsteps.resetEncounter();this.landings.resetEncounter(this.movement);
    this.yaw=level.entryYaw??0;this.pitch=0;this.braking=new Braking();this.pendingBrakeShot=null;this.stoppedAt=this.time;this.clearFireView();this.renderedTargets.clear();
  }
  private sampleTracking(){
    this.origin.copy(this.movement.position);this.origin.y+=this.movement.eyeHeight;this.viewDirection(this.direction);this.ray.set(this.origin,this.direction);
    let nearestError=Infinity;
    const frame=this.renderedTargets.forShot();
    const hit=castShot(this.ray,this.targets,this.hit,this.obstacles,frame),onHead=hit.zone==='head';
    for(const t of this.targets){if(!headPositionInFrame(t,frame,this.targetPoint))continue;this.targetDirection.copy(this.targetPoint).sub(this.origin).normalize();
      const angle=Math.acos(MathUtils.clamp(this.targetDirection.dot(this.direction),-1,1));nearestError=Math.min(nearestError,angle/DEG);
      if(onHead&&hit.target===t&&!t.reactionRecorded&&this.time-t.changeAt<2){this.reactions.push({targetId:t.id,changeTime:t.changeAt,latency:this.time-t.changeAt});t.reactionRecorded=true;if(this.reactions.length>256)this.reactions.shift();}
    }
    if(Number.isFinite(nearestError)){this.tracking.samples++;this.tracking.errorSquared+=nearestError**2;if(onHead)this.tracking.onHead++;}
  }
  configureAmmo(){for(const id of WEAPON_ORDER){const w=this.weapons[id];w.infiniteReserve=this.settings.infiniteReserve;w.autoReload=this.settings.autoReload;if(this.settings.infiniteMagazine){w.infiniteMagazine=true;w.ammo=w.profile.magazine;w.reloadingUntil=null;}else delete w.infiniteMagazine;}}
  switchWeapon(id:WeaponId){this.clearFireView();if(id===this.weaponId)return;this.meleeReadyAt=0;const old=this.weapon;old.reloadingUntil=null;this.weaponId=id;this.weapon=this.weapons[id];this.ads=false;this.weapon.equip(this.time);}
  configure(patch:Partial<Settings>){
    const targetChange=['targetCount','targetSize','targetSpeed','targetDistance','spawnInterval','behavior','analysisWall','peekScenario','randomDefenders','defenderWeapon'].some(k=>k in patch&&(patch as unknown as Record<string,unknown>)[k]!== (this.settings as unknown as Record<string,unknown>)[k]);
    const bufferChanged=patch.jumpBufferMs!==undefined&&patch.jumpBufferMs!==this.settings.jumpBufferMs;
    Object.assign(this.settings,patch);this.tap.drill=this.settings.drill;
    if(this.movement.configurePhysics(this.settings,this.time)){
      if(this.pendingBrakeShot)this.stats.settleBrake(this.pendingBrakeShot);
      this.pendingBrakeShot=null;this.braking=new Braking();this.stoppedAt=null;
      this.clearFireView();this.renderedTargets.clear();this.footsteps.resetEncounter();this.landings.resetEncounter(this.movement);
      if(this.currentInput){Object.assign(this.currentInput,emptyInput());delete this.currentInput.movementYaw;delete this.currentInput.jumpRequestedAt;}
      this.physicsTransitions.push({time:this.time,profile:this.movement.profile.id,preset:this.movement.profile.preset});if(this.physicsTransitions.length>32)this.physicsTransitions.shift();
    }else if(bufferChanged)this.movement.clearJumpInput();
    this.settings.practiceMap=this.practiceMap;this.footsteps.configure(footstepProfile(this.settings));this.configureAmmo();this.weapon.configureScope(this.settings);if(this.mode==='free'&&targetChange)this.resetTargets();
  }
  resetTargets(){this.clearFireView();this.renderedTargets.clear();if(this.drill){this.drill.reset(this.time);return;}if(this.exercise){this.exercise.resetTargets(this);return;}if(this.scenario){this.applyScenarioTargets();return;}if(this.practiceMap==='complex'){const sectors=activeAngles(this.settings.peekScenario).slice(0,this.settings.targetCount);for(const t of this.targets){const a=sectors[t.id];t.enabled=!!a;t.active=!!a;if(!a)continue;const base=this.settings.randomDefenders&&a.alternatives?.length?a.alternatives[Math.floor(this.rng.next()*a.alternatives.length)]:a.position;const jitter=this.settings.randomDefenders?this.rng.range(-a.jitter,a.jitter):0;t.scale=1;t.spawn(base.x+jitter,base.z,this.time,base.y);}this.defenders?.setSectors(sectors);this.defenders?.retry();this.exposure?.reset();return;}this.exposure?.reset();this.angles?.reset();for(const t of this.targets){if(this.mode==='free'){t.behavior=this.settings.behavior;t.enabled=t.id<Math.min(this.settings.targetCount,this.hearing?5:this.settings.behavior==='peek'?1:12)&&!(this.settings.analysisWall&&!this.hearing);}if(this.angles)t.enabled=t.id<this.level!.angles.length;if(t.enabled)this.spawn(t);else t.active=false;}this.defenders?.retry();}
  retryTactical(){
    const signature=`${this.ticks}:${this.settings.peekScenario}:${this.weaponId}`;
    if(!this.level||!this.running&&this.retrySignature===signature)return;
    this.retrySignature=signature;this.running=false;this.lifeGeneration++;this.clearFireView();this.renderedTargets.clear();
    if(this.currentInput)Object.assign(this.currentInput,emptyInput());
    this.currentInput=emptyInput();this.pendingBrakeShot=null;this.braking=new Braking();
    const zone=this.practiceMap==='complex'?zoneForScenario(this.settings.peekScenario):undefined;
    this.movement.reset(this.scenario?.spawn??zone?.entry??this.level.spawn,this.time,true);
    this.yaw=this.scenario?.yaw??this.level.entryYaw??(zone&&zone.center.z>0?Math.PI:0);this.pitch=this.scenario?.pitch??0;
    for(const weapon of Object.values(this.weapons))weapon.resetForEncounter(this.time,true);
    this.weapon.equip(this.time);this.ads=false;this.adsAmount=0;this.previousAdsAmount=0;
    this.adsChangedAt=this.time;this.stoppedAt=null;this.operatorLastShot=null;
    this.lastHitAt=-100;this.lastHit='miss';this.lastEarlyAt=-100;this.lastShotAt=-100;
    this.footsteps.resetEncounter();this.landings.resetEncounter(this.movement);this.exposure.reset();this.exposure.max=0;this.resetTargets();
  }
  resetStatistics(){this.tap=new TapDrill(this.settings.drill);this.stats=new LifetimeStats();for(const key of Object.keys(this.operatorStats) as (keyof typeof this.operatorStats)[])this.operatorStats[key]=0;this.operatorLastShot=null;this.shots.length=0;this.kills.length=0;this.reactions.length=0;this.tracking={samples:0,onHead:0,errorSquared:0};this.pendingBrakeShot=null;}
  hudSummary(){return this.stats.apply(this.emptySummary,this.pendingBrakeShot);}
  summary(){return this.stats.apply(summarize(this.shots,this.kills,this.reactions,this.tracking),this.pendingBrakeShot);}
  snapshot():SessionData{return {sessionOptions:structuredClone(this.options),exercise:this.exercise?.snapshot(),movementPractice:this.settings.movementTools?.enabled?this.movementPractice.snapshot():undefined,landings:{events:this.landings.totalEvents,recent:this.landings.historyRecent()},physics:{version:this.movement.physicsVersion,...(this.rules!=='legacy-v2'?{rules:this.rules,materialPhysicsVersion:SURFACE_CALIBRATION_VERSION}:{}),current:this.movement.physicsSnapshot(),transitions:this.physicsTransitions.map(t=>({...t}))},movement:this.movement.hopSnapshot(),operator:{...this.operatorStats},peeking:this.defenders?.snapshot(),tactical:this.level?{clears:this.defenders?.report.clears??this.angles?.clears??0,deaths:this.exposure.deaths,maxExposure:this.exposure.max,lastDeath:this.exposure.death}:undefined,drill:{...this.tap.stats},footsteps:{events:this.footsteps.totalEvents,botHeardEvents:this.defenders?.report.heardEvents??this.hearing?.heardEvents??this.angles?.heardEvents??0,finalAccumulation:this.footsteps.footstepAccumulation,recent:this.footsteps.historyRecent()},id:globalThis.crypto?.randomUUID?.()??`session-${Date.now()}-${this.settings.seed}`,createdAt:Date.now(),mode:this.mode,weapon:this.weaponId,duration:this.time,seed:this.settings.seed,settings:{...this.settings},shots:this.shots.slice(),kills:this.kills.slice(),reactions:this.reactions.slice(),tracking:{...this.tracking},summary:this.summary(),weaponTotals:structuredClone(this.stats.weapons),detailLimit:DETAIL_LIMIT};}
}
