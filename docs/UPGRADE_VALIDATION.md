# VALOPRAC 2.0 validation

This is an additive upgrade of the deployed Site source at baseline `6a75e43654ff701e7081354c210a11a3aa599128`. The original fixed-step movement, braking recorder, 3D rig/collision, four timed modes and local history are retained. The official production domain is `https://valoprac.trade`. The existing public audience and Site ID are preserved.

## Status and evidence

| Feature | Status | Evidence / limit |
| --- | --- | --- |
| Vandal, Phantom and Sheriff configurations, damage bands | Implemented and tested | `upgrade.test.ts`; calibration provenance in `WEAPON_CALIBRATION.json` |
| Automatic rifle cadence and ADS cadence | Implemented and tested | Scheduled shot interval tests; 30/60/144/240 Hz deterministic input replay |
| Sheriff press-only firing and short click capture | Implemented and tested | Weapon and browser-event contract tests; no automatic firing while held |
| Magazine, reserve, reload, equip and switch state | Implemented and tested | Full-duration reload, finite reserve, canceled reload, equip gate tests |
| 1.25x ADS and no Sheriff ADS | Implemented and tested | Projection tangent, sensitivity, speed and ADS availability tests; visual transition not browser-verified |
| Stateful horizontal recoil and protected bullets | Implemented and tested | Guaranteed-switch tests prove early protection and opportunity spacing; exact native parity incomplete |
| Velocity-based accuracy, crouch, air, braking and recovery | Implemented and tested | Original and added movement, recoil and collision regression tests |
| Animated and scaled 3D head collision | Implemented and tested | Ray tests at 0.5x/1x/2x; shared rig transforms drive target instances |
| Direct training/settings/statistics URLs and browser history | Implemented and tested | Route parsing and concrete .html entry documents; the static host does not implement Pages-only wildcard rewrites |
| Four original timed modes | Implemented and tested | Original end conditions, scoring and render-rate replay retained |
| Unlimited Free Practice | Implemented and tested | One hour of simulated time, no finish event; actual wall-clock browser soak not verified |
| Target count/size/speed/distance/behavior/spawn interval | Implemented and tested | Pool identity, respawn timing, appearance events and cover-peek count tests |
| Head-only default and optional elimination rules | Implemented and tested | Head-only regression; any-hit and damage rule tests |
| Target reset and statistics reset within a session | Implemented and tested | Reset preserves elapsed time, magazine and weapon state |
| Lifetime totals and bounded detail | Implemented and tested | Up to 2,048 recent shots, 256 kills and 256 reactions; constant-size lifetime aggregates |
| Per-weapon accuracy, residual recoil and spread metrics | Implemented and tested | Aggregate consistency and detailed session retention tests |
| Korean menus/settings/results | Implemented and tested | React server markup tests; actual layout and keyboard navigation not browser-verified |
| Settings and history persistence | Implemented and tested | Storage adapters and fake IndexedDB; real browser quota/persistence not verified |
| Required named audio profile routing | Implemented and tested | Exact reference labels; distinct original buffers; authorized local import tests |
| One firing sound event per valid shot, overlap and cleanup | Implemented and tested | Mock AudioContext event/lifecycle tests; actual latency and acoustic clipping not verified |
| Actual authorized Riot skin recordings | Not implemented | No licensed assets were present. All default audio is explicitly labeled original substitute audio |
| Original weapon geometry, magazines and revolver cylinder | Implemented and tested | Finite geometry, independent model assemblies and movable cylinder data |
| Weapon recoil/reload/equip/sway and muzzle effects | Implemented but not verified | Driven by simulation state; visual/browser QA unavailable |
| PBR materials, normal maps and environment reflection probe | Implemented but not verified | Procedural textures and PMREM studio probe; actual GPU output not viewed |
| Shadows, contact shading, SSAO, bloom, FXAA and tone mapping | Implemented but not verified | Optional render passes; GPU quality and visual clarity need desktop verification |
| Low/Medium/High/Ultra and independent rendering settings | Implemented and tested | Configuration tests; all shader/preset combinations need actual GPU verification |
| Target instancing and static architecture batching | Implemented but not verified | Four target instance batches, merged static materials; GPU draw-time measurement pending |
| Input blur reset, listener cleanup, raw input fallback | Implemented and tested | Mock document/canvas lifecycle and unsupported-API tests; actual Pointer Lock unverified |
| GPU resource cleanup and context-loss handling | Implemented but not verified | Explicit pass, render-target, geometry, material and texture disposal; GPU soak pending |
| 144 FPS at 1080p and 240 Hz responsiveness | Incomplete | Goals only; no physical display or GPU benchmark has been run |
| Native VALORANT mechanical or sensitivity parity | Incomplete | Published values and requested references are separated from estimates; no client measurements |
| Authored baked GI, lightmaps, compressed texture pipeline, WebGPU | Not implemented | Current small procedural range uses one shadowed light, hemisphere fill, environment probe and precomputed radial contact textures |
| Unreal Engine runtime / proprietary rendering technology | Not implemented | The application remains Three.js/WebGL2 |

## Executed checks

The baseline had **79 passing tests**. Current machine-readable execution results are in `test-results.json`; full output and engine-only workload measurements are in `test-output.txt`. `npm run build` also runs tests and TypeScript. Engine workloads are accelerated simulation tests, not real-time FPS or browser memory measurements.

The one-hour wall-practice test processes 20,972 shots and retains 2,028 of them, with exact lifetime counters and no automatic termination. Four timed modes still stop at their configured duration. Rendering interpolation uses the original 120 Hz clock; view rotation still uses immediate relative mouse input.

## Manual desktop browser verification

1. Open `https://valoprac.trade` in Chrome and Edge and verify `/release.json` reports 2.0.0. Confirm a valid certificate, hard refresh and the guide link.
2. Enter Free Practice, click to lock the pointer and enable audio. Verify raw input where supported; check mouse, WASD, walk, crouch and jumping. Compare with raw-input-disabled OS behavior manually; browser parity is not guaranteed.
3. Vandal: tap, burst and hold fire; verify 25 rounds, recoil compensation, 2.5-second reload, ADS FOV and slower ADS cadence. Repeat for Phantom with 30 rounds and its separate recoil/sound.
4. Sheriff: hold the button for a second (one shot), then press repeatedly. Verify six rounds, 2.25-second reload and no ADS on right click. Switch with 1/2/3 and the B menu during normal play and reload.
5. Shoot torsos, animated heads and limbs, including crouching/scaled targets. Verify default head-only elimination, optional rules and cover occlusion.
6. Use Esc/B to adjust target count, distance, speed, appearance behavior, size and respawn interval without leaving the session. Verify one target for the single cover-peek position. Reset targets and statistics independently. Disable infinite reserve/automatic reload and verify normal magazine rules.
7. Enable the analysis wall and recoil overlay; compare impacts, trajectory, compensation path, residual recoil and recovered spread. Confirm overlay toggles do not change shooting.
8. Select every graphics preset and individual switches. Inspect target contrast, sights, shadows, normal maps, effects and animations at 1080p. Record median/p95 frame times on named hardware. Test High/Ultra AO under fast rotation and weapon switching.
9. Verify that default sounds are labeled substitutes; import only authorized local files for each slot and begin a new session. Check overlapping tails, one gunshot per shot and no prior-weapon audio after switching. Confirm files persist locally and restoring defaults works.
10. Run a real browser soak for at least one hour with repeated switches, target changes, exits/reentries and blur/visibility transitions. Inspect GPU/JS/audio memory, listener counts, timer counts and sound-node cleanup. This check has not been executed here.
11. Exit with record saving; refresh and inspect history and all preferences. Run each original timed mode through completion and check statistics and retry behavior.

The managed browser QA facility was unavailable in this execution environment. No alternative preview browser or fabricated screenshot was used. HTTP verification and native hosting status do not establish mouse/audio/GPU playability.
