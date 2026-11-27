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
