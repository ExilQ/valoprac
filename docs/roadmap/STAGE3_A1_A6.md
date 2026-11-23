# Stage3 A1/A6: one-minute warm-up and flash avoidance

Status2026-11-04: functional implementation and repeatable validation pass on the existing Stage3 engine. The proposed cold-start3-second target does **not** pass on the measured software renderer. This report separates that deviation from successful input, scoring, retry and replay checks. It is not a deployment receipt.

The actual browser recording uses a frozen unreleased9.0.1 source snapshot to avoid hot updates during input capture. Current focused tests use the unreleased10.0.0 source. The seven inspected exercise/runtime/input/replay/UI modules have identical SHA256 hashes between that snapshot and the current source; replay file headers retain their real9.0.1 version rather than being rewritten.

## Implemented tasks

**A1 —1분 워밍업.** The existing3D range, normal BrowserInput, weapon, movement and hit-registration systems drive a60-second exercise. One human-shaped target actually crosses the held angle, with seeded direction and short seeded gaps between appearances. The player aims and fires manually. Only one target slot is enabled; ordinary free-range targets and their automatic respawn logic cannot leak into the protocol. The displayed score is the actual elimination count. An immediate retry creates fresh simulation/replay authority and restores the same seed/configuration while retaining the prepared renderer, canvas and material resources.

Completed comparable best scores stay in this browser. Records are keyed by game/protocol version, seed, weapon, movement profile/preset, jump buffer, elimination rule, ammunition/reload settings and task options. Early exits, partial clocks, malformed scores and mismatched task versions cannot earn a new best. Storage is bounded to64 records/64,000characters, handles unavailable storage and offers deletion. These are local personal records, not verified online rankings.

**A6 —플래시 회피.** A seeded original visual/audio cue asks the player to turn away. The controller records the initial world-space viewing vector, cue timestamp, actual angular displacement, first movement≥1degree and completion of the selected60–150degree threshold within a0.25–1.5second response window. Source position is6metres along the initial view direction. Camera rotation is entirely manual. Translation, tiny turns and late movement do not become successful avoidance. The sound is an original short mathematical synthesis, routed through the existing tactical-audio system; no Riot ability recording or asset was imported.

Both tasks run at the shared120Hz simulation rate. Their versioned initial options, seeded state, cue/turn events and resulting score are included in the common A2 replay authority. The replay outcome and viewer use the task score for flash avoidance rather than incorrectly substituting ordinary enemy eliminations. Cue and turn timeline markers correspond to real controller events; a new independent task replay format was not introduced.

## Measured results

| Check | Exact method | Result |
| --- | --- | --- |
| Focused tests | Current source; `exercise-mechanics.test.ts` and `exercise-records-ui.test.tsx` | **15/15 pass**,2files, zero failed |
| Passive warm-up |7,200 actual fixed steps; no fire or movement | Exactly60s,29 appearances/28 escapes, score0, first target at simulation time0 |
| Real3D hit/score authority | Deterministic scripted test input aims at actual target geometry and fires through Simulation |103 legitimate headshots/eliminations in60s;107 appearances; two identical replay outcomes; **7,700gzip bytes** |
| Flash timing authority | Scripted manual-look commands110degrees after each actual cue; no automatic product movement |43/43 successes; mean onset/completion258.333ms; two identical replay outcomes |
| Rejection behavior | Real translation,2degree nudges, late/uncompleted cues and malformed task options | No artificial success; unsupported/executable/unbounded options rejected |
| Actual warm-up browser input | Real prepared App/Runtime/Pointer Lock; trusted mouse down after equip readiness | **2actual weapon shots** at simulation2.175s; exactly one owned target; completed60s replay reproduces shots2, score0; **4,129gzip bytes** |
| Actual flash browser input | Trusted CDP mousemove through the real BrowserInput while locked/running | Delivered movementX1317/Y−99; actual camera yaw−2.413528556rad; avoidance score1; **no synthetic input fallback used** |
| Flash common replay | Complete remaining time through real fixed steps; replay twice from its recorded initial state | Identical checksums/outcomes, score1, real cue/turn markers; **4,497gzip bytes** |
| Initial cold target submission | Separate full-render software-browser attempt; one observed sample | **13,210.5ms** from mode action to first target-containing renderer submission; **3,000ms target unmet** |
| Prepared warm retry | Same full-render attempt, one observed sample | **441.2ms** to target submission; same renderer/canvas, fresh simulation time0 and same seed |
| Paused language change | Same App Runtime before/after English selection | Same canvas, simulation checksum and clock |

The scripted103-headshot/43-turn fixtures are reproducibility tests, not human performance data or automatic aiming in the product. The browser's17ms turn shown in the result screenshot is likewise an automation event, not a measured human reaction time. The other cues intentionally fail when the test fast-forwards without more turns; the resulting3.1% session success rate is not presented as a training-effect claim.

## Browser failures, isolation and evidence

The initial full-render browser attempt passes prepared-target,60-second inline-result, retry and locale-preservation checks, but fails its flash completion wait. Its row named “trusted firing” contains **shots0**, so that row does not establish a fired round. The raw failed report and its five recorded rows are preserved unchanged inside [STAGE3_A1_A6_BROWSER.json](STAGE3_A1_A6_BROWSER.json), rather than relabeled as a successful run.

A follow-up waits for equip readiness and asserts two actual shots. To isolate functional input from the measured SwiftShader stalls, the range still performs real paused preparation/WebGL draws, but active gameplay draws are suspended during this follow-up. BrowserInput, trusted Pointer Lock, actual fixed-step weapon/exercise logic and replay recording remain active. The test advances the remaining session time through the same Simulation.step after real input; it is not a continuous one-minute human session or a graphics benchmark. It passes **7/7 functional checks**, including the real trusted flash turn and repeated score reconstruction.

The13.21-second cold result includes development loading/preparation and a renderer submission that can occur behind the preparation overlay. It is not input-to-photon latency, and the first actionable frame can occur later. The separate441.2ms retry is also renderer submission timing, not a display-latency measurement. These single software-renderer observations do not certify integrated-GPU startup, physical mouse latency, stable FPS or headphone audibility. The3-second cold objective remains an explicit known deviation, with no claim that it was met.

Actual captured results: [flash-results.png](exercises/flash-results.png), [paused-english.png](exercises/paused-english.png). Complete input-event fields, checksums, sizes, unit outputs, original failed attempt, source hashes and limits are in [STAGE3_A1_A6_BROWSER.json](STAGE3_A1_A6_BROWSER.json). The repeatable functional harness is `measure-exercise-input-browser.mjs`; the original full-render harness is retained at `/workspace/roadmap-qa/exercise-app-browser.mjs`.

## Files and release boundaries

Core implementation: `training/exercises/{types,Exercises,personalBest}.ts`, `ui/ExerciseTraining.tsx`, `ui/exerciseTraining.css`, `engine/audio/trainingCue.ts`. Existing integration points are Simulation/session options, Runtime cue/retry hooks, TrainingPlatform, GameStage and the shared replay recorder/outcome/viewer. Tests are `exercise-mechanics.test.ts` and `exercise-records-ui.test.tsx`; this task adds15 focused cases without removing tests. Korean is the default; checked English views use the common locale system.

No new dependency, account, network scoring service, tracking or external game asset is required. The cue/task timing is an original training protocol, **not** a claim of native VALORANT ability parity or clinical reaction-time accuracy. Whole-release build/transfer size, physical GPU behavior, input latency, final patch number and actual production deployment are owned by the final release gate. Neither this functional acceptance nor the local best-score storage adds online rankings.
