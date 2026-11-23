import type {InputState,Mode,Settings,WeaponId} from '../types';
import type {SimulationOptions} from '../../training/platform/SessionOptions';
import type {MovementAction} from '../../training/movementTools/types';

export const REPLAY_SCHEMA=1 as const;
export const REPLAY_SIMULATION_VERSION='valoprac-replay-simulation-2';
export const REPLAY_FIXED_DT=1/120;
export const MAX_REPLAY_COMMANDS=750_000;
export const MAX_REPLAY_SECONDS=1800;
export const MAX_REPLAY_COMPRESSED_BYTES=2_000_000;
export const MAX_REPLAY_DECOMPRESSED_BYTES=24_000_000;
export const ONE_MINUTE_REPLAY_TARGET_BYTES=200_000;
export type PackedInput=[number,number,number,number|null,number|null,number,number,number,number];
export type ReplayCommand=
 |[0,PackedInput] // authoritative fixed tick
 |[1,number,number] // immediate delivered look, in its original order
 |[2,number,number,number,number] // frame id, DOM submitted time, interpolation alpha, tick
 |[3,number] // click-time selected displayed frame
 |[4] // clear pending fire frame
 |[5,Partial<Settings>]
 |[6,WeaponId]
 |[7]|[8]|[9]|[10]
 |[11,boolean,boolean] // external running/completed flags
 |[12,MovementAction]; // bounded practice-tool command; no coordinates/scripts
export interface ReplayHeader {
 gameVersion:string;simulationVersion:string;movementVersion:string;projectionVersion:string;calibrationFingerprint:string;
 createdAt:number;fixedHz:120;map:string;physics:string;seed:number;
 initial:{mode:Mode;weapon:WeaponId;settings:Settings;attached:boolean;options:SimulationOptions};
}
export interface ReplayCheckpoint {command:number;tick:number;checksum:string;}
export interface ReplayEvent {time:number;kind:'shot'|'kill'|'death'|'respawn'|'jump'|'landing'|'weapon'|'settings'|'movement'|'cue'|'turn';label:string;}
export interface ReplayOutcome {checksum:string;score:number;shots:number;hits:number;deaths:number;tick:number;time:number;}
export interface ReplayRecording {
 schema:1;header:ReplayHeader;commands:ReplayCommand[];checkpoints:ReplayCheckpoint[];events:ReplayEvent[];
 duration:number;ticks:number;final:ReplayOutcome;
}
export interface ReplayProgress {tick:number;time:number;ended:boolean;commands:number;}
export interface ReplayVerification {passed:boolean;mismatches:{command:number;tick:number;expected:string;actual:string}[];checksum:string;score:number;shots:number;hits:number;deaths:number;}
export class ReplayError extends Error {constructor(message:string){super(message);this.name='ReplayError';}}

export function packInput(i:InputState):PackedInput {
 let flags=Number(i.walk)|Number(i.crouch)<<1|Number(i.jump)<<2|Number(i.fire)<<3|Number(i.ads)<<4|Number(i.reload)<<5;
 if(i.jumpHeld!==undefined)flags|=64|Number(i.jumpHeld)<<7;
 if(i.scopeHeld!==undefined)flags|=256|Number(i.scopeHeld)<<9;
 return[i.forward,i.strafe,flags,i.movementYaw??null,i.jumpRequestedAt??null,i.jumpPresses??0,i.firePresses??0,i.scopePresses??0,i.zoomPresses??0];
}
export function unpackInput(p:PackedInput):InputState {
 const flags=p[2],i:InputState={forward:p[0],strafe:p[1],walk:!!(flags&1),crouch:!!(flags&2),jump:!!(flags&4),fire:!!(flags&8),ads:!!(flags&16),reload:!!(flags&32),jumpPresses:p[5],firePresses:p[6],scopePresses:p[7],zoomPresses:p[8]};
 if(flags&64)i.jumpHeld=!!(flags&128);if(flags&256)i.scopeHeld=!!(flags&512);
 if(p[3]!==null)i.movementYaw=p[3];if(p[4]!==null)i.jumpRequestedAt=p[4];return i;
}
