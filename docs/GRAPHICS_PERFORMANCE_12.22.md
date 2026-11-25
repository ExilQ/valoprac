# Graphics options and performance — 12.22

Report: low frame rate and stutter on a high-end gaming PC at the highest
preset. Gameplay, simulation and replay identity are unchanged.

## Cost audit of 12.0.21

Per-frame work at **Ultra** before this release:

| Stage | Cost |
|---|---|
| Render scale | `min(devicePixelRatio, 2) × 1.25`. At 150 % Windows scaling that is 1.875× per axis (≈3.5× the pixels); at 200 % it is 2.5× (6.25×). Every later pass runs at this size. |
| SSAO | Re-renders the whole scene for normals/depth (draw calls ×2), 32-sample kernel, blur. |
| Bloom | Unreal bloom mip chain on top. Strength 0.12 — barely visible. |
| FXAA | Extra full-screen pass, because the canvas was created without MSAA. |
| Output | Final copy pass. |
| Shadows | 2048² soft-PCF sun map re-rendered every frame. |

**High** already enabled SSAO + bloom + FXAA; **Medium** enabled bloom + FXAA.

Relative measurements (`dev/engine-audit.html`, Chrome + SwiftShader, 1280×720,
render scale forced to 1, so the render-scale saving above is *not* included):

| Map / preset | 12.0.21 FPS | 12.22 FPS | Draw calls |
|---|---|---|---|
| range / High | 2.8 | 3.7 | 151 → 67 |
| ascent / High | 2.9 | 4.6 | 142 → 62 |
| ascent / Medium | 5.1 | 6.9 | 77 → 62 |
| ascent / Low | 26.5 | 30.6 | 27 |

SwiftShader is a CPU rasteriser: absolute numbers are meaningless and its MSAA is
far more expensive than on a GPU. Use these only as relative evidence that
removing passes halves draw calls. High without MSAA measured 7.1 FPS.

## What shipping shooters do

- VALORANT: MSAA 2×/4× rather than post-process AA; bloom, distortion and
  vignette are separate toggles commonly turned off; Riot's own guide lists
  shadows, effects/post-processing and material quality as the biggest costs.
- CS2: ambient occlusion is one of the largest single costs and is commonly
  disabled; "Boost player contrast" is the visibility feature kept on.
- Overwatch 2: render scale 100 % is recommended; dynamic render scale exists
  but competitive players disable it because resolution shifts mid-fight.

## Changes

- Presets: no preset supersamples (Ultra render scale 1.25 → 1). Medium and
  High no longer enable bloom; High no longer enables SSAO. Ultra keeps both.
- Pixel budget: drawing buffer capped at 3840×2160 for any window size, device
  pixel ratio or render scale (`renderPixelRatio`).
- Anti-aliasing: native canvas MSAA when no composer is needed; when a composer
  is needed, its render target is 4× multisampled. FXAA removed.
- SSAO: half resolution (unchanged) with 16 samples instead of 32.
- Shadows: hard PCF instead of soft PCF — cheaper and crisper.
- Stutter: the crosshair `--movement-gap` custom property was written on every
  animation frame, forcing style recalculation of the whole HUD subtree; it is
  now written only when the value changes.
- Migration: on first start, a profile that still exactly matches an old preset
  bundle (including untouched defaults) moves to the new bundle; any customised
  profile is left alone. `DEFAULT_SETTINGS` and `loadSettings` are unchanged so
  historical replay fixtures validate byte-for-byte.

## Not verified

Hardware-GPU frame times, Firefox/Safari, and whether the reported stutter had
other causes (browser extensions, background tabs, power plan, iGPU selection).
If stutter remains, the in-game frame display and the Chrome Performance panel
are the next step; dynamic render scale is a possible follow-up.
