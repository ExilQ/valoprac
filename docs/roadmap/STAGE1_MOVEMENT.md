# Stage 1 — F1/F2 movement calibration; F9/F10 reference hold

## Evidence classification

All F1/F2 equations and targets in this change are **provisional calibration**, based on the supplied October 29 report. No native VALORANT recording or first-party source establishes these equations. The runtime configuration exports explicit evidence metadata in `MOVEMENT_CALIBRATION_EVIDENCE`. F9 walking ratio and F10 walking-landing behavior remain unchanged pending a reproducible reference-game experiment.

## Current baseline and measured change

Before editing, immutable 09.01 commit `8abf7b173698be249882ab34562016e640df4b3e` was checked out at `/workspace/roadmap-baseline`. Actual deterministic movement was measured at 120 Hz using the same input sequence as the updated engine. This replaces the report's older 9.0 observations as the current baseline.

| Measurement | 09.01 before | Updated |
| --- | ---: | ---: |
| Jump apex | 0.729583 m | 1.149970 m |
| Reported takeoff-to-contact interval | 0.566667 s | 0.641667 s |
| Repeated jump interval | 0.575 s (old profile) | 0.650 s |
| Walking held-forward airborne speed | 2.592 m/s | 2.592 m/s |
| Crouching held-forward airborne speed | 1.944 m/s | 1.944 m/s |
| Operator held-forward airborne speed | 5.130 m/s | 5.130 m/s |
| Rifle ADS held-forward airborne speed | 4.104 m/s | 4.104 m/s |
| Operator scope held-forward airborne speed | 3.6936 m/s | 3.6936 m/s |
| Full-run tactical steering ceiling | 5.500 m/s fixed | 5.670 m/s maximum, takeoff dependent |
| Same-height impact velocity | 5.150 m/s | 7.186632 m/s sampled at contact tick |

09.01 had already corrected the large held-forward walk/crouch/weapon jump boost. F1 now adds a frozen, auditable takeoff budget that also bounds sideways/mouse-assisted steering and prevents releasing walk/crouch or switching weapons in midair from refilling the budget.

Takeoff metadata records actual horizontal velocity, state, position, weapon ID, unscoped weapon run speed and ADS state. The budget is `min(takeoffSpeed + 0.75, weaponRunSpeed * 1.05)`, additionally respecting an explicitly lower custom profile ceiling. It is fixed for that jump. The existing vector projection acceleration and movement-state wish-speed restrictions remain in force. At a desired/current direction difference of 150° or more, the acceleration impulse is multiplied by 0.5; velocity is never replaced by the requested direction. At 120 Hz this measures 0.0416667 m/s per reverse input tick versus 0.0833333 m/s at 149°.

F2 uses `gravity = 22 m/s²` and `jumpImpulse = sqrt(2 * gravity * 1.15) ≈ 7.113368 m/s`. Tactical vertical displacement uses the exact constant-gravity equation, including the transition to terminal velocity, rather than a first-order integration offset. The theoretical apex is 1.15 m and theoretical flight is about 0.64667 s. Measured simulation timestamps are quantized to a 1/120 s contact tick; repeated jumps occur 0.65 s apart. The tests also evaluate 60 and 240 Hz integration to detect accidental tick-rate-dependent apex changes.

`MOVEMENT_PHYSICS_VERSION` changes to `dual-movement-1.1.0`, keeping old/new physics records separate in existing analysis fingerprints.

## Tests and regression coverage

- New `roadmap-stage1-movement.test.ts`: 24 tests for actual takeoff metadata, slow-state budgets, weapon switching, stationary-jump control, 149°/150°/151°/180° reverse steering, real Simulation integration, immutable snapshots, 60/120/240 Hz ballistic arcs, ceiling collisions, no accidental double jump, elevated routes, terminal velocity, and explicit evidence classification.
- 180 affected tests in 8 files passed; no failures. Full application-suite status is recorded by the release owner.
- Counter-Strike remains isolated: both CS2 and Source Classic preserve the exact SHA-256 of all 600 position/velocity/contact samples captured from immutable09.01. Both keep the original semi-implicit vertical integration and projection-based air solver.
- Existing stairs, ramps, elevated support, low ceilings, wall sliding, manual chaining, jump buffers, per-map traversal, airborne accuracy and footstep invariants remain covered.
- Three old assertions were calibrated to their original intent: the air cap reads the profile instead of an obsolete hard-coded5.5; the cross-profile comparison uses measurable post-F2 flight/travel differences and normalized landing retention; the platform-gap test waits for actual bounded ground contact rather than assuming the old68-tick flight.

## Files

- `src/config/movement.ts`: provisional constants, integration mode, physics version and evidence metadata.
- `src/engine/movement/Movement.ts`: takeoff capture, frozen cap, weapon context and ballistic vertical displacement.
- `src/engine/movement/MovementSolvers.ts`: tactical-only reverse steering and takeoff budget.
- `src/engine/simulation/Simulation.ts`: one production weapon-context call before movement integration.
- `src/tests/roadmap-stage1-movement.test.ts`: new acceptance tests.
- `src/tests/combat-movement.test.ts`, `movement-trajectories.test.ts`, `mechanics-maps.test.ts`: existing calibration-sensitive assertions updated without removing test cases.

## Limits and follow-up

- These are software trajectories, not independently measured reference-game values.
- F9 remains0.48; native running/walking capture with distance and time uncertainty is required before changing it.
- F10 remains impact based. The higher physical impact is passed through the existing independent landing stream, preserving one contact event and no artificial silent-jump rule. Native walk/crouch/running material captures are still required.
- Geometry, cover, hitboxes, navigation and ordinary ground movement constants were not edited.
- No physical GPU, speaker/headphone listening or end-to-end input-latency measurement was available. Trajectory timings must not be presented as GPU/FPS evidence.
- Build size, final stage gate, patch version and deployment are completed and reported by the release owner.

Machine-readable before/after evidence: `STAGE1_MOVEMENT.json`.
