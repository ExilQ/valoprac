export type Mode = 'precision' | 'braking' | 'spray' | 'tracking' | 'free';
export type WeaponId = 'rifleA' | 'rifleB' | 'sheriff' | 'operator';
export type PracticeMap='range'|'tactical'|'long'|'garage'|'site'|'mid'|'tower'|'multi'|'complex';
export type Drill='none'|'tapAD'|'tapDA'|'release'|'wide'|'repeat'|'stopMoving'|'corner'|'vertical'|'mixed'|'moving';
export type Behavior = 'stationary' | 'strafe' | 'random' | 'stopGo' | 'crouch' | 'peek' | 'appearing'|'short'|'long'|'reactive'|'wide'|'mixed';
export type HitZone = 'head' | 'torso' | 'arm' | 'leg' | 'wall' | 'miss';
export interface Vec3 { x: number; y: number; z: number }
export interface InputState { forward: number; strafe: number; walk: boolean; crouch: boolean; jump: boolean; fire: boolean; ads: boolean; reload: boolean; firePresses?: number; scopePresses?:number; zoomPresses?:number; scopeHeld?:boolean }
export const emptyInput = (): InputState => ({forward:0, strafe:0, walk:false, crouch:false, jump:false, fire:false, ads:false, reload:false, firePresses:0,scopePresses:0,zoomPresses:0,scopeHeld:false});
export type Quality = 'low' | 'medium' | 'high' | 'ultra';
export const BINDING_ACTIONS = ['forward','backward','left','right','walk','crouch','jump','reload','weapons'] as const;
export type Bindings = Record<typeof BINDING_ACTIONS[number],string>;
export interface WeaponTotals { shots:number; hits:number; heads:number; recoilSquared:number; spreadSum:number }
export type PeekScenario='free'|'wide'|'shoulder'|'jiggle'|'crouch'|'jump'|'vertical'|'slicing'|'operator'|'mixed';
export interface Settings {
  peekingTimed:boolean;operatorScopeMode:'hold'|'toggle';operatorAutoRescope:boolean;operatorZoomBinding:string;peekScenario:PeekScenario;defenderWeapon:WeaponId|'mixed';defenderReaction:number;defenderAccuracy:number;defenderReposition:number;randomDefenders:boolean;
  gameplayRevision:number;aimTelemetry:boolean;
  practiceMap:PracticeMap;drill:Drill;crouchMode:'hold'|'toggle';inputDiagnostics:boolean;adsDotSize:number;botDifficulty:'easy'|'normal'|'hard';exposureEnabled:boolean;exposureLimit:number;exposureMode:'continuous'|'persistent';footstepHud:boolean;soundMinimap:boolean;footstepVolume:number;
  stepPerMeter:number;stepWalkingGain:number;stepWalkingDecay:number;stepStationaryDecay:number;stepStationaryVelocity:number;stepStationaryDelay:number;stepAudibleVelocity:number;stepThreshold:number;stepGraceDistance:number;stepHearingRadius:number;

  frameLimit:number; hudScale:number; showHeadshotConfirmation:boolean; showControlHints:boolean; interfaceVolume:number;
  adsSensitivity:number; adsMode:'hold'|'toggle'; bindings:Bindings;
  graphicsPreset:Quality; shadowQuality:Quality|'off'; textureQuality:Quality; postProcessing:boolean; ambientOcclusion:boolean; effectsQuality:Quality; premiumTheme:boolean;
  firingVolume:number; handlingVolume:number; feedbackVolume:number;
  targetCount:number; targetSize:number; targetSpeed:number; targetDistance:number; spawnInterval:number;
  eliminationRule:'head'|'any'|'damage'; infiniteReserve:boolean; autoReload:boolean; practiceHud:boolean; recoilAnalysis:boolean; analysisWall:boolean;

  sensitivity: number; degreesPerCount: number; dpi: number; fov: number; duration: number; seed: number;
  crosshairColor: string; crosshairThickness: number; crosshairGap: number; crosshairLength: number;
  dynamicCrosshair: boolean; brakingHud: boolean; idealCompensation: boolean; volume: number;
  renderScale: number; antialias: boolean; showPerformance: boolean; behavior: Behavior;
}
export interface ShotEvent {
  timestamp: number; weapon: WeaponId; damage?:number; ads?:boolean; scopeZoom?:number; recoveryUntil?:number;penetratedLayers?:number; accuracyState?:string; horizontalDirection?:number; shotIndex: number; magazineShot: number; firstShot: boolean;
  position: Vec3; velocity: Vec3; direction: Vec3; aim: {yaw:number;pitch:number};
  recoil: {pitch:number;yaw:number}; spread: {base:number;movement:number;bloom:number;air:number;total:number;x:number;y:number};
  hit: HitZone; impact: Vec3; targetId: number | null; targetPosition: Vec3 | null; targetState: Behavior | null;
  targetGeneration: number | null; playerCompensation: {pitch:number;yaw:number};
  adsTransition?:number; targetElevation?:number; stoppedFor?:number; accurate: boolean; releaseTime: number | null; thresholdDelta: number | null;
  brakingKind: 'neutral' | 'opposite' | null; initialSpeed: number | null; brakingDuration: number | null; decelerationDuration: number | null;
  movementDirection: {x:number;z:number}; angularError: number | null;
}
export interface KillEvent {timestamp:number;targetId:number;generation:number;elapsed:number;firstShot:boolean}
export interface DirectionResponse {targetId:number;changeTime:number;latency:number}
export interface SessionData {
  footsteps?:{events:number;botHeardEvents:number;finalAccumulation:number;recent:import('./footsteps/Footsteps').FootstepEvent[]};

  operator?:{scopedShots:number;scopedHits:number;unscopedShots:number;unscopedHits:number;holdingSeconds:number;scopeTransitions:number;recoverySamples:number;recoverySum:number;highGroundShots:number;highGroundHits:number;missedRecoverySeconds:number;};
  peeking?:import('./tactical/DefenderAI').PeekReport;
  tactical?:{clears:number;deaths:number;maxExposure:number;lastDeath:import('./tactical/Exposure').ExposureDeath|null};
  drill?:import('../training/modes/TapDrill').DrillStats;
  runtime?:'browser'|'unreal';streamEvidence?:{schema:1;session:string;epoch:number;processedThrough:number;lastSequence:number;lostEvents:number;detailsComplete:boolean;endedNormally:boolean;};
  id: string; createdAt: number; mode: Mode; weapon: WeaponId; duration: number; seed: number; settings: Settings;
  shots: ShotEvent[]; kills: KillEvent[]; reactions: DirectionResponse[];
  tracking: {samples:number;onHead:number;errorSquared:number}; summary: SessionSummary; weaponTotals?:Record<'rifleA'|'rifleB'|'sheriff',WeaponTotals>&{operator?:WeaponTotals}; detailLimit?:number;
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
