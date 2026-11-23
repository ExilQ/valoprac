import {GAME_VERSION} from '../../aim/types';
import {MOVEMENT_PHYSICS_VERSION,VALORANT_PHYSICS,CS2_PHYSICS,SOURCE_CLASSIC_PHYSICS} from '../../config/movement';
import {WEAPONS} from '../../config/weapons';
import {PROJECTION_CALIBRATION} from '../rendering/projection';
import {HELD_ANGLE_TIMING_CALIBRATION} from '../tactical/BotAimMotor';
import type {Simulation} from '../simulation/Simulation';
import type {ReplayOutcome} from './types';
import {REPLAY_SIMULATION_VERSION} from './types';

/** Non-cryptographic reproducibility checksum. It never authenticates an online
 * score: verification always re-executes the complete compatible simulation. */
export function integrityHash(value:unknown){const text=JSON.stringify(value),length=text.length;let a=2166136261,b=5381;for(let i=0;i<length;i++){const c=text.charCodeAt(i);a=Math.imul(a^c,16777619);b=Math.imul(b,33)^c;}return(a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0');}
const commonOmit=new Set(['onAction','onStep','onLanding','onFootstep','onShot','onKill','onFinish','root','upper','head','leftHip','rightHip','leftKnee','rightKnee','leftArm','rightArm','parts','node','inverse','collision','obstacles','settings','targets','profile','head','ray','hit','sectors']);
function state(value:unknown,depth=0,parents=new Set<object>()):unknown {
 if(value===null||typeof value==='string'||typeof value==='boolean')return value;
 if(typeof value==='number')return Number.isFinite(value)?value:String(value);
 if(value===undefined||typeof value==='function')return undefined;
 if(typeof value!=='object'||depth>14)return null;
 const o=value as Record<string,unknown>;
 if(o.isObject3D||o.isBufferGeometry||o.isMaterial)return undefined;
 if(o.isVector3)return[(o.x as number),(o.y as number),(o.z as number)];
 if(o.isMatrix4)return(o.elements as number[]).slice();
 if(parents.has(value))return undefined;const next=new Set(parents);next.add(value);
 if(Array.isArray(value))return value.map(v=>state(v,depth+1,next));
 if(value instanceof Set)return [...value].map(v=>state(v,depth+1,next));
 const result:Record<string,unknown>={};for(const key of Object.keys(o).sort()){if(commonOmit.has(key))continue;const v=state(o[key],depth+1,next);if(v!==undefined)result[key]=v;}return result;
}
/** Version-pinned internal state is intentionally richer than the result card:
 * RNG streams, movement timers, all guns, target generations and defender memory
 * are covered. Render-only THREE objects and wall-clock UUIDs are excluded. */
export function deterministicState(s:Simulation){
 const raw=s as unknown as Record<string,unknown>,frame=s.renderedTargets.latest;
 return{ticks:s.ticks,time:s.time,mode:s.mode,map:s.practiceMap,weapon:s.weaponId,running:s.running,completed:s.completed,life:s.lifeGeneration,
  aim:[s.yaw,s.pitch,s.ads,s.adsAmount,s.previousAdsAmount,s.adsChangedAt],settings:s.settings,
  movement:state(s.movement),movementProfile:s.movement.profile,braking:state(s.braking),guns:state(s.weapons),targets:s.targets.map(t=>state(t)),
  rng:state(raw.rng),defenders:s.defenders?state(s.defenders):null,angles:state(s.angles),hearing:state(s.hearing),exposure:state(s.exposure),
  shots:s.shots,kills:s.kills,reactions:s.reactions,tracking:s.tracking,stats:state(s.stats),operator:s.operatorStats,tap:state(s.tap),
  footsteps:state(s.footsteps),landings:state(s.landings),pendingBrake:raw.pendingBrakeShot??null,stoppedAt:s.stoppedAt,
  physicsTransitions:raw.physicsTransitions,operatorLastShot:raw.operatorLastShot,retrySignature:raw.retrySignature,
  platform:state(s.trainingState()),
  rendered:{attached:s.renderedTargets.isAttached,size:s.renderedTargets.size,latest:frame?{id:frame.id,stamp:frame.submittedAt,targets:frame.targets.map(p=>p?{generation:p.generation,active:p.active,position:p.position.toArray(),matrices:p.active?p.matrices.map(m=>m.toArray()):[]}:null)}:null},
 };
}
export function simulationChecksum(s:Simulation){return integrityHash(deterministicState(s));}
export function replayOutcome(s:Simulation):ReplayOutcome{return{checksum:simulationChecksum(s),score:s.exercise?.snapshot().score??s.stats.eliminations,shots:s.stats.shots,hits:s.stats.heads+s.stats.bodies+s.stats.limbs,deaths:s.exposure.deaths,tick:s.ticks,time:s.time};}
export function replayCompatibility(){return{gameVersion:GAME_VERSION,simulationVersion:REPLAY_SIMULATION_VERSION,movementVersion:MOVEMENT_PHYSICS_VERSION,projectionVersion:PROJECTION_CALIBRATION.version,calibrationFingerprint:integrityHash({weapons:WEAPONS,physics:[VALORANT_PHYSICS,CS2_PHYSICS,SOURCE_CLASSIC_PHYSICS],bot:HELD_ANGLE_TIMING_CALIBRATION})};}
