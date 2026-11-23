import type {Target} from '../../engine/targets/Target';
import type {Vec3,WeaponId} from '../../engine/types';

export const EXERCISE_VERSION='exercises-1.0.0';
export type ExerciseKind='warmup'|'flash';
export interface WarmupOptions {schema:1;kind:'warmup';durationSeconds:60;}
export interface FlashOptions {schema:1;kind:'flash';durationSeconds:60;responseWindowSeconds:number;turnThresholdDegrees:number;}
export type ExerciseOptions=WarmupOptions|FlashOptions;
export const DEFAULT_WARMUP_OPTIONS:WarmupOptions={schema:1,kind:'warmup',durationSeconds:60};
export const DEFAULT_FLASH_OPTIONS:FlashOptions={schema:1,kind:'flash',durationSeconds:60,responseWindowSeconds:.8,turnThresholdDegrees:100};

/** Original trainer protocol. These are not native VALORANT ability timings. */
export const EXERCISE_PROTOCOL={version:EXERCISE_VERSION,warmup:{distanceMeters:20,startX:2.9,exitX:3.05,speedMultiplier:.7,minimumGapSeconds:.35,maximumGapSeconds:.65},flash:{movementOnsetDegrees:1,minimumRestSeconds:.75,maximumRestSeconds:1.5,cueDistanceMeters:6},nativeParityVerified:false} as const;

export class ExerciseValidationError extends Error {constructor(message:string){super(message);this.name='ExerciseValidationError';}}
export function validateExerciseOptions(raw:unknown):ExerciseOptions {
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||(Object.getPrototypeOf(raw)!==Object.prototype&&Object.getPrototypeOf(raw)!==null))throw new ExerciseValidationError('훈련 과제 설정의 형식이 올바르지 않습니다.');
 const o=raw as Record<string,unknown>,keys=o.kind==='flash'?['schema','kind','durationSeconds','responseWindowSeconds','turnThresholdDegrees']:['schema','kind','durationSeconds'];
 if(Object.keys(o).some(k=>!keys.includes(k))||o.schema!==1||o.durationSeconds!==60||(o.kind!=='warmup'&&o.kind!=='flash'))throw new ExerciseValidationError('지원하는 1분 훈련 설정 버전과 종류를 사용하세요.');
 if(o.kind==='warmup')return{...DEFAULT_WARMUP_OPTIONS};
 const response=o.responseWindowSeconds??DEFAULT_FLASH_OPTIONS.responseWindowSeconds,turn=o.turnThresholdDegrees??DEFAULT_FLASH_OPTIONS.turnThresholdDegrees;
 if(typeof response!=='number'||!Number.isFinite(response)||response<.25||response>1.5||typeof turn!=='number'||!Number.isFinite(turn)||turn<60||turn>150)throw new ExerciseValidationError('반응 창은 0.25–1.5초, 회전 기준은 60–150도여야 합니다.');
 return{schema:1,kind:'flash',durationSeconds:60,responseWindowSeconds:response,turnThresholdDegrees:turn};
}

export interface ExerciseContext {
 time:number;ticks:number;targets:Target[];
 movement:{position:Vec3;eyeHeight:number};viewYaw:number;viewPitch:number;
 stats:{eliminations:number;shots:number;heads:number;bodies:number;limbs:number};
}
export interface FlashCue {
 id:number;cueTime:number;deadline:number;source:Vec3;initialDirection:Vec3;
 movementOnset:number|null;maximumTurnDegrees:number;completionTime:number|null;
 success:boolean|null;
}
export interface WarmupReport {appearances:number;escaped:number;eliminations:number;shots:number;hits:number;headshots:number;hitAccuracy:number;firstTargetAt:number|null;targetActive:boolean;nextTargetAt:number|null;}
export interface FlashReport {cues:number;successes:number;failures:number;successRate:number;meanOnsetSeconds:number|null;meanCompletionSeconds:number|null;events:FlashCue[];active:FlashCue|null;}
export interface ExerciseReport {
 schema:1;version:string;kind:ExerciseKind;durationSeconds:60;elapsedSeconds:number;completed:boolean;score:number;
 warmup?:WarmupReport;flash?:FlashReport;
}
export interface ExercisePersonalBest {schema:1;protocol:string;kind:ExerciseKind;weapon:WeaponId;physics:string;score:number;recordedAt:number;}
