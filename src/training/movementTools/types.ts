import type {Settings,Vec3} from '../../engine/types';
import type {Movement,MovementPracticePose} from '../../engine/movement/Movement';

export const MOVEMENT_ACTIONS=['movement-save','movement-restore','movement-takeoff','movement-reset'] as const;
export type MovementAction={kind:typeof MOVEMENT_ACTIONS[number]};
export type MovementToolBinding='save'|'restore'|'takeoff'|'reset';
export interface MovementToolsSettings {
 enabled:boolean;showTrajectory:boolean;showGhost:boolean;
 bindings:Record<MovementToolBinding,string>;
}
export function defaultMovementTools():MovementToolsSettings{return{enabled:false,showTrajectory:true,showGhost:true,bindings:{save:'KeyK',restore:'KeyL',takeoff:'KeyT',reset:'KeyY'}};}
export function isMovementAction(value:unknown):value is MovementAction {
 return!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===1&&Object.hasOwn(value,'kind')&&MOVEMENT_ACTIONS.includes((value as MovementAction).kind);
}
export function sanitizeMovementTools(raw:unknown,occupied:readonly string[]=[]):MovementToolsSettings {
 const out=defaultMovementTools(),o=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw as Record<string,unknown>:{};
 for(const k of ['enabled','showTrajectory','showGhost'] as const)if(typeof o[k]==='boolean')out[k]=o[k];
 const b=o.bindings&&typeof o.bindings==='object'&&!Array.isArray(o.bindings)?o.bindings as Record<string,unknown>:{};
 const used=new Set(occupied),fallback=Array.from('KLTYFGHJNMOQEUIPZXCVBASDWR',c=>`Key${c}`);
 for(const key of ['save','restore','takeoff','reset'] as const){
  const requested=typeof b[key]==='string'&&/^Key[A-Z]$/.test(b[key])?b[key] as string:out.bindings[key];
  const selected=!used.has(requested)?requested:fallback.find(code=>!used.has(code));
  // Standard input reserves fewer than26letterkeys. If an embedding reserves
  // every key, disable tools rather than overriding its movement controls.
  if(!selected){out.enabled=false;return out;}out.bindings[key]=selected;used.add(selected);
 }
 return out;
}
export function movementActionForKey(settings:Pick<Settings,'movementTools'|'bindings'|'operatorZoomBinding'>,code:string):MovementAction|null {
 if(!settings.movementTools?.enabled||Object.values(settings.bindings).includes(code)||settings.operatorZoomBinding===code)return null;
 const names:Record<MovementToolBinding,MovementAction['kind']>={save:'movement-save',restore:'movement-restore',takeoff:'movement-takeoff',reset:'movement-reset'};
 for(const key of ['save','restore','takeoff','reset'] as const)if(settings.movementTools.bindings[key]===code)return{kind:names[key]};return null;
}
export interface MovementPracticeContext {movement:Movement;map:string;bounds:readonly number[];yaw:number;pitch:number;time:number;ticks:number;}
export interface MovementActionResult {ok:boolean;message:string;restored?:{yaw:number;pitch:number};}
/** time,x,y,z,horizontalSpeed,grounded,yaw,crouch */
export type MovementTracePoint=[number,number,number,number,number,boolean,number,number];
export interface MovementAttempt {
 id:number;startTick:number;endTick:number;startTime:number;duration:number;takeoff:Vec3;landing:Vec3|null;
 peakHeight:number;peakSpeed:number;distance:number;takeoffSpeed:number;landingSpeed:number|null;speedPreservation:number|null;
 truncated:boolean;samples:MovementTracePoint[];
}
export interface MovementPracticeSnapshot {
 enabled:boolean;saved:boolean;canReturnTakeoff:boolean;canReset:boolean;message:string;
 savedPose:MovementPracticePose|null;lastTakeoffPose:MovementPracticePose|null;attemptOrigin:MovementPracticePose|null;
 current:MovementAttempt|null;last:MovementAttempt|null;restores:number;
}
