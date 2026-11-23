# A2: deterministic replay viewer and local library

Status2026-11-02: implemented and verified in the development checkout. This is not a production deployment receipt. The owning release workflow assigns the final patch version and verifies publication; the captured fixture currently reports the source's9.0.1 header.

## Implemented behavior

The lazy `ReplayViewer` uses the shared `ReplayPlayer` and existing `RangeRenderer`. It does not construct `BrowserInput`, request PointerLock, or change simulation time steps. Play/pause,0.25/0.5/1/2speed, a120Hz seek timeline, bounded event markers, first-person and top-down inspection, compatible file import/export, integrity status and real result-highlight seeking are available in Korean.

The top-down camera frames the player and enabled defenders using the viewport aspect ratio; it does not merely point down at the player's feet. A display-only clipping plane removes overhead roof geometry above human silhouettes. Its height includes target scale and elevation. The inspection scene disables distance fog and extends its camera far plane so distant tactical sectors remain visible from above. All of these are render settings: collision, hitboxes, visibility decisions, player position and bullet paths remain in the original authority. First-person scope projection and the Operator mask are retained.

`RangeRenderer` accepts `{recordFrames:false}` before attaching to target history. Rendering a replay therefore cannot overwrite the recorded displayed-target frames or change an originally headless replay into a render-dependent simulation. Re-executed shots feed only the display renderer's tracer/impact callback. Seeking does not paint an artificial burst of historical shots. This viewer is currently silent; it does not instantiate `TrainingAudio` or imply that recorded audio waveforms are reproduced.

The library uses the existing local session retention and imports a file into the current view without an account, server or automatic persistent save. Export uses the shared bounded gzip codec. Oversized/malformed files and incompatible game/physics/calibration versions fail before replacing the current library selection. Valid-format recordings with mismatched outcomes visibly fail verification and cannot be played as verified results. Corrupted local session data produces an error panel rather than reading an arbitrary weapon identifier.

## Files and corrections

- `src/ui/ReplayViewer.tsx`, `replayViewer.css`: responsive viewer/library, validation, local files, scopes, verification lifecycle and display-only shot effects.
- `src/ui/replayTransport.ts`: bounded presentation clock, asynchronous cancellation-aware seek, marker budget, camera framing and cutaway height. Minute labels round once and never display a `00:60.0` remainder.
- `RangeRenderer.ts`: optional history attachment and inspection camera override before culling/drawing; the default gameplay path retains recording behavior.
- `dev/replay.html`, `src/dev/replay.tsx`: repeatable development fixture, absent from production entrypoints. It records actual seeded Simulation input, displayed frames, ten shots and four eliminations over480ticks/4seconds.
- `src/tests/replay-viewer.test.tsx`, `replay-transport.test.ts`:20 tests. Runtime/session storage and result/history entrypoints are integrated by the owning agent.

Review identified and fixed three nontrivial issues: re-applying recorded Medium settings undid software-device Low selection; a new imported recording could display2x while recreating a1x transport; the initial top-down view showed overhead architecture and missed distant defenders. Display policy now stays separate from authoritative settings, declared speed is reapplied, verification/readiness resets between files, and engagement framing/cutaway are tested. Unmount and repeated verification cancel pending verification work; superseded seeks are aborted.

## Executed evidence

Unit/integration suite: **20/20 passed** across two files; TypeScript passes. The transport test runs a real240-tick recording with a headshot, strafe, jump and shots at0.25x/2x and after seeking, with equal final outcomes. Boundary tests cover malformed local data, oversized imports before buffer reads, current/foreign encoded files, graphics authority separation, scaled/elevated cutaways and actual projected framing at narrow/16:9/ultrawide aspects.

Actual Chromium154/Linux/SwiftShader: **15 checks passed**, four layouts at390×844,1280×720,1366×768 and3440×1440, zero page/console errors. A fresh browser verified the scripted source, played/paused actual fixed ticks, used keyboard End to reconstruct the final4eliminations/10shots, sought a real kill marker, changed cameras, downloaded/re-imported the gzip file, rejected malformed/foreign files, rejected a mismatched score, closed/unmounted the canvas, rendered an unattached recording without adding history, and presented the Operator scope. **85 actual WebGL render observations kept the complete simulation checksum unchanged.** No PointerLock was entered. Top-down projected player/defender coordinates both stayed inside the camera frame. See [raw report](STAGE3_A2_VIEWER_BROWSER.json) and [repeatable harness](measure-replay-viewer.mjs).

The four-second UI fixture exported6,571bytes. This is not extrapolated into the one-minute200kB acceptance criterion; longer/high-rate recording measurements belong to the A2 core report. Captures: [top-down](replay/top-down.png), [mobile](replay/mobile.png), [Operator](replay/operator-scope.png).

## Limits

No native VALORANT, physical input-to-photon, integrated-GPU, headphone, or cross-browser determinism claim follows from this viewer test. Renderer timings on shared SwiftShader are not hardware FPS evidence. The file format requires browser CompressionStream/DecompressionStream support and reports unavailable functionality explicitly. A missing or failed verification is not a verified competitive score. Recordings are version pinned; older histories without replay data remain usable. The remaining Stage3 training features and the final gate are separate work.
