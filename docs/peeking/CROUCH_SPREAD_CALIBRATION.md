# Crouch-moving spread correction

Calibration: `crouch-motion-1.0.0`; official historical notes retrieved 2026-10-26.

The previous implementation obtained crouch-moving accuracy by multiplying the standing velocity curve by the stationary crouch multiplier. At the movement controller's resolved full-crouch speed of 1.944 m/s, that produced approximately 1.50° Vandal, 1.40° Phantom and 0.66° Sheriff. This conflated stationary crouch accuracy and a separate moving posture.

The weapon profiles now carry independent `crouchMovingSpread` values: Vandal/Phantom 0.8°, Sheriff 0.5°. The stationary `crouchSpread` factors, standing walking/running endpoints, recoil, ADS multiplier, bloom, airborne penalty and landing penalty remain separate. Operator's dedicated spread path is unchanged.

| Reference | Published change | Applied scope |
| --- | --- | --- |
| [Riot patch 2.02, 2021-02-02](https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-2-02/) | Rifle crouch-moving error 0.3 → 0.8 | Vandal and Phantom |
| [Riot patch 9.10, 2024-11-19](https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-9-10/) | Moving-while-crouching inaccuracy 0.1 → 0.5 for pistols except Shorty | Sheriff |

The 9.10 notes also state rifle walking/running values of 3/6; those existing VALOPRAC endpoints remain unchanged. The pistol crouch change is listed for all pistols except Shorty, while the note preserves Sheriff/Frenzy's distinct other movement values.

## Units and mapping

VALOPRAC's existing trajectory API uses **half-cone angles in degrees**. These new values author the **total no-bloom hip-fire half-cone** at full crouch speed: a 0.8° radius corresponds to a 1.6° full angular width. They are not added again to stationary spread, halved, or doubled before sampling. The published patch notes do not formally define the geometric cone convention or the engine's composition of separate inaccuracy terms; this is an explicit, versioned mapping into this browser trainer, not a claim of native-game equivalence or exhaustive confirmation of all later patches.

## Actual movement, transitions and braking

The crouched curve starts at the stationary crouch radius while resolved speed is below the existing accuracy threshold, then rises to its authored endpoint at the movement profile's full crouch speed. The actual crouch pose amount continuously blends standing and crouched curves. Residual velocity above normal crouch speed retains an additional penalty; pressing crouch during a fast movement cannot instantly grant the endpoint's precision. A slower crouch walk can have less error, and releasing a key does not erase movement error before velocity decays.

Executable checks in `src/tests/crouch-spread.test.ts` drive the real movement controller to its crouch speed, verify all three independent endpoints and random sample bounds, preserve standing/walk/run/stationary values, exercise actual braking, and check posture blending and independent penalties. They do not measure native VALORANT bullet distributions or human performance.
