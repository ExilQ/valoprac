# Validation and implementation status

Date: 2026-10-23. Release 2.2.0. Existing public release 2.1.0/source `683be0cd1bbf4f867cb7f27d78ab548a1351fd9e` was retained as the source base and rollback candidate. No Unreal installation, configured UE root, UBT, GPU render device or NVIDIA utility is present. No paid host was provisioned.

| Area | Status | Executed evidence / limitation |
|---|---|---|
| Existing movement, braking, Vandal/Phantom/Sheriff, head-only hitboxes, timed modes and unlimited Free Practice | Implemented and tested automatically | Existing regression suite passes. Actual hardware gameplay/latency remains unverified. |
| Existing browser settings/history and new stream provenance | Implemented and tested | IndexedDB round trips, duplicate save, lifetime totals, late braking corrections and bounded retention tests. Old records without a runtime field remain browser records. |
| Portable C++ simulation core | Implemented and tested | g++ C++20 `-Wall -Wextra -Werror`; 12 golden comparisons, 3 weapons × 30/60/144/240 render schedules, within 1e-10 comparison precision. This does not compile UE-dependent files. |
| C++ analytics to TypeScript results | Implemented and tested outside UE | The compiled native probe emits real JSON consumed by the actual schema/parser/recorder. Tests cover page bounds, resets, duplicates, late correction, loss reporting, authoritative statistics and 2,560-shot bounded capture. |
| Native UE collision/analytics bridge and tracking sampler | Implemented but not verified in UE | Actual line-trace, target generation, shot/reaction/brake and output code exists. UBT/API/runtime correctness remains blocked. |
| Stream history, final-page draining and recoil overlay | Implemented and tested at unit/build level | Native JSON feeds existing statistics, recoil readout and IndexedDB; finish saves once only after final pages drain, partial capture is labeled. No actual WebRTC session executed. |
| Handshake, reconnect and input admission | Implemented and tested with adapters | Actual readiness/ACK ownership logic, coalescing, retries, stale ACKs, interrupted streams and cancelled late Pointer Lock. Document-event adapters do not establish real pointer behavior. |
| Epic frontend cleanup | Implemented and tested automatically | Genuine pinned library cleanup patch; repeated media/listener adapter tests. Actual browser media soak remains unverified. |
| Broker/worker lifecycle | Implemented and tested with fixtures | 20 Node tests: independent leases, reservation races, cancellation, heartbeat, failure, rate limit, HTTP, WebSocket handshake/byte forwarding, real disposable process-group termination, probe timeout and ICE file cleanup. No actual UE worker or WebRTC media. |
| Korean UI, weapon selection, settings and history filters | Implemented and partially verified in Chrome | Managed preview: menu layout observed, Phantom selection changes actual selection state, sensitivity 0.35→0.36 and toggle ADS survive reload, history runtime filter changes, unconfigured GPU controls remain disabled. |
| Browser 3D in the current cloud browser | Implemented but not verified here | Chrome reports `GL_VENDOR = Disabled`, `GL_RENDERER = Disabled` and WebGL context creation failure. The app shows its Korean fallback error; menus remain usable. No browser flags/security settings were changed. |
| Actual Pointer Lock, shooting, audio and GPU performance | Implemented but not verified on hardware | WebGL block prevents meaningful gameplay QA. No 144 FPS, full input-to-photon, exact native mouse parity or acoustic fidelity claim. |
| Genuine UE5.7 project/range/weapon assets and audio imports | Implemented but not built or run | `.uproject`, module/configuration, C++ Pawn/targets, original mesh data/WAVs and Editor/build scripts exist. No UBT/cook/package execution evidence. |
| Premium original Riot recordings | Not implemented | No authorized original recordings available. Requested named slots contain clearly labeled independently synthesized substitutes. |
| Full UE visual/animation parity | Incomplete | Actual UE camera/target interpolation, weapon/VFX polish, per-setting rendering behavior and visual comparison need UE build/GPU testing. No premium-art quality completion claim. |
| Lumen/Nanite/VSM/TSR or baked GI | Not implemented | Expensive techniques remain off pending GPU profiling; no fabricated bake or proprietary technology claim. |
| GPU deployment, TURN, TLS, concurrent UE sessions | Incomplete / blocked | Configuration and isolation code included; no authorized GPU host/TURN deployment, live WSS endpoint or concurrent UE run. |
| Long-session stability and latency comparison | Partially tested, hardware unverified | Bounded memory structures, simulated long runs and process fixtures pass; two-hour real GPU/browser soak and external latency measurements not run. |
| Production browser fallback | Preserved | Browser remains default; streaming stays disabled and all 11 promotion gates remain false. HTTP/deployment verification is recorded separately. |

## Executed commands

- `npm test`: 193 application tests passed after capture/persistence integration. Rerun by the final production build gate.
- `npm run typecheck`: passed.
- `npm run test:broker`: 20 tests passed, including actual disposable Node children and byte proxy fixtures.
- Browser QA used the supported Sites managed preview at `http://terminal.local:4173/`; it is internal QA, not the production address. Screenshots were observed, but screenshot-file export was blocked by automatic approval review. No comparison image is presented as an Unreal frame.

## Manual hardware matrix still required

Use real desktop Chrome and Edge at 1080p and 1440p, with hardware WebGL enabled normally. Test all routes/refresh/back/forward, actual mouse capture/release/raw fallback, single/burst/spray Vandal, Phantom ADS/cadence, Sheriff hold versus click, head/body/limb classification, neutral/opposite braking, live target configuration, normal/automatic reload and reserves, all timed modes, unlimited practice, audio switching and every graphics preset. Save results, refresh and confirm history. Check console errors, responsive layout, focus, fullscreen denial and reduced motion.

For Unreal, first build/cook/package with the licensed engine, then validate actual Pixel Streaming2 input/media, every analytics field against authoritative traces, audio event counts, target hitboxes, finishes/resets/reconnects, independent users, missing packets and final-page drain. Review `PROTOCOL.md`, `LATENCY.md`, `VISUAL_REVIEW.md` and `DEPLOYMENT.md`. Never flip a migration gate based only on source/unit tests.
