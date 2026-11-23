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

## GitHub patch releases

- For every completed VALOPRAC product patch, validate the changes, commit the source and push it to `ExilQ/valoprac`. Follow the repository's pull request and validation process.
- Check the GitHub releases, tags, and the source version before choosing the next patch version. Use a `vMAJOR.MINOR.PATCH` tag on the exact commit that contains the verified patch. Keep the package version in sync when releasing the browser package.
- Publish a GitHub Release for that tag. Write the patch notes in Korean with the user-visible changes, fixes, and any release-relevant validation limitations. Verify the published release and share its link when reporting completion.
- If a patch was developed in the hosted Sites project, verify that the GitHub commit contains the corresponding source before tagging it. A GitHub release does not publish the live website.

## Shared memory (Memorix; optional until runtime installation is verified)

- Read `docs/agent-memory/VALOPRAC_CONTEXT.md` and `docs/MEMORIX.md` when beginning a new Codex session or switching agents.
- If Memorix is installed and connected, use its project context / search before major changes. Verify recalled claims against current source files and tests; a memory is never proof that a feature works.
- After a verified change, store a concise durable memory: goal, changed files, reason/alternatives, reproducible tests and outcomes, commit SHA, and any remaining uncertainty. Label untested changes as unverified. Use Git history as the canonical record of *what* changed.
- Do not copy full chat transcripts, user identities, environment variables, credentials, private tokens, proprietary materials, or raw browser-local training data into shared memory.
- Never claim that installing this repository's documentation automatically installs the user-level Codex plugin. Memorix installation and Codex hook review occur in the Codex execution environment; see `docs/MEMORIX.md`.
- Existing repository `main` is a historical 2.3.0 snapshot. The live website can be newer and diverge. Inspect actual deployed source separately before assuming parity.
