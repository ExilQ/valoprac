# Stage2: sound, environment and usability gate

Status2026-11-01: **software regression/build gate passed**. Physical integrated-GPU qualification, headphone/laptop listening and input-to-photon measurements remain open; they are not represented as passes. No separate stage deployment was made. Production remains09.01 while the next release is prepared.

Implemented/verified IDs: **I1–I9**, with replay-linked seeking for I9 deliberately following A2. Existing09.01 I2/I4/I7 work was retained and extended or remeasured, not replaced.

| IDs | Measured result and implementation | Detailed evidence |
| --- | --- | --- |
| I1 | Native HRTF direction/orientation; original landing source positions; actual map-ray occlusion with smoothed gain0.45/2.2kHz filter.9→36m RMS0.25; covered/open RMS0.3199. Bots emit steps from resolved grounded movement; no invented airborne bot landing stream. | STAGE2_AUDIO.md/JSON, actual-map endpoint tests |
| I2 | Original09.01 surface synthesis retained; defined spectral analysis keeps below250Hz energy9.97–15.96%, under60% target. Hearing comfort on physical speakers remains unverified. | STAGE2_AUDIO.md, earlier spectrum fixtures retained |
| I3 | Actual compilation/warm-draw/GPU-completion phase and program counts exposed before play; no fabricated progress percentage. First visible frames add0 shader programs. | STAGE2_RENDERING.md/JSON |
| I4 | Software/integrated renderer heuristics, unknown/privacy restrictions and manual override retained; explicit software warning and Low behavior verified. | STAGE2_ENVIRONMENT.md/JSON, renderer tests |
| I5 |9 local preflight checks, actual PointerLock/97delivered events/aim change/fullscreen,4 viewport layouts; callbacks and listeners clean up. Sensor polling, physical refresh and device settings are not inferred. | STAGE2_ENVIRONMENT.md/JSON |
| I6 | Same-camera complex Medium118→101entry,136→110gallery calls; Low54→45/63→45. Collision/cover unchanged. Wider batching raises entry triangles996,0.52% Medium; gallery triangles fall256. | STAGE2_RENDERING.md/JSON and before/after images |
| I7 | Independent ADS/2.5x/5x preserved.0.5sensitivity/800DPI yields eDPI400,10,285.714counts and derived32.657cm/360°. | STAGE2_CROSSHAIR.md/JSON |
| I8 | Bounded static symmetric P/A code subset; unsupported semantics rejected.5 canonical round trips,12local profiles, presets/import/export/copy/delete;14actual UI checks and four centered/overflow-free viewports. | STAGE2_CROSSHAIR.md, browserJSON |
| I9 | Up to5 deterministic moments from real retained events with metric/time/reason; no-data omission.8normal/future-seek layouts. No fictitious flick-reaction measurement or already-functional replay claim. | STAGE2_HIGHLIGHTS.md/JSON |

Modified files: audio `Audio.ts`/`occlusion.ts`, `RangeRenderer.ts`/`StaticGeometry.ts`/`GroundContacts.ts`; new `EnvironmentCheck` policy/view/CSS; new crosshair configuration, codec, designer and centeredSVG rendering; `settings.ts`/types and crosshair settings; highlight selector/view/Results; Runtime map occlusion/preparation telemetry and pause-screen wiring. No new dependency, advertising, account, telemetry upload or external game asset.

Full `npm run build` passes: **1080/1080 application tests across77files**, broker20/20, hosting12/12, TypeScript, build integrity,67Worker asset responses, strict headers/no-transform/real404 and disabled Unreal migration checks. Existing tests remain. New report-specific categories include code validation, actual audio occlusion, mapped contact endpoints, preflight lifecycle, render batching/preparation and deterministic highlight selection.

Build all emitted JS/CSS: **1,860,257bytes**, **528,275gzip bytes**, versus1,809,589/512,429 at09.01; gzip increase15,846bytes(3.09%). These totals include optional chunks and are not initial network transfer. Source archive/Worker is9,147,887bytes at this checkpoint; optional tools are not third-party network services. See STAGE2_BUILD.json and BASELINE_BUILD.json. The final version and cold production transfer are remeasured after integration.

Rendering limits: raw adverse and two reversed sequential SwiftShader startup pairs are retained. Every software run exceeds100ms at least once; no integrated GPU is available. Zero newly compiled programs establishes preparation coverage for those probes, not a physical100ms frame-time guarantee or FPS gain. The Low/software behavior has been measured and the deviation explained; hardware qualification remains pending.

Input evidence: synthetic delivery tests at125/500/1000/4000events/s retain all events. CPU callback p95 at1000events/s is0.002294→0.002214ms and4000 is0.001112→0.001693ms in these shared runs; these are noisy CPU probes, not peripheral polling or input-to-photon measurements. New preflight sampling runs only while its paused panel is open. F8 real rendered PCM cadence remains within one48kHz sample after the audio changes. No severe software input loss was observed; physical latency and high-refresh hardware claims remain unverified.

Known native dependencies: F9/F10 remain unchanged pending native VALORANT measurement; supported crosshair-code semantics are an independent bounded parser, not certified complete native compatibility. English, replay seeking, new exercises and scenario sharing are later-stage work. Patch version/publication are assigned and verified by the final release workflow, not inferred from this gate.
