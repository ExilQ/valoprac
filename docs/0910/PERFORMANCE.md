# Rendering corrections and measured workloads,09.01

The09.00 baseline is frozen at `bbdfa88ebd4a434e11aecefede0b21f1a17a24cb` in a separate worktree. Actual Chromium renders import the unmodified baseline renderer and the current renderer into the same minimal browser fixture. Both use1366×768 CSS pixels, render scale0.5, eleven requested targets, free complex scenario, fixed120Hz frame state, declared camera poses, and the same LOW or MEDIUM preset. Scene geometry, collision/navigation inputs and seed are unchanged except the authored visual batching/topology corrections below.

| Map | Preset | Camera | Calls before→after | Triangles before→after |
| --- | --- | --- | --- | --- |
| complex | low | entry | 61→54 | 99,046→93,446 |
| complex | low | gallery | 78→63 | 103,522→94,830 |
| garage | low | entry | 55→48 | 33,924→31,212 |
| garage | low | gallery | 55→48 | 33,924→31,212 |
| complex | medium | entry | 169→118 | 210,909→190,189 |
| complex | medium | gallery | 195→136 | 216,909→192,665 |
| garage | medium | entry | 116→98 | 66,603→60,899 |
| garage | medium | gallery | 116→98 | 66,603→60,899 |

The complex MEDIUM gallery sample reduces195→136 submissions(30.26%) and216,909→192,665 submitted triangles(11.18%). LOW and the existing garage map also reduce both measured budgets. These are renderer work counts, not hardware FPS claims. Raw reports, individual draw samples and exact preparation times are in [PERFORMANCE.json](PERFORMANCE.json).

## Geometry and appearance

- Original44-triangle chamfered architectural boxes retain the solid outer dimensions and restrained bevel scale, replacing108-triangle rounded grids on planar walls/trim. Weapon and character geometry are unchanged.
- Architectural themes keep their exact linear palette tints as constant vertex colors. Only materials with identical PBR, texture, opacity/depth and shading state share a batch. Essential architecture uses shared campus batches; optional upper finishes retain32m cells and preset/distance visibility. Broader essential batches trade some culling granularity for fewer submissions; the measured net triangle counts above still decrease.
- Every original collider, ramp, portal, cover boundary, spawn and navigation record is preserved. Existing aperture-ray and traversal regression tests pass. The bevel surface becomes an intentionally faceted original chamfer, so pixel-identical images are not claimed.

## Device detection and startup preparation

Renderer strings identify explicit software implementations(SwiftShader,llvmpipe,etc.) and conservatively recognize selected integrated-device names. Integrated classification is a labeled heuristic, not measured performance; masked/blocked device names remain unknown and do not automatically downgrade quality. Explicit manual settings are respected through the existing automatic policy.

Preparation compiles world/effect/viewmodel materials, warms the actual linear postprocess and sRGB canvas variants while the canvas is hidden, uploads hidden weapon variants, and waits for completion of a WebGL2 GPU fence. KHR_parallel_shader_compile is polled with disposal/revision guards when supported; synchronous compilation is a fallback. The ordinary next renderer frame reveals the canvas. Warm draws never enter the rendered-target shooting history. Quality changes invalidate only material-affecting revisions.

All eight recorded current scene/camera samples retain exactly the shader-program count reached during preparation; the first visible frame adds no program in these probes. In this shared software renderer, compilation/warm drawing can take seconds and now occurs before pointer-lock readiness. The measurements do not establish faster total loading, high-refresh GPU performance, native integrated-GPU behavior, or physical input-to-photon latency. Concurrent software-GPU timing variation is substantial; frame milliseconds are retained as observations, not an FPS improvement claim.

Lifecycle tests cover shared preparation work, quality revision changes during an await, disposal without querying destroyed programs, a compilation failure and retry. Graphics/type/art/geometry checks are recorded in `/workspace/0910-qa/render-final-tests.log` and `render-final-typecheck.log`.
