# Stage2 I5 — local pre-training environment check

Status 2026-11-01: implemented and software/browser checks passed. This is a source-stage report for the next platform release; it does not claim a new production deployment. Production 09.01 remains the reference until the release workflow is verified.

## Implementation

New files: `src/engine/input/EnvironmentCheck.ts`, `src/ui/EnvironmentCheck.tsx`, `src/ui/environmentCheck.css`, `src/tests/environment-check.test.tsx`. Root integration mounts the panel in the existing paused/preparation UI in `GameStage.tsx`; no mandatory modal or external service was added.

Before this stage, `InputDiagnostics` already recorded delivered events, callback cost, delivery delay and relative deltas, while `InputLatencyProbe` recorded a DOM-event-to-render-submit CPU proxy. There was no single pre-training capability/readiness panel. These existing probes are reused, rather than replaced or reinterpreted as hardware measurements.

The compact, initially collapsed panel presents nine rows: Pointer Lock, raw input request, relative event delivery, input consistency, callback cadence, render interval, fullscreen, graphics classification and optional battery information. Each row has one action. Missing or restricted observations remain unknown. Driver names and integrated-GPU classification remain explicitly reported names/heuristics; an independently measured device performance result is not inferred.

Policy thresholds are advisory: input consistency warns when observed delivery p95 exceeds 16ms or callback p95 exceeds 2ms, after at least 32 events. Chosen frame limits inform the rendering warning budget. These thresholds do not certify competitive input latency. An idle paused cursor does not become a false zero-Hz device warning.

The rAF probe samples actual `performance.now()` callback arrivals, not the callback's render-opportunity timestamp. It retains at most 120 intervals, finishes after 120 samples or 2.2 seconds, and discards hidden-tab gaps. Open-panel timers and fullscreen listeners are removed on collapse/unmount; this component is absent during active gameplay. Optional battery rejection/absence is handled without blocking play. No observation is uploaded.

## Executed validation

- **22/22 automated tests**, zero failures: unavailable/denied/fallback capabilities, raw-request semantics, cancelled input deltas, idle input, invalid numbers, selected 30 FPS limits, software/integrated/unknown device names, battery/fullscreen limits, bounded cadence, hidden tabs and compact Korean markup.
- **TypeScript passed**. Whitespace validation passed.
- Actual **Chromium 154.0.8037.57**, Linux headless, WebGL2/SwiftShader: trusted button click acquired Pointer Lock; real delivered mouse events changed the existing `Simulation.look` orientation. The browser selected ordinary relative-input fallback; the panel reported that fallback instead of claiming verified raw sensor input.
- Final probe captured **97 delivered movement events**, nonzero relative X/Y and changed yaw/pitch. Its callback p95 was 0.100 ms and delivery p95 was 40.700 ms. The panel correctly warned about the observed delay. These automation/shared-CPU observations are not a physical-mouse latency benchmark or a claim of improvement.
- Nine real-API rows rendered. Fullscreen entry/exit from a trusted click updated the open panel. Collapse/reopen and unmount completed cleanly. No external HTTP requests or telemetry uploads occurred.
- **Four actual layouts passed**: 1366×768,1280×720,1920×1080 and 390×844. No horizontal overflow or clipped row content. The expanded panel can extend the existing preparation page and remain reachable by normal scrolling; it never covers an active aiming view.

The repeatable probe is `/workspace/roadmap-qa/environment-browser.mjs`; raw results and actual row text are retained in [STAGE2_ENVIRONMENT.json](STAGE2_ENVIRONMENT.json). Full-page captures are `/workspace/roadmap-qa/environment-{width}.png`. An earlier fixture run failed because its manual ReactDOM import missed CommonJS default interop; the corrected harness was rerun successfully. That failed harness result was not counted as an application pass.

## Limits and budgets

This fixture deliberately creates only a tiny WebGL context for capability queries and performs **no 3D render/warmup**. Render timing and CPU-submit latency therefore remain unknown in this probe; the panel accepts actual Runtime observations in normal training. Renderer budgets and first-three-second frame observations belong to the separate I3/I6 report.

Physical sensor reporting rate, true display refresh, operating-system acceleration/power-saving settings, GPU completion and input-to-photon latency are not measured. Battery status is only what the browser reports; headless charging/level data is not a real laptop power experiment. High-polling-rate device stability still requires a real device and controlled repeated input. No native VALORANT measurement was performed. No official mechanics constants changed.

No dependencies, accounts, tracking or network APIs were introduced. There is no active-gameplay sampler added by this panel. Its final compressed build contribution and total transfer size will be measured by the release build, rather than estimated from TypeScript source.
