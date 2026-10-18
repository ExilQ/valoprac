# VALOPRAC — Production source for valoprac.global

A functional, browser-local tactical aim trainer built with React, TypeScript, Vite, Three.js, Zustand, Tailwind CSS, IndexedDB, Pointer Lock and Web Audio. All player-facing text is Korean. No API key, server, account integration or external asset CDN is required by the app.

The movement, recoil, spread and sensitivity constants are **provisional tuning values, not verified VALORANT data**. The app should be treated as a configurable tactical mechanics trainer, not a certified replica. Neither training transfer nor 1:1 sensitivity conversion has been established.

## Run

Use Node 22.12 or later (Node 22 LTS is configured) and npm:

```bash
npm ci
npm run dev
```

Open the displayed URL in a desktop browser. Choose a mode, duration and rifle. Press **훈련 시작**, then click **클릭하여 훈련 시작** to grant Pointer Lock and unlock audio. The second click deliberately supplies a fresh browser user gesture.

```bash
npm test
npm run typecheck
npm run build
```

`dist/` is a static deployment; serve it over HTTPS or localhost. Do not open `index.html` using the file protocol. `public/guide.html` supplies Korean controls and manual checks.

## Production status

The requested production domain **https://valoprac.global is not live yet**. Cloudflare account authorization and domain registration are required. See [production execution status and continuation](docs/PRODUCTION.md). The repository preserves the complete game and contains validated production build/hosting/CI configurations; it is not a replacement mockup.

`npm run build` runs typechecking and all tests before creating `dist`. GitHub CI validates pushes/PRs. Native Cloudflare Git integration must be authorized and connected before automatic public deployment is active.

## Implemented experience

- WASD movement, normalized diagonals, acceleration, velocity-dependent neutral deceleration, direction reversal, walking, crouching, jumping, limited air control and floor/cover/wall collision.
- A 120 Hz deterministic simulation independent of the rendering loop, interpolated movement/eye height, direct unsmoothed mouse-look and configurable horizontal FOV.
- Two configurable full-auto rifles, fire-rate lattice, magazines, manual/automatic reload, ADS, seeded disk spread, independent weapon animation, camera and trajectory recoil, recovery and mouse compensation.
- Pooled procedural humanoid rigs. Exact head spheres and oriented torso/limb boxes share authoritative joint matrices with their corresponding render geometry. Nearest-hit ordering and real cover occlusion apply. Only head hits eliminate.
- Headshot precision, braking comparison, spray control and moving-target tracking. Six tracking behaviors include stationary, strafe, random reversal, stop-and-go, crouch and cover peek.
- Korean menu, crosshair editor, sensitivity/graphics/audio controls, training HUD, pause/resume, results, per-mode history trend, spray impact ordinals, grouping statistics, input compensation paths and optional baseline ideal compensation.
- Rich per-shot snapshots, per-target eliminations, tracking samples and bounded local history. Forty summaries and ten detailed sessions are retained. Training duration is clamped to ten minutes.

## Architecture

| Directory | Responsibility |
| --- | --- |
| `src/app` | Application screen flow and low-frequency Zustand state |
| `src/config` | Movement, weapon and persisted settings profiles |
| `src/engine/simulation` | Fixed clock, seeded RNG, authoritative world and events |
| `src/engine/input` | Pointer Lock, relative mouse, keys, blur reset, cleanup |
| `src/engine/movement` | Velocity integration, collision response, braking observations |
| `src/engine/weapons`, `recoil` | Cadence, ammunition, spread, kick, recovery, compensation |
| `src/engine/targets`, `collision` | Hierarchical target poses, exact 3D ray volumes, occlusion |
| `src/engine/rendering`, `audio` | WebGL scene, interpolated visuals, pooled impacts, synthesized cues |
| `src/training` | Mode metadata and pure analytics |
| `src/storage` | IndexedDB transactions and retention |
| `src/ui`, `components` | Korean presentation and accessible controls |
| `src/tests` | Executable deterministic, integration, storage, markup and CPU-workload tests |

Gameplay does not live in React components. HUD snapshots publish approximately ten times per second. Mouse events update base aim immediately; React is absent from the input hot path. Render resources, listeners, resize observers, audio contexts and animation frames have explicit disposal. Targets, their joint matrices, impact markers and tracer geometry are reused.

The arena is a flat floor with box walls and box cover. An axis-separated horizontal circle/AABB resolver with displacement substeps is smaller and deterministic for that geometry; Rapier is intentionally not necessary in this phase. The arena has no climbable stairs, slopes or moving rigid bodies. Cover blocks horizontal motion; jumping above cover is possible. Adding general terrain should replace the controller's environment resolver with a tested shape-casting controller rather than adding exceptions.

See [mechanics](docs/MECHANICS.md), [validation and feature status](docs/VALIDATION.md), and [manual browser acceptance](docs/MANUAL_TESTING.md).

## Verification boundary

Automated tests and TypeScript/production builds were executed. Browser visual QA, actual hardware Pointer Lock/audio, GPU frame pacing and 144/240 Hz perceived responsiveness were not executed in the available environment. The CPU benchmark is explicitly **not** a rendering FPS benchmark. Phase 1 browser/hardware acceptance remains pending those manual checks.

## Tuning

Edit `src/config/movement.ts` and `src/config/weapons.ts`. Both are plain typed profiles with English technical comments. Profile changes should be validated with the same deterministic tests and calibrated against measurements before claiming fidelity to a specific commercial game.
