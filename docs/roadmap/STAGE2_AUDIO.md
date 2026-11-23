# Stage2 sound: I1 and I2

## Scope and evidence classification

I1 uses browser-native HRTF for enemy shots, actual resolved bot footsteps and
player landing contacts. The original procedural source audio and09.01 spatial
backend remain in use. I2's existing footstep redesign already passes the report's
spectral ceiling; no arbitrary second sound redesign was added.

Occlusion gain/filter values are **original provisional audible mix calibration**,
not official VALORANT material transmission values. This is a direct-ray audible
filter, not a wave propagation, diffraction or room acoustics simulation.
Headphone localization and laptop-speaker listening remain unverified. No native
VALORANT acoustic match or physical audio latency is claimed.

## I1 changes

`TrainingAudio.setOcclusionResolver((source,listener)=>boolean)` optionally queries
actual map geometry. Runtime owns the collision query; audio never changes bot
hearing, visibility, damage, hit registration or distance accumulation. Failing
or unavailable queries safely use an open audible path. Non-finite coordinates
fall back to centered playback without injecting invalid Web Audio parameters.

A covered source uses0.45 gain (approximately-6.94dB) and a2200Hz low-pass filter.
The filter opens to the lower of20000Hz and the sample Nyquist limit. Existing
HRTF nodes retain world coordinates and inverse-distance response. Stereo/mono
fallback applies distance and cover exactly once, and updates as the listener
moves. Active source cover queries refresh at most15 times per second, with25ms
parameter smoothing when coverage changes. Voice limits and stop/disposal
cleanup include the added filter nodes.

Player landings now use their already recorded, resolved contact position, while
landing and ordinary footstep event IDs remain independent. F10 landing emission
semantics are unchanged. Bot movement is currently a supported-ground solver: it
can traverse valid stairs/ramps but does not simulate airborne jumps or unsupported
drops. Accordingly no artificial bot landing stream was invented. Stationary,
blocked or airborne-unsupported bot steps remain prohibited by their existing
actual-movement generation rules.

Runtime integration uses `visibleBetween` and the existing collider ray tests.
The source endpoint is excluded so a landing cue on a floor is not falsely
occluded by that floor. The stage owner records geometry integration test results
separately from the audio graph fixture below.

## Native browser measurements

A real Chromium `OfflineAudioContext` rendered48kHz stereo,0.5-second windows,
using the actual TrainingAudio gain/filter/Panner/master/compressor graph. Left,
right, turn, front, rear and distance fixtures use the original concrete bot
footstep buffer. Labeled occlusion probes use500Hz/4000Hz tones to isolate the
filter transfer ratio. No proprietary audio or impulse response was introduced.

| Fixture | Result | Acceptance |
| --- | --- | --- |
| Source12m left | Left/right RMS2.139x | Left dominates by>1.2x |
| Source12m right | Right/left RMS2.139x | Right dominates by>1.2x |
| Same left source, listener yaw180° | Dominance changes to right | Reverses channel |
| Distance9m→36m | Combined RMS ratio0.2500 |0.25±0.015|
| Covered/open two-tone RMS |0.3199|Covered below0.5x|
| Covered4000/500Hz ratio relative to open |0.1062|Below0.2|
| Native spatial backend | HRTF in all9 cases | All cases |

Pass. Exact measurements and tolerances are retained in
[STAGE2_AUDIO_SPATIAL.json](STAGE2_AUDIO_SPATIAL.json). `front` and `rear` rows
record the distinct native HRTF responses; these do not prove a person can always
distinguish front/rear with ordinary stereo speakers. That requires headphone
listening and individual HRTF fit, both outside the available test environment.

## I2 retained spectrum

The defined48kHz,8192-point analysis measures9.97–15.96% energy below250Hz across
four surfaces and two foot variants, satisfying the provisional≤60% ceiling.
Each surface remains deterministic, finite and unclipped; useful250–4000Hz bands,
RMS and peaks are also recorded. The actual source PCM was not changed in Stage2.

This is a spectral result only. Naturalness, fatigue and small-speaker audibility
need human listening and are not inferred from a Fourier transform. Stereo/mono
fallback cannot provide native HRTF front/rear cues; the UI must retain its honest
browser capability guidance.

## Files, tests and repeatability

- `src/engine/audio/occlusion.ts`: optional resolver type and provisional mix values.
- `src/engine/audio/Audio.ts`: positional landing, coverage/filter and cleanup.
- `src/tests/audio-occlusion.test.ts`:6 new cases covering HRTF, cover reopening,
  query throttling, contact positions, failure/invalid data and stereo/mono gains.
- `docs/roadmap/measure-spatial-audio.mjs`: repeatable native audio fixture.

Focused audio checks:40 passed,0 failed across7 files. This includes F8 cadence,
spatial fallback, spectrum, surface differentiation, lifecycle and landing events.
The stage owner runs the full application suite and build after integration.
To repeat the native PCM experiment, run Vite on4179 and then
`node docs/roadmap/measure-spatial-audio.mjs`. Set `PLAYWRIGHT_MODULE` if the installed
Playwright path differs. The fixture adds no production dependency, network call,
tracking or telemetry. Device input/audio latency remains unmeasured.
