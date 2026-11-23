# Stage2 event highlights: I9

Status2026-11-01: implemented and verified in the working source. This stage is
not separately deployed; production remains09.01 until the release owner
completes the versioned publishing and production verification workflow.

## Selection and evidence boundaries

09.01 exposed averages and detailed statistics but did not select a short list
of moments to review. `session-highlights-1` now selects at most five moments
from actual retained `SessionData` events. It returns fewer when there are not
enough valid events, and no panel at all when there is no source data. It never
fills a three-item minimum with invented successes or recommendations.

Supported evidence is deliberately specific:

- Fastest recorded head reacquisition after target direction change, measured
  from its change timestamp plus recorded game latency. This is not a pure human
  visual reaction-time experiment.
- Fastest and slowest recorded target elimination, using the event's actual
  spawn-to-elimination elapsed time.
- Longest contiguous retained non-hit shot sequence. Wall-analysis exercises are
  excluded; invalid records, reversed time and changed life generation split a
  sequence.
- An accurate headshot after a measured neutral or opposite-input brake, ranked
  by nonnegative time after crossing the actual accuracy threshold.
- Largest recorded first-shot ballistic angular error. This includes spread and
  recoil in the shot ray; a pure initial mouse-flick error is unavailable and is
  not fabricated.
- Exposure duration from the last retained death event. The current session
  model does not retain every death, so this is not called the longest of all
  historical deaths or a measurement of exposed screen area.

Each item carries a deterministic ID, type, simulation timestamp, metric, unit,
reason, source kind and source event index. Problems and distinct positive
examples have explicit fixed selection priorities; metric ties use timestamps
and source indices. Selected items are displayed chronologically. Equivalent
input data produces identical selections without random numbers or wall-clock
decisions. Session objects are not mutated.

Invalid/future timestamps and nonfinite or impossible timing are rejected,
not clamped into apparently valid replay positions. Work is bounded to the last
4096 records per source and at most five output items. Pruned local histories
retain their summaries but do not acquire highlights from those summaries.

## Replay boundary

`SessionHighlights` accepts an optional `onSeek(timestamp,moment)` callback.
Stage2 results render the list without seek controls because no compatible
viewer has been supplied yet. The callback passes the exact selected simulation
time and source item. A2 in Stage3 must supply the actual replay viewer before
seeking is presented as a working feature.

## Reproducible measurements

The synthetic12-second retained-event fixture contains8shots,3kills,2reactions
and one retained death. It is a deterministic test of the selection algorithm,
not a human training outcome. Current output is:

| Time | Selected event | Metric |
| --- | --- | --- |
|1.0s|Longest non-hit sequence|3shots, ending1.4s|
|2.0s|Slowest retained elimination|1.8s|
|3.0s|Closest valid braking headshot|10ms after accuracy threshold|
|4.2s|Fastest head reacquisition|200ms|
|10.0s|Retained death exposure|1.1s|

The five timestamps are within the session, chronological and unique by ID.
Repeated selection is identical; empty source events yield no items.
[STAGE2_HIGHLIGHTS.json](STAGE2_HIGHLIGHTS.json) records the exact values,
algorithm version, environment, selection checksum and limitations.

Nine I9 tests cover real source selection, timing validity, no fabricated flick
measurement, wall-analysis exclusions, sequence boundaries, bounds/ties,
formatting, no empty cards and exact future seek callback arguments. The affected
highlight/UI/streaming check completed **42passed,0failed across3files**.
The separately repeated I9 fixture check passed9/9. TypeScript passed on the
current source; the release owner runs the full gate after all Stage2 areas are
integrated. No tests were removed to obtain these results.

Native Chromium154.0.8037.57 rendered the actual React server-markup fragment and
current component CSS at390,768,1366 and1920pixels, both without controls and with
the future callback-enabled control layout: **8/8layouts passed**, with five rows,
no horizontal overflow and no time/body/metric overlap. This isolated component
fixture is not a production-navigation or gameplay test. Exact bounds and its
environment are retained in
[STAGE2_HIGHLIGHTS_LAYOUT.json](STAGE2_HIGHLIGHTS_LAYOUT.json).

To reproduce the fixture, set `VALOPRAC_HIGHLIGHT_FIXTURE` and/or
`VALOPRAC_HIGHLIGHT_HTML` to local artifact paths when running
`src/tests/session-highlights.test.tsx`. These optional test-only exports do not
upload training data or create runtime telemetry.

## Files, costs and limitations

- `src/training/analytics/highlights.ts`: bounded deterministic selection and
  metric/time formatting.
- `src/ui/SessionHighlights.tsx` and `sessionHighlights.css`: compact Korean
  result rows, responsive layout and optional callback.
- `src/ui/Results.tsx`: integrates the panel with real session results.
- `src/tests/session-highlights.test.tsx`:9 behavior/UI cases and optional local
  evidence-fixture export.

No external dependency, account, network service or telemetry upload was added.
Selection occurs in result presentation, not the input/fixed-step firing path.
Rendering FPS and physical input-to-photon latency were not measured for this
panel and are not claimed improved. The release owner reports aggregate build
and transfer size; no separately built Stage2 artifact is represented as live.
The patch version remains9.0.1 in source until final release metadata is assigned.

Known limits: detailed history can be pruned, pure flick instrumentation is absent,
only the latest death is retained, no human effectiveness study was performed,
and replay-linked seeking remains an A2 integration requirement. None of these
limits depend on unverified native VALORANT mechanical constants.
