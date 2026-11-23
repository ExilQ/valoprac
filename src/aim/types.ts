import type {CalibrationConfig} from './precision/calibration';
export const AIM_VERSION='aim-2.0.0';
// Mechanical version advances when the explicit collision/material rules change.
export const GAME_VERSION='12.0.0';
export const TASKS=['large','small','micro','smooth','reactive','switch','dynamic'] as const;
export type AimTask=typeof TASKS[number]|'tactical';
export const TASK_LABELS:Record<AimTask,string>={large:'큰 각도 플릭',small:'작은 머리 표적',micro:'미세 조정',smooth:'부드러운 트래킹',reactive:'반응형 트래킹',switch:'표적 전환',dynamic:'이동 표적 클릭',tactical:'전술 사격 전이'};
export type PrecisionMode='quick'|'precision'|'longitudinal';
export type PrecisionStage='baseline'|'coarse'|'fine'|'heldout'|'retention';
export type EvaluationMode='hip'|'rifle-ads'|'operator-2.5'|'operator-5';
export type AimPhase='exploration'|'verification'|'baseline'|'training'|'post'|'retention'|'transfer'|'combat';
export const PHASE_LABELS:Record<AimPhase,string>={exploration:'감도 탐색',verification:'보류 과제 검증',baseline:'사전 평가',training:'개인 맞춤 훈련',post:'직후 평가',retention:'지연 유지 평가',transfer:'전이 평가',combat:'실제 무기 참고'};
// Trace columns: time seconds, delivered deltas, camera/target degrees, radius degrees,
// event kind (0 input, 1 click, 2 fixed sample, 3 target direction change), receipt delay ms,
// angular camera delta from the exact input event. No physical sensor-count claim.
export const COLS=22;
export interface AimMeta {schema:1;algorithm:string;game:string;id:string;experiment:string;session:string;createdAt:number;task:AimTask;phase:AimPhase;sensitivity:number;dpi:number;dpiSource:'user-declared';coefficient:number;fov:number;ads:boolean;adsMultiplier:number;rawMode:string;renderer:'angular-canvas'|'browser-webgl';seed:number;round:number;pair:string;order:number;radius:number;amplitude:number;duration:number;warmup:number;condition:string;valid:boolean;issues:string[];appearanceKnown:boolean;weapon?:string;moving?:boolean;recoil?:number;spread?:number;hit?:boolean;shotTime?:number;frameP95?:number;targetId?:number;}
export interface AimMetrics {valid:boolean;issues:string[];samples:number;inputEvents:number;duration:number;hit:boolean|null;reaction:number|null;primaryDuration:number|null;primaryEnd:number|null;initialError:number|null;signedError:number|null;perpendicular:number|null;extent:'over'|'under'|'center'|'unknown';corrections:number|null;correctionDistance:number|null;correctionTime:number|null;reversals:number|null;stabilization:number|null;entry:number|null;dwell:number|null;clickTime:number|null;clickError:number|null;clickClass:'early'|'late'|'passed'|'aligned'|'movement'|'none';path:number;direct:number;efficiency:number|null;sector:number|null;trackingRms:number|null;onTarget:number|null;velocityMismatch:number|null;lag:number|null;recovery:number|null;changeOvershoot:number|null;speedVariation:number|null;score:number|null;}
export interface AimRecord {meta:AimMeta;metrics:AimMetrics;trace:number[];}
export interface AimMeta {distance?:number;targetDiameter?:number;movementState?:string;weaponState?:string;viewport?:[number,number];renderScale?:number;targetState?:string;gameMode?:string;monotonicStartMs?:number;timeOriginMs?:number;appearanceTime?:number;}
export interface AimBlock {id:string;experiment:string;session:string;task:AimTask;phase:AimPhase;sensitivity:number;seed:number;round:number;pair:string;order:number;radius:number;amplitude:number;duration:number;warmup:number;trials:number;difficulty:number;}
export interface AimPlan {id:string;createdAt:number;kind:AimPhase;base:number;alternative:number|null;fov:number;coefficient:number;dpi:number;blocks:AimBlock[];schedule:'blocked'|'mixed';goal:'balanced'|'precision'|'tracking'|'tactical';seed:number;protocol?:PrecisionMode;protocolId?:string;stage?:PrecisionStage;evaluationMode?:EvaluationMode;adsMultiplier?:number;weapon?:import('../engine/types').WeaponId;scopeZoom?:number;resumeBlock?:number;}
export interface AimSetup {base:number;alternative:number;dpi:number;range:number;rounds:number;goal:AimPlan['goal'];schedule:AimPlan['schedule'];mousepad:number;comfortAngle?:number;}
export const trackingTask=(t:AimTask)=>t==='smooth'||t==='reactive';
export interface AimMeta {protocol?:PrecisionMode;protocolId?:string;stage?:PrecisionStage;evaluationMode?:EvaluationMode;scopeZoom?:number;inputFingerprint?:string;calibration?:CalibrationConfig;expectedTrials?:number;expectedTasks?:AimTask[];blockId?:string;trialIndex?:number;}

/** Observed movement phases; absent phases are not inferred from a template. */
export interface AimMovementPhase {phase:'reaction'|'initiation'|'ballistic'|'deceleration'|'approach'|'correction'|'stabilization'|'shot';start:number;end:number;}
export interface AimMetrics {
 phases?:AimMovementPhase[];
 initialDistance?:number|null;
 initialDirectionError?:number|null;
 peakVelocity?:number|null;
 decelerationTime?:number|null;
 correctionFraction?:number|null;
 oscillation?:number|null;
 trackingMedian?:number|null;
 angularAccelerationRms?:number|null;
 accelerationReliable?:boolean;
 aimHit?:boolean|null;
 sensitivityEligible?:boolean;
 missAttribution?:string[];
 segmentationQuality?:'segmented'|'continuous'|'insufficient';
}
export interface AimMeta {
 eventTimestampClock?:'receipt-with-original-delay';
 pointerLocked?:boolean;
 rawRequest?:'unverified'|'accepted'|'fallback'|'denied';
 frameMedian?:number;
 frameP99?:number;
 frameSamples?:number;
 inputEventHz?:number;
 targetVisibleAtShot?:boolean;
 targetExposureSeconds?:number;
}

/** Actual browser movement solver identity; absent historical values remain legacy.
 * Angular-canvas tasks do not use this condition. */
export interface AimMeta {movementModel?:string;}
