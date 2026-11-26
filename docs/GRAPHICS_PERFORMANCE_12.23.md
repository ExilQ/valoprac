# Graphics tiers and performance — 12.23

Report: on a high-end gaming PC the highest preset still dropped to a very low,
stuttering frame rate after 12.22. Gameplay, simulation and replay identity are
unchanged by this release.

## What Ultra still did in 12.22

Ultra was the only preset that left the single forward pass:

| Stage | Cost |
|---|---|
| Canvas | Created **without** MSAA whenever bloom or AO was on at start-up, so the renderer stayed on the offscreen path for the whole session even after turning them off. |
| Main pass | Rendered into a 4× multisampled **half-float** offscreen target instead of the canvas. |
| SSAO (three `SSAOPass`) | Rendered the whole scene **twice more** (its own beauty image and a normal pass), then wrote its own half-resolution beauty image over the full-resolution main pass — Ultra was both slower and blurrier. |
| Bloom | Five-level blur chain on top (strength 0.12, barely visible). |
| Output | An extra full-screen copy for tone mapping/sRGB. |

## Measurements

Chrome with the SwiftShader software rasteriser. Absolute numbers are meaningless
on a real GPU; use them only to compare configurations. Draw calls, triangles and
full-screen passes are exact.

Per-frame cost, `dev/graphics-bench.html`, 320×180, every frame waits for the GPU:

| Preset | Frame | Draw calls | Triangles | Full-screen passes |
|---|---|---|---|---|
| 12.22 Ultra | 100.5 ms | 162 | 81,453 | 5 |
| **12.23 Ultra** | **78.7 ms** | **79** | **42,002** | **0** |
| High (both) | 57.8–77.7 ms | 79 | 42,002 | 0 |
| Low (both) | 8.8–9.7 ms | 54 | 23,115 | 0 |
| 12.23 Ultra + GTAO (optional) | 106.9 ms | 150 | 81,441 | 4 |
| 12.23 Ultra + bloom (optional) | 80.0 ms | 93 | 42,016 | 4 |

Real training session (production bundle, pointer lock simulated, moving,
turning and shooting for 10 s, 320×180):

| Build | Ultra median frame | Ultra FPS |
|---|---|---|
| 12.22 | 103.3 ms | 9.7 |
| **12.23** | **63.9 ms** | **15.6** |

High measured 67 ms in both builds. In software rendering the 2048² shadow map
dominates every shadowed tier; on a desktop GPU the depth-only shadow pass is
cheap, so the gap between tiers is far smaller than shown here.

## Changes

- **Tiers** (all render one forward pass straight to the canvas with native MSAA):

  | | Low | Medium | High | Ultra |
  |---|---|---|---|---|
  | Render scale | 80 % | 100 % | 100 % | 100 % |
  | Anti-aliasing | off | MSAA | MSAA | MSAA |
  | Shadows | off | 1024² | 2048² | 2048² |
  | Material maps | 32 px | 64 px | 256 px + normal | 256 px + normal |
  | Anisotropic filtering | 1× | 2× | 8× | 16× |
  | Impact decals/debris | 12 | 24 | 48 | 96 |
  | Bloom, ambient occlusion | optional | optional | optional | optional |

  This follows shipping competitive shooters: VALORANT and CS2 tie their quality
  tiers to shadows, material/texture detail, filtering and MSAA, and treat
  bloom/AO as separate, often disabled options; render scale stays at 100 %.
- **Canvas MSAA** follows the anti-aliasing setting alone, so turning bloom/AO on
  at start-up no longer strands a session on the offscreen path.
- **Ambient occlusion** (optional) uses three's `GTAOPass` at half resolution: one
  normal/depth pass, occlusion blended over the full-resolution image. Materials
  and the depth texture the pass does not release are disposed explicitly.
- **Migration**: profiles still on an untouched 12.21 or 12.22 preset bundle move
  to the 12.23 bundle once (`valoprac-graphics-presets-v3`); customised profiles
  are kept. `DEFAULT_SETTINGS` and `loadSettings` are unchanged, so replays and
  their headers validate byte-for-byte.
- **Settings → Graphics**:
  - a table of what each tier changes (highlighting the current one, or "custom");
  - *Graphics environment*: the GPU name the browser reports, whether hardware
    acceleration is on, and the real drawing-buffer size. A software renderer
    (hardware acceleration off) gets a prominent warning with the browser setting
    to change; a likely integrated GPU gets the Windows "High performance" hint.
    A browser falling back to CPU rendering is the most common way a gaming PC
    ends up with single-digit frame rates in WebGL.
  - *Measure on this computer*: renders each tier off-screen at the window's real
    resolution for about ten seconds, measures the display refresh rate, and
    recommends the highest tier whose 90th-percentile frame time fits the frame
    budget. Each frame waits for the GPU (1-pixel readback), so results are a
    little pessimistic. Results stay in this browser.
- `dev/graphics-bench.html`: per-setting cost harness used for the table above.

## Not verified

Real GPU frame times (none available in this environment), Safari/Firefox, and
the user's reported machine. The in-app measurement exists so the actual GPU can
be measured and reported.
