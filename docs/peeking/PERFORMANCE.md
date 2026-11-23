# VALOPRAC 06.00 software-renderer performance evidence

The matched paused garage workload measured **-5.56% lower average FPS** in the 06.00 software-rendered sample. This is a rendering-cost regression in this one sample, not a hardware-FPS result or an established population-level effect. No performance improvement is claimed.

| Metric | 05.00 | 06.00 |
| --- | ---: | ---: |
| rAF intervals | 60 | 60 |
| Average software FPS | 3.447 | 3.255 |
| Frame interval p50 (ms) | 283.4 | 300.0 |
| Frame interval p95 (ms) | 366.7 | 416.7 |
| Frame interval p99 (ms) | 400.0 | 466.6 |
| Submitted draw calls | 44 | 58 |
| Submitted triangles | 30,102 | 34,018 |
| Registered geometries | 39 | 53 |
| Registered textures | 9 | 11 |
| JS heap snapshot (bytes) | 71,623,827 | 67,233,534 |

## Measurement conditions

- Chromium ANGLE / Vulkan SwiftShader, sequentially on the same execution host.
- 1366 × 768 viewport, Low preset, render scale 0.5, Vandal, three sector targets, paused garage camera.
- Ten requestAnimationFrame warm-up intervals followed by sixty measured intervals per version. The 05.00 source checkpoint was measured alongside the current 06.00 implementation; it was not reconstructed from screenshots.
- Raw values and frame intervals are retained in `/workspace/operator-qa/performance.json`; the runner is `/workspace/operator-qa/performance.mjs`.
- Scope-mask overdraw was removed and unused defender-weapon batches were hidden before the final after sample. New architecture and defender equipment still increase submissions.

## Limits

These are software-rendered browser frame intervals, not GPU timing, hardware gaming FPS, physics throughput or input-to-photon latency. GPU utilization and physical input latency were unavailable and remain null. Sixty intervals from one paired scene do not validate every map, preset or combat workload, and there are no repeated trials or confidence intervals. Hardware performance remains unverified.

The heap values are point-in-time JS heap snapshots, not peak memory or complete GPU allocation. Their difference is not evidence of a memory optimization. Recorded development-navigation response-end / DOM-content-loaded times were 119.4 / 3922.9 ms and 18.7 / 875.3 ms. Development-server compilation and cache state differ; these are not comparable production asset-load benchmarks, so no load-time improvement is claimed.
