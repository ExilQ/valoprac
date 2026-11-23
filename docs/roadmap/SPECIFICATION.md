# Evidence-based upgrade specification

Primary specification: the user's supplied request, “VALOPRAC — EVIDENCE-BASED ENGINE CORRECTIONS & COMPLETE TRAINING PLATFORM UPGRADE”, received2026-10-31. It transcribes requirements attributed to “VALOPRAC 개선 계획 — 참고 사이트 검증 기반”,2026-10-29. The separately paginated10-page document was not available as a current attachment; no claim is made to have inspected its pages. The complete supplied requirements and issue IDs govern this implementation.

Baseline source: `8abf7b173698be249882ab34562016e640df4b3e`, release09.01/9.0.1. Historical380kB/861-test figures are not current measurements. The unchanged checkout baseline passes940 application,20 broker and12 hosting tests. Frozen source is retained separately for comparisons and rollback.

## Evidence classes

- **Official:** a first-party publication can establish only the values or behavior it actually documents, with source date/version. No new numerical jump, air-steering, zoom or reaction constants in this update are classified official.
- **Independent reference measurement:** requires a reproducible experiment in the reference game, with device/version/method/uncertainty. No native VALORANT PC client is available in this execution environment.
- **Provisional calibration:** report/community/browser-trainer suggestions, independent VALOPRAC model choices and its own reproducible simulation measurements. Passing trainer tests establishes implementation behavior, not native parity or human effectiveness.

F9 walking ratio and F10 walking landing sound remain measurement-gated. Retaining0.48 or audible impacts is preservation of the disclosed model, not verification of native rules. A permitted native capture must record route scale, weapon, bindings, launch/landing stance, velocity, surface, multiple matched trials and uncertainty before changing those rules.

## Tracked roadmap

| Stage | IDs | Work and gate |
| --- | --- | --- |
| 1 | F1–F5 | Takeoff air budget, calibrated jump, projection/target size, fair expert pre-aim, sampled ADS spread; full regression gate |
| 1 | F6–F8 | Essential jump HUD, mode-specific naming throughout session, timestamp-aware gunfire with measured onsets |
| 1 | F9–F10 | Direct reference measurement required; no speculative walking/silent-landing change |
| 2 | I1–I4 | Spatial cues, actual bot footsteps, spectral balance, shader preparation and renderer classification |
| 2 | I5–I7 | Local preflight, same-scene rendering budget, independent sensitivities and derived counts/distance |
| 2 | I8–I9 | Validated crosshair profiles/codes and deterministic key-event metadata; seeking follows replay |
| 3 | A2 | One versioned input/state-transition replay engine, outcome checkpoints, bounded files and viewer first |
| 3 | A1,A3 | Real3D warm-up; save/restore, takeoff return, trajectories and non-colliding movement ghosts |
| 3 | A4–A6 | Original validated tactical routes, bounded scenario editor/codes and turn-away flash reaction |
| 3 | A7 | Explicit optional English, Korean default, persisted language and complete supported-screen checks |
| 4 | A8 | Local seeded challenge records/codes with replay score recomputation; no ranking infrastructure |

Each stage report records files, algorithms, before/after values, tests, rendering and input evidence, build size, limits, native-measurement dependencies, version and actual publication state. Later-stage implementation starts only after the preceding software gate is recorded. Hardware/headphone/native checks unavailable here remain explicit limitations rather than invented passes.

Security/privacy invariants: existing CSP and HTTPS headers; no executable share-code payloads, new advertising, trackers, accounts, telemetry uploads or unrelated services. Optional systems should load lazily and retain bounded local data with export/deletion.
