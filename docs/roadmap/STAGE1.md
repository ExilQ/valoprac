# Stage1: correctness gate

Status2026-10-31: **software gate passed**. Source checkpoint for the next platform release; not separately deployed. Production remains09.01 until the full release workflow succeeds. Native reference parity is not a gate result.

Implemented/verified: **F1,F2,F3,F4,F5,F6,F7,F8**. Measurement-gated, unchanged: **F9,F10**.

| Item | Actual09.01 baseline | Updated measurement | Evidence |
| --- | --- | --- | --- |
| F1 | Held-forward walk2.592,crouch1.944,Operator5.13m/s already corrected | Same forward speeds, immutable takeoff budget and continuous reverse steering; CS2/classic600-tick SHA unchanged | STAGE1_MOVEMENT report/JSON |
| F2 | Apex0.729583m, flight0.566667s | Apex1.1499695m, sampled flight0.641667s; ballistic target about0.647s | STAGE1_MOVEMENT report/JSON |
| F3 | 82.4/41.2/20.6° already corrected | Projection matrices/actual pixel extent and aim center validated at16:9 and ultrawide | STAGE1_UI_ACCURACY.json |
| F4 | Expert held20m median316.7ms, minimumsetting233.3ms | 287.5/208.3ms; beginner/normal/advanced timing arrays unchanged, beginner/normal simulated survival unchanged | F4_MEASUREMENTS.json |
| F5 | Correct multipliers already present | 4096 actual shots per rifle: Vandal max0.157483°, Phantom max0.109993° | STAGE1_UI_ACCURACY.json |
| F6 | Essential09.01 HUD correction present |20 actual browser layouts, PointerLock/fullscreen,1280–3440 width,1–1.25scale pass | STAGE1_HUD_LAYOUT.json |
| F7 | Free-backed tasks still misnamed in preparation/HUD/results/history | Shared actual task title/instructions throughout those screens | STAGE1_UI_ACCURACY.md |
| F8 |200msstall compressed retained onset gap to60.729ms |90.917/90.917/90.896ms gaps,11Hz target±one48kHzsample | STAGE1_AUDIO_ONSETS.json |

Files/algorithms and targeted tests are enumerated in the linked per-area reports. Main changes: `Movement.ts`, `MovementSolvers.ts`, `config/movement.ts`, narrow weapon-context call in `Simulation.ts`; expert-only held-angle calibration in `DefenderAI.ts`/`BotAimMotor.ts`; bounded per-emitter `FiringTimeline.ts`; shared `trainingPresentation.ts` used by preparation, menu, HUD, results and history. The portable disabled Unreal staging exporter explicitly omits browser-only integration/takeoff fields; this is not an Unreal runtime port.

Full application regression: **994/994 tests in71files passed**, plus unchanged broker20/20 and hosting12/12. TypeScript and diff-whitespace checks pass. Initial full run found two expectations tied to the old shorter jump trajectory; updated tests wait for actual contact and compare normalized speed retention, preserving the intended traversal/friction assertions. No tests were removed. Original baseline940/940 is recorded in `/workspace/roadmap-qa/baseline-tests.log`. A redundant frozen-worktree full run had one dependency-resolution failure for an Epic package through a shared node_modules symlink; the unchanged primary-checkout baseline passed.

Rendering/input limits: stage1 does not alter mouse delivery, rendering cadence or shader paths. Actual PointerLock/HUD tests pass; movement is120Hz, including trajectory comparisons and unchanged CS fixtures. No physical input-to-photon or real integrated-GPU measurement is claimed. Stage2 repeats renderer counts and software-device frame observations.

Baseline build: all JS/CSS1,809,589uncompressed bytes,512,429gzip bytes (all optional chunks included, not initial transfer). Fresh anonymous Chromium production resource timing measured **395,885encoded bytes** for the settled main menu,10resources. These replace historical380kB as this task's baseline. Source/build-size changes and final build checks are reported at release; a stage-specific production artifact has not been published.

Known limitations: F1/F2/F3/F4/F5 proposed reference numbers are provisional calibrations; F4 survival fixtures are deterministic synthetic trajectories, not human trials. F8 adds at most150ms audio-only repair delay for retained late bursts; it never delays gameplay. F9 walking ratio and F10 silent landing require controlled native VALORANT measurements. Walking ratio0.48 and existing impact audibility are retained, with landing events separate from ordinary accumulated steps.
