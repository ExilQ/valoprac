// Provisional SI-unit profile, not measured or verified VALORANT constants.
export interface MovementProfile {
  maxSpeed:number; groundAcceleration:number; groundDeceleration:number; friction:number;
  reverseAcceleration:number; lateralModifier:number; backwardModifier:number; walkModifier:number; crouchModifier:number;
  airAcceleration:number; airMaxSpeed:number; jumpImpulse:number; gravity:number; accuracyVelocityThreshold:number;
  /** Provisional manual jump controls. They do not enable hold-to-bhop. */
  jumpBufferSeconds?:number; jumpCooldown?:number; hopSpeedCap?:number;
  standingEyeHeight:number; crouchingEyeHeight:number; radius:number;
}
export const MOVEMENT: MovementProfile = {
  maxSpeed:5.4, groundAcceleration:38, groundDeceleration:20, friction:3.5, reverseAcceleration:45,
  lateralModifier:1, backwardModifier:0.92, walkModifier:0.48, crouchModifier:0.36,
  airAcceleration:10, airMaxSpeed:5.4, jumpImpulse:5.2, gravity:18, accuracyVelocityThreshold:0.65,
  jumpBufferSeconds:.08,jumpCooldown:.08,hopSpeedCap:5.5,
  standingEyeHeight:1.64,crouchingEyeHeight:1.12,radius:0.28
};

export type MovementPhysicsId='valorant'|'counterStrike';
export const MOVEMENT_PHYSICS_VERSION='dual-movement-1.0.1';
export type CounterStrikePreset='cs2'|'sourceClassic';
export interface MovementPhysicsSettings {movementPhysics:MovementPhysicsId;csMovementPreset:CounterStrikePreset;jumpBufferMs:number;}
/** Independent SI calibration. Source projection/ground-friction principles
 * and the 2026 CS2 timing rules inform the algorithms, not exact native values. */
export interface MovementPhysicsProfile extends MovementProfile {
 id:MovementPhysicsId;label:string;preset:CounterStrikePreset|null;
 groundModel:'tactical'|'source';airModel:'tactical'|'projection';
 airWishSpeedCap:number;airSpeedLimit:number|null;groundStopSpeed:number;
 landingFriction:number;landingImpactPenalty:number;landingWindow:number;
 jumpSpeedLimit:number|null;jumpSpamWindow:number;jumpSpamPenalty:number;
 maxSlopeCos:number;stepHeight:number;
}
export const VALORANT_PHYSICS:MovementPhysicsProfile={...MOVEMENT,id:'valorant',label:'발로란트 물리엔진',preset:null,groundModel:'tactical',airModel:'tactical',airWishSpeedCap:5.4,airSpeedLimit:5.5,groundStopSpeed:0,landingFriction:0,landingImpactPenalty:0,landingWindow:.08,jumpSpeedLimit:5.5,jumpSpamWindow:0,jumpSpamPenalty:0,maxSlopeCos:Math.SQRT1_2,stepHeight:.3};
export const CS2_PHYSICS:MovementPhysicsProfile={...MOVEMENT,id:'counterStrike',label:'카운터 스트라이크 물리엔진',preset:'cs2',groundModel:'source',airModel:'projection',groundAcceleration:5.5,groundDeceleration:0,friction:5.2,reverseAcceleration:5.5,groundStopSpeed:2,backwardModifier:1,walkModifier:.52,crouchModifier:.34,airAcceleration:12,airMaxSpeed:5.4,airWishSpeedCap:.8,airSpeedLimit:null,jumpImpulse:7.4,gravity:20.32,jumpBufferSeconds:.04,jumpCooldown:.1,hopSpeedCap:5.94,accuracyVelocityThreshold:.81,landingFriction:.08,landingImpactPenalty:.008,landingWindow:.08,jumpSpeedLimit:5.94,jumpSpamWindow:.08,jumpSpamPenalty:.08,maxSlopeCos:Math.SQRT1_2,stepHeight:.3};
export const SOURCE_CLASSIC_PHYSICS:MovementPhysicsProfile={...CS2_PHYSICS,preset:'sourceClassic',airAcceleration:20,airWishSpeedCap:1.2,airSpeedLimit:null,jumpBufferSeconds:.08,jumpCooldown:.025,hopSpeedCap:20,jumpSpeedLimit:20,landingFriction:0,landingImpactPenalty:0,landingWindow:.14,jumpSpamWindow:0,jumpSpamPenalty:0};
export function resolveMovementPhysics(settings:MovementPhysicsSettings):MovementPhysicsProfile{
 const base=settings.movementPhysics==='counterStrike'?(settings.csMovementPreset==='sourceClassic'?SOURCE_CLASSIC_PHYSICS:CS2_PHYSICS):VALORANT_PHYSICS;
 const requested=Math.max(0,Math.min(140,Number.isFinite(settings.jumpBufferMs)?settings.jumpBufferMs:80))/1000;
 // The CS2-inspired window is centered on contact: the early buffer is at
 // most half of the total window. The late half never enables automatic hops.
 return{...base,jumpBufferSeconds:base.preset==='cs2'?Math.min(requested,base.landingWindow/2):requested};
}
