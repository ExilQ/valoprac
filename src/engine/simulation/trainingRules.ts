/** Mechanics introduced by rules training-v7 (12.31). Part of the replay
 * calibration fingerprint, so changing a value requires a new ruleset. */
export const TRAINING_RULES=Object.freeze({
 /** Crouching in the air raises the feet by this much (m) instead of lowering
  * the eyes; uncrouching lowers them again where there is room. */
 airCrouchTuck:.5,
 /** Gunfire audibility (m). The Phantom is suppressed: the official wiki says
  * its shots cannot be heard beyond 40 m except in the firing direction. */
 gunfireRadius:60,suppressedGunfireRadius:40,
 /** Bots return this long after elimination unless settings say otherwise. */
 defaultRespawnDelay:3,
});
