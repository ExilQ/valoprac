/** Mechanics introduced by rules consistency-v9 (12.34). Part of the replay
 * calibration fingerprint, so changing a value requires a new ruleset. */
export const CONSISTENCY_RULES=Object.freeze({
 /** Every air speed cap (takeoff budget, hop cap, air limit) scales with the
  * takeoff weapon's run speed / 5.4 when that is faster, whatever the takeoff
  * state: knife jumps keep 6.75 m/s backwards, crouching or chaining too. */
 weaponRelativeAirCaps:true,
 /** Landings below this vertical impact (m/s) are silent. A full jump on flat
  * ground lands at 6.90 m/s and is heard; a jump taken already crouched and
  * stood up in the air lands earlier at about 5.4-5.5 m/s and is silent, as
  * in the community-known VALORANT crouch-jump trick. Equivalent drop height
  * with 20.45 m/s^2 gravity: 0.88 m. */
 silentLandingBelow:6,
});
/** acceleration-v10 (12.35): ground acceleration toward the wished speed, m/s^2.
 * 2048 cm/s^2 is the Unreal character default; a stop-to-run then reaches 95 %
 * of 5.4 m/s in 0.25 s, against 0.14 s with the earlier 38 m/s^2. Braking
 * and counter-strafing (reverse acceleration) are unchanged. */
export const RECOVERY_GROUND_ACCELERATION=20.48;
