# Storage, replay import and aim analysis audit — 2026-11-15

This is a bounded source review of the current unreleased 12.00 checkout, not the historical GitHub 2.3 tree. The pre-audit comparison is the retained `checkpoint/12.00-before-comprehensive-audit-20261110` snapshot. No gameplay, sensitivity calibration, recommendation coefficients or statistical algorithm was retuned.

## Verified corrections

| Area | Reproduced defect | Corrected behavior |
| --- | --- | --- |
| Training history | Concurrent saves read outside their write transaction, allowing the 40-session / 10-detail limits to race; an earlier pending save could follow a clear. | Read, insertion and retention pruning share one readwrite transaction. Completion and abortion are observed, and synchronous IndexedDB security failures no longer remain cached. |
| Replay file import | `readReplayFile` compared every file only with current metadata and rejected authentic supported 10.00 / simulation-2 files. | Import uses the same `replayRulesFor` compatibility registry as playback. Historical identity and checksum remain intact; mixed or altered metadata is rejected. |
| Aim database retry | A synchronous `indexedDB.open` exception left a rejected promise cached permanently. | The cached opening promise is cleared on rejection so a later permitted access can succeed. |
| Aim plan retention | Two independent writer contexts at the 180-plan boundary retained 181 plans. | Plan read, insert and pruning occur in one serialized IndexedDB readwrite transaction. |
| Aim deletion ordering | A pending plan save could restore the plan after `clearAimData` completed. | Plan saves join the existing write queue and epoch checks; clear waits for queued writes and invalidates earlier operations. |
| Raw aim trace budget | Separate per-tab record queues could retain 65 trajectories under the 64-trace limit. | Record read, summary write, trace write and pruning share one records/traces transaction; summaries remain available after old traces are removed. |

The IndexedDB transaction ordering applies across connections. It does not stop another active tab from intentionally creating a new session after deletion. Storage availability, quota and real-device browser behavior still need runtime checks.

## Changed files and regression evidence

Retained changes from the previous audit are `src/storage/history.ts`, `src/ui/ReplayViewer.tsx`, `src/tests/history-concurrency.test.ts` and `src/tests/replay-import-compatibility.test.ts`. This final pass adds `src/tests/aim-storage-concurrency.test.ts` and corrects `src/aim/storage.ts`.

Four new aim-storage regressions were run against the frozen pre-audit storage implementation through a temporary Vite load override, without replacing the live source file. All four failed for the stated reasons: cached security rejection, 181 plans, one resurrected plan and 65 traces. The same four tests pass with the corrected implementation. The before-run failure log is `/workspace/full-audit-20261110/aim-storage-before-expected-failure.log`; this is intentional defect evidence, not a failed release gate.

Focused validation: **114 tests passed in 10 files**, using direct Vitest and fake-indexeddb. The exact output is `/workspace/full-audit-20261110/storage-aim-final-focused-2.log`.

```sh
node_modules/.bin/vitest run \
  src/tests/aim-storage-concurrency.test.ts \
  src/tests/history-concurrency.test.ts \
  src/tests/replay-import-compatibility.test.ts \
  src/tests/replay-viewer.test.tsx \
  src/tests/exercise-records-ui.test.tsx \
  src/tests/aim-science.test.ts \
  src/tests/precision-statistics.test.ts \
  src/tests/precision-protocol.test.ts \
  src/tests/zoom-analytics-compat.test.ts \
  src/tests/storage-statistics.test.ts
```

The set includes authentic frozen legacy replay reconstruction, invalid compatibility rejection, history/aim storage, exercise records, scoped compatibility, repeated-block statistics and protocol gates. The synthetic statistical coverage printed by existing tests is a software check; it is not a human training-effectiveness measurement. The parent agent owns the final full suite, typecheck, browser workflow and build gates.

## Review coverage and limits

Read in full or through their relevant source paths: `src/storage/history.ts`, `src/aim/storage.ts`, `src/app/store.ts`, `src/training/exercises/personalBest.ts`, `src/aim/AnalysisService.ts`, `src/aim/math.ts`, `src/aim/optimizer.ts`, `src/aim/precision/statistics.ts`, `src/aim/precision/longitudinal.ts`, `src/aim/precision/calibration.ts`, `src/aim/projection.ts`, `src/aim/Telemetry.ts`, `src/training/analytics/statistics.ts`, `src/training/analytics/LifetimeStats.ts` and `src/training/analytics/highlights.ts`.

Also inspected the replay import/display boundary, neutral/combat compatibility and block aggregation portions of `src/aim/statistics.ts`, the event/segmentation validity portions of `src/aim/analyzer.ts`, scenario validation/serialization boundaries, and aim storage call sites in `AimRuntime`, `CombatCapture` and `AimDashboard`. These checks found no additional verified scoring or recommendation defect requiring a change in this pass. This is not a formal proof that every analytics or UI path is defect-free, and it does not replace physical mouse, browser rendering or long-term human measurements.

All writes for this audit pass are complete. No commit, deployment, external service, tracking or dependency change was made.
