import {courseFor} from '../../config/mapCourses';
import {GAME_VERSION} from '../../aim/types';
import {MOVEMENT_PHYSICS_VERSION,MATERIALS_MOVEMENT_PHYSICS_VERSION,AIR_STEERING_MOVEMENT_PHYSICS_VERSION,VALORANT_BUNNY_HOP,VALORANT_AIR_STEERING,VALORANT_PHYSICS,CS2_PHYSICS,SOURCE_CLASSIC_PHYSICS} from '../../config/movement';
import {WEAPONS,LEGACY_WEAPONS,WEAPON_ORDER} from '../../config/weapons';
/** Firearm profiles in their original key order. The knife (12.21) is excluded
 * so recordings made before it keep their calibration fingerprint; its attacks
 * are covered by the melee state in each checksum instead. */
const {knife:_knife,...FIREARM_PROFILES}=WEAPONS;void _knife;
const {knife:_legacyKnife,...LEGACY_FIREARM_PROFILES}=LEGACY_WEAPONS;void _legacyKnife;
const firearms=(weapons:Record<string,unknown>)=>Object.fromEntries(WEAPON_ORDER.filter(id=>id in weapons).map(id=>[id,weapons[id]]));
import {SURFACES,SURFACE_CALIBRATION_VERSION} from '../../config/surfaces';
import {PENETRATION_WEAPONS} from '../../config/penetration';
import {FOOTSTEP_BASELINE} from '../../config/footsteps';
import {obstaclesFor} from '../tactical/map';
import {PEEK_ZONES} from '../tactical/complex';
import {BASE_GROUND_SURFACE,THEMED_FLOOR_SURFACES,RANGE_MAT_SURFACE} from '../footsteps/surfaceSelection';
import {FIELD_CHARACTER_GEOMETRY,LEGACY_CHARACTER_GEOMETRY,type CharacterGeometryVersion} from '../targets/characterProfile';
import {PROJECTION_CALIBRATION} from '../rendering/projection';
import {HELD_ANGLE_TIMING_CALIBRATION} from '../tactical/BotAimMotor';
import type {Simulation} from '../simulation/Simulation';
import type {ReplayHeader,ReplayOutcome} from './types';
import {CURRENT_SIMULATION_RULES,BUNNY_HOP_SIMULATION_RULES,AIR_STEERING_SIMULATION_RULES,MATERIALS_SIMULATION_RULES,LEGACY_SIMULATION_RULES,usesCurrentWeapons,type SimulationRulesId} from '../simulation/rules';
import {LEGACY_REPLAY_SIMULATION_VERSION,MATERIALS_REPLAY_SIMULATION_VERSION,AIR_STEERING_REPLAY_SIMULATION_VERSION,BUNNY_HOP_REPLAY_SIMULATION_VERSION,REPLAY_INPUT_VERSION,REPLAY_SIMULATION_VERSION,REPLAY_WEAPON_VERSION,ReplayError} from './types';

/** Non-cryptographic reproducibility checksum. It never authenticates an online
 * score: verification always re-executes the complete compatible simulation. */
export function integrityHash(value:unknown){const text=JSON.stringify(value),length=text.length;let a=2166136261,b=5381;for(let i=0;i<length;i++){const c=text.charCodeAt(i);a=Math.imul(a^c,16777619);b=Math.imul(b,33)^c;}return(a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0');}
const commonOmit=new Set(['onAction','onStep','onLanding','onFootstep','onShot','onKill','onFinish','root','upper','head','leftHip','rightHip','leftKnee','rightKnee','leftArm','rightArm','parts','node','inverse','collision','obstacles','settings','targets','profile','head','ray','hit','sectors','characterGeometry']);
function state(value:unknown,depth=0,parents=new Set<object>(),legacy=false):unknown {
 if(value===null||typeof value==='string'||typeof value==='boolean')return value;
 if(typeof value==='number')return Number.isFinite(value)?value:String(value);
 if(value===undefined||typeof value==='function')return undefined;
 if(typeof value!=='object'||depth>14)return null;
 const o=value as Record<string,unknown>;
 if(o.isObject3D||o.isBufferGeometry||o.isMaterial)return undefined;
 if(o.isVector3)return[(o.x as number),(o.y as number),(o.z as number)];
 if(o.isMatrix4)return(o.elements as number[]).slice();
 if(parents.has(value))return undefined;const next=new Set(parents);next.add(value);
 if(Array.isArray(value))return value.map(v=>state(v,depth+1,next,legacy));
 if(value instanceof Set)return [...value].map(v=>state(v,depth+1,next,legacy));
 const result:Record<string,unknown>={};for(const key of Object.keys(o).sort()){
  // Only the new engine selector is absent from historical state. Scenario
  // definitions already had a rules object, which remains checksum-bearing.
  const rulesSelector=key==='rules'&&(o[key]===LEGACY_SIMULATION_RULES||o[key]===CURRENT_SIMULATION_RULES||o[key]===MATERIALS_SIMULATION_RULES||o[key]===AIR_STEERING_SIMULATION_RULES||o[key]===BUNNY_HOP_SIMULATION_RULES);
  if(commonOmit.has(key)||legacy&&(rulesSelector||key==='stepMinLandingWidth'))continue;
  const v=state(o[key],depth+1,next,legacy);if(v!==undefined)result[key]=v;
 }return result;
}
/** Version-pinned internal state is intentionally richer than the result card:
 * RNG streams, movement timers, all guns, target generations and defender memory
 * are covered. Render-only THREE objects and wall-clock UUIDs are excluded. */
export function deterministicState(s:Simulation){
 const raw=s as unknown as Record<string,unknown>,frame=s.renderedTargets.latest;
 const legacy=s.rules===LEGACY_SIMULATION_RULES,serialize=(v:unknown)=>state(v,0,new Set<object>(),legacy),profile={...s.movement.profile};
 if(legacy)delete profile.stepMinLandingWidth;
 return{...(!legacy?{simulationRules:s.rules,materialPhysicsVersion:SURFACE_CALIBRATION_VERSION}:{}),
  ...(s.characterGeometry!==LEGACY_CHARACTER_GEOMETRY?{characterGeometryVersion:s.characterGeometry}:{}),ticks:s.ticks,time:s.time,mode:s.mode,map:s.practiceMap,weapon:s.weaponId,running:s.running,completed:s.completed,life:s.lifeGeneration,
  aim:[s.yaw,s.pitch,s.ads,s.adsAmount,s.previousAdsAmount,s.adsChangedAt],settings:s.settings,
  movement:serialize(s.movement),movementProfile:profile,braking:serialize(s.braking),guns:serialize(firearms(s.weapons)),targets:s.targets.map(t=>serialize(t)),
  rng:serialize(raw.rng),defenders:s.defenders?serialize(s.defenders):null,
  ...(s.drill?{drill:serialize(s.drill)}:{}),angles:serialize(s.angles),hearing:serialize(s.hearing),exposure:serialize(s.exposure),
  shots:s.shots,kills:s.kills,reactions:s.reactions,tracking:s.tracking,stats:serialize(s.stats),operator:s.operatorStats,tap:serialize(s.tap),
  footsteps:serialize(s.footsteps),landings:serialize(s.landings),pendingBrake:raw.pendingBrakeShot??null,stoppedAt:s.stoppedAt,
  physicsTransitions:raw.physicsTransitions,operatorLastShot:raw.operatorLastShot,retrySignature:raw.retrySignature,
  platform:serialize(s.trainingState()),
  ...(s.meleeSerial>0||s.weaponId==='knife'?{melee:{knife:serialize(s.weapons.knife),serial:s.meleeSerial,readyAt:s.meleeReadyAt,last:s.lastMelee}}:{}),
  rendered:{attached:s.renderedTargets.isAttached,size:s.renderedTargets.size,latest:frame?{id:frame.id,stamp:frame.submittedAt,targets:frame.targets.map(p=>p?{generation:p.generation,active:p.active,position:p.position.toArray(),matrices:p.active?p.matrices.map(m=>m.toArray()):[]}:null)}:null},
 };
}
export function simulationChecksum(s:Simulation){return integrityHash(deterministicState(s));}
export function replayOutcome(s:Simulation):ReplayOutcome{return{checksum:simulationChecksum(s),score:s.exercise?.snapshot().score??s.stats.eliminations,shots:s.stats.shots,hits:s.stats.heads+s.stats.bodies+s.stats.limbs,deaths:s.exposure.deaths,tick:s.ticks,time:s.time};}
/** Exact historical identity, recorded independently before the material update.
 * Legacy playback still executes the real engine with explicit retained rules. */
const LEGACY_COMPATIBILITY=Object.freeze({gameVersion:'10.0.0',simulationVersion:LEGACY_REPLAY_SIMULATION_VERSION,movementVersion:'dual-movement-1.1.0',projectionVersion:'horizontal-angular-division-1',calibrationFingerprint:'b9c4ab53c0512d05'});
export function replayCompatibility(rules:SimulationRulesId=CURRENT_SIMULATION_RULES,
 characterGeometry:CharacterGeometryVersion=rules===LEGACY_SIMULATION_RULES?LEGACY_CHARACTER_GEOMETRY:FIELD_CHARACTER_GEOMETRY,mapId?:string){
 if(rules===LEGACY_SIMULATION_RULES)return{...LEGACY_COMPATIBILITY};
 const surfaces=Object.entries(SURFACES).map(([id,s])=>({id,collisionFriction:s.collisionFriction,penetrationResistance:s.penetrationResistance,penetrationRetention:s.penetrationRetention,opaque:!!s.opaque,blocksSight:s.blocksSight,footstepSoundProfile:s.footstepSoundProfile}));
 const maps=['range','tactical','long','garage','site','mid','tower','multi','complex','bunny','wallbang'].map(id=>({id,obstacles:obstaclesFor(id).map(o=>({min:o.box.min.toArray(),max:o.box.max.toArray(),kind:o.kind,ramp:o.ramp,material:o.material,surfaceId:o.surfaceId,groundSurfaceId:o.groundSurfaceId}))}));
 const materials=rules===MATERIALS_SIMULATION_RULES,steering=rules===AIR_STEERING_SIMULATION_RULES,bunnyHop=rules===BUNNY_HOP_SIMULATION_RULES;
 const course=mapId?courseFor(mapId):undefined;
 const ground={base:BASE_GROUND_SURFACE,themed:THEMED_FLOOR_SURFACES,rangeMat:RANGE_MAT_SURFACE,complex:PEEK_ZONES.map(z=>({bounds:z.bounds,center:z.center,material:z.material}))};
 const characterIdentity=characterGeometry!==LEGACY_CHARACTER_GEOMETRY?{characterGeometryVersion:characterGeometry}:{};
 return{...characterIdentity,gameVersion:GAME_VERSION,simulationVersion:materials?MATERIALS_REPLAY_SIMULATION_VERSION:steering?AIR_STEERING_REPLAY_SIMULATION_VERSION:bunnyHop?BUNNY_HOP_REPLAY_SIMULATION_VERSION:REPLAY_SIMULATION_VERSION,movementVersion:materials?MATERIALS_MOVEMENT_PHYSICS_VERSION:steering?AIR_STEERING_MOVEMENT_PHYSICS_VERSION:MOVEMENT_PHYSICS_VERSION,projectionVersion:PROJECTION_CALIBRATION.version,calibrationFingerprint:integrityHash({...(!materials&&!steering?{tacticalBunnyHop:VALORANT_BUNNY_HOP}:{}),...(materials?{}:{tacticalAirSteering:VALORANT_AIR_STEERING}),...(course?{courseRules:1,entryYaw:course.entryYaw,coursePlan:course.rows,cell:course.cell,height:course.height,wall:course.wall,floor:course.floor,...('drill' in course?{drill:course.drill,drillVersion:1}:{})}:{}),weapons:usesCurrentWeapons(rules)?FIREARM_PROFILES:LEGACY_FIREARM_PROFILES,physics:[VALORANT_PHYSICS,CS2_PHYSICS,SOURCE_CLASSIC_PHYSICS],bot:HELD_ANGLE_TIMING_CALIBRATION,surfaces,maps,ground,penetrationWeapons:PENETRATION_WEAPONS,footsteps:FOOTSTEP_BASELINE,...characterIdentity}),simulationRules:rules,materialPhysicsVersion:SURFACE_CALIBRATION_VERSION,inputVersion:REPLAY_INPUT_VERSION,weaponVersion:REPLAY_WEAPON_VERSION};
}
export function replayRulesFor(header:ReplayHeader):SimulationRulesId {
 const rules=header.simulationVersion===LEGACY_REPLAY_SIMULATION_VERSION?LEGACY_SIMULATION_RULES:header.simulationVersion===MATERIALS_REPLAY_SIMULATION_VERSION?MATERIALS_SIMULATION_RULES:header.simulationVersion===AIR_STEERING_REPLAY_SIMULATION_VERSION?AIR_STEERING_SIMULATION_RULES:header.simulationVersion===BUNNY_HOP_REPLAY_SIMULATION_VERSION?BUNNY_HOP_SIMULATION_RULES:CURRENT_SIMULATION_RULES,expected=replayCompatibility(rules,replayCharacterGeometry(header),header.map);
 for(const key of Object.keys(expected) as (keyof typeof expected)[])if(header[key]!==expected[key])throw new ReplayError('현재 게임·물리·보정 버전과 호환되지 않는 리플레이입니다.');
 // A simulation-2 file cannot opt into new mechanics through optional metadata.
 if(rules===LEGACY_SIMULATION_RULES&&(header.simulationRules!==undefined&&header.simulationRules!==rules||header.materialPhysicsVersion!==undefined||header.inputVersion!==undefined||header.weaponVersion!==undefined||header.characterGeometryVersion!==undefined))throw new ReplayError('현재 게임·물리·보정 버전과 호환되지 않는 리플레이입니다.');
 return rules;
}

export function replayCharacterGeometry(header:ReplayHeader):CharacterGeometryVersion {
 return header.characterGeometryVersion??LEGACY_CHARACTER_GEOMETRY;
}
