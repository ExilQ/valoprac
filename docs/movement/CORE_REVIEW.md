# Independent movement trajectory review

Reviewed on 2026-10-28. The reviewed browser implementation uses the shared 120 Hz fixed simulation, a tactical air-control solver for the VALORANT-inspired profile, and projection-limited air acceleration for the Counter-Strike profiles. These are independently implemented provisional trainer profiles, not verified native game constants or an exact CS2 sub-tick simulation.

## Reproducible checks

Run `npx vitest run src/tests/movement-trajectories.test.ts --reporter=verbose`.

The focused suite passed **42 tests**. It emits one JSON line with `benchmark: "dual-movement-trajectories"`, containing measured rows A–G and six render-schedule comparisons. The release audit captured the full log and extracted JSON outside the source tree as `movement-qa/trajectory-tests.log` and `movement-qa/trajectory-metrics.json`.

| Requested check | Verification |
| --- | --- |
| A, B: fixed-camera left/right steering | Real airborne positions, horizontal velocities and trajectory headings change in the requested direction for both profiles. |
| C: mouse-assisted air strafing | Both turning directions change the horizontal wish basis, velocity and curved trajectory; compared with the corresponding fixed-yaw path. |
| D: airborne direction reversal | The next tick accelerates against the previous lateral direction without reversing velocity instantly; subsequent ticks produce a genuine reversal. |
| E: no air input | Horizontal momentum persists; gravity produces ascent, an airborne apex, descent and one real floor landing. |
| F: consecutive jumps | Four discrete landing-timed jumps produce three chains and three landings. Holding Space across several contacts produces exactly one jump. |
| G: profile comparison | The same movement intent yields distinct measured turning, displacement, flight duration, contact speed and braking. |
| H: collision safety | Actual Movement integration is checked against a thin wall, ceiling, existing tower stairs and an authored ramp. Wall tangential momentum survives; ceilings do not create a grounded apex or repeated takeoff. |
| Additional edge regressions | Zero-buffer grounded input is accepted at its real within-tick timestamp; stale requests stay expired. Adjacent ramp/platform contacts never teleport the player, standing headroom blocks traversal, crouching permits it, and low-speed crouch+walk reaches its intended speed. Two-millisecond pulses produce fractional rather than full-tick impulses. |
| Frame scheduling | At each of 60, 144 and 240 Hz rendering, all 300 recorded 120 Hz trajectory samples exactly equal the 120 Hz rendering reference, for both profiles. The input stream includes short taps, timestamped yaw changes, jumps and a direction reversal. |

Check I, the full weapon/audio/AI/analytics regression suite and browser UI verification, belongs to the release-level audit; passing these focused tests alone does not establish those results.

## Measured examples

After running forward to full speed, jumping, and applying left input for 22 fixed ticks (0.1833 s; the requested 0.18 s rounds to the nearest fixed tick):

| Measurement | VALORANT-inspired | CS2-inspired |
| --- | ---: | ---: |
| Lateral displacement | −0.17366 m | −0.14450 m |
| Lateral velocity | −1.77847 m/s | −0.80000 m/s |
| Horizontal heading | −0.32928 rad | −0.14708 rad |

For the comparison that steers left for 22 ticks and then releases directional input:

| Measurement | VALORANT-inspired | CS2-inspired |
| --- | ---: | ---: |
| Air time after the takeoff tick | 0.56667 s | 0.71667 s |
| Horizontal speed at first contact | 5.50000 m/s | 5.45894 m/s |
| Speed after eight further contact ticks | 3.13542 m/s | 3.29891 m/s |
| Remaining time to slow below 0.05 m/s | 0.12500 s | 0.28333 s |

The last row starts **after** those eight contact ticks. It is not total stopping time from landing. Contact speed happens to be close in this sequence; the observed 0.04106 m/s difference is recorded honestly and is not presented as the main distinction between profiles.

The CS2-inspired profile also preserves an externally seeded airborne horizontal velocity above 10 m/s when no wish acceleration is allowed, proving that there is no whole-vector airborne speed clamp. A grounded takeoff separately enforces its finite contact limit. Rapid jump requests invoke the timing penalty instead of generating automatic hops. The explicitly labeled classic Source preset has a different, finite takeoff limit and manual timing buffer.

## Limits

These tests measure simulation trajectories, not GPU performance, display latency, mouse-device latency, or native-game parity. They do not claim a hardware FPS improvement. Input axes are integrated over fixed ticks; opposing pulses within a single tick can average out. Mouse look remains immediate, while movement uses the timestamped yaw applicable to each fixed tick.
