# VALOPRAC — Codex repository instructions

This is the existing VALOPRAC tactical-FPS trainer. **Continue development rather than rebuilding it.**

- Canonical browser production hostname: `https://valoprac.trade`.
- Browser stack: React 19, TypeScript, Vite, Three.js, Zustand; `src/engine` maintains gameplay mechanics and fixed-tick simulation.
- Package manager: **pnpm 11.25.0** via Corepack (`corepack pnpm install --frozen-lockfile`). Do not use the retained historical `package-lock.json` as the source of truth.
- Preserve existing weapon configurations, 120 Hz movement simulation, recoil, braking/counter-strafe, head collision, target modes, history, audio settings, and accessibility controls.
- `unreal/VALOPRAC` is an experimental Unreal Engine 5.7 native staging project. It is not proven to compile or run in this environment; never claim native parity without tests.
- `infrastructure/pixel-streaming` is an opt-in staging infrastructure. Do not enable paid GPU resources or publish streaming endpoints without separate approval.
- Avoid embedding API tokens, credentials, proprietary game assets, or unlicensed music in Git. Use only authorized/licensed audio assets.
- Browser runtime and published website deployment are separate. Do not overwrite the live Sites deployment or change custom-domain DNS from GitHub commits.
- Refer to `docs/CODEX_HANDOFF.md`, the top-level `README.md`, and `docs/migration/README.md` before structural changes.
- Validation, where network and tools permit: `corepack pnpm install --frozen-lockfile`, `corepack pnpm test`, `corepack pnpm typecheck`, `corepack pnpm build`, `node --test infrastructure/pixel-streaming/*.test.mjs`, and `node scripts/verify-migration.mjs`.
- Before merging to `main`, check the GitHub Actions PR results and manually exercise browser Pointer Lock, keyboard focus, weapon recoil, collision, and client-only persistence.
