# F4 — expert held-angle response calibration

## Scope and provenance

This change implements F4 of the supplied October29,2026 improvement report.
The thresholds are **provisional trainer calibration**, not official VALORANT
values, measured native-game reaction times, rank distributions or human survival
data. The previous implementation is commit
`8abf7b173698be249882ab34562016e640df4b3e` (09.01).

`F4_MEASUREMENTS.json` retains both captures, all64 deterministic seeds, actual
shot times and ballistic survival outcomes. It is development evidence and is
not included in the application's initial download.

## Algorithm

`BotAimMotor.ts` exports `HELD_ANGLE_TIMING_CALIBRATION`, including issue/source
metadata. The existing skill reaction profiles remain unchanged. An expert-only
alternative response is `max(0.125, configuredReaction ×0.49)` seconds, before the
existing deterministic0.88–1.14 jitter. It applies only when the actual finite
angular motor is within3° of the newly visible aim point at detection. A surprise
outside that angle retains the existing0.55 expert reaction multiplier and150ms
response floor. Beginner, normal and advanced use their existing profiles.

`DefenderAI.ts` separately records detection, recognition, response deadline,
motor-start time, acquisition deadline, trigger deadline and physical firing time
on shot events. The classification is based solely on current visible information.
It does not reveal concealed locations, aim through walls, alter target hitboxes,
replace the motor or guarantee a headshot. Existing movement accuracy, fresh LOS,
burst decisions, recoil, ammo, scope readiness, bolt action, reload and cadence
still gate the actual shared weapon simulation. RNG consumption order remains
unchanged for ordinary profiles.

## Timing measurements

Environment: fixed120Hz simulation, one stationary rifleA defender20m away,
level ground, already-held yaw, player150HP for survival and1,000,000HP for timing
capture, seeds1–64, no reposition, no exposure-timer deaths. Default configured
reaction is0.42s; minimum configuration is0.15s. Values below include recognition,
actual motor movement and trigger confirmation; they are not bare slider values.

| Skill | Default median before→after | Minimum-configuration median before→after |
| --- | --- | --- |
| Beginner |0.6333→0.6333s |0.2833→0.2833s |
| Normal |0.3917→0.3917s |0.2333→0.2333s |
| Advanced |0.3417→0.3417s |0.2333→0.2333s |
| Expert, held angle |0.3167→0.2875s |0.2333→0.2083s |

The expert default64-seed range is0.2417–0.3250s. Minimum configuration range is
0.1667–0.2417s. The report's ≤0.30s default median and ≤0.22s configurable
held-angle target pass; these targets are not a requirement that every individual
trial fire before300ms or220ms. Normal/beginner/advanced timing arrays exactly
match the09.01 samples. Large45° surprises remain slower and do not receive the
held-angle response.

## Ballistic survival and cover

The test generates routes using actual grounded `Movement.step` strafe commands,
real acceleration and reversal, then supplies each collision-resolved position and
velocity to the AI. It uses a0.4m-thick concrete cover wall between defender and
player. Jiggle and wide-return routes manually reverse and return past their
starting cover position; overstay adds a0.9s exposed pause. The same64 seeds,
150HP, physical body intersections and penetration rules are used before/after.
This is a scripted input benchmark, not human testing or automatic gameplay peeking.

| Skill | Jiggle survival before→after | Wide-return survival before→after | Overstay survival before→after |
| --- | --- | --- | --- |
| Beginner |100→100% |100→100% |84.375→84.375% |
| Normal |100→100% |98.4375→98.4375% |56.25→56.25% |
| Advanced |93.75→93.75% |67.1875→67.1875% |28.125→28.125% |
| Expert |68.75→53.125% |62.5→68.75% |7.8125→1.5625% |

All beginner/normal per-seed health, shot count, exposure, first shot, death cause
and survival samples remain exactly identical. Expert survival is not necessarily
monotonic with earlier firing: an earlier shot samples a different physical body
position, recoil and follow-up schedule. The increase in wide-return survival is
retained as measured rather than replaced with a claim that faster always means
harder. All recorded deaths are ballistic; optional exposure elimination is off.
New obstruction tests verify zero shots and unchanged150HP when concrete cover
blocks the shorter response before its trigger deadline. Motor speed and
acceleration bounds remain enforced.

## Validation and limitations

- Dedicated F4 tests:4 pass, including64-seed timing/survival contracts, detailed
  timing stage order, angle eligibility, surprise delay and physical occlusion.
- Combined F4, existing combat-motor and existing defender/footstep suites:
  **33 tests pass in3 files**,0 failures.
- No existing tests were deleted or weakened.
- No movement, renderer, input handler, UI, deployment or public release metadata
  is changed by this F4 work. Root-stage integration reports the final version,
  full suite, build size and production state.
- Physical mouse-to-photon latency, headphones, native VALORANT and GPU frame
  timing were not measured in this AI fixture. No hardware-performance or human
  fairness equivalence is claimed. Normal/beginner fairness here means preservation
  of their actual09.01 behavior in these repeatable routes, not a population study.

Reproduce with Node24.22.1 and the existing dependencies:

```sh
npm test -- --run src/tests/f4-bot-calibration.test.ts src/tests/defender-latency-footsteps.test.ts src/tests/combat-ai-motor.test.ts
VALOPRAC_F4_CAPTURE=1 npm test -- --run src/tests/f4-bot-calibration.test.ts
```

The optional second command prints the complete `F4_EVIDENCE` JSON capture.
The three seed-controlled input routes are defined in the dedicated test.
