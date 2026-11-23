# VALOPRAC 06.00 implementation review

The existing React/TypeScript/Three.js application is extended in place. Its 120 Hz simulation, input adapter, original three weapons, recoil, movement, footstep accumulation, aim tasks and local history remain in use. This release does not run Unreal Engine or replace the browser engine.

## Tactical level pipeline

The connected 100 × 92 m complex contains eight distinct exercises and eleven authored defender sectors. The central gallery, rear galleries and outside return paths connect the facility, research, urban and courtyard bays. Each exercise defines protected entries, two approaches, an engagement route, grounded defender alternatives and local navigation choices. Zone F adds a continuous staircase, front and rear ramps and a 2.4 m balcony; H adds a 1.2 m route and deliberate crossfire.

The geometry was built and refined before its architectural finish: actual collision, crouch/jump visibility, movement traversal, alternative spawns and progressive angle exposure have executable checks. A discovered gap between the vertical staircase and balcony was closed. Door headers now have physical collision. Zone G is validated against body samples and the complete alternative-plus-jitter spawn envelope; H intentionally permits two simultaneous threats. The architecture kit adds chamfered portals, recesses, lintels, clerestories, material-specific floor treatments, structural roof details and finished cover. The six previous tactical maps also receive additional collision-authoritative cover and architectural treatment.

Player movement performs every peek. There is no automatic peek animation, invulnerable shoulder state or protected jump state. The same movement controller resolves cover, stairs, ramps, crouching and airborne movement.

## Operator

The Operator has a separate single-press bolt-action admission path, five-round magazine, ten-round finite reserve when unlimited reserve is disabled, reload/equip gates and a 1/.6 second bolt cycle. Holding fire does not repeat shots. Scope entry and zoom transitions gate firing. Toggle cycles 2.5× → 5× → off; Hold and a separate configurable zoom key are supported. Optional re-scope queues a fresh scope transition after recovery. Rifle ADS and Sheriff behavior are preserved.

Camera magnification is calculated from the actual tangent FOV relation. A circular scope mask and centered reticle share the camera's aiming center. There is no hit-ray offset to compensate for presentation. A separate existing viewmodel camera renders original authored geometry. The Operator uses a varying chamfered receiver, open chassis stock, narrower tapered optics, articulated bolt, magazine and wrist handling rather than a scaled copy of another gun. Static details are batched within their articulated parents.

Scoped precision depends on resolved velocity, grounded/landing state and completed scope entry. Unscoped, moving and airborne fire receive distinct penalties. High penetration uses obstacle thickness, layer limits and damage attenuation. Public references and provisional calibration values are separated in [OPERATOR_CALIBRATION.json](OPERATOR_CALIBRATION.json); present-day native-game parity has not been verified.

## Defenders and evidence

The new complex and six authored tactical levels use weapon-aware defenders. Perception samples a yawed, crouched player-body proxy at 25 Hz; firing performs a fresh LOS check and a physical ray/body/cover intersection. Bots retain dated observations rather than reading the hidden current player position. Hearing accepts emitted footstep events, not movement keys. Operator recovery, deliberate Sheriff cadence and short rifle bursts differ. Repositioning follows supported, collision-validated routes with acceleration and braking; velocity matches actual displacement.

Training records exposure, actual movement distance, peak velocity, shot velocity, view acquisition, return to cover, observed shot baits, recovery-window hits and death cause. Current cleared/remaining sectors are separated from cumulative clears. Nine-sample visibility is explicitly described as a coverage approximation, not projected pixel area. The optional death view is a horizontal path/LOS record, not a reconstructed three-dimensional replay. Instant retry clears death, health, optics and transient inputs while preserving the session, ammunition and footstep accumulation.

All new model geometry and synthesized audio are original. Concrete footsteps retain their previous waveform; other floor materials select independently synthesized timbres without changing sound radius or accumulation. No extracted Riot artwork, map coordinates or recordings are included.

## Release boundaries

Tests and software-rendered screenshots establish browser behavior and sampled geometry. They do not establish an AAA quality rating, hardware FPS, sensor latency, native VALORANT equivalence or human training effectiveness. Historical UE source staging remains disabled in production and has not received this browser Operator port.

Rollback source: `checkpoint/05.00-before-operator`. The remote Node 24.22.1 build configuration was merged before release. The previously deployed Site version 12 remains a rollback target; version 10 preserves the original 05.00 visual release.
