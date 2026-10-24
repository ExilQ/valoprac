# VALOPRAC 2.2 — genuine UE5 staging and authoritative session capture

This release preserves the production React/Three.js trainer. It does **not** replace it with a stream. The new Unreal 5.7 project contains actual Unreal game module, targets, configuration, Pawn, camera, collision traces, rigged humanoid targets, range geometry, procedural first-person weapon meshes, sound routing and Pixel Streaming 2 input bridge. It has **not** been built with UnrealBuildTool or executed in an Unreal runtime here. No screenshot is presented as an Unreal rendering.

Release 2.2 adds a bounded native event journal, replay acknowledgements, lifetime statistics, late braking corrections, browser history/recoil integration, strict input admission and worker cancellation/teardown. The actual compiled C++ JSON is exercised by the TypeScript tests. Unreal-dependent integration and real WebRTC remain unverified. Read [the protocol](PROTOCOL.md).

## Repository map

- `unreal/VALOPRAC/VALOPRAC.uproject`: real UE5.7 C++ project, separate from the working browser engine.
- `Source/VALOPRAC/Core`: portable fixed-step movement, weapon cadence, ADS, recoil and spread. Tested against TypeScript golden replays, not a substitute for UBT compilation.
- `Content/Data`: generated weapon calibration and original indexed weapon geometry.
- `SourceAssets/Audio`: original synthesized WAV recordings generated from the existing browser sound models. No Riot recordings.
- `Scripts/prepare_assets.py`: UE Editor asset import, original PBR material and actual cooked map preparation.
- `src/streaming`: official Epic frontend adapter, session protocol, state validation and WebRTC diagnostics.
- `infrastructure/pixel-streaming`: isolated worker/session broker, official infrastructure pin, reverse proxy and service configuration.
- `docs/migration/VALIDATION.md`: executed evidence and remaining gates.

## Version compatibility

Pinned to Unreal Engine **5.7**, Pixel Streaming **2**, official Infrastructure branch **UE5.7**, commit `15f616198b7b33b1544f2a6a2d53b5f44e6ae707`, official frontend package `@epicgames-ps/lib-pixelstreamingfrontend-ue5.7@0.3.1`. UE5.7 is a supported branch; the official repository lists UE5.8 as current. Do not mix engine versions or change all pins without integration tests.

A small pnpm dependency patch removes the official frontend VideoPlayer's anonymous resize/orientation listeners on destruction. This is an explicit cleanup patch to the genuine Epic client, not a replacement WebRTC implementation.

## Reuse and calibration

`npm run export:unreal` exports current TypeScript weapon profiles, all three original weapon meshes, independent recoil patterns, damage bands and original audio into the Unreal project. `GeneratedProfiles.h` is generated from the same values. Rifle IDs `rifleA`/`rifleB` remain stable for browser history compatibility. Movement is SI units; conversion at the UE boundary is `UE centimeters = (-browser.z, browser.x, browser.y) * 100`. No game-generated assets were extracted.

The 120 Hz portable core matches the existing provisional browser movement, spread and recoil model. Published/requested fire rates are preserved (9.75 / 11 / semi-automatic 4 RPS; ADS 8.775 / 9.9 / unavailable). Precise VALORANT recoil, latency, hit registration, native sensitivity and animation parity remain unverified. Existing calibration details remain in the main project documentation.

## Build on an authorized UE workstation

Install a licensed Unreal Engine 5.7 with Linux build support and matching dependencies. Do not attempt this ordinary frontend host as a GPU runtime. From the **full site repository**, run:

```bash
npm test
npm run test:broker
npm run export:unreal
export VALOPRAC_UE_ROOT=/path/to/UnrealEngine-5.7
bash scripts/build-unreal.sh
```

The script builds the Editor target first, executes `prepare_assets.py` to create actual UE assets, then builds/cooks/stages/packages the Shipping target. No packaged binary or `.uasset` is asserted to exist before that command succeeds. Runtime mesh JSON is staged as UFS, materials and audio are cooked. Do not enable `-nullrhi` on a streaming game; it is only used for the Editor asset-preparation command.

The downloadable staging archive contains UE project and integration sources; the full React site is included alongside the UE staging project and also remains in the canonical source repository. Generation is already performed, so the UE assets can be imported without running the TypeScript exporter on a UE-only workstation.

## Rendering choices

Baseline: conventional shadow maps, two bounded indoor area lights, ambient skylight, original clean PBR materials, instanced range architecture, restrained bloom/AO, manual stable exposure, TAA, no motion blur/DOF/chromatic aberration. Procedural meshes are imported from the original browser geometry; they do not claim Nanite support. Lumen, Nanite, virtual shadow maps and TSR are deliberately off by default pending measured benefit. Static light baking and reflection probes are evaluation items; no baked GI asset is fabricated. Run `stat unit`, `stat gpu`, Unreal Insights and profile each feature separately before promoting a preset.

## Audio rights

Champions 2023 Vandal / Champions 2026 Phantom / Ion Sheriff are requested **reference slot names**. Every included WAV is an independently synthesized substitute. Genuine authorized recordings were not provided or discovered. Browser-local uploaded audio remains local and is **not** silently uploaded to the GPU host. To use authorized server assets, import them under `/Game/Audio/<weapon>_<action>`, update the rights manifest and recook the project. Importing a copyrighted file requires actual public streaming/distribution rights; public accessibility is not proof.

## Production

The production landing page, weapon grid, five settings tabs, in-game HUD, browser simulation and history are deployed through the existing Sites source workflow at `https://valoprac.trade`. New concrete routes: `/weapons.html` and `/unreal.html`. `public/streaming-config.json` deliberately has `enabled:false`. It contains no GPU URL, credentials or billing operation. Build verification prevents publishing enabled streaming until every migration gate passes. See `DEPLOYMENT.md` before provisioning anything.
