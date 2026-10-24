# VALOPRAC — Work → GitHub → Codex handoff (2026-10-24)

## Source provenance and scope

- Migration destination: private repository `ExilQ/valoprac`.
- Imported from an HTTP 200 downloadable source archive served by the user's published website: `https://valoprac.trade/downloads/valoprac-unreal-source.zip`.
- Archive SHA-256: `8bdfad29cb8a5a5fd43a4ace2657f281a0360e14acde20aca3db15eca4a669e9`.
- Archive contained **171 file entries** (all files imported); archive README and package indicate VALOPRAC **2.3.0**.
- Byte-level check against GitHub Git-blob SHA: **171/171 matching**, 118 new paths, 40 replaced paths, 13 identical paths; existing-only historical paths retained. No deletions.
- The archive is a verifiable captured source *snapshot*. This does **not** establish that unpublished edits, all ChatGPT Work conversation history, user-local media, or newer unpublished website revisions have been migrated.

## Architecture

- Browser frontend: `src/app`, `src/ui`, `src/components`, `src/engine`, `src/training`, `src/storage`.
- Tactical geometry, simulation/recoil/input and hearing: `src/engine/{tactical,simulation,input,movement,footsteps,recoil,rendering}`.
- Streaming: `src/streaming` (client), `infrastructure/pixel-streaming` (broker and worker).
- Unreal prototype: `unreal/VALOPRAC`, associated tests and scripts. Unreal build, renderer and runtime are **not validated**.
- Browser remains the default runtime; streaming stays disabled by default.

## Validation actually performed during migration

- Imported archive was parsed as valid ZIP, individual file paths checked, and no obvious credential filenames (`.env`, private keys) or credential token patterns in code were detected (not a full security audit).
- Exact Git blob SHAs matched for all 171 source files on the migration branch, and all 73 historical GitHub files still exist.
- `node --test infrastructure/pixel-streaming/*.test.mjs`: **20 passed / 0 failed**.
- `node scripts/verify-migration.mjs`: success; showed streaming disabled, default browser runtime, 0 of 12 optional gates passed.
- Full `pnpm install` exceeded network timeout with npm registry connection errors in the execution environment; therefore browser `typecheck`, complete Vitest suite and Vite build are **not yet verified** here.
- Unreal native build was not run. `scripts/test-unreal-core.mjs` exceeded its local timeout and should be retried in an equipped environment.

## Compatibility and safe merge

- Previous `main` used `npm` and `package-lock.json`, while archive version 2.3 uses `pnpm-lock.yaml`. PR validation workflow is updated to use Corepack and pnpm. The retained old npm lockfile is historical and may be removed only after verification.
- Previous `deployment/status.json`, production validation workflows and readme may refer to the old `valoprac.global` domain and the pre-deployment condition recorded on 2026-10-18; they are historical, **not** evidence about current `valoprac.trade` production state.
- Compare changes and run CI before merging. Merge does not itself redeploy the existing OpenAI Sites production website. Preserve the Sites hosting identifier in `.openai/hosting.json` and current DNS.
- Do not commit credentials, uploaded personal audio without rights, or proprietary third-party game assets.

## Codex first session

1. Read `AGENTS.md`, this file, `README.md` and `docs/migration/README.md`.
2. Inspect the imported branch (or merged `main`) without recreating the app.
3. Run frozen pnpm install, typecheck, Vitest suite and Vite build; document failures precisely.
4. Compare behavior of `https://valoprac.trade` to source and list post-snapshot work not present in Git.
5. Fix validation and carefully integrate separately saved VALOPRAC prototype/audio packages only with appropriate provenance and usage rights.
6. Continue improvements in small PRs; preserve core movement/recoil/counter-strafe/footstep mechanics and regression tests.
