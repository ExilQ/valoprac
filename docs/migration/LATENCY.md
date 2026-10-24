# Repeatable input, rendering and network benchmark

Only menu/settings/error-path browser QA has been executed for this release; the cloud browser has WebGL disabled. No actual gameplay, UE GPU runtime or high-speed-camera measurement has been executed. All mouse-to-camera, click-to-shot, shot-to-photon, encoding, decoding, jitter and network values remain **unmeasured**, not zero. Portable core equivalence tests establish simulation consistency, not responsiveness or GPU FPS.

## Protocol

Use the same physical machine, mouse, polling rate, desktop refresh rate, sensitivity, view angle, weapon, target scene and camera path. Record Chrome/Edge version, OS, GPU/driver, display resolution/refresh, USB settings, region, route, bitrate and encoder. Warm both runtimes for five minutes. Test at least 100 single shots and 100 repeatable horizontal mouse impulses per condition, then report median, p95, sample count and uncertainty. Repeat 60/120/144/240 Hz display modes where supported; a 60 FPS stream cannot be claimed equivalent to a 240 Hz locally rendered session.

1. **Mouse-to-camera photon:** high-speed camera (ideally 1000 FPS) simultaneously sees a motion sensor/mouse LED and a fixed screen edge that shifts under camera rotation. Use the same threshold and scanout position. A USB LED trigger is a timestamp reference, not a JavaScript timer.
2. **Click-to-shot event:** hardware input trigger plus authoritative engine shot marker recorded in the engine trace. Cross-machine timestamps need explicit synchronization; do not subtract independent `performance.now()` and UE monotonic clocks.
3. **Shot-to-rendered-frame photon:** trigger/engine marker plus first changed muzzle/impact pixel. Include encode/decode/scanout in the UE case. A rendered frame is not necessarily displayed immediately.
4. **RTT / jitter / loss:** official Epic `statsReceived` -> selected ICE candidate pair and inbound video stats. Decode and packet loss use interval deltas; displayed metrics retain `null` when unsupported.
5. **Encode:** Epic `requestLatencyTest()` -> `EncodeMs` when supplied. This is an encoder component, not proof of full end-to-end latency. Jitter, RTT, decode and encode are not simply additive measurements of mouse-to-photon.
6. **Browser CPU proxy:** play in browser mode, pause, select **입력 처리 진단 저장**. The bounded `InputLatencyProbe` records DOM event timestamp to the end of CPU render submission. It excludes GPU completion, monitor scanout, peripherals and events outside active play. It must never be presented as input-to-photon.
7. **Stream diagnostics:** collect **진단 기록 받기** in the engine connection page after an actual GPU connection. Full input-to-photon remains null until externally measured.

Export external measurements as `runtime,metric,milliseconds`, with runtime `browser` or `unreal` and metric `mouse-to-photon`, `click-to-shot`, or `shot-to-photon`. Run `node scripts/compare-latency.mjs real-measurements.csv`. This script refuses malformed input and never fabricates measurements.

## Acceptance decision

User acceptance and measured aim-training latency are required before replacing a local renderer. Provisional **evaluation gates**, not measured guarantees: stream stable at least 60 FPS, p95 network RTT near 20 ms for the target population, p95 input-to-photon regression no more than 10 ms compared with the local path, packet loss below 0.5%, no perceptible aim inconsistency. These provisional targets may prove infeasible for Pixel Streaming and must be revisited with evidence. If unacceptable, keep native browser gameplay for precision training and offer UE as optional visual practice only.

## Long-session soak

Run each weapon continuously in Free Practice for at least two hours, and a longer overnight smoke test if hardware permits. Every minute record JS heap, GPU memory, UE UObject count, audio components, process RSS, encoder sessions, event listeners, active timers and sockets. Rotate weapons 100 times, open/close settings 100 times, disconnect/reconnect 30 times, remove/recreate targets and exit/re-enter 30 times. Confirm no increasing resource trend after GC/stabilization and no duplicated inputs/audio. Bounded storage and listener unit tests are implemented; they do not replace this soak test.
