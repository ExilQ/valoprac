# VALOPRAC 9.0.0 — dual movement physics and real air control

Patch **09.00** applies selectable VALORANT and CS2-inspired movement physics across every existing browser mode/map. It adds real camera-relative air steering, timestamped input, distinct ground and landing rules, optional Source Classic, separate landing sounds and physics-compatible analytics. Existing combat, weapons, maps, sensitivity tools and Korean preferences remain available.

Calibration and software evidence are in [combat documentation](docs/combat/README.md) and the generated `/combat-validation.json`. These independent training models are not verified native VALORANT formulas or measured human skill profiles. The runtime remains Three.js/WebGL; the included Unreal staging source remains disabled.

# VALOPRAC 5.0.0 — visual redesign

Patch **05.00** refines original weapon geometry, skinned first-person gloves/arms, articulated tactical characters, architectural materials/lighting and the complete Korean interface within the existing Three.js engine. See [visual audit and implementation](docs/visual/REDESIGN.md). Existing mechanics, local records and production Site identity remain in place. Hardware FPS and physical input latency require real-device validation.

# VALOPRAC 4.0.1 — tactical movement and visual upgrade

Patch **04.01** fixes HUD docking, late Pointer Lock errors, explicit total movement cones, source-export completeness, player guidance, and actual security/cache/SPA responses through the existing Site. The response worker embeds the compiled client; `dist-client` is intermediate, `dist` is the complete Worker ESM deployment.

Major patch **04.00** extends 3.0 in place with real velocity-cone spread, tap-braking drills, compact toggle ADS, faster persistent-footstep recovery, optional fullscreen keyboard capture, bounded input diagnostics, faster bots, six original elevated tactical sections and exposure retry. See [implementation and calibration](docs/TACTICAL_OVERHAUL.md) and the actual release-generated tactical validation report. GPU visuals and physical input remain unverified.

Major patch **03.00** adds neutral angular tasks, shared input telemetry, motion analysis, controlled sensitivity exploration, optional GP-UCB, explainable drills, paired verification and local history. See [methodology](docs/AIM_SCIENCE.md). Human efficacy is unverified. The 2.3 browser game remains intact; Unreal migration remains disabled.

# VALOPRAC 2.3 — persistent footsteps and tactical corner practice

The browser trainer remains the production default. The genuine Unreal Engine 5.7 source project is in `unreal/VALOPRAC`; it has not been built or run with Unreal in this environment. See [migration documentation](docs/migration/README.md), [validation](docs/migration/VALIDATION.md) and [deployment/rollback](docs/migration/DEPLOYMENT.md). No GPU service has been purchased or activated. Release 2.2 adds the portable authoritative analytics journal, browser history/results/recoil adapter, acknowledged input admission, cancellation handling and tested worker teardown. See [protocol and limits](docs/migration/PROTOCOL.md).

Release 2.3 integrates the original separate corner-map layout and hearing/peeking concept with the existing Three.js movement, weapon and 3D hitbox engine. Persistent distance-based footsteps, stationary recovery, a distinct event-radius minimap, hearing-only bot investigation, local calibration controls/comparison and Korean patch notes are functional in the browser path. See [footstep calibration and evidence](docs/FOOTSTEP_CALIBRATION.md). These additions are not ported to the unbuilt UE staging runtime.

# VALOPRAC

A Korean browser-based tactical FPS trainer built with React, TypeScript, Vite, Three.js and Zustand. Production domain: https://valoprac.trade.

Version 2.0 extends the existing engine rather than replacing it: the 120 Hz movement simulation, braking measurements, rig-based head collision, original timed modes and IndexedDB history remain in place. Free Practice is unlimited and supports live weapon/target configuration while preserving normal magazine and reload mechanics.

## Development

Node.js 24.22.1 LTS; dependencies are pinned by `pnpm-lock.yaml`.

```sh
pnpm install --frozen-lockfile
npm test
npm run typecheck
npm run build
```

`npm run build` runs tests, TypeScript and Vite. Output is `dist`. Known client routes (`/training.html`, `/settings.html`, `/statistics.html`, `/results.html`) are exported as static HTML entry documents so direct URLs and refresh work without relying on Pages-only rewrite handling. No server, account, API key or client-side secret is needed. All data and optional imported audio remain in the user's browser. Existing settings/history keys and the `rifleA`/`rifleB` IDs are retained for compatibility.

## Systems

- `src/engine/simulation`: authoritative fixed ticks and mode lifecycle.
- `src/engine/movement`: acceleration, friction, inertia, jumping, crouch and braking episodes.
- `src/config/weapons.ts`: distinct Vandal, Phantom and semi-automatic Sheriff profiles, damage bands and ADS.
- `src/engine/recoil`: stateful horizontal direction, protected bullets, smooth recovery and player compensation.
- `src/engine/collision`, `targets`: hitscan against animated sphere/OBB hit zones and original cover geometry.
- `src/engine/rendering`: original weapon models, instanced humanoid parts, merged range geometry, stylized PBR, reflection probe and optional post-processing.
- `src/engine/audio`: preloaded original sound buffers, channel gains, overlapping tails and bounded active voices.
- `src/storage/audioAssets.ts`: rights-attested local audio import. For authorized public assets, configure same-origin paths and explicit redistribution authorization in `src/config/audio.ts`.
- `src/training/analytics`: lifetime scalar totals and capped detailed snapshots. Old history summaries remain readable.
- `src/ui`: Korean settings, practice controls, analysis and results. React updates at HUD cadence, not on every simulation tick.

Three layers remain distinct: bullet rays/spread, camera recoil and cosmetic gun/effect animation. Audio or graphical quality changes do not consume gameplay RNG. Sheriff input uses press counts so a click shorter than a simulation frame is retained.

## Calibration and rights

See `docs/WEAPON_CALIBRATION.json` for verified published values, requested reference values and provisional estimates. No native VALORANT parity or exact sensitivity matching is asserted. The required named skin profiles are present, but **no Riot audio/model/texture recording is included**. All shipped sounds and weapon artwork are independently produced alternatives. Requested reference names remain internal calibration metadata; the public sound UI labels shipped original audio and authorized user imports.

Three.js' MIT-licensed procedural `RoomEnvironment` is used to generate an original reflection probe. This is a browser WebGL renderer, not Unreal Engine or Lumen. Low quality removes expensive passes; High/Ultra are optional.

## Validation and production

Read `docs/UPGRADE_VALIDATION.md` for per-feature status and manual desktop QA. Tests cover mechanics, 30/60/144/240 Hz replay, storage, input contracts, audio lifecycle and one hour of simulated unlimited firing. They do not prove real GPU FPS, actual Pointer Lock, acoustic fidelity or browser soak stability.

The authoritative production repository is the existing Sites source identified by `.openai/hosting.json`; keep its project ID and public audience. Use the existing source helper to open the latest source, validate/build, push the exact source state, package `dist`, save a version and deploy it. Do not replace the Site or move its custom-domain DNS. Previous saved versions remain rollback candidates. `public/release.json` identifies the release for public HTTP verification.

## 09.00 dual movement

The existing browser trainer now selects a VALORANT or CS2-inspired movement
profile in Settings → Controls. Source Classic is explicitly separate. All
existing modes/maps keep their weapons, AI, sound and analytics. See
[implementation and independent calibration](docs/movement/IMPLEMENTATION.md),
[official references](docs/movement/REFERENCES.md) and
[release/rollback](docs/movement/RELEASE.md).
