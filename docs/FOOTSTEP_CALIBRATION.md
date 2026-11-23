# Persistent footstep accumulation — provisional v1, release 2.3.0

Date: 2026-10-24. Production browser renderer: Three.js. No claim of exact VALORANT mechanics, sound assets, native-input parity or measured GPU FPS.

## Integration and preserved content

The canonical production source at the start of this change was `913a396879af7a007ecafcd49af07e2b3f46ad04` (2.2.0). It had the normal range, weapons and five training modes, but no tactical corner map, hearing AI, minimap or patch-note UI. The user's separate `VALOPRAC_Angle_Trainer_Standalone.html` prototype was read. Its original 24×24 layout (2 meters/cell), five spawn zones, randomized zone placements, hearing/peeking concept and explicitly prototype-only patch records were retained and integrated into the existing 3D browser engine. Its 2D drawing, simplified weapon/hit logic and binary noise rule were not used as replacements for production mechanics. The original Library files were not modified.

The normal range and all timed modes remain available. Tactical layout is an optional unlimited Free Practice map. Vandal, Phantom and Sheriff still use the same authoritative weapon/recoil/spread/ADS/ammunition implementations and actual animated head/body/limb hitboxes. Default elimination remains head-only. All five tactical zone bots use the existing pooled humanoid targets. Bullet occlusion, movement collision, rendering and minimap read the same map geometry. Map selection applies on entering training; normal volume/HUD/control changes do not recreate simulation or reset phase.

## Actual algorithm

`Footsteps.step` runs at 120 Hz **after** movement/collision resolution. Horizontal displacement is `hypot(current.x-previous.x, current.z-previous.z)`; speed is that distance divided by the fixed tick. A held key against a wall cannot create distance. WASD release and Shift transitions never reset the accumulator. Actual velocity above the configured audible threshold continues advancing the step cycle while running, coasting, or decelerating into walking/crouching.

A fresh recovered cycle consumes the configurable grace distance, then increases normalized accumulation by eligible meters × accumulation per meter. Reaching the audible threshold emits one pooled event with a monotonically increasing ID, interpolated crossing time/position, actual speed and hearing radius. The cycle consumes the threshold and preserves fractional distance remainder. Continuing to run repeats by distance, without a run-key timer. The journal is capped at 64 events; fixed-step footstep sampling does not allocate new events.

Below the audible-speed threshold, walking/crouching preserves most progress and can use a configured distance-gain multiplier and slow decay. Stationary recovery begins only below the actual stationary-speed threshold after the configured delay. Linear decay is integrated across the delay boundary, not applied as an instantaneous stop reset. Full stationary recovery restores grace. Pausing freezes simulation; it cannot be used as a faster recovery action. Weapon selection, statistics reset, audio mute, HUD changes and Shift toggling do not reset accumulated progress. Airborne movement preserves phase and does not generate ground footsteps; separate landing sounds are outside this patch.

| Parameter | Default | Status |
|---|---:|---|
| Accumulation per eligible meter | 0.625 | Provisional |
| Walking distance multiplier | 0 | Provisional |
| Walking decay / second | 0.02 | Provisional; 0 and 0.08 comparison presets included |
| Stationary decay / second | 3.5 | Provisional |
| Stationary velocity | 0.035 m/s | Provisional |
| Stationary recovery delay | 0.12 s | Provisional |
| Audible accumulation velocity | 2.7 m/s | Provisional; default walk speed is 2.592 m/s |
| Audible threshold | 1.0 normalized | Trainer normalization, not an exposed Riot value |
| Fresh-cycle grace | 0.2 m | Provisional |
| Hearing radius | 20 m | Provisional; not the accumulator percentage |
| Obstructed hearing multiplier | 0.65 | Retained prototype training approximation, not Riot acoustics |

All numerical training controls persist locally and are sanitized. Changing profile values preserves phase up to a lowered configured threshold. The independent footstep volume and both HUD toggles affect presentation only, not event generation or AI hearing.

## Event/audio/AI contract

Only emitted footstep events feed the dedicated Web Audio channel and `TacticalHearing.hear`. Partial accumulation and run/walk inputs cannot alert a bot. Heard events store a last-known source position, an alert expiry and a bounded valid peek destination. Bots wait 180 ms then investigate at a bounded movement speed and return to their anchor after 3.3 s without another heard event. These are explicit trainer parameters. They do not track the live hidden player through walls. Blocked/out-of-range/inactive/disabled bots do not receive detection by input state.

Two independently synthesized footstep buffers preload with the existing audio engine. Event IDs suppress duplicates, audio voices share the existing 48-voice cap, and nodes/buffers are cleaned on session disposal. No Riot recording is included. Muting the local channel does not make simulated sounds inaudible to bots.

The optional Korean gauge displays actual normalized progress, movement state, threshold, remaining eligible distance and a crossing flash. The minimap displays a fixed hearing-radius circle only for a real recent event, centered on its event position. It does not derive radius from progress. The map is a training aid that also displays bot markers; it is not a full VALORANT minimap implementation for all weapon/ability sounds.

## Executed validation

233 application tests and 20 infrastructure tests pass. Tests A–G run at 60, 144 and 240 render schedules through the actual 120 Hz simulation:

| Case | Result |
|---|---|
| A: reach approximately 85%, walk one tick, immediately run | Retains approximately 88.19% after physical transition; next step follows a small additional displacement |
| B: same buildup, stop physically, wait for full recovery, run | Progress reaches zero; substantially longer fresh allowance |
| C: repeated Shift toggles without stopping | No instant phase reset; legitimate steps still emit |
| D: short run-stop bursts with recovery | Silent for the tested burst/recovery trajectory |
| E: hold W against a wall | Zero actual movement, no recurring step events; stationary recovery works |
| F: same input/trajectory across render schedules | Identical per-tick accumulator trace and event data in these replays; timing tolerance 1e-9 s |
| G: bot inside hearing range | No reaction to partial progress; reaction begins only after a legitimate emitted event |

Additional tests cover remainder/crossing time, bounded journals, walking-decay comparison, coast after release, pause/weapon/settings/reset persistence, airborne phase, out-of-range bots, valid zone spawns and bot collision, exact 3D head/body/wall results for all weapons, actual event-only SVG circles, settings persistence and audio deduplication/disposal. Existing headshot, recoil, movement, ammo, timed modes, indefinite Free Practice, storage and portable C++ golden regressions remain passing.

The reusable interactive comparison (Settings → 훈련 → 현재 설정으로 걷기·정지 비교) uses the same `Movement`, `Footsteps` and `FixedClock` classes. Default replay results at all three render schedules:

| Treatment | Additional actual displacement to emitted event |
|---|---:|
| Immediate walk → run | 0.188888889 m |
| Sufficient stationary recovery → run | 1.895000000 m |

These values include movement acceleration in this trainer. They are CPU simulation results, not native-game measurements or a benchmark of the physical display's refresh rate. Machine-readable results: `/footstep-calibration.json`.

Chrome managed-preview QA executed the comparison button, showed the three identical distance pairs, changed walking-recovery preset and verified persistence after reload, selected the tactical map, opened/filtered/closed patch notes with keyboard focus restoration. The cloud browser reports WebGL unavailable, so actual rendered gameplay, perceived audio, Pointer Lock while firing, and GPU performance remain **implemented but not verified on hardware**.

## Calibration evidence and limits

Riot's official Patch Notes 1.0 describes the minimap white circle as audio-distance visualization: https://playvalorant.com/en-gb/news/game-updates/valorant-patch-notes-1-0/ . It supports the distinction between hearing radius and this trainer's accumulation aid. It does not provide an internal accumulator formula, grace distance, walking decay or stationary recovery constants. Official/public source searches did not establish those constants. The user's observed run→walk→run versus run→stop→run behavior is the provisional behavioral requirement, not a verified numeric calibration dataset.

No local VALORANT executable, controlled gameplay recording or movement/audio timestamp dataset was available. **Exact equivalence is not verified.** To calibrate, record authorized gameplay with visible input timestamps, matching weapon/surface, known movement distances and audio waveforms; use at least 30 trials per treatment. Measure first audible onset, coast distance, stationary dwell and walking duration separately. Fit per-meter gain/grace/decay on training trials, then evaluate held-out trials and report median/p95 error and uncertainty. Preserve the original clips/dataset and game patch/build. Include A–G trajectories, wall sliding, crouch/ADS transition and packet-loss-free local capture. Do not tune only to a single anecdotal run.

No paid infrastructure or production Unreal replacement was performed. The existing unbuilt UE staging source remains included; footsteps/tactical hearing are **not ported to UE** in this release, and streaming remains disabled behind its false migration gates.


## 4.0 recovery revision

Stationary decay increased2.5times; walking retention, actual velocity gating and event hearing remain unchanged. The former default migrates once through gameplayRevision1. Current custom values remain configurable. The release-generated tactical report contains1x/2x/2.5x/3x recovery comparisons;85%stationary phase reaches zero in.367s at the selected profile versus.733s previously. These are simulation measurements, not native game observations.
