export type Mode = 'precision' | 'braking' | 'spray' | 'tracking';
export type WeaponId = 'rifleA' | 'rifleB';
export type Behavior = 'stationary' | 'strafe' | 'random' | 'stopGo' | 'crouch' | 'peek';
export type HitZone = 'head' | 'torso' | 'arm' | 'leg' | 'wall' | 'miss';
export interface Vec3 { x: number; y: number; z: number }
export interface InputState { forward: number; strafe: number; walk: boolean; crouch: boolean; jump: boolean; fire: boolean; ads: boolean; reload: boolean }
export const emptyInput = (): InputState => ({forward:0, strafe:0, walk:false, crouch:false, jump:false, fire:false, ads:false, reload:false});
export interface Settings {
  sensitivity: number; degreesPerCount: number; dpi: number; fov: number; duration: number; seed: number;
  crosshairColor: string; crosshairThickness: number; crosshairGap: number; crosshairLength: number;
  dynamicCrosshair: boolean; brakingHud: boolean; idealCompensation: boolean; volume: number;
  renderScale: number; antialias: boolean; showPerformance: boolean; behavior: Behavior;
}
export interface ShotEvent {
  timestamp: number; weapon: WeaponId; shotIndex: number; magazineShot: number; firstShot: boolean;
  position: Vec3; velocity: Vec3; direction: Vec3; aim: {yaw:number;pitch:number};
  recoil: {pitch:number;yaw:number}; spread: {base:number;movement:number;bloom:number;air:number;total:number;x:number;y:number};
  hit: HitZone; impact: Vec3; targetId: number | null; targetPosition: Vec3 | null; targetState: Behavior | null;
  targetGeneration: number | null; playerCompensation: {pitch:number;yaw:number};
  accurate: boolean; releaseTime: number | null; thresholdDelta: number | null;
  brakingKind: 'neutral' | 'opposite' | null; initialSpeed: number | null; brakingDuration: number | null; decelerationDuration: number | null;
  movementDirection: {x:number;z:number}; angularError: number | null;
}
export interface KillEvent {timestamp:number;targetId:number;generation:number;elapsed:number;firstShot:boolean}
export interface DirectionResponse {targetId:number;changeTime:number;latency:number}
export interface SessionData {
  id: string; createdAt: number; mode: Mode; weapon: WeaponId; duration: number; seed: number; settings: Settings;
  shots: ShotEvent[]; kills: KillEvent[]; reactions: DirectionResponse[];
  tracking: {samples:number;onHead:number;errorSquared:number}; summary: SessionSummary;
}
export interface SessionSummary {
  shots:number; heads:number; bodies:number; limbs:number; misses:number; eliminations:number;
  headshotAccuracy:number; hitAccuracy:number; missRate:number; firstShotAccuracy:number; firstShotHeadshot:number;
  averageEliminationTime:number; earlyShots:number; brakingSamples:number; averageBrakeDuration:number; averageDecelerationDuration:number; brakingMeasuredSamples:number; brakingTimingSamples:number; decelerationSamples:number;
  averageShotSpeed:number; averageThresholdDelta:number; brakingConsistency:number;
  neutral:{count:number;duration:number;delta:number;headshotRate:number}; opposite:{count:number;duration:number;delta:number;headshotRate:number};
  spray:{count:number;centerX:number;centerY:number;width:number;height:number;meanRadius:number;stability:number;angularRms:number;consistency:number|null};
  reactionTimes:number[]; trackingAccuracy:number; trackingRms:number;
}
