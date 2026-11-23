# Stage1 audio: F8 and F10

## F8 result

**Pass:** retained automatic-fire onsets preserve their authoritative timestamp
intervals after a simulated200ms delivery stall. This strengthens09.01's policy,
which prevented a burst by coalescing several late sounds into one.

| Measured fixture | Frozen09.01 | Updated |
| --- | --- | --- |
| Delivered shot events |5|5|
| Audible probe onsets |4|5|
| First post-stall gap |60.729ms|90.917ms|
| Remaining post-stall gaps |90.917ms|90.917/90.896ms|
| Expected11Hz interval |90.909ms|90.909ms|
| Maximum interval error versus target |30.180ms|0.0133ms|

The expected tolerance is one48kHz sample (0.02084ms). This is a repeatable
**native browser offline audio graph measurement**, not a human listening test or
physical device latency measurement. Exact sampled values and environment are in
[STAGE1_AUDIO_ONSETS.json](STAGE1_AUDIO_ONSETS.json).

The original automatically synthesized sounds and spatial signal graph remain in
place. A48-sample authored pulse replaces only the gunshot buffer in this timing
fixture, so onsets can be measured without ambiguous overlapping gunshot tails.
The signal passes through TrainingAudio's firing channel, master gain and actual
DynamicsCompressorNode. The compressor adds the same measured6ms lookahead to
all onsets; interval comparisons therefore preserve that real graph behavior.

### Algorithm and bounds

`FiringTimeline` records the last simulation timestamp and scheduled audio start
per emitter. Consecutive events within450ms preserve timestamp differences after
a late delivery. Idle gaps and pause/retry/weapon-switch voice teardown clear
playout repair. Independent opponents may still fire simultaneously legitimately.
No weapon event, hit, score, simulation clock or enemy decision is delayed.

Events older than120ms are dropped before entering the firing timeline. Invalid
and more-than2s-future events are rejected. Additional playout delay is capped at
150ms; impossible timelines are dropped instead of accumulating a queue. All
voices still share a48-voice ceiling and disconnect on disposal. The legacy
`lateCoalesced` diagnostic remains available and is zero under the new policy;
`lateRescheduled` and `queueDropped` expose actual repair decisions.

In this200ms fixture, the first late shot starts12ms after delivery. Its retained
burst acquires a121.091ms offset, which is intentionally held through the burst
instead of compressing its cadence. Timely, unstalled bursts acquire no added
playout offset. This is an explicit bounded recovery tradeoff, not a claim of
unchanged acoustic latency after a stall.

### Files and checks

- `src/engine/audio/FiringTimeline.ts`: bounded per-emitter timeline.
- `src/engine/audio/Audio.ts`: timeline integration and existing cleanup.
- `src/tests/audio-stall-cadence.test.ts`: four new regression cases.
- `src/tests/spatial-audio.test.ts`: existing tests now assert retained intervals
  rather than the superseded cancellation policy; no tests removed.
- `measure-audio-cadence.mjs`: native OfflineAudioContext/PCM measurement fixture.

Focused check:23/23 tests passed across audio-stall-cadence, spatial-audio,
audio-spectrum and surface-audio. Full-suite status is recorded by the stage
owner after other Stage1 changes. To repeat the PCM comparison, start Vite on4180
in the frozen09.01 worktree and4179 in current source, then run
`node docs/roadmap/measure-audio-cadence.mjs`. The script uses the environment's
Playwright installation; `PLAYWRIGHT_MODULE` can select another installed module.
It adds no production dependency.

## F10: reference measurement still required

**Unverified; behavior deliberately unchanged.** No native VALORANT PC client or
reproducible first-party landing measurement is available in this environment.
The report's silent-jump description is provisional evidence, not confirmation of
an unconditional rule.

Current landing events are emitted from actual contact transitions, consume a
monotonic landing serial once, reject impact speeds below0.35m/s, and obtain the
material from the resolved contact position. They do not read walk/crouch keys.
Louder impacts change radius and playback gain. Landings remain separate from
distance-accumulated ordinary footsteps, including during a buffered immediate
next jump. Existing landing-sounds and movement-integration tests cover contact,
material selection, velocity-dependent radius, deduplication and chaining.

A future native reference capture must compare run/walk/crouch takeoff and landing,
held walking input versus released input, buffered/repeated hops, controlled drop
heights/impact velocities, and each supported surface. Record client patch,
controls, distances, input timestamps, PCM onset/RMS window and uncertainty. Do
not change F9 walking speed or F10 silence from another trainer's implementation.

## Stage2 audit only: I1/I2

09.01 already contains HRTF PannerNodes for enemy gunshots and actual grounded bot
steps, listener position/yaw/pitch updates, stereo/mono fallback, and four original
surface sounds. Existing spectrum tests measure9.97–15.96% energy below250Hz,
under the report's60% ceiling, with a defined48kHz/8192-sample FFT. These remain
software evidence; headphone/front-rear localization, laptop-speaker naturalness
and physical audio latency remain unmeasured.

Identified follow-up: there is no geometry-aware audible occlusion filter yet;
player landing playback is centered rather than world-positioned; bot landings
are not currently a separate positional cue stream. These are Stage2 work,
pending Quality Gate1, and are not reported complete here.
