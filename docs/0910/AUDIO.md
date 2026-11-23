# Directional original audio and scheduling correction

Enemy shots and actual bot footsteps now carry SI world coordinates. The listener
follows the actual player eye position, yaw and pitch. HRTF PannerNodes handle
direction and inverse-distance response; a StereoPanner fallback derives camera-relative
left/right and distance. A final mono fallback keeps distance attenuation when
spatial Web Audio nodes are unavailable. Source buffers remain independently
authored; no proprietary recordings or remote impulse responses are loaded.

Bot step events come from collision-resolved grounded displacement and per-bot
distance accumulation. Idle, low-speed movement and blocked paths do not emit
artificial steps. Player and bot IDs are deduplicated independently; encounter
resets replace old trackers while monotonic event ownership prevents stale callbacks.

Timestamped audio uses the simulation-to-AudioContext anchor. Events more than120ms
old are dropped; invalid or more-than2s-future events are rejected. Late firing
events from the same emitter defer by12ms and coalesce before playback. Distinct
future events retain their true spacing; different opponents keep independent
emitter identities. All voices remain bounded and are stopped/disconnected on
pause, retry, weapon switch or disposal. These are software scheduling checks,
not an acoustic input-to-photon or hardware latency measurement.

At48kHz, an8192-point independent FFT of the same four original surface pairs
measured the share below250Hz at78.99–90.53% before,9.97–15.96% after. The revised
sole/ground transients retain impact energy with more mid/high surface detail.
RMS and peak values, full band fractions and the exact frozen09.00 source commit
are recorded in AUDIO_SPECTRUM_COMPARISON.json. Human headphone localization,
listening preference and native-game spectral equivalence were not tested.

Walking-based quiet landing semantics remain unverified in a native client.
See NATIVE_VERIFICATION.md; this update does not claim native silent-jump behavior.
