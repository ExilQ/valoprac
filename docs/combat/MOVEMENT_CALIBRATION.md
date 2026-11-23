# Movement and footstep calibration

This update extends the existing 120 Hz movement core. Ground acceleration,
neutral stopping, reverse acceleration, weapon movement modifiers, and the
existing bullet-spread calculation remain authoritative. It does not replace
movement with a scripted peek or hop animation.

## Actual braking and sound recovery

`Movement.step()` publishes the previous velocity, current velocity, acceleration,
desired direction, previous speed, speed reduction, opposed-input diagnostic,
and `braking`. Braking requires grounded movement on both ends of the step,
previous horizontal speed above 0.08 m/s, a speed reduction over 0.0001 m/s,
deceleration over 0.1 m/s², and negative velocity/acceleration power below -0.01.
Pressing the opposite key alone does not satisfy these conditions.

`Footsteps.step()` receives that same movement instance after collision resolution.
It independently verifies the velocity reduction and power, and derives traveled
distance from resolved position changes. High-speed distance still crosses the
same audible-event thresholds. No braking recovery is deducted during eligible
audible-speed travel, including rapid repeated A/D movement.

Below the configured audible velocity, the provisional recovery rate is:

```
quietFactor = clamp(1 - max(resolvedSpeed, velocitySpeed) / audibleVelocity, 0, 1)
recoveryPerSecond = brakingDecay * (0.35 + 0.65 * quietFactor²)
```

`brakingDecay` is 1.4 gauge units/s. Recovery continues for at most 120 ms after
the last valid quiet braking step; renewed acceleration or leaving the ground
ends it. The normal stationary recovery is faster at 3.5 units/s after its
existing 120 ms delay. These recoveries use the greater applicable amount,
avoiding double subtraction. Walking retains its existing slow recovery and
does not reset phase when Shift changes.

The accumulator, actual emitted-event callbacks, hearing journal and minimap
indicators come from this single `Footsteps` object. The HUD reads this state;
it does not independently animate an estimated meter.

## Manual buffered jumps

The default input buffer is 80 ms, configurable from 0–140 ms. The minimum
takeoff interval is 80 ms. These are provisional VALOPRAC training values,
not verified native VALORANT constants.

Each new physical key press supplies one jump edge. Operating-system key repeat
and a continuously held Space key supply no new edge. An airborne edge can
remain queued only for the selected buffer duration; it cannot create a double
jump. A valid queued edge is consumed on actual floor/ramp/platform contact.
An expired edge is counted as a missed input. A new manual press shortly after
landing also works and records the time spent on the ground.

Takeoff happens before grounded friction, preserving existing horizontal
momentum. It adds vertical impulse without a free horizontal impulse. The
existing air acceleration is 3.5 m/s², with a 5.4 m/s wish-direction limit.
Current momentum changes progressively with directional input and mouse turning.
The total horizontal airborne cap is 5.5 m/s, a bounded 1.85% allowance above
the existing 5.4 m/s run speed. The cap also applies when no movement key is held.

Landing updates `landedAt`, even if an accepted input launches immediately in the
same step. The actual airborne flag and existing landing timestamp therefore
continue to drive weapon inaccuracy. No accurate airborne exemption is added.

Head collision uses the actual standing/crouching body height. A low ceiling
blocks standing up. Existing step/ramp support, side collisions and subdivided
horizontal displacement remain active during hopping. No invisible protected
or permanently airborne state is used.

## Reproducible software comparison

Run:

```
npx vitest run src/tests/movement-calibration.test.ts --reporter=verbose
```

The benchmark emits a JSON record named `movement-software-calibration`.
These measurements use 720 physics ticks, an obstacle-free plane and the same
initial 5.4 m/s forward velocity. The curved comparison turns the requested
direction at 0.65 rad/s. Its input driver emits a discrete pre-landing press;
it is a test fixture, not runtime automatic jumping.

| Six-second scenario | Traveled distance | Net displacement | Peak speed | Chained jumps |
| --- | ---: | ---: | ---: | ---: |
| Normal straight run | 32.400000 m | 32.400000 m | 5.4 m/s | 0 |
| Single jump, then run | 32.400000 m | 32.400000 m | 5.4 m/s | 0 |
| Straight chained jumps | 32.400000 m | 32.400000 m | 5.4 m/s | 10 |
| Curved chained jumps, 5.4 cap | 32.400000 m | 22.113478 m | 5.4 m/s | 10 |
| Curved chained jumps, 5.5 cap | 32.979785 m | 22.630027 m | 5.5 m/s | 10 |

Both chain comparisons have ten real landings and eleven takeoffs. Consecutive
landing intervals average 0.575 s. A test press 50 ms before landing preserves
100% of incoming horizontal speed. Zero grounded simulation ticks means a new
takeoff occurred at the real collision contact, not that landing was skipped.
The curved 5.5-cap trial travels 1.79% farther than its 5.4-cap comparison,
without unbounded acceleration. Its largest per-tick velocity-direction change
is 0.283081°, demonstrating that a camera turn does not instantly rotate momentum.

A separate mirrored 5.4 m/s counter-strafe comparison begins with gauge 0.7.
Both A→D and D→A first recover at 58.333 ms and last recover at 108.333 ms.
Each recovers 0.047466 gauge during actual braking. High-speed travel still adds
eligible distance; the counter-strafe does not grant a free complete reset.

These are measurements of this software implementation. Native-game movement
captures, exact VALORANT jump/air constants, physical input latency, GPU costs
and rendered frame times have not been measured by this benchmark. The existing
5.4 m/s ground profile is retained rather than presented as newly verified.
The 5.5 m/s cap is an explicit provisional choice supported by the bounded
comparison above; future native capture can replace it with a calibrated value.

## Integration and reset contracts

- `Simulation` sets `movement.profile.jumpBufferSeconds` from `jumpBufferMs`
  on creation and reconfiguration. It consumes `jump`/`jumpPresses` after each
  physics tick. `jumpHeld` is informative, not an automatic landing request.
- Browser input reset clears held keys and queued edges, and calls the optional
  `clearMovementInput()` integration hook. That hook clears the movement queue
  so blur, pointer-lock loss and pause cannot trigger a stale landing jump.
- `Movement.reset(position, time, preserveHopStats)` clears velocity, crouch,
  airborne/landing state, queued input, braking and jump timing. It preserves
  the movement profile; passing `true` retains bounded session hop analytics.
- `Footsteps.resetEncounter()` clears the meter, grace, recovery, transient
  ground state and audible-ring timer. It preserves callbacks, cumulative event
  counters, eligible distance and the bounded session journal. `recent()`
  includes only the new encounter; `historyRecent()` returns session history.
- `hopSnapshot()` deep-copies at most 64 events and exposes takeoffs, chains,
  missed inputs, landings, timing mean/deviation, contact duration, speed
  preservation and peak speed. It does not retain unbounded frame samples.

## Focused validation

```
npx vitest run src/tests/movement.test.ts src/tests/footsteps.test.tsx src/tests/input.test.ts src/tests/combat-movement.test.ts src/tests/movement-calibration.test.ts
```

Coverage includes mirrored braking, high-speed A/D sound, walk/run phase,
near-zero noise rejection, airborne rejection, encounter-history isolation,
zero/25/140 ms buffer boundaries, late manual presses, held-key rejection,
momentum, bounded steering, real ceiling/floor collisions, original ramps and
stairs, elevated re-jumps, airborne/landing spread, blur reset and bounded
analytics. Identical physics, sound events and hop analytics are verified with
60/144/240 Hz render schedules driving the same 120 Hz simulation.
