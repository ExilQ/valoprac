# VALOPRAC

VALOPRAC is an independent, Korean-language tactical FPS practice tool that runs in the browser. It helps players repeat the moments that are hard to isolate in a match, such as stopping before the first shot, managing recoil, peeking a corner, and moving quietly enough to avoid giving away their position.

[Open the trainer](https://valoprac.trade/) · [Open the Review Lab](https://valoprac.trade/review/)

## What it helps you practice

- **Movement and first-shot accuracy.** Use drills and timing measurements to see how braking, movement speed, and stance affect a shot.
- **Weapon control.** Practice firing, aiming down sights, reloading, and recoil recovery with distinct weapon profiles. Use timed drills for repeatable attempts or Free Practice to work at your own pace.
- **Tactical decisions.** Approach corners from different angles and use the footstep display to see where movement produces noise that defenders can hear.
- **Review.** Check local training statistics after a session. The live Review Lab lets players connect training sessions to their own match-review notes and compare results over time.

## What this repository is for

This public repository provides a runnable browser trainer and a place to inspect, test, and improve its mechanics. It documents how simulation, rendering, input, and local storage work together. The live website can be ahead of this source snapshot. For the features served on the website, see the [production metadata](https://valoprac.trade/release.json) and [English patch history](docs/PATCH_HISTORY_EN.md).

| Area | Role |
| --- | --- |
| [Simulation](src/engine/simulation) and [movement](src/engine/movement) | Advance the game at a fixed 120 Hz and apply acceleration, braking, jumping, and crouching. |
| [Rendering](src/engine/rendering) and [interface](src/ui) | Draw 3D scenes with Three.js and present training controls, feedback, and results in React. |
| [Training analytics](src/training/analytics) and [storage](src/storage) | Calculate practice statistics and save training history and settings in the browser. |
| [Unreal project](unreal/VALOPRAC) and [streaming infrastructure](infrastructure/pixel-streaming) | Provide experimental native and streaming scaffolding. Browser practice uses the WebGL runtime. Native Unreal build and play verification are still outstanding. |

## Run locally

Use Node.js **24.22.1** and **pnpm 11.25.0**. The pnpm lockfile pins the dependencies.

```sh
corepack enable
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

Open [localhost:4173](http://localhost:4173). The browser trainer can run locally without an account or an API key. Use `corepack pnpm build` to generate the static browser output in `dist/`.

## Contributing

Open an issue with the drill, weapon, browser, and steps to reproduce a problem. Include what you expected and what happened. For changes to movement, hit detection, or audio, include the measurement or test that demonstrates the difference.

Before opening a pull request, run the checks relevant to your change.

```sh
corepack pnpm test
corepack pnpm typecheck
corepack pnpm build
```

[Mechanics](docs/MECHANICS.md) · [Footstep calibration](docs/FOOTSTEP_CALIBRATION.md) · [Manual testing](docs/MANUAL_TESTING.md) · [Unreal migration notes](docs/migration/README.md)

## Calibration and rights

VALOPRAC is an unofficial training tool. Its movement, weapon, and sensitivity values are independently calibrated for practice. The trainer uses original models and sounds, and [Third-party notices](THIRD_PARTY_NOTICES.md) describe included dependencies and their terms.

Project-wide licensing terms are currently unspecified. Confirm permissions with the maintainer before redistributing the project's code or assets.
