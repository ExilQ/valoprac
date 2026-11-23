# Runtime, audio, input and replay audit — 2026-11-15

This review finalizes the existing unreleased 12.00 changes against checkpoint
`checkpoint/12.00-before-comprehensive-audit-20261110` (`6dcb6e0`). It does not
replace the application, retune weapon or movement calibration, or change the
retained historical simulation-2 execution rules. The inherited fixes were
reviewed and verified. This finishing pass additionally made recorder completion
terminal and defensive after reproducing an API-level stale-outcome edge.

## Reviewed source

- `src/engine/Runtime.ts`: preparation, Pointer Lock state, pause, fixed-step
  delivery, exercise restart, callback binding/unbinding, recording lifecycle,
  movement ghost snapshots, rendering cadence and disposal.
- `src/engine/audio/Audio.ts`, `FiringTimeline.ts`, `spatial.ts`, `occlusion.ts`:
  audio clock anchoring, per-emitter shot admission, contact identities, material
  boundary events, pooled buffers, voice disconnection and fresh-session reset.
- `src/engine/input/Input.ts`, `InputCommandBuffer.ts`, `InputDiagnostics.ts`:
  finite relative mouse delivery, one-shot edges, movement timestamps and reset.
- `src/engine/simulation/FixedClock.ts`: fixed 120 Hz work and retained debt.
- `src/engine/replay/recording.ts`, `playback.ts`, `types.ts`, `validation.ts`,
  `integrity.ts`, `codec.ts`: export budgets, timed finish, bounded journals,
  compatibility selection, cancellation and deterministic reconstruction.

This is a targeted correctness and lifecycle audit of these paths, not a formal
proof that every possible caller or browser configuration is defect-free.

## Reproduced defects and fixes

| Defect | Previous behavior | Current behavior and regression evidence |
| --- | --- | --- |
| Reusing audio after an exercise retry | A fresh simulation restarts time and event IDs, while `stop()` retained last shot/contact IDs and latest per-emitter firing times. Early new sounds could be rejected as old duplicates. | `TrainingAudio.resetSession()` releases voices, resets admission identities and anchors the retained context to the new authority. Only `Runtime.restartExercise()` calls it; ordinary pause/weapon changes keep deduplication. The test reuses the same five buffers and context, accepts new ID 1 events at the new clock, and rejects repeats. |
| Automatic graphics frame cap not used by runtime pacing | The renderer privately applied the software-device cap, while runtime cadence read the unchanged recorded preference. | Runtime reads `renderer.effectiveFrameLimit`. A synthetic 240-frame schedule submits 60 draws at the effective 60 cap, with identical authoritative ticks/time and an unchanged recorded unlimited setting. |
| Non-finite frame timing | Adding NaN or infinity permanently poisoned fixed-step debt. | Non-finite incoming elapsed values add no new time. Existing finite debt still drains through the ordinary bounded fixed-step loop. A 2.5-second debt test retains and processes all 300 ticks. |
| Non-finite relative mouse event | Invalid movement components could reach camera orientation and the timestamped movement stream. | The input handler ignores a relative event unless both components are finite. Existing valid high-rate gain and input delivery remain covered by regressions. |
| Synthetic material boundaries | Partitioned penetration intervals could trigger audio for an interior split rather than a physical surface. | `Audio.impacts()` honors optional `entrySurface`/`exitSurface` flags supplied by current ballistics. Absent flags retain legacy behavior. Input segment data is unchanged by playback. |
| Exact replay command budget | A recording could consume every command slot and then append an extra final state command during snapshot. | One slot is reserved for the final control command. The last admissible snapshot validates and reconstructs; further recording fails explicitly while live shooting continues. |
| Replay duration crossing | The previous pre-step time check could admit one over-limit tick and export a file the validator rejects. | The recorder checks the next fixed tick against the duration budget before recording it. The authority still advances and fires after recording stops. |
| Final event backfill | A timed final shot could add events beyond the validated envelope. Repeated linear searches also multiplied backfill work. | A kind/time set makes backfill linear in bounded journals; the completed envelope is checked before export. An over-limit final shot produces no purported valid replay. |
| Non-finite seek chunk | A NaN chunk budget could yield indefinitely without executing commands. | Non-finite budgets use a finite default; finite budgets are floored and clamped. The regression reaches the requested 240th tick. |
| Repeated completion after live simulation continues | A second `finish()` or `snapshot()` could combine frozen commands with a later live outcome. | One bounded terminal snapshot is retained; subsequent results are defensive copies of that same completed state. A recording disposed before completion returns no purported final result. Tests mutate returned data, perform a real later shot, dispose, and verify the unchanged replay. |
| Already-aborted seek | A cancelled request reset the visible authority and could supersede a valid seek before noticing cancellation. | Abort is checked before replacing the simulation or incrementing generation. Tests preserve both an existing verified pose and an in-flight valid seek. |

## Executed verification

Environment: Linux x64, Node 24.22.1 selected through the existing task-specific
PATH, Vitest 3.2.7. Commands used the installed executable directly; no package
installation, dependency upgrade, full build or deployment was performed here.

The first focused run passed **40 tests in 7 files**, including the actual frozen
10.00 fixtures in `replay-physics-versions.test.ts` and the presentation
compatibility test. Log:
`/workspace/full-audit-20261110/final-runtime-replay-focused.log`.

The broader affected regression run passed **152 tests in 26 files**, with no
failures:

```sh
node_modules/.bin/vitest run \
  src/tests/audio-*.test.ts src/tests/spatial-audio.test.ts \
  src/tests/surface-audio-selection.test.ts src/tests/surface-audio.test.ts \
  src/tests/runtime-audio-boundaries.test.ts src/tests/runtime-platform.test.ts \
  src/tests/input.test.ts src/tests/tactical-input.test.ts \
  src/tests/input-movement-tools.test.ts src/tests/replay-*.test.ts \
  src/tests/presentation-replay-compatibility.test.ts \
  src/tests/scenario-replay-integration.test.ts \
  src/tests/movement-practice-replay.test.ts
```

Log: `/workspace/full-audit-20261110/final-runtime-replay-regressions.log`.
These files include deterministic combat outcomes, imported old recordings,
scenario and movement replays, spatial audio structure, material sound selection,
audio lifecycle, stalled firing cadence and input tools. Synthetic high-polling
input timings are CPU observations rather than physical-device latency results.

## Limits and terminal storage contract

Real Pointer Lock/browser workflows, physical audio listening, GPU performance,
input-to-photon latency and full production packaging are owned by the integrated
release validation. The Node audio regressions use an explicit Web Audio mock;
they verify scheduling, admission and resource calls, not acoustic output.

The recorder retains at most one final replay snapshot within the existing
command, duration and event budgets. Returning a defensive copy costs additional
bounded memory and copying at completion or an explicit later snapshot request;
this does not run per mouse event or render frame. Runtime already caches the
completed result, so its ordinary completed-session path does not repeatedly
request these copies. Disposal without `finish()` abandons recording and cannot
later create a valid-looking result from an unrecorded simulation tail.

Historical recording bytes and command encodings were not rewritten. No exact
cross-platform replay or native VALORANT parity claim is made.
