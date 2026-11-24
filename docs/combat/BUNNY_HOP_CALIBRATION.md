# VALOPRAC bunny-hop calibration

Version 12.19 runs this calibration at a deterministic 120 Hz.

## Reference observations

| Evidence | Observation used | Limit |
| --- | --- | --- |
| [Stark002002's 240 fps analysis](https://www.reddit.com/r/VALORANT/comments/utc7qf/) and [updated measurement notes](https://docs.google.com/document/d/e/2PACX-1vTsGYzGYiO78fcr_frhhBmzDaMvEqgBRd3b5u7TNzXRAhKflvFOovleWmavebIfFywh3DHppT75xHAk/pub) | The notes time a level jump at 0.676 s and revise gravity to 2,045 units/s² and launch speed to 690.2 units/s. | Community measurements from 2022. The original height estimate used wall marks and crouch displacement. |
| [xlzqwerty1's raw frame counts](https://www.reddit.com/r/VALORANT/comments/vgare6/) and [linked side-by-side video](https://www.youtube.com/watch?v=HsHDQaNnOwI) | 427 running frames versus 400 hopping frames at 60 fps, from the same archway to the teleporter exit. | A single knife-out range comparison. The author describes a possible start offset. Key and mouse telemetry are unavailable. |
| [Woohoojin's air-strafe lesson](https://www.youtube.com/watch?v=nm_n2lvHbsM) | Running entry, W held through takeoff, one lateral key, a smooth turn in the same direction, and a new jump input at contact. | Explains a repeatable input sequence. The lesson does not quantify air acceleration or mouse counts. |
| [Community hopping demonstration and discussion](https://www.reddit.com/r/VALORANT/comments/uyem6z/) and [2026 Sunset jump walkthrough](https://www.reddit.com/r/VALORANT/comments/1vvcwac/sunset_b_jump_isnt_randompixel_perfect/) | Side-key-only turns and running entry are useful variants. An Icebox comparison reported in the discussion gives a similar order of magnitude for a straight route. | Setup, input timing, patch, and geometry vary. These are qualitative cross-checks. |
| [Riot's 1.02 notes](https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-1-02/) | Riot describes a slowdown triggered by bullets and utility. | The patch supplies no ordinary, untagged bunny-hop coefficients. |

The archived report quoting Volcano's early Twitch stream suggests a ceiling around 10%. The VOD is unavailable, so the ceiling here is a model assumption. [Archived discussion](https://www.reddit.com/r/VALORANT/comments/g0hchv/psa_bunnyhopping_gives_up_to_a_10_speed_bonus/)

## Reconstruction

The study's unit convention gives a launch speed of 6.902 m/s and gravity of 20.45 m/s². A ballistic trajectory then has an apex of 1.16473 m and a level-flight time of 0.67501 s. The simulation checks collision at 120 Hz, so support detection may land up to one tick after the analytic crossing.

The route pace target is dimensionless. Over an identical route, the average hop pace divided by the run pace is 427/400, or 1.0675. That ratio cannot identify a peak speed or unique acceleration. Two independent endpoint choices per timing give a simple worst-case frame sensitivity of 425/402 to 429/398, or 1.057 to 1.078, before any start bias.

At full running takeoff, the solver retains its existing continuous heading response and adds a small acceleration along the present velocity. The extra acceleration scales with the captured weapon running speed and the forward diagonal input fraction. It requires a signed cut into the selected side and positive alignment with current momentum. Straight travel contributes zero. The angular term peaks when the movement request leads the velocity by 45°. A normal ground step resumes the normal running speed controller.

The fitted gain is 0.12 per second of running speed at maximum alignment. It approximates the public ratio under three synthetic left-right camera sweeps. Their world-space diagonal intent centers at 5°, 8°, and 10° to either side of the route, with 16°, 18°, and 20° sweeps. The public route has no input recording, so these schedules are explicit assumptions. A fast, unscoped running takeoff can reach a modeled ceiling of 1.10 times weapon run speed. Walking, crouching, ADS, slow starts, and drops do not qualify for the added acceleration. Tightly chained jumps preserve existing momentum within the speed cap.

## Reproduction

`pnpm exec vitest run src/tests/bunny-hop-calibration.test.ts` runs the real Movement integration on a flat route, compares 12.18 with 12.19, and prints apex, flight time, peak speed, and normalized travel pace. Rendering cadence, collision, input buffering, and replay compatibility remain covered by the existing automated suite.
