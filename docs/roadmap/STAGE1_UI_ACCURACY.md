# Stage 1 — F3, F5, F6 and F7

Date: 2026-10-31. Baseline: production 09.01, commit `8abf7b173698be249882ab34562016e640df4b3e`.

## Scope and evidence classification

- **F3:** preserve the already corrected 09.01 camera and measure its matrix and target projection. The convention is **horizontal angular division**, `horizontalFov = baseHorizontalFov / zoom`; vertical FOV is derived from the actual aspect ratio. It is not physical optical magnification, whose tangent-half-angle equation produces different values. `PROJECTION_CALIBRATION` records the report as a **provisional calibration** source; no direct native VALORANT measurement is claimed.
- **F5:** preserve the already corrected multipliers `.63` and `.55`. These are provisional report targets in the trainer's half-cone convention, not newly verified official values. The acceptance test now exercises actual `Simulation.step` firing and stored bullet direction instead of checking only configuration numbers.
- **F6:** preserve the 09.01 separation of four pinned essential diagnostic rows from optional collapsed vector details. Re-measure the current markup/CSS with real Chromium Pointer Lock and fullscreen.
- **F7:** fix remaining task identity errors in preparation, HUD, results, history and recent-session copy. The start button had already been fixed in 09.01. Shared `trainingPresentation` maps a task plus its settings to a name and instruction text; the underlying `free` simulation mode remains unchanged.

## Before and after

| Item | Actual 09.01 before | Updated behavior / measured result |
| --- | --- | --- |
| F3 camera targets | Already 82.4° / 41.2° / 20.6° | Unchanged; matrix reconstruction error below 1e-12°, within ±0.1° |
| F3 target size | Previously no target-projection assertion in the focused test | 30 cm target at 20 m, 1920×1080: 16.448987 / 38.310579 / 79.238082 pixels for the three zooms; width and height agree; aim-center NDC `(0,0)` |
| F5 Vandal ADS | Already `.25 × .63 = .1575°` | 4096 actual rested first shots: maximum `.157483261°`, RMS `.111118269°` |
| F5 Phantom ADS | Already `.2 × .55 = .11°` | 4096 actual rested first shots: maximum `.109993286°`, RMS `.078200007°` |
| F6 essential rows | Four pinned rows already implemented | 20 current layout cases passed, including 1366×768, 1280×720, Pointer Lock and fullscreen |
| F7 preparation | `MODES[mode].description` displayed generic Free Practice instructions for tactical/vertical/movement tasks | Actual selected task title and instructions |
| F7 HUD | Tactical task replaced by combat-rule label; unlimited tactical timer said “자유 훈련” | Actual task title; combat-rule label remains available in its title text; timer says “경과 시간” |
| F7 results/history | `MODES[session.mode].title` mislabeled free-backed tasks | Name derived from recorded session settings |
| F7 result footstep context | All non-legacy tactical maps labeled the basic range | Actual map name, including the peeking complex and vertical maps |

`STAGE1_UI_ACCURACY.json` contains exact measurements, seeds, resolutions, tolerances and pass states. No first-shot radius is expected to equal the boundary exactly: it is sampled over a uniform disc. The maximum is bounded by the configured cone, and measured RMS is compared with `cone / sqrt(2)` using a 2% cone tolerance. RNG order is retained between reset first shots and the first eight shot directions reproduce exactly with the same seed. Separate assertions retain recoil, bloom and airborne penalties.

## Files

- `src/engine/rendering/projection.ts`: explicit provisional projection metadata/documentation; no numerical camera change.
- `src/ui/trainingPresentation.ts`: shared task title, description, map label and timed-state interpretation.
- `src/ui/MainMenu.tsx`, `GameHUD.tsx`, `Results.tsx`, `History.tsx`: use the selected task consistently; preserve the `trainingStartLabel` export for compatibility.
- `src/components/GameStage.tsx`: preparation/pause task identity and instructions only; runtime/input unchanged.
- `src/tests/roadmap-stage1-ui-accuracy.test.tsx`: 22 new assertions/tests covering camera, sampled firing and all eight navigation tasks across five UI surfaces.
- `docs/roadmap/STAGE1_UI_ACCURACY.json`, `STAGE1_HUD_LAYOUT.json`: generated measurement evidence.

The eight navigation tasks are Free Practice, timed precision, tap braking, recoil, tactical peeking, vertical angle clearing, bunny hop and wall penetration. Timed moving-target tracking is additionally checked. Sensitivity exploration and aim analysis are separate analysis screens, not misrepresented as simulation training modes.

## Reproduction and results

Use the repository's Node 24.22.1 runtime and installed dependencies:

```sh
VALOPRAC_STAGE1_UI_REPORT=docs/roadmap/STAGE1_UI_ACCURACY.json npx vitest run src/tests/roadmap-stage1-ui-accuracy.test.tsx src/tests/ui-corrections-0910.test.tsx src/tests/movement-profile-ui.test.tsx
npm run typecheck
```

The isolated current React HUD fixture was rendered with the actual application CSS in Chromium 154.0.8037.57. It covers 1280×720, 1366×768, 1920×1080, 2560×1440 and 3440×1440; windowed/fullscreen; HUD scales 1 and 1.25. All four essential readouts and ammunition must remain fully visible through every clipping ancestor. Actual Pointer Lock is required. Twenty cases passed; no overlaps, clipping failures or browser errors. The 36 focused tests and 73 additional UI regressions pass; TypeScript checking passes. The fixture does not benchmark WebGL or physical input latency. External harness: `/workspace/roadmap-qa/stage1-essential-layout.mjs`; source fixture generated by the existing focused UI test.

## Performance, deployment and limitations

- Projection and simulation measurements use Three.js math and the real fixed-step simulation, not a native VALORANT client or a visual similarity claim.
- No rendering geometry, draw-call count, mouse event pipeline, shot mechanics, map collision or movement parameter changes in this subtask. Hardware FPS, physical input latency and first-entry shader behavior require the parent stage measurements.
- Full-stage build size and test totals are recorded by the release owner after integration; these focused results do not substitute for the full quality gate.
- No deployment performed by this subtask. Patch version is assigned by the release owner.
- Native validation of FOV, spread convention and target pixel size remains open. F9 walking ratio and F10 silent landing require direct reference-game measurement and are not changed here.
