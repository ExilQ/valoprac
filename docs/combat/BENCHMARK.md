# Combat benchmark protocol and measured results

The machine-readable record is [BENCHMARK_RESULTS.json](./BENCHMARK_RESULTS.json).
It includes capture timestamps, the frozen baseline commit, SHA-256 hashes of
measured source files, raw artifact hashes, conditions and per-weapon/per-pose
summaries. Browser layout results are recorded separately in
[BROWSER_QA.json](./BROWSER_QA.json).

## Reproducible encounter protocol

The baseline is commit `59295203ddd2d54ffb1495b7b456508b81d0f7c9` (07.00),
in a separate, unchanged worktree. Both implementations receive the same
precomputed physical player trajectories from that frozen `Movement` class at
120 Hz: standing still, alternating lateral movement every 0.65 seconds,
continuous crouching, and manually pressed jumps every 0.85 seconds. Freezing
the trajectories isolates combat behavior from the separate movement update.

Each encounter has one stationary defender at 20 metres, one of the four
weapons, no obstacles, no emitted sound, no return fire, no repositioning and
no exposure timer. The defender can fire only through its real firing and
physical bullet-intersection path. The encounter stops on actual ballistic
elimination or after eight seconds. Production defaults are used, including
the old 0.35-second/new 0.42-second reaction reference. This compares the
complete default behavior rather than attributing every difference to one
subsystem.

There are 16 held-out seeds × four weapons × four player trajectories:
256 baseline normal encounters and 1,024 new encounters across four skills.
The seeds are preserved in the JSON. They were selected independently of the
AI tuning tests. Compare baseline **normal** against current **normal**;
the new aggregate combines four different skills.

## Default normal comparison

| Measurement | 07.00 baseline | 08.00 measured implementation |
| --- | ---: | ---: |
| Encounters | 256 | 256 |
| Median time to first shot | 0.350 s | 0.750 s |
| First-shot hit rate | 85.94% | 70.31% |
| All-shot hit rate | 82.33% | 77.60% |
| Follow-up-shot hit rate | 81.01% | 81.44% |
| Alive after one second | 46.09% | 64.06% |
| Median elimination time among eliminated encounters | 0.992 s | 1.408 s |
| Alive after eight seconds without return fire | 0.39% | 0.00% |
| Exposure-timer eliminations | 0 | 0 |

The later first shot and increased one-second survival are measured results.
Follow-up accuracy did not decrease in this probe: the new bot can stop and
reacquire after missed bursts. Eight seconds of unopposed open exposure
remains lethal. These results must not be summarized as a universal survival
or difficulty improvement.

The new normal median controlled aim error at emission was 0.367 degrees;
median complete trajectory error was 0.424 degrees. Controlled error compares
the finite aim motor against the delayed observed target direction. Trajectory
error additionally includes real recoil, imperfect compensation and spread.
The legacy implementation did not expose equivalent motor measurements.

## New skill profiles

| Skill | Median first shot | First-shot hit rate | Follow-up hit rate | Alive at one second |
| --- | ---: | ---: | ---: | ---: |
| Beginner | 1.000 s | 54.30% | 57.68% | 91.80% |
| Normal | 0.750 s | 70.31% | 81.44% | 64.06% |
| Advanced | 0.625 s | 69.92% | 66.54% | 56.64% |
| Expert | 0.575 s | 74.61% | 72.75% | 52.34% |

Hit rates need not increase monotonically across every pooled statistic.
Earlier eliminations remove later shots, and each weapon has a different
cadence and damage model. Per-weapon and per-pose records are retained rather
than hiding these differences behind one score.

## Performance and limits

The encounter runner also records elapsed CPU wall time and active simulation
ticks. In this run the single-defender baseline used 8.57 microseconds per tick
and the new four-skill run used 9.29 microseconds per tick. These unpaired
server-CPU observations have different encounter lengths and warm-up effects;
they do not prove a rendering or scalability regression or improvement.

The separate browser probe records actual frame intervals, draw calls,
geometry/texture counts, accessible JavaScript heap use and development-server
load timing in Chromium with SwiftShader. Software GPU results are scoped to
that environment. GPU utilization and physical mouse-to-display latency are
unavailable and are recorded as null. Development-server load timing is not
production CDN asset latency.

No human participants were tested. The motor, tracking/reaction distributions,
wall-penetration formula and skill profiles are original provisional training
models; native VALORANT parity and human fairness are not established by this
benchmark. Collision, cover, sound memory, recoil, reload, scope and repeated
retry behavior have separate deterministic regression tests.

## Measured browser render probe

Actual Chromium/SwiftShader samples are recorded in [PERFORMANCE_RESULTS.json](./PERFORMANCE_RESULTS.json). The paired render-only garage samples were:

| Measurement | 07.00 | 08.00 |
| --- | ---: | ---: |
| Average software-render FPS | 4.25 | 3.49 |
| Frame time P95 (ms) | 499.9 | 850.0 |
| Draw calls | 55 | 55 |
| Triangles | 33924 | 33924 |
| Geometry allocations | 50 | 50 |
| Texture allocations | 10 | 10 |

The attempted active baseline session did not advance any simulation ticks: a frame longer than 500 ms triggered the application's safety pause. It is marked `activeAttemptAborted` and is **not** an active gameplay benchmark. The measured software renderer is very slow; no claim of hardware gameplay FPS, low input latency or stable real-device performance follows from these samples. The deterministic CPU encounter probe remains valid within its stated scope.
