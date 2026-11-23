# Character collision audit

The `materials-v3` rules use continuous square-footprint sweeps. Ground movement
sweeps both horizontal axes together, updates support between accepted risers,
and clips velocity along walls. Air movement sweeps horizontal and vertical
travel together against solid boxes and ramp planes. A ceiling crossed between
tick endpoints now clips upward velocity even when the final horizontal pose is
already beyond that ceiling.

`legacy-v2` retains the original point-support, axis-sweep and split vertical
integration path. The current movement calibration identifier is
`dual-movement-1.2.0`; legacy recordings and practice poses use
`dual-movement-1.1.0`. Rule selection happens before playback. Existing ground
acceleration, jump impulse/gravity, takeoff air-speed budget, reverse steering,
CS2 projection rules and Source Classic momentum limits were not retuned.

## Reproduced defects and measurements

The focused tests compare both rule paths with the same inputs. The legacy path
is preserved from frozen baseline `0029c16`. Full output is in
[COLLISION_RESULTS.json](COLLISION_RESULTS.json).

| Probe | Legacy result | Current result |
| --- | --- | --- |
| Steep descending wedge, x=-1, vx=100000, dt=1 | x=99999: tunnels through | x=-0.28, vx=0 |
| Thin diagonal corner at extreme speed | x=z=99999: skips corner | x=z=-0.28, both axes stopped |
| Three 20 cm risers, vx=50, dt=.08 | x=.65517, y=0: stalls | x=3, y=.6 |
| 1 cm tread, minimum landing width 10 cm | Accepts 20 cm support | Stops before tread |
| Same tread, minimum landing width 5 mm | Accepts | Accepts at y=.2 |
| Airborne steep slope after 1.5 seconds, VALORANT | Suspended at y=1.5, z=-.5 | Slides to ground, z=.299631 |
| Airborne steep slope after 1.5 seconds, CS2 | Suspended at y=1.5, z=-.5 | Slides to ground, z=.604718 |
| Source Classic transient ceiling corner, one 120 Hz tick | y=.166922, vy=6.830667: misses underside | y=.14, vy=0 |

Additional regressions cover obstacle-array order, genuine standing/crouched
headroom and square-footprint overhang support. An earlier blocking wall always
wins over a later reachable step, including when the obstacle array is reversed.
The extreme-speed tests deliberately exceed gameplay speed to exercise the
bounded-subdivision fallback. They are software stress probes, not native-game
measurements.

## Contact contract and configuration

The footprint remains an axis-aligned square with half-width `profile.radius`.
This preserves authored tactical widths and angles. It was not replaced with a
capsule. Flat tops support a body while positive footprint overlap remains.
Support normals come from the actual authored top plane, and steep contacts
remain physically solid without becoming grounded landings.

`MovementPhysicsProfile.stepMinLandingWidth` defaults to `.1` metres in all
three presets. `HorizontalCollisionOptions.minLandingWidth` overrides it for a
standalone solver. A step must expose at least this much authored landing span
on both horizontal axes. This is a tread-size requirement; it is not an overlap
percentage. Narrow surfaces still catch an airborne landing physically. This
keeps a thin sliver from providing an automatic step while allowing an explicit
jump onto real geometry.

Walkable ramps retain their centre-plane foot anchor. A matching adjoining
platform is ignored as support until the centre reaches the shared ramp edge,
so the player's radius does not introduce an artificial upward stair at the
join. Steep ramps use the high footprint edge consistently for support and
sweep solidity, which permits gravity-projected downslope motion instead of
repeatedly rejecting that motion as penetration.

Ground traversal bounds geometric subdivision at 512 pieces and sliding at 8
contacts per piece; airborne traversal bounds sliding at 12 contacts. Exhausting
a contact budget discards the remaining travel conservatively. Airborne sweeps
use the fixed tick's integrated vertical displacement as a segment; the tactical
profile still computes that displacement with its existing exact constant-gravity
formula. Registered immutable map arrays use the shared static broadphase;
custom mutable obstacle arrays retain a linear fallback.

## Validation

`src/tests/physics-materials-collision.test.ts` adds 11 mechanical regression
cases. The affected movement, contact, landing, air, combat and input suite
passed **240 tests in 15 files**, including the existing 1.15 m apex, air budget,
reverse steering and render-schedule equality checks. `tsc -b` passed. Existing
trajectory output measures the VALORANT apex at `1.1499695016912355` m and keeps
60/144/240 Hz render schedules identical at the fixed 120 Hz simulation rate.

Run the affected suite with:

```sh
./node_modules/.bin/vitest run src/tests/movement*.test.ts src/tests/air-zoom-corrections.test.ts src/tests/landing-sounds.test.ts src/tests/input-movement-tools.test.ts src/tests/combat-movement.test.ts src/tests/roadmap-stage1-movement.test.ts src/tests/physics-materials-collision.test.ts
./node_modules/.bin/tsc -b
```

These checks establish deterministic software behavior. The calibration remains
provisional and is not a claim of verified VALORANT, CS2 or Source engine constants.
