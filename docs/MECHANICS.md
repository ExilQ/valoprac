# Mechanics, units and measurement definitions

## Fixed-step movement

All gameplay uses `dt = 1/120 s`. The clock consumes elapsed render time in fixed updates, retains excess debt rather than dropping it, and interpolates positions for rendering. The runtime intentionally pauses after a visible frame stall exceeding 0.5 seconds or tab focus loss. Paused time is not gameplay time. Ordinary frame drops do not discard simulation steps.

Position and velocity use meters and seconds. Ground input accelerates horizontal velocity toward a normalized, state-dependent desired velocity with a bounded change of `acceleration * dt`. Reversal uses a separate configurable acceleration. Releasing all movement keys applies a speed-dependent opposing force:

`speedNext = max(0, speed - (groundDeceleration + friction * speed) * dt)`

`positionNext = position + velocityNext * dt`

The final finite stop follows the configured Coulomb-plus-linear deceleration. It is not a teleport to zero on release. Airborne input adds limited acceleration without ordinary ground braking. Gravity, jump velocity, floor contact, crouch stance and short landing spread are separate states.

| Parameter | Provisional default |
| --- | --- |
| Maximum speed | 5.4 m/s |
| Ground acceleration | 38 m/s² |
| Reversal acceleration | 45 m/s² |
| Neutral constant deceleration | 20 m/s² |
| Neutral linear friction | 3.5 s⁻¹ |
| Walk / crouch / backward modifiers | 0.48 / 0.36 / 0.92 |
| Air acceleration / speed cap | 3.5 m/s² / 5.4 m/s |
| Jump impulse / gravity | 5.2 m/s / 18 m/s² |
| Moving-accuracy threshold | 0.65 m/s |

These are not established VALORANT measurements. With different profiles, neutral stopping can outperform or underperform opposite input. No scoring bonus is assigned merely for counter-strafing.

## Braking events

An episode begins on grounded release or direct opposing input while speed exceeds the threshold. A neutral episode is reclassified if opposing input is applied before threshold crossing. Turning the camera alone does not count as releasing a key.

- Initial velocity is captured before deceleration on the release tick.
- **Readiness duration** ends when horizontal speed reaches the threshold on the ground.
- **Full deceleration duration** ends when speed falls below 0.02 m/s or the initial velocity direction crosses through zero during reversal. It is distinct from readiness duration.
- The first shot within 1.5 seconds of an episode is the comparison sample. Further burst shots are still logged but do not count as independent braking trials.
- Threshold-relative shot timing is `shotTime - readinessTime`; a negative number is an early shot.
- An early shot's unknown timing/durations are backfilled when the actual threshold/full-stop event occurs. Unobserved crossings remain `null`, displayed as unavailable instead of fabricated zero-duration measurements.
- HUD time-to-ready is a prediction assuming the current opposing/neutral input continues. Movement readiness excludes recoil and shot bloom. Prediction is unavailable in the air or when accelerating away from readiness.
- Measurements are quantized to at most a simulation tick (8.33 ms). This is not a sub-millisecond instrumentation claim.

## Weapons, recoil and spread

Weapon settings are degrees and seconds. Rifle A is slower with a 25-round magazine; Rifle B is faster with a 30-round magazine. There is no damage-based body elimination, so a numeric damage model would have no gameplay effect in this phase.

Continuous fire runs on a fire-rate lattice; update-time shot spacing has up to one fixed tick of quantization while long-run cadence follows the profile. A trigger pressed after a pause never creates catch-up shots. Shot index resets after the configured inter-shot delay. Magazine ordinal and burst ordinal are recorded separately.

Three separate outputs exist:

1. Base aim changed directly by mouse counts.
2. Accumulated recoil, with a camera-scaled visible offset and an independent angular bullet offset.
3. Cosmetic view-weapon kick, muzzle flash and tracers, which never decide a hit.

Mouse compensation consumes opposing recoil first, then applies any residual to base aim. This preserves immediate camera rotation while preventing recovery from reintroducing compensated kick. Recovery never writes to base mouse aim. Pitch/yaw kick depends on shot ordinal and small seeded deviations. Profile `cameraScale` intentionally permits bullet recoil and visible kick to differ.

Spread is an independent seeded uniform disk with a radius consisting of first-shot spread, speed-related error above the threshold, bloom, airborne/landing error, crouch and ADS modifiers. Angular spread is applied to the shot after recoil. The same seed and fixed-tick inputs reproduce the same spread, targets and impacts. This does not imply two real mouse recordings at different refresh rates have identical event arrival times.

Ideal compensation is a standing-profile pattern reference without stochastic deviations, recovery or all stance transitions; it is not a guaranteed trajectory. Random spread cannot be removed by mouse compensation. The actual input path logs mouse angular compensation from burst start.

## Hit detection and target movement

Each live target owns an Object3D hierarchy with shoulder, hip and knee pivots. Pose updates transform both visible geometry and exact ray volumes. The head is a radius-0.17-meter sphere, visibly rendered with that radius. Torso and limbs are oriented boxes whose visual dimensions equal their collision dimensions. Ray intersections are performed in each part's local coordinates and compared by world distance. Cover, walls and floor participate in nearest-hit occlusion. Head priority only breaks practically equal-distance intersections; a distant head cannot override nearer cover or a nearer torso.

Only a `head` intersection changes target life state. Torso/arms/legs produce a distinct cue with no elimination. An eliminated target is excluded from collision during its visual collapse and respawns through the same pooled rig. Pose/position interpolation may place a rendered target up to one fixed tick behind the authoritative collision pose; there is no network latency or lag compensation.

## Statistics

- Headshot accuracy: head hits / all shots. Misses include wall impacts.
- First-shot headshot percentage and hit accuracy: the first shot of each burst, not the first bullet directed toward a specific enemy.
- Per-target first-shot elimination flag is also recorded independently.
- Average elimination time: spawn to elimination. Simultaneously spawned unselected targets contribute the time spent awaiting engagement; this is not pure visual reaction time.
- Tracking accuracy: proportion of active-target simulation samples where the actual aim ray hits an unobstructed head. Looking away counts as error; frames with no active targets are omitted.
- Direction-change response: time from an AI direction command to the next exact head-ray intersection within two seconds. Zero-near-zero values can occur if aim was already aligned. This is a reacquisition proxy, not a measurement of human neurological reaction latency.
- Angular tracking RMS: RMS angle to the closest active head across samples.
- Spray width/height: full world-space extents on the rear wall; mean radial error is distance from the group centroid. Radial standard deviation measures stability. These are not statistical variances despite the UI's generic dispersion terminology.
- Repeated-spray consistency: compare same-ordinal impacts across bursts containing at least three rear-wall impacts after translating to each burst's first impact. At least two comparable bursts are required.

## Sensitivity and browser limits

`rotationDegrees = relativeMovementCounts * sensitivity * degreesPerCount`

`estimatedCmPer360 = 360 / (DPI * sensitivity * degreesPerCount) * 2.54`

The default 0.07 degrees/count coefficient is provisional. Enter the mouse's configured hardware DPI; the browser does not read it. The estimate assumes reported counts correspond to hardware counts, which is not universally guaranteed across browser/platform combinations. Horizontal FOV is converted to Three.js vertical FOV from viewport aspect ratio. No extra mouse smoothing is applied.

Raw movement is requested using `requestPointerLock({ unadjustedMovement: true })`. A fallback uses standard Pointer Lock when unavailable. Browser, platform, event coalescing, OS acceleration in fallback mode, display cadence and mouse polling can differ from native engines. Exact 1:1 VALORANT sensitivity is unverified. Test a measured physical 360-degree turn before using the conversion for matching.

Primary implementation references:

- https://developer.mozilla.org/en-US/docs/Web/API/Element/requestPointerLock
- https://developer.mozilla.org/en-US/docs/Web/API/Pointer_Lock_API
- https://threejs.org/docs/pages/WebGLRenderer
- https://threejs.org/docs/pages/Raycaster.html
