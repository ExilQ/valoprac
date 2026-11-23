# VALOPRAC 12.00 engineering report

Release date: 2026-11-15. Target package 12.0.0. Baseline production source: `0029c162de2756aa11092748514efe726e1ee217` (release 11.00). Baseline checkpoint branch: `checkpoint/11.00-before-physics-materials`. Exact source, archive, deployment and actual production checks are recorded in the separate final release receipt. This document records source/build evidence and its limitations.

## Architecture and scope

The existing React/TypeScript/Vite/Three.js/WebGL application remains intact. Simulation runs at 120 Hz independently from rendered frames. Separate VALORANT, CS2-inspired and Source Classic movement presets retain their acceleration, braking, air budget, jump calibration and input semantics. No Rapier dependency, whole-engine rewrite, Rust runtime, WebGPU migration or Unreal runtime was added. Korean remains the product interface; existing maps, weapons, training, AI, replay, local analytics and privacy/security settings remain available.

This update implements the current physics/materials/performance brief. It builds on retained report items F1–F8 and I1–I9 and the common A2 replay foundation; it does not claim new reference-game measurements for F9 walking ratio or F10 silent landing. F1 takeoff budget, F2 jump calibration, F3 zoom projection and F5 ADS calibration retain their provisional source classification. F4 expert-specific response and normal difficulty remain separate. Original A1/A3–A7 features are preserved. A8 online infrastructure remains deferred.

## Changes and files

| Area | Main files | Result |
| --- | --- | --- |
| Contact simulation | `CollisionController.ts`, `Movement.ts`, `config/movement.ts` | Versioned continuous square-footprint sweeps, actual support normals, minimum step tread and bounded wall sliding; legacy path retained. |
| Physical surfaces | `config/surfaces.ts`, `surfaceSelection.ts`, `penetration.ts`, map authoring |22 stable IDs connect physical resistance, sight transmission, contact audio and impacts. Explicit editor material overrides stay authoritative. |
| Ballistics and queries | `StaticBroadphase.ts`, `Ballistics.ts`, `environment.ts`, `DefenderAI.ts`, `Exposure.ts`, `AngleTraining.ts` | Immutable static candidate index, exact clipping/order, early opaque occlusion; explicit current or legacy rules. |
| PBR appearance | `config/materials.ts`, `ProceduralSurfaces.ts`, `SurfaceMaterials.ts`, `SurfaceShowcase.ts` |15 original deterministic finishes, shared base/roughness/normal maps, meter-scale UVs, bounded cache and disposal. |
| Renderer | `RangeRenderer.ts`, `CharacterBatches.ts`, `StaticGeometry.ts`, `WeaponView.ts`, `OperatorVisual.ts`, `TacticalArchitecture.ts` | Shared materials across maps/weapons/bots, compact visible instances, qualified multi-draw, pooled decals, representative prewarming, preset memory control. |
| Audio/effects | `Audio.ts`, `Runtime.ts`, footstep/landing synthesis, `materialImpact.ts`, `floorImpact.ts` | Actual support/surface selects footstep, landing and impact family. No extra hearing radius or key-based movement events. |
| Replay | simulation rules, replay types/integrity/recording/playback/validation | New simulation 3/materials-v3 identity; independent 10.00 fixtures reconstruct exact old outcomes with legacy-v2. |
| Local records | `training/exercises/personalBest.ts` | Historical personal bests retain their old mechanical compatibility key. |
| Low-end policy | `graphicsPolicy.ts`, app store | Software renderer uses scalar-PBR Low fallback, reduced render scale and bounded frame cap; manual choice respected. |
| Evaluation | three benchmark scripts and this documentation | CPU query, whole-step attribution and real WASM boundary/copy experiment retained with raw samples. |

Paths in the table are relative to `src/engine` unless prefixed; the final Git change list is authoritative.

## Correctness evidence

[COLLISION_RESULTS.json](COLLISION_RESULTS.json) compares retained legacy and current rules with identical inputs. Extreme-speed stress probes tunnel to x99999 in legacy and stop at x−.28 now; these deliberately exceed gameplay speed. Three 20 cm risers previously stall at x .65517 / y 0 and now reach x 3 / y .6. A 1 cm tread cannot auto-step under the 10 cm minimum. A Source Classic ceiling corner at an actual 120 Hz tick now clips to y .14 / vy 0 rather than missing the underside. Steep slopes no longer leave the character suspended. The square footprint preserves authored tactical widths; a new capsule was not substituted.

Existing trajectory output measures the provisional VALORANT apex at 1.1499695016912355 m. Jump impulse/gravity, takeoff-speed budget, reverse steering, counter-strafing and the three profiles were not retuned. Physics changes are versioned instead of silently changing historical recordings. [Replay compatibility](replay-compatibility.md) documents the original unchanged fixture, four independently recorded movement/headshot fixtures, and the original scenario fixture with checksum `0504b121cca31227`. Current replay tests cover all three movement presets, four graphics presets and 60/144/240 Hz render schedules.

Graphics settings do not enter physical calibration. Recorded settings still remain in complete deterministic state/checksums, as before. Appearance-only comparison tests therefore compare authoritative state while explicitly excluding only visual settings rather than weakening replay integrity.

## Comprehensive code audit before publication

The final source audit covers movement/contact integration, material-boundary effects, Runtime/audio/input lifecycle, replay limits and compatibility, local-history concurrency, renderer ownership and the connected analytics paths. It extends the prior physics/materials implementation rather than replacing its architecture. The source checkpoint before this audit is `6dcb6e07089ab6a2fad50f27f14206458e9d6761`, retained at `checkpoint/12.00-before-comprehensive-audit-20261110`. It is an unreleased work checkpoint, not a production baseline.

Concrete fixes include fresh-session audio identity reset, actual effective render-frame limits, non-finite input/timing rejection, real entry/exit surface flags for clipped ballistic intervals, buffered landing-jump ceiling handling, footprint-consistent steep-ramp restores, registered legacy replay import, bounded recording snapshots and safe replay seeking, serialized history save/clear retention, and locale listener registration only after successful graphics construction. These address reproduced defects; they do not claim a formal proof that all code is free from bugs. Geometry, damage coefficients, native-game calibration and legacy recording outcomes are not retuned by this audit.

Detailed reviewed files, reproductions and focused test results are in the final dated audit reports in this directory. Final application counts and browser/build evidence must be populated from executed gates after all source edits stop. Earlier November 7–8 measurement files retain their original timestamps and source hashes; they must not be described as fresh physical-device or final-source captures.

## CPU measurements

[QUERY_BENCHMARK.json](QUERY_BENCHMARK.json) compares the frozen production modules against the candidate with source/geometry manifests, same objects, seeded/authored rays, warmup and 15 alternating repeated batches. 3,880 legacy rays, 3,880 current-vision oracle queries, 180,989 obstacle intervals and 15,520 four-weapon traces have zero mismatches. Ballistic kernel medians improve 2.27–3.27× across eleven maps. Legacy visibility improves 1.20–2.80× on ten maps; the tiny six-box range regresses to .94×. Complete nearest-hit scanning is retained because the index was not consistently faster. These are CPU query ratios, not FPS claims.

[STEP_PROFILE.json](STEP_PROFILE.json) was re-measured November15 with five alternating repeats and an independent instrumented pass on the original range/complex/tower scenes. Baseline/current-legacy authority fingerprints match in every scene. Median-of-repeat-medians (microseconds per120Hz step) are range: 19.89 → 20.33, complex: 41.57 → 40.89, tower: 34.46 → 35.73. Wrapper/timer overhead is retained and documented. These finite CPU observations do not establish a whole-engine speedup; current-material tower is slower in this cohort. The separate ballistic kernel experiment isolates its measured improvement.

[WASM_EVALUATION.json](WASM_EVALUATION.json) measures a real original 192-byte compiled WebAssembly module, not a hypothetical port. 163,975 exact scalar/batch comparisons include signed zero with no mismatch. The scalar JS/WASM boundary is slower (3.51 ns JS versus 8.50 ns WASM median); packed copied batches of 16–1024 show 1.29–1.78× favorable ratios. Existing object extraction, full solver updates, collision and complete frame cost are outside that favorable packed-array experiment. Rust compilers were unavailable. **TypeScript remains the production implementation.** No new WASM CSP permission is required.

## Rendering and materials

The procedural textures are original deterministic data generated locally with no downloaded assets. Fifteen families share maps across tints and use metallic/roughness PBR, controlled normal detail, mipmaps and bounded anisotropy. Full-family map estimates are 80 KiB Low, 640 KiB Medium, 3.75 MiB High and 15 MiB Ultra excluding driver overhead. Software-renderer Low omits maps after same-scene measurement; hardware Low retains 32 px base maps. Runtime allocation is lazy. Managed material objects survive quality switches while old texture sets are disposed; no historical preset cache is kept.

Visual and physical properties are independent. All contact friction multipliers remain 1 pending calibrated traction measurements. Original ten penetration coefficient sets are unchanged; added physical IDs explicitly borrow documented existing families. Authored solid concrete ramps/platforms now have concrete physical cores under current rules rather than geometry-label wood or opaque defaults. Actual support surfaces, the range mat footprint and exact complex bay bounds select contact sound. Glass has explicit sight transmission while remaining collidable and penetrable; original map colliders currently contain no glass, so dedicated tests cover that contract.

[RENDER_BASELINE.json](RENDER_BASELINE.json) and [RENDER_AFTER.json](RENDER_AFTER.json) contain fourteen same-state scenes: all eleven maps on Low and range/complex/tower on High. The camera, seed, 960 × 540 viewport, manual render scale 1 and preset overrides match exactly. Each run renders 36 actual requestAnimationFrame frames (35 measured intervals); no draw suppression or fake clock is used. Candidate source hashes are checked before and after capture and remain unchanged. Every row preserves authority during preparation and adds zero shader programs during observed gameplay.

This table reports observed median frame time, maximum draw calls and maximum triangles. These are finite software-GPU samples, not stable physical-device FPS estimates. Lower milliseconds is better.

| Map | Preset | Draw calls before → after | Triangles before → after | Median frame ms before → after |
| --- | --- | ---: | ---: | ---: |
| range | low | 42 → 37 | 28526 → 22030 | 200.0 → 50.0 |
| tactical | low | 22 → 19 | 33706 → 16694 | 350.0 → 50.0 |
| long | low | 33 → 32 | 40858 → 15746 | 216.6 → 50.0 |
| garage | low | 31 → 30 | 28516 → 12244 | 350.0 → 66.6 |
| site | low | 32 → 31 | 34396 → 13676 | 416.7 → 66.6 |
| mid | low | 32 → 33 | 35618 → 14022 | 216.7 → 66.6 |
| tower | low | 33 → 34 | 37256 → 15812 | 100.1 → 66.7 |
| multi | low | 33 → 34 | 36226 → 14634 | 150.0 → 66.6 |
| complex | low | 28 → 29 | 81726 → 56142 | 183.3 → 83.3 |
| bunny | low | 23 → 12 | 23328 → 4596 | 100.0 → 16.7 |
| wallbang | low | 31 → 32 | 29554 → 8818 | 399.9 → 50.0 |
| range | high | 70 → 60 | 55998 → 43006 | 933.3 → 450.0 |
| complex | high | 63 → 68 | 167030 → 117478 | 716.6 → 750.0 |
| tower | high | 69 → 71 | 76240 → 33352 | 616.6 → 533.2 |

All eleven Low scenes improve observed median frame time in this capture. Complex Low uses two additional draw calls because distinct finishes remain explicit, while triangles decrease by about 26%. High complex is slightly slower on SwiftShader despite lower triangles; High tower improves in the latest post-merge capture. Earlier cohorts also recorded a tower regression, so no universal High improvement is claimed. High range improves. The original complex was already below the historical 120-call target, so this update does not claim a 204-to-120 reduction. All idle scenes remain at most 71 calls under these exact conditions. Draw calls alone are not a total GPU-cost measure.

The full JSON also records average FPS, 1% low, p95/p99/max frame time, CPU rendering time, actual simulation-step samples, GPU timer availability/results, shader/material/resource counts, texture estimates, heap, construction and preparation time. Constructor/preparation observations are recorded separately from active frames. Baseline preparation spans about 4.2–22.3 seconds; current spans about 1.2–3.5 seconds in this software environment. Loading is not concealed inside the FPS interval.

**High comparison disables AO/post/AA in both versions** to isolate PBR, geometry and shadows; it is not the stock full High preset. Software Low selects the measured scalar-PBR fallback; hardware Low keeps original maps. SwiftShader results cannot qualify physical integrated/discrete GPUs. Initial PBR captures with fewer draw calls regressed software frame time and were rejected; the measured fallback addresses that failure. Hardware-qualified multi-draw is implemented but hardware performance is unmeasured.

[VISUAL_DELIVERY.json](VISUAL_DELIVERY.json) records six original comparison frames delivered as lossless WebP. The three pairs show range, a complex bay and Vandal hip-fire at identical camera/seed settings, captured November 8 from the frozen 11.00 source and the unreleased 12.00 material candidate. Decoded-pixel SHA-256 equality is checked against the original PNGs. The Korean guide embeds these dated pairs. Later November 15 fixes have separate functional evidence and are not re-labelled as these original screenshots. Optional copies under `public/physics-comparison` are excluded from the staging ZIP while the served files and source repository remain intact.

[SHADER_PROBE.json](SHADER_PROBE.json) separately checks Low and High with actual WebGL draws and an actual first shot. Prepared programs are 28 and 32 respectively; observed idle frames and the first shot add zero programs. Authority checksums are unchanged by preparation; the shot count changes from 0 to 1 and ammunition from 25 to 24. This validates warmed representative characters and impact paths in the tested scene. It does not establish the physical integrated-GPU first-three-second frame budget.

[LONG_SESSION.json](LONG_SESSION.json) and [LONG_SESSION.md](LONG_SESSION.md) exercise two actual 120 Hz Free Practice authority runs of 31 simulated minutes each (223,200 ticks per run), with and without recording. Both end at checksum `40899af36fc9232f`, with 5,633 shots, 2,326 footsteps and 930 landings. Retained detail reaches its intended bounded limits: 2,048 shots, 64 steps, 32 landings and 32 presentation frames; movement trace stays at most 22 points. Recording reaches its existing 30-minute cap, then another 78 actual shots and 7,080 ticks continue safely. A partial capped recording is not exported as a valid complete replay. Forced-GC no-recorder heap samples stay approximately 32.3–32.8 MB over minutes 10–30; recorder memory intentionally retains command/checkpoint/event data. The wall runs take 53.14 and 6.58 seconds. This is compressed simulation time, not a physical 31-minute browser soak, and excludes GPU/audio-node lifecycle.

Final November15 browser QA keeps real WebGL draws enabled: trusted firing consumes ammunition, two right-clicks toggle ADS, Escape pauses, the real UI writes an IndexedDB session whose replay reconstructs, and the independently recorded simulation-2 file imports and verifies through the replay library. Seven viewports from390×844 to3440×1440 retain the primary action without horizontal overflow. Eight map cycles with500 floor effects each and five quality transitions return geometry/texture counts to zero, including stock High after fixing the r180 SSAO noise/material disposal omission. Stock High submits137 total pass draws; the matched core scene table disables AO/post/AA and remains below120. The stock software startup sample includes an883.3ms frame and does not meet the physical integrated-GPU100ms target. Fifteen material finishes were inspected under six dated lighting conditions; those original November8 captures are preserved. See [BROWSER_LOCAL.json](BROWSER_LOCAL.json), [BROWSER_LIFECYCLE.json](BROWSER_LIFECYCLE.json), [SHADER_PROBE.json](SHADER_PROBE.json), [VISUAL_DELIVERY.json](VISUAL_DELIVERY.json) and the consolidated release validation. No physical-device acceptance is implied.

## Tests and release gates

The untouched initial release 11 baseline passed **1,268 tests in 105 files**. A later reference rerun encountered temporary package-file/test-infrastructure failures under concurrent GPU work; its log is retained and is not described as the clean baseline. Initial candidate failures exposed public-helper legacy defaults and explicit-material precedence; both were corrected without deleting old assertions. New tests cover swept contacts, physical metadata, audio selection/contact integration, sight transmission, broadphase parity, procedural materials/disposal, managed batching, actor batches, replay versions, fallback physics invariance and surface effects.

**Final executed software gate: 1,444 application tests in130 files,20 broker tests and14 hosting tests passed.** `npm run build` executes the existing complete tests through prebuild, writes validation metadata, typechecks, packages source, emits lazy client chunks, verifies routes/search and constructs/verifies the response Worker. The actual prebuild was executed once; the unchanged tested runtime is then packaged with `npm --ignore-scripts run build`, avoiding a duplicate test run. Typechecking, route/search checks, image hashes and self-contained Worker response checks remain part of that build. Exact final build bytes and deployment identifiers are in the separately maintained release receipt. Build evidence is not a deployment receipt.

The previous Worker compressed size was 10,084,409 bytes at gzip 6. The complete Worker remains subject to the 10 MiB release limit. Optional duplicated QA screenshot binaries are omitted from the downloadable staging ZIP while their source repository and served public paths remain intact. Gameplay source, assets and measurement manifests stay included. No tracking, account requirement, external dependency or broad CSP exception was added.

## Limits and required measurements

No direct native VALORANT/CS2 measurement was performed. Walking ratio and silent-landing policy remain unchanged. Hardware FPS, first-three-second integrated-GPU budget, input-to-photon latency, long physical-device sessions and headphone/laptop listening remain unqualified. Software frame samples, Node timings and bounded simulations must be reported under their own methods. Low visual presets preserve collision, hitboxes, physical surfaces and simulation. High PBR can cost more on software GPUs; no universal performance or 60 FPS promise is made.

## Release and rollback

Patch 12.00 / package 12.0.0 / simulation 3 / movement 1.2.0 / physical-surfaces 1.0.0. New replay headers explicitly record simulation, material, input and unchanged weapon versions. The public audience, existing Sites project and custom domain must be preserved. Rollback candidate is existing saved Site version 24 (`appgprj_6ad3456a37e08191ae5aef8440d1d28f~appgver_a2ce0b530f3881918525f8ba8eb8b170`), original source `0029c162de2756aa11092748514efe726e1ee217`. Exact final pushed commit, saved version, deployment ID and actual custom-domain checks belong in the final release receipt. Until that receipt succeeds, deployment status remains **unverified**.


Remote integration: retained e18cdfe coplanar-wall fix, including single-mesh plinth/cornice finish bands, preserving PBR managed materials and UVs. All three real wall-ray assertions pass; the full same-camera render cohort was recaptured after this merge. Original dated November8 image comparisons remain unchanged.

The latest pre-release rollback is saved Site version25 (`appgprj_6ad3456a37e08191ae5aef8440d1d28f~appgver_4788f5de56b48191a113747237056a7a`), source e18cdfe606542078874f8c01d4747b4a07a5ee6a.
