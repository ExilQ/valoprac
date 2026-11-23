# Stage2 rendering: I3 and I6

Source status: implemented and measured on the unreleased tree based on09.01. This report is not a publication receipt. Production remains09.01 until the owning release workflow succeeds.

## I6: matched actual renderer work

The baseline is frozen at `8abf7b173698be249882ab34562016e640df4b3e` in `/workspace/roadmap-baseline`. Both source versions were imported directly into fresh Chromium154.0.8037.57 sessions. Conditions:1366×768 CSS pixels, render scale0.5, eleven requested targets, fixed stationary scene, original maps, identical preset settings, seed and two declared camera poses. Measurements use actual WebGL draw submissions, with `gl.finish()` only in this workload-count harness. They are not hardware FPS measurements. The report's historical204-call figure is not substituted for the freshly measured09.01 baseline.

| Map | Preset | Camera | Draw calls before→after | Submitted triangles before→after |
| --- | --- | --- | --- | --- |
| complex | Low | entry |54→45|93,446→94,442|
| complex | Low | gallery |63→45|94,830→94,574|
| garage | Low | entry/gallery |48→43|31,212→31,084|
| complex | Medium | entry |118→101|190,189→191,185|
| complex | Medium | gallery |136→110|192,665→192,409|
| garage | Medium | entry/gallery |98→92|60,899→60,771|

Both complex cameras meet the proposed **≤120 draw-call budget** on Low and Medium. Medium gallery reduces submissions19.1% relative to the measured09.01 baseline. Merging a wider static batch intentionally increases entry submissions by996 triangles,0.52% on Medium; gallery submitted triangles decrease. No claim of universally lower triangle submission or measured hardware FPS is made.

Changes:

- `GroundContacts.ts` submits existing floor rings and contact shadows in two instance batches. Per-target frustum checks retain the old visibility behavior, active/enabled rules, exact interpolation and original dimensions. The zero-thickness transparent double-sided rings use one raster pass. These visual helpers never enter gameplay collision or bullet hit registration.
- `StaticGeometry.ts` adds a conservative material signature. Only immutable, untextured materials whose serialized shading/depth/blending state matches can share a constant-color palette batch. Constant **linear** colors move to vertex colors. Textures, dynamic surface materials, custom shaders, clipping and different PBR/depth flags remain separate.
- `RangeRenderer.ts` applies those batches to static architecture and retains the original tactical collision/spawn/navigation data. Weapon and character geometry is unchanged. Its optional `recordFrames=false` switch is reserved for replay inspection; ordinary gameplay retains authoritative rendered-frame capture by default.

Actual matched screenshots: [before](rendering/complex-medium-before.png) and [after](rendering/complex-medium-after.png). Visual inspection found the same architectural composition, weapon silhouette, target visibility and cover edges. Minor floating-point palette conversion differences are possible; pixel identity is not claimed.

## I3: preparation readiness and truthful progress

The existing09.01 preparation already compiles world/viewmodel materials, warms real canvas and postprocess variants, uploads hidden weapon variants and waits for a GPU fence before play. This update adds `preparationStatus`: idle, compiling, warming, GPU wait, ready, failed or disposed, plus actual elapsed milliseconds and revision information. KHR parallel compilation exposes actual completed/total program counts when available. Synchronous compilation uses a null count while pending; there is no invented percentage. The owning runtime displays this progress and continues to require readiness before Pointer Lock.

All measured visible frames added **zero shader programs after preparation**. Prepared programs decreased38→37 on Medium and25→24 on Low. Program count is an implementation observation, not a generic asset-load or speed guarantee.

## First-three-second software observations

The startup harness uses the actual Simulation,120Hz FixedClock and RangeRenderer, ordinary asynchronous WebGL submission, no per-frame `gl.finish()`, and a three-second observation window after preparation. Frame intervals use actual rAF **callback arrival** times. The first simulation interval is zero. Raw rAF opportunity timestamps are retained separately because a queued timestamp can predate completion of synchronous preparation. Render CPU duration excludes GPU completion, display scanout and peripheral delay.

| Fresh run | Frames | Maximum arrival interval | p95 arrival interval | Intervals over100ms | New shader programs |
| --- | --- | --- | --- | --- | --- |
| baseline, original |42|163.2ms|103.4ms|3|0|
| current, original |14|520.7ms|520.7ms|11|0|
| baseline, sequential pair1 |18|391.3ms|391.3ms|14|0|
| current, sequential pair1 |37|194.2ms|188.5ms|10|0|
| current, sequential pair2 |36|187.3ms|177.3ms|11|0|
| baseline, sequential pair2 |23|259.2ms|233.9ms|19|0|

All raw samples are retained in [STAGE2_RENDERING.json](STAGE2_RENDERING.json). The original adverse result was not discarded. Two sequential pairs reverse the source order and avoid concurrent heavy browser rendering, but this shared SwiftShader CPU renderer still has substantial scheduling variance. These runs support the explicit software-renderer warning and Low recommendation; they do **not** establish an FPS improvement or a stable100ms upper bound.

The proposed first-three-second **100ms criterion on a validated integrated GPU remains unverified** because no physical integrated GPU is available. The software renderer itself exceeds100ms in every observed run. Physical input-to-photon latency, high-refresh hardware behavior and total loading-time improvement are also unverified. No automatic blocking or false hardware qualification is introduced.

## Tests, repeatability and release limits

Final relevant suite: **61/61 tests across6files passed**, including new palette identity, exact tint, dynamic-material exclusions, ground-helper dimensions/interpolation/visibility, truthful preparation phases, disposal/error handling and actual driver completion. Existing rendering, original weapon art, static geometry, peeking visibility and mechanics traversal tests pass. Full application regression, build-size comparison and production checks are performed by the owning stage/release workflow.

Repeatable environment harnesses: [workload](measure-render-workload.mjs) and [startup](measure-render-startup.mjs). Run a Vite server from each declared source tree and pass its origin, an output name and preset to the script. The captured scripts use this execution environment's installed Playwright path and write raw artifacts under `/workspace/0910-qa`; those locations must be adapted outside this environment. They are QA tooling, not production dependencies or network telemetry.

No new package, external asset, tracking request or proprietary map asset was added. The extra module is part of the existing lazily loaded3D renderer. Runtime/build transfer size is reported at the final release, rather than inferred from these source files.
