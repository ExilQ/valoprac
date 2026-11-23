# Combat AI calibration — human-motor-1.0.0

This update replaces the former per-shot random target offset with a deterministic continuous controller. It does not use an external model, online learning, a hit-probability roll, licensed human traces, or a claimed VALORANT rank model. Human playtesting participants: **0**. All difficulty and motor values below are provisional VALOPRAC training choices.

## Authoritative simulation

`DefenderAI.ts` retains the existing renderer-facing `state`, `face`, `pose`, `aim` and `lastShot` fields. Its functional stages are perception/history, reaction/admission, `BotAimMotor`, burst utility, shared `Weapon`, collision/damage, and the existing supported cover navigation. The production fixed clock runs at 120 Hz. Rendering at 60, 144 or 240 Hz does not change the simulated rays or seeded decisions.

Perception performs a 20 Hz horizontal-FOV/range check and nine physical body-sample visibility tests. It records only visible samples, dated player position and observed velocity. A one-ray obstruction check invalidates a previously visible sample between perception updates; ordinary shot admission requires a fresh full sight check. Vision never uses penetrability: wood blocks perception even when a bullet can cross it.

A fresh encounter proceeds through detection, completed recognition, reaction, motor initiation, acquisition and trigger execution. Recognition takes 35 ms. Reaction is the configured delay times a bounded, once-per-contact 0.88–1.14 multiplier. The acquisition window adds 150–400 ms based on profile and initial angular displacement; trigger execution adds 45–85 ms. A fresh-contact admission floor of 450 ms also protects manually lowered reaction controls. These timers admit an attempt; the finite motor and real weapon may delay it further. A short re-peek may retain a valid old contact, but still requires physical LOS, finite correction and a renewed 120 ms firing admission window after a meaningful interruption.

## Profiles and independent controls

The UI changes `defenderSkill`; it does not overwrite the independent settings. Profile multipliers apply to the current controls. Default base controls are reaction 420 ms, angular speed 180°/s, acceleration 1200°/s², stability 0.70, initial error 0.8°, recoil control 0.60 and tactical quality 0.55.

| Skill | Reaction multiplier | Speed | Acceleration | Tracking delay | Initial error multiplier | Base acquisition |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Beginner | 1.45 | 117°/s | 780°/s² | 220 ms | 1.65 | 240 ms |
| Normal | 1.00 | 180°/s | 1200°/s² | 140 ms | 1.00 | 180 ms |
| Advanced | 0.82 | 216°/s | 1440°/s² | 100 ms | 0.72 | 150 ms |
| Expert | 0.70 | 252°/s | 1620°/s² | 75 ms | 0.50 | 130 ms, subject to the 150 ms minimum |

Angular speed and acceleration in the table use default independent values. The motor also decelerates when approaching its target; it does not teleport between headings. A once-per-contact signed initial error produces over/undershoot and a later smooth correction. Small bounded variation refreshes every 160 ms and is low-pass filtered; it is not sampled independently for every bullet. Sustained bursts increase its amplitude. `defenderAccuracy` scales continuous initial error rather than granting hit/miss outcomes.

Tracking follows old visible observations and at most 55 ms of bounded prediction using the old measured velocity. A concealed direction reversal is not known. After cover, the controller freezes the last observed point, gradually increases uncertainty and expires visual location memory after 1.5 seconds. Actual audible footstep events retain their emitted location for up to 2.2 seconds; held movement keys are not observations.

## Real weapons, recoil and ammunition

Every defender owns an actual `Weapon` instance with separate seeded spread/recoil streams. The same `WEAPONS` data, `Weapon.step`, `Weapon.calculateSpread`, `Recoil.kick`, recovery, magazine and reload restrictions used by the player also apply to the bot. The spread adapter receives collision-resolved bot velocity, stance and grounded state. Disciplined bots brake before firing; low-tactical-quality bots may fire before completely stopping and receive the resulting spread. The selected infinite-reserve setting applies to bot reserves; a finite exhausted reserve cannot create more bullets. Bots handle their own reload decisions.

Each shot uses the **pre-shot** controlled motor orientation plus imperfect compensation, actual weapon recoil and the shared angular spread basis. The current shot then kicks the weapon for the next shot. The compensation controller never clears the physical recoil state. It receives 25 Hz historical feedback after a skill/familiarity-dependent recognition delay (132 ms for the default normal rifle), has limited correction speed, and retains less than 100% correction gain (0.60 for the default rifle, 0.564 Sheriff, 0.54 Operator). Residual climb, yaw switching, misses and recovery are real trajectory effects.

Rifle utility chooses long-range taps, medium short bursts and close sprays. It also uses observed motion, current angular confidence, residual recoil, available magazine, repeated-peek risk, difficulty and physical incoming impacts. Large residual error or repeated misses can interrupt fire for a recovery pause. Sheriff triggers are deliberate separate presses at least 650 ms apart. Operator uses the shared bolt cycle, real scope readiness, automatic re-scope and 3.7 s magazine reload; it cannot fire during the bolt or scope transition. These tactical cadences may be slower than the mechanical maximum.

A shot first intersects the physical player proxy, then calls shared `traceBallisticRay`. Material, thickness, layers, resistance and distance-scaled damage apply identically to player and bot shots. A limited speculative wallbang requires a recent real visual or audible observation and a penetrable path to its uncertain remembered estimate. The decision never intersects the concealed player to decide where to aim. It can miss, stop in cover, or hit the current physical player by legitimate trajectory. At most two speculative shots are admitted before another genuine contact.

## Modes, retry and analytics

- `gunfight`: real bullet damage only, even if an old saved exposure toggle is enabled.
- `learning`: no damaging bot gunfire; optional exposure timer.
- `exposure`: timer-only elimination. Cover interrupts continuous exposure.

Retry creates fresh bot weapon, motor, history, timers, burst and information states. Spawn generation and encounter epoch guards prevent old synchronous shot callbacks from modifying a replacement life. Session history remains available for analysis, while the current journal and opponent states are reset.

`DefenderShot` records physical direction, region, damage, spread components, pre/post recoil, compensation, controlled angular error, actual-trajectory angular error against the delayed desired ray, burst/weapon shot indices, ammunition before firing, reaction/acquisition times, observation source, material traversal and generation. Sound-only shots do not invent visual reaction timings. Death feedback includes visibility, valid reaction/acquisition, actual shot/hit counts, penetration and latest actual player-shot velocity where available.

`PeekReport.combatSummary` preserves counts, first/follow hit rates, total damage, visual reaction/acquisition/time-to-first-shot means, physical recoil RMS and compensated residual RMS. RMS values are in degrees; timings are seconds. The optional developer overlay explicitly exposes internal memory only when enabled. Normal gameplay does not show concealed AI memory.

## References and validation boundaries

The shared weapon model is versioned separately in `src/config/weapons.ts` and `docs/WEAPON_CALIBRATION.json`. The official patch references for crouch-moving spread and this trainer's half-cone interpretation are documented in [CROUCH_SPREAD_CALIBRATION.md](../peeking/CROUCH_SPREAD_CALIBRATION.md). Riot's undisclosed recoil/penetration internals and human rank behavior have not been reproduced or independently measured. Movement, recoil curves, bot timing, resistance and utility thresholds remain explicit simulation calibrations.

Before replacement, the actual old controller was frozen and measured in 160 seeded open-lane encounters (4 weapons × 2 motions × 20 seeds at 20 m, reaction 350 ms, accuracy 0.75). Its stationary and moving cases both hit 100% of shots. Rifle/Sheriff first-shot median was 342 ms; Operator was 400 ms. This exposed the old direct-current-position targeting problem. The raw capture is retained in the task evidence workspace; the release benchmark uses a separately frozen baseline, declared seeds, identical trajectories and current four-profile runs.

Run focused regression tests:

```sh
npx vitest run src/tests/defender-ai.test.ts src/tests/combat-ai-motor.test.ts --reporter=verbose
npx tsc --noEmit
```

The 35 focused tests cover physical body intersections, occlusion/FOV, heard-position limits, navigation/support/collision, exact seeded replay, motor bounds, imperfect compensation, all four real weapon trajectories/cadences/reloads, distance-based firing utility, finite reserves, hidden-history limits, sound-based wallbangs, mode exclusivity, full retry reset, immutable analytics and render-cadence independence. Software benchmarks measure this controller and its chosen trajectories; they do not establish real-player fairness, rank equivalence, browser GPU performance or display/input latency. Human scenario review remains a distinct validation stage.
