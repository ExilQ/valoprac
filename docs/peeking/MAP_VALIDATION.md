# Tactical Peeking Complex geometry validation

Validated on 2026-10-25 with `npx vitest run src/tests/peeking-geometry.test.ts`: **24 tests passed**.

The connected campus has eight training bays and eleven defender sectors. A central gallery, two rear galleries and both outside return routes connect the bays without teleporting the player. Each bay has a protected front approach and a rear approach. The vertical bay has a continuous twelve-riser staircase, a front ramp and a rear ramp. The mixed bay adds a separate elevated route and deliberate crossfire.

| Zone | Tactical purpose | Primary-route samples at ≤20 cm | Maximum primary threats |
| --- | --- | ---: | ---: |
| A | Wide swing, braking and exposure | 147 | 1 |
| B | Shoulder bait against a sniper | 148 | 1 |
| C | Brief information peeks and reversal | 148 | 1 |
| D | Crouch-dependent silhouette and cover heights | 147 | 1 |
| E | Physically performed jump information peek | 147 | 1 |
| F | Stair/ramp traversal and high-ground clearing | 212 | 1 |
| G | Three sequentially revealed sectors | 143 | 1 |
| H | Mixed-height routes and intentional crossfire | 147 | 2 |

## Checks performed

- Actual obstacle raycasts along 1,239 primary-route positions; every designed defender is revealable.
- Ground support, standing clearance and collision checks for the primary anchors, alternative anchors, the complete alternative-plus-x-jitter spawn envelope, and local defender navigation samples.
- Collision-clear circulation and protected entries. All player-body perception samples remain hidden at each entry while standing or crouching and facing either of two perpendicular directions.
- Real `Movement` controller traversal of all 18 front/rear/elevated exercise routes and all 21 circulation routes. These tests use ordinary walk input, acceleration, collision, stairs and ramps; they do not assign waypoint positions or play automatic peek animations.
- Real `Movement` traversal of all eighteen original entrances across the six existing tactical levels, including their stairs and ramps. Alternative defender positions remain grounded and clear of the additional cover.
- Zone G remains limited to one potential threat even when each defender independently chooses a bounded randomized spawn or local navigation position. A separate test uses the actual nine-sample player perception silhouette, standing and crouched, at ≤15 cm route spacing. This closes the gap where checking head-to-head visibility alone could miss exposed limbs.
- Zone D changes head-level visibility when crouching. Zone E changes information visibility during a physically valid jump. Actual controller tests verify the jump lands normally, the F stairs meet the balcony, and both elevated zones can be approached by their ramps.

`auditPeekingGeometry()` returns a structured schema-2 report with failed positions, spawn failures, exposure samples and worst sampled randomized threat counts. The G audit covers the actual combined randomization: alternative x offsets and x jitter can add together, producing a ±0.36 m spawn envelope rather than ±0.18 m around the primary anchor.

## Limits

These are deterministic collision, support and line-of-sight checks against the browser simulation. Visibility uses the defender perception samples and is an approximation of a human silhouette, not a rendered pixel-area calculation. Route and randomization checks are sampled and are not a mathematical proof of every continuous trajectory. They do not establish hardware performance, production rendering quality, current VALORANT parity or an AAA quality rating. Visual captures, real input checks and production verification must accompany the release review.
