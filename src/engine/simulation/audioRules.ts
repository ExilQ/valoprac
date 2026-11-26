/** Mechanics introduced by rules audio-v8 (12.32). Part of the replay
 * calibration fingerprint, so changing a value requires a new ruleset. */
export const AUDIO_RULES=Object.freeze({
 /** Footsteps are audible above audibleVelocity x (weapon run speed / 5.4).
  * With 5.4 m/s weapons this is the old 2.7 m/s; with the knife (6.75 m/s)
  * it is 3.375 m/s, so knife walking (3.24 m/s) stays silent. */
 relativeFootstepThreshold:true,
 /** A jump's push-off is silent when crouch depth at takeoff is at least this.
  * Crouching takes 0.125 s (15 ticks) and the jump tick also crouches, so
  * 0.83 means crouch pressed at least 12 ticks (100 ms) before the jump; 11
  * ticks (92 ms) is still audible. A VALORANT 13.06 replay study heard jumps
  * at 86-94 ms of crouch lead and none at 101-102 ms
  * (BuddyKang/Valo_Study_SlientJump, n=10). */
 silentTakeoffCrouch:.83,
 /** A standing jump keeps up to 1.05 x the weapon's run speed. Earlier rules
  * capped it at 1.05 x 5.4 m/s, so knife jumps lost 16% of their speed. */
 weaponRelativeJumpSpeed:true,
});
