# Reference website review

Review date: **2026-10-29 UTC**. The user selected **reported corrections and
performance/audio fixes, per-zoom sensitivity, rotation counts and graphics
capability guidance** for this update. Position bookmarks/replay, a new warm-up
loop, crosshair-code import, stretched resolution, settings sharing and English
localization remain outside this chosen update.

This review separates public interface observations from implementation and native
game verification. VALOPRAC keeps its independently authored code, maps and audio.
Website UI observations are design references, not evidence of a game's physical
constants or another site's internal implementation.

## Observation matrix

| Reference | Actually observed | Boundaries |
| --- | --- | --- |
| [OKIAIMX](https://okiaimx.com/) | Public Chromium menu with PLAY, AIM MODE and settings; its visible guide describes pre-aim practice, map/difficulty selection and ESC menu. The public document contains a 60-second timer, one score, best-score area and a retry/result control. A language selector lists English, Korean and other languages. | A complete timed run and deterministic input replay were not executed. Public guide says recorded high scores require sign-in and the default map; this is not evidence of an account-free local personal-best implementation. |
| [Aim Local / Sheepu Aim](https://aim.sheepu.dev/aim) | Root redirect to `/aim` and public page document retrieved. It describes browser VALORANT practice and exposes a performance-check entry labeled `Kiểm tra hiệu năng`. | The JS/CSS needed for its live training/settings UI repeatedly timed out in this environment. Its `103° / zoom` rule, independent scope sensitivity, 360-degree counts and automatic graphics classification were **user-reported and not independently verified in the running application**. |
| [Dannnn Raze training](https://raze.dannnn.me/?view=training) | Public Chromium training/help shell showed VALORANT sensitivity, volume, handedness, crosshair/key settings; visible help names R for returning to the last jump, 5/6 for save/load and H for replay. Visible usage guidance links to low-FPS/stutter help and recommends desktop Chrome/Edge. The public document also exposes replay speeds 0.25×/0.5×/1×, free camera and trajectory recording controls. | The scene was still preparing resources during this bounded inspection. Save/load, replay trajectory correctness and physical movement fidelity were not exercised. A low-FPS help link does not independently verify automatic integrated-GPU detection or automatic preset selection. |

## What informs this release

- The requested horizontal zoom contract provides a concrete, testable
  **VALOPRAC projection convention**: `horizontalFov = baseFov / zoom`,
  followed by conversion to vertical FOV using the current aspect ratio. At a
  103-degree base this gives 82.4, 41.2 and 20.6 degrees at 1.25×, 2.5× and 5×.
  Numerical projection tests in VALOPRAC, rather than the inaccessible reference
  application's internals, should verify these values.
- Per-zoom sensitivity remains a separate control from projection. Rotation-count
  estimates should identify reported DPI/coefficient and their assumptions, rather
  than claiming access to physical sensor counts.
- Graphics guidance can distinguish a confidently identified software renderer
  from a likely integrated adapter. Adapter-string heuristics are uncertain; a
  readable reason and an explicit user graphics choice take precedence over an
  unsupported claim of exact hardware classification.
- Compact launch/selection flow and clear graphics-help text are useful UI
  references. VALOPRAC retains the user's existing training modules, original
  environments, calibration disclosures and security response behavior.

## Access and evidence

External review artifacts:

- `/workspace/0910-qa/reference-browser.json`
- `/workspace/0910-qa/reference-screenshots/okiaimx-initial.png`
- `/workspace/0910-qa/reference-screenshots/raze-initial.png`
- Parent-fetched public documents under `/workspace/0910-qa/references/`

The browser initially lacked the managed proxy certificate authority. The fallback
fetched public responses using curl's normal certificate verification and delivered
those bytes to Chromium at the original URLs; certificate checks were not disabled.
Aim Local's main JS and several CSS requests returned no bytes before 30-second
limits; a separate 12-second HEAD retry of its main JS also timed out. The public
HTML alone cannot verify the claimed FOV formula or hardware auto-selection.

These observations do not establish runtime performance comparisons, original-game
asset licensing, physical input latency or parity with VALORANT. Screenshots are
external review material, not VALOPRAC product assets.

## Silent-jump limitation

No native VALORANT client was available in this execution environment. None of
these browser trainers is a native-game validation source for walk-jump landing
sound suppression. The user specifically asked to confirm the original game's
behavior first; this review therefore does **not** certify silent-jump conditions,
fall-height thresholds or a Shift-at-landing rule. Native capture or an adequately
identified reproducible reference is still needed before declaring such a rule
verified.
