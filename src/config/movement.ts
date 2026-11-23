// Provisional SI-unit profile, not measured or verified VALORANT constants.
export interface MovementProfile {
  maxSpeed:number; groundAcceleration:number; groundDeceleration:number; friction:number;
  reverseAcceleration:number; lateralModifier:number; backwardModifier:number; walkModifier:number; crouchModifier:number;
  airAcceleration:number; airMaxSpeed:number; jumpImpulse:number; gravity:number; accuracyVelocityThreshold:number;
  standingEyeHeight:number; crouchingEyeHeight:number; radius:number;
}
export const MOVEMENT: MovementProfile = {
  maxSpeed:5.4, groundAcceleration:38, groundDeceleration:20, friction:3.5, reverseAcceleration:45,
  lateralModifier:1, backwardModifier:0.92, walkModifier:0.48, crouchModifier:0.36,
  airAcceleration:3.5, airMaxSpeed:5.4, jumpImpulse:5.2, gravity:18, accuracyVelocityThreshold:0.65,
  standingEyeHeight:1.64,crouchingEyeHeight:1.12,radius:0.28
};
