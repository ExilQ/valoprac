# Streaming protocol and authoritative session capture — schema 1

This is an implemented source/unit-test contract. Unreal-dependent classes have not been compiled with UBT or exercised over an actual WebRTC stream. It does not establish engine API compatibility, latency, or visual quality.

## Ownership and admission

Epic's pinned UE5.7 frontend is the sole sender of mouse/keyboard/fire input. JSON UI messages never contain a fire command. A new connection waits for both initialized video and the sending data channel before sending `hello`. A successful acknowledgement, rather than an assumed sequence number, establishes application readiness. Reconnection uses a fresh monotonically increasing command sequence.

Pointer Lock must actually belong to the stream element before `resume` is sent. Gameplay input remains disabled until the engine acknowledges that command as unpaused. Menu opening, blur, transport loss, pause and finish immediately revoke browser input admission. A late resume acknowledgement cannot reopen admission after pause. Cancelled asynchronous lock requests cannot admit input or release a newer request's lock. Void-returning Pointer Lock implementations retain an observer for at most five seconds to release cancelled late locks.

Application `ping` is sent once per second only after hello succeeds. Unreal pauses after three seconds without an accepted application command. These are liveness controls, not an input-latency measurement.

## Command envelope

`{v:1, session, seq, type, payload}` uses a per-lease session ID and safe integer sequence. Commands: `hello`, `configure`, `weapon`, `pause`, `resume`, `resetTargets`, `resetStats`, `finish`, `ping`, `ackEvents`. Unreal acknowledges a processed command with `ack`; duplicate sequences do not execute again. Pending commands are capped at 32, retried with the same sequence every 1.5 seconds, up to three sends. Settings and weapon selections coalesce to one pending command of each kind plus the latest desired value. Stale HUD revisions are discarded while their matching command acknowledgements still clear retries.

## State and detailed events

State includes authoritative weapon, ammo, reserve, reload, pause/finished flags, elapsed simulation time, speed/readiness, recoil and absolute shot/hit/head/elimination counters. Native state is emitted at about 10 Hz during simulation and in command replies. The browser rejects payloads over 65,536 characters, invalid fields, inconsistent aggregates, wrong sessions, and stale revisions.

`analytics` contains:

| Field | Meaning |
|---|---|
| `schema`, `epoch` | Analytics schema and statistics-reset generation. |
| `startSequence` | First possible event in this epoch; distinguishes a reset from journal loss. |
| `firstSequence`, `lastSequence` | Earliest retained and latest generated journal sequence. |
| `acknowledged` | Highest browser-confirmed sequence; pages start after it. |
| `totals` | Absolute lifetime counters, weapon totals, tracking samples and `n/sum/squares` moments. |
| `events` | At most 16 ordered `shot`, `kill`, `reaction`, or `brake` events. |

The native journal is a 512-event ring. Its storage and fixed-step tracking do not grow with session duration. Browser event capture retains 2,048 detailed shots and 256 kills/reactions each. Older detail eviction does not reduce authoritative lifetime totals. The existing IndexedDB policy retains 40 summaries and detail for the latest 10 sessions.

Shot records include the true pre-kick trajectory, SI player position/velocity, camera aim, residual recoil, independent spread components, actual collision classification and point, target generation/behavior/position, input direction, ADS, damage, compensation, braking fields and angular error. The residual recoil state is recorded after this shot's kick, consistent with the browser implementation. A `brake` event patches the first shot of a braking episode when threshold/full-stop times or opposite input become known later. Lifetime moments include the pending sample without double counting it. Late corrections remain bounded and do not fabricate a successful stop for an unfinished episode.

Positions and velocities use the browser axes and meters: UE centimeters are `(-browser.z, browser.x, browser.y) * 100`. Aim is radians; recoil/spread/compensation/angular error are degrees; all gameplay timestamps and durations are simulation seconds. No browser clock is subtracted from an engine clock.

## Replay, finish and interruptions

The recorder processes each sequence once and sends `ackEvents {through}` only after handling it. Duplicate pages are harmless. A journal gap is explicitly counted as lost detail; absolute native totals remain authoritative. `resetStats` increments the epoch and clears counters/details without rewinding event sequence, preventing old pages from resurrecting previous statistics.

A finished message freezes the engine but does not immediately discard its outbox. The client continues acknowledgement/reply paging until it has processed the final sequence, then saves that epoch exactly once through the existing history store/results UI. An interrupted connection offers an explicitly labeled partial snapshot of the last received authoritative state. The record contains runtime/session/epoch/sequence provenance and a detail-completeness flag. Result trends can separate browser and Unreal runtimes. No record is synthesized from an old engine that omits analytics.

All live recoil overlays use captured shot data and never modify firing physics. Final cumulative accuracy and braking moments come from Unreal totals; wall grouping and reaction histograms describe retained detail. Full input-to-photon remains unmeasured.

## Worker lifecycle

One slot contains one Unreal application and one official signalling server with at most one controlling WebSocket. A slot remains reserved through pending startup and termination. Cancelling allocation, lease expiry, HTTP disconnect, worker death or host shutdown aborts readiness, terminates Linux process groups, waits for children, removes the private ICE file and only then frees the slot. Concurrent release/stop calls share their cleanup promise. A failed termination quarantines capacity. The readiness probe is a tracked child with a timeout. Tests use actual disposable Node child processes and HTTP/WebSocket byte proxy fixtures; these are not UE or WebRTC tests.

The broker is loopback-only behind its configured TLS proxy. Client-origin checks and private tokens remain required. `createBroker` defaults to direct-peer rate limiting; the shipped loopback-only entrypoint enables `trustProxy` for Caddy. Caddy overwrites `X-Forwarded-For` with its actual remote peer. Only the exact loopback peers `127.0.0.1`, `::1`, and `::ffff:127.0.0.1` may supply that header, and one valid IP is required: missing, malformed, or chained values fail before worker allocation. Other peers use their socket address regardless of forwarding headers. Keep the broker inaccessible to untrusted local processes and do not expose its port publicly. No paid infrastructure is started by these tests.
