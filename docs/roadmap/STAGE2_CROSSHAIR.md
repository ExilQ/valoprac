# Stage2 I7/I8: sensitivity readouts and crosshair configuration

Status: implemented in the current source and locally verified2026-11-01. This report does not establish production publication;09.01 remains the last verified deployed release until the root release workflow publishes its successor.

## I7 sensitivity diagnostics

09.01 already separated hip sensitivity, rifle ADS, Operator2.5x and5x multipliers and displayed delivered mouse counts per360°. These controls and their existing input/zoom logic are preserved. The controls tab now adds explicit eDPI and identifies centimeter output as a calculation from the supplied DPI, not a physical measurement.

The selected conversion remains0.07degrees per delivered count per unit sensitivity. At sensitivity0.5 and800DPI, automated and actual UI checks measured:

- eDPI:400.
- Counts/360°:10285.714285714284, displayed rounded to10,286.
- Derived cm/360°:32.65714285714285, displayed32.7.

This formula describes the configured trainer model; operating-system acceleration, raw sensor delivery and actual physical centimeters are not verified by a DOM readout. The arithmetic FOV convention and independent scope gains remain the already disclosed09.01 calibration.

## I8 crosshair model and interface

The former flat color/thickness/gap/length fields are retained for existing profiles. A bounded nested `crosshairAdvanced` field adds outline size/opacity, center dot size/opacity, independent inner/outer visibility and opacity, an ADS policy (`dot`, shared primary, or custom), and per-weapon hip/ADS display flags. Existing rifle ADS defaults remain a compact2px central dot. The Operator keeps its separate sniper-scope reticle.

An SVG centered at `(0,0)` renders the selected design without changing aim or weapon simulation. CSS applies the existing optional movement/recoil gap outside the authoritative aim. Every advanced setting passes finite numeric/color sanitization; old settings receive independent nested defaults without sharing mutable objects.

The Korean crosshair tab contains immediate primary/ADS previews, three presets, shape controls, code import/export/copy, and up to12 named local profiles with apply/delete actions. Copy failure offers manual copying. Local storage denial or quota exhaustion yields a clear message and leaves the current design usable. No network service, account, telemetry or dependency was added.

## Supported code boundary

The parser implements a declared static symmetric subset of version0 semicolon-delimited VALORANT-style codes: primary `P`, optional independent ADS `s=1;A`, supported palette/custom opaque RGB colors, outline, center dot, and symmetric inner/outer lines. It never executes imported content. It rejects unsupported sniper `S`, asymmetric lines, dynamic-error multipliers, duplicate keys/sections, non-finite/out-of-range numbers, malformed data and excess resources. It does not silently discard unsupported fields.

Limits are4096characters,256tokens,32characters per token; local profiles are limited to12,32-character names and64kB serialized data. Export creates a canonical supported code representing primary/ADS appearance. Weapon display flags and the trainer's dynamic error feedback remain local preferences and are explicitly excluded from that interoperable code. Import disables dynamic error feedback so the imported static shape matches its preview.

Five representative codes round-trip to equivalent supported primary/ADS settings; native VALORANT client import/export was not available for direct verification. The implementation is a transparent supported subset, not a claim of complete proprietary format compatibility.

## Verification and evidence

-70/70 affected tests in4files passed: crosshair codes/settings/rendering, general UI, legacy settings migration and storage/statistics.
-39 crosshair/sensitivity cases include five representative code round trips, malformed and unsupported keys, resource limits, local storage failure, profile validation, nested migration, SVG shape/aim origin and weapon display.
-TypeScript and `git diff --check` pass.
-Actual Chromium154.0.8037.57 browser UI:14/14 checks pass, no page errors. Import/export was exercised through real buttons and text input; clipboard was read after a real copy action; a saved local profile survived reload and was applied/deleted.
-Four actual layouts390×844,1366×768,2560×1440,3440×1440 have no horizontal overflow. Primary and ADS preview centers have exactly0px X/Y error relative to their samples.
-Measurements: [STAGE2_CROSSHAIR.json](STAGE2_CROSSHAIR.json), [STAGE2_CROSSHAIR_BROWSER.json](STAGE2_CROSSHAIR_BROWSER.json). Browser harness retained at `/workspace/roadmap-qa/crosshair-browser.mjs`; screenshots and logs remain under that QA directory.

Files: `src/config/crosshair.ts`, `crosshairCodes.ts`, nested settings/type additions, `src/components/Crosshair.tsx`, `crosshair.css`, `src/ui/CrosshairDesigner.tsx`, crosshair/eDPI sections of `SettingsPanel.tsx`, narrow actual-weapon prop wiring in `GameStage.tsx`, and `src/tests/crosshair-codes.test.tsx`.

Rendering cost, whole-platform transfer size and input latency are evaluated by the overall stage/release reports. This SVG/settings change makes no hardware FPS, input-to-photon, human efficacy or native-game parity claim.
