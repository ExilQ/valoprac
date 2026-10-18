# Production preparation update — 2026-10-18

The preserved application has been prepared for Cloudflare Pages with npm, VALOPRAC branding, security/cache policies, lazy game loading, SPA history routes, runtime error recovery and prebuild validation. The current suite contains **82 executed passing tests**. Production runtime dependency audit reported zero vulnerabilities. The build artifact's manifest, CSP/redirect policy, Korean branding and potential-secret scan passed.

The target **https://valoprac.global has not passed public verification and is not live**: authoritative RDAP returned no domain object, public DNS returned NXDOMAIN, and a real Chrome request displayed a 502 connection-refused error. Cloudflare is not connected and no production Pages project/domain/certificate has been created. Game controls/audio/GPU frame pacing in the requested deployed environment remain unverified. See [production status](PRODUCTION.md).

The original Phase 1 validation details below are historical engine evidence, not a claim that the new domain is operational.

---

# Validation and feature status

Automated validation executed on 2026-10-17 in Linux x64, Node v24.19.0, Intel Xeon Platinum 8573C. This is a container CPU environment, not a desktop graphics benchmark. Exact executed output is retained in `docs/test-output.txt` and the machine-readable report in `docs/test-results.json`.

Status vocabulary:

- **Implemented and tested**: actual automated execution exists for the stated logical behavior.
- **Implemented but not verified**: code exists, but the browser/hardware path was not exercised.
- **Incomplete**: an intended guarantee, calibration or acceptance condition remains unmet.
- **Not implemented**: intentionally absent capability; not represented as working.

| Feature | Status | Evidence and limits |
| --- | --- | --- |
| React + TypeScript + Vite production build | Implemented and tested | Strict typecheck and production build executed |
| Korean menu, settings, history and four result views | Implemented and tested | React server-markup tests; visual layout and interaction remain unverified |
| Desktop WebGL range and first-person rendering | Implemented but not verified | GPU browser path not executed |
| Pointer Lock, raw request, standard fallback, rejection messages | Implemented but not verified | User gesture and browser permissions need manual checks |
| Unsmooth mouse rotation and sensitivity arithmetic | Implemented and tested | Immediate count-to-angle and pitch clamp tests; real device transfer unverified |
| Configurable horizontal FOV and crosshair | Implemented but not verified | Compiled and markup-rendered; visual/physical acceptance pending |
| Frame-independent movement | Implemented and tested | 30, 60, 75, 144, 240 render schedules compared with 120 fixed ticks |
| Ground acceleration, inertia, speed-based release friction | Implemented and tested | Numerical acceleration/release/cap assertions |
| Direction reversal and normalized diagonals | Implemented and tested | Sign-crossing and equal-speed assertions |
| Walk, crouch, backward modifiers | Implemented and tested | Reached configured speeds and stance changes |
| Jump, gravity, restricted air control, landing | Implemented and tested | Air control and floor-contact tests |
| Box arena horizontal collisions | Implemented and tested | Wall and cover penetration assertions |
| Readiness threshold and prediction | Implemented and tested | Crossing measurement and prediction tolerance <= 1 tick |
| Neutral vs opposite braking episodes | Implemented and tested | Independent classification, initial speed and summary assertions |
| Full-stop/reversal duration separate from readiness | Implemented and tested | Separate stop and threshold observations |
| Early-shot backfill and timing consistency | Implemented and tested | Actual future threshold fills pending negative shot timing |
| Shooting while moving | Implemented and tested | Movement contribution exceeds stationary spread |
| Two rifle profiles, continuous fire and cadence | Implemented and tested | Both fire-rate schedules exercised within fixed-tick quantization |
| Ammo, reload, burst reset, no catch-up bursts | Implemented and tested | Empty/full/reload/execution tests |
| ADS and stance/air/landing spread contributions | Implemented and tested | Numerical contribution tests; browser ADS visual unverified |
| Seeded spread and target determinism | Implemented and tested | Equal seeds and full gameplay across frame schedules |
| Pitch/yaw recoil accumulation and recovery | Implemented and tested | Pattern, delay, decay and base-aim preservation tests |
| Mouse recoil compensation | Implemented and tested | Numerical compensation/recovery behavior; feel requires manual testing |
| Shared humanoid joints and exact ray hit volumes | Implemented and tested | Animated head, rotated arm, sphere-corner exclusion, nearest-hit tests |
| Headshot-only elimination and pooled respawn | Implemented and tested | Integrated head vs torso shots and reused target identity |
| Cover occlusion | Implemented and tested | Hidden/peeking head ray and tracking occlusion cases |
| Stationary, strafe, random, stop/go, crouch, peek behaviors | Implemented and tested | All six advanced for deterministic ticks; visual animation unverified |
| Four training modes and timed completion | Implemented and tested | Each runs a full 30-second simulated session and terminates once |
| Spray wall hit points and grouping calculations | Implemented and tested | Actual 3D impacts, centroid/extents/radial analytic fixtures |
| Shot ordinals, actual/ideal compensation plots | Implemented but not verified | Rendered in server markup; graph/visual browser QA pending |
| Rich shot and elimination events | Implemented and tested | Snapshot content and integrated kill records |
| Headshot, hit/miss, first-shot, elimination statistics | Implemented and tested | Known-outcome fixtures and integrated session snapshots |
| Tracking/reacquisition calculations | Implemented and tested | Exact head-ray sample, occlusion and looking-away tests |
| Local settings persistence | Implemented and tested | Storage-adapter round trip, malformed/blocked storage cases |
| IndexedDB history and bounded retention | Implemented and tested | fake-indexeddb transactions: 40 summaries, 10 details; real browser persistence pending |
| Audio cues | Implemented but not verified | Web Audio graph code exists; actual output/unlock not exercised |
| rAF frame monitoring and HUD | Implemented but not verified | Rolling FPS/p95 implemented; real display/GPU measurement pending |
| Resource/listener cleanup, input blur reset | Implemented but not verified | Explicit lifecycle implementation reviewed, browser leak/blur checks pending |
| Ten-minute engine workload | Implemented and tested | 72,000 ticks, four targets, 3,685 shots; workload report emitted by executed test |
| 144 FPS at 1080p / stable 240 Hz device input | Incomplete | No actual desktop GPU/display benchmark; goals, not results |
| Verified VALORANT constants / 1:1 sensitivity | Incomplete | All tuning is provisional and exposed; no game measurement dataset |
| Training-transfer effectiveness | Incomplete | Statistics measure in-app performance; no controlled transfer study |
| Rapier integration / general slopes or stairs | Not implemented | Not needed for box-only arena; documented resolver scope |
| Native raw hardware input, networking, multiplayer | Not implemented | Outside Phase 1 browser-local requirements |

## Executed test coverage

The final suite includes fixed-clock/movement tests, weapons/recoil tests, 3D collision tests, integrated four-mode simulation tests, storage/statistics tests, Korean server-markup tests and an engine-only ten-minute workload. Consult the retained output for the exact final count and timings.

One initial rotated-arm test incorrectly aimed through an arm rotated behind the torso. Its outward pose was corrected, preserving nearest-surface occlusion behavior. One empty-summary assertion was corrected to allow intentional nullable consistency data. Server-markup tests were adjusted for Zustand's initial server snapshot; they now test independent screens directly. No failing assertions are suppressed or skipped.

## Determinism boundary

Identical scripted input changes at identical simulation ticks produce equivalent full shot arrays, recoil, player positions and target poses across 30, 60, 144 and 240 Hz render schedules. Pure movement additionally covers 75 Hz and irregular frame drops. This establishes simulation independence for those inputs. It does not establish identical real browser mouse-event delivery at different refresh rates.

## Performance boundary

The engine-only test simulates ten minutes without WebGL, DOM events, sound or GPU work. Its measured elapsed time must not be called FPS. The report captures actual CPU execution on the container host. Real render and input latency goals remain unverified. Draw calls, rAF FPS and rolling p95 intervals are available in the implementation for later hardware profiling.

## Acceptance decision

The project is implemented, typechecked and production-buildable, with executed engine/storage/UI-markup coverage. Complete desktop Phase 1 acceptance remains **pending** the tests in `docs/MANUAL_TESTING.md`, including actual launch, input, audio, frame pacing, visual QA and absence of critical browser runtime errors.
