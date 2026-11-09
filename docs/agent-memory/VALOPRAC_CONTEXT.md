# VALOPRAC project memory — source-backed baseline

> Captured for Codex/Memorix onboarding on 2026-11-09. This Markdown is a **portable, reviewable seed**, not a live Memorix database, a byte-for-byte chat backup, or a claim about the current deployed site.

## Provenance and freshness

- Git repository: `ExilQ/valoprac` (private). Reviewed `main` commit `6a4836d298264e2c9d45375abcb2f3932ac629bd`, dated 2026-10-25. This tree has 194 tracked files and package version **2.3.0**.
- Original phase: `2484302857` initial commit (2026-10-18); `fd95bdf173` Cloudflare Pages preparation; `fbaf285cd3` imported validated source v2.3 (171 checked archive entries); `4fb75412a5` and `5263b6d888` Node 24.22.1 adjustments; `6a4836d298` PR #2 merge.
- `docs/CODEX_HANDOFF.md` says the archive was a source snapshot and explicitly did **not** prove that all unpublished edits, ChatGPT Work conversations, uploaded media, or later live website revisions were included.
- The published `https://valoprac.trade` is not automatically the same thing as this Git tree. Do not treat historical `valoprac.global` status notes as current domain status.
- For authoritative behavior, consult current code and tests first; this file points to those records. A summarized request is **not** evidence of implementation.

## Current Git tree — browser trainer

- Frontend: React 19 + TypeScript + Vite + Three.js + Zustand. Korean interface. Production source builds with Corepack **pnpm 11.25.0**, Node **24.22.1** (`package.json`, `README.md`, `AGENTS.md`).
- Fixed-step simulation: `src/engine/simulation` at **120 Hz**; movement under `src/engine/movement`, braking under `src/engine/movement/Braking.ts`; values expressed in SI units. These are trainer parameters, not proven exact VALORANT engine internals (`docs/MECHANICS.md`).
- Separate three layers: authoritative bullet ray + spread, camera recoil, and cosmetic weapon/FX animation. Avoid using cosmetic RNG to determine a hit. Hit volumes are visible head sphere and animated oriented body parts; only head hits eliminate a target (`docs/MECHANICS.md`).
- Weapons: Vandal, Phantom, and Sheriff profiles, ADS and reloads; source references `src/config/weapons.ts`, `src/engine/weapons`, `src/engine/recoil`. Distinguish verified values from provisional calibration (`README.md`, `docs/WEAPON_CALIBRATION.json` if present in current branch).
- Training includes unlimited Free Practice and timed/practice modes, stored local statistics and recoil analysis. Browser persistence is in IndexedDB/local storage, not a server account (`README.md`, `src/training`, `src/storage`).
- Tactical 3D corner map, sound/hearing bots and event-radius minimap are documented in 2.3.0. Footsteps are based on **actual horizontal displacement**, not merely pressing run; walking preserves progress, physical stopping recovers it. Source `src/engine/footsteps/Footsteps.ts`, `src/engine/tactical`; detailed parameters/tests: `docs/FOOTSTEP_CALIBRATION.md`.
- Rendering is original stylized WebGL/PBR/Three.js with quality presets; original procedurally derived assets. No Riot proprietary sound recordings or models are bundled. Rights-attested import only (`README.md`, `THIRD_PARTY_NOTICES.md`).
- Runtime boundaries: Pointer Lock needs browser user gesture; capture fallback, audio Web API, WebGL access and GPU frame pacing require real-browser/hardware testing (`docs/MANUAL_TESTING.md`).

## Experimental Unreal/streaming paths — not production-ready

- `unreal/VALOPRAC` has UE **5.7** staging project and a portable C++ fixed-step core; UE-dependent game project has **not been successfully built/run** in the reviewed environment (`docs/migration/README.md` and `VALIDATION.md`).
- `src/streaming` plus `infrastructure/pixel-streaming` contain opt-in Pixel Streaming 2 client/broker/session protocols. Existing browser engine remains default; paid GPU/TURN/live streaming are **not enabled or proven** (`docs/migration/PROTOCOL.md`, `DEPLOYMENT.md`).
- Native JSON replay and TypeScript parity tests exist, but do not prove actual UE visuals, native input-to-photon latency, GPU FPS or network reliability. `docs/migration/LATENCY.md` gives reproducible measurement protocol.

## Testing and change boundaries

- Relevant commands: `corepack pnpm install --frozen-lockfile`, `corepack pnpm test`, `corepack pnpm typecheck`, `corepack pnpm build`, `node --test infrastructure/pixel-streaming/*.test.mjs`, `node scripts/verify-migration.mjs`.
- Historical test counts in documents relate to their dated snapshots; they are **not new test results**. Record command + environment + commit + pass/fail when rerunning.
- Always use small reviewable branches; prevent regression of movement, recoil, aim accuracy, head hits, peeking, footstep accumulation, local data and Korean UI.
- Never deploy, purchase infrastructure, change DNS, overwrite live Sites source, or activate streaming solely due to a memory entry or Git change. Do not assume a main-branch merge is an actual Sites production deployment.

## Requested development directions — requirements, NOT verified source features

Earlier project discussions requested: distinct Counter-Strike and VALORANT-inspired air-control/bunnyhop physics selectable in settings; faster side-to-side strafing and tap-braking practice; realistic peeking (wide, shoulder, jiggle, crouch, vertical angles); bot variation/exposure timing; wall penetration and Operator support; a brighter legible non-generic UI; original upgraded weapon/map/character art; FPS/performance tuning; expanded training analytics, replay review and sensitivity evaluation; legal focus BGM.
Some of these may be present on a **newer deployed Sites version** but not in this reviewed 2.3.0 Git snapshot. Do not mark any of them implemented without checking live source, relevant tests and UI.

Recent user priorities also include: keep production site at `valoprac.trade`; allow OAI-SearchBot search traffic while separating GPTBot model-training collection; prefer only the main page in search results; compare Cloudflare Analytics weekly without unapproved changes. Treat these as independent operations/SEO requirements, not proof that code/config already matches.

## Reading map (all development material remains in Git)

- `AGENTS.md` — Codex project invariants and validation gates.
- `README.md` — versions, architecture, commands, runtime limitations.
- `docs/CODEX_HANDOFF.md` — import provenance, missing history and Codex handoff.
- `docs/MECHANICS.md` — movement, braking, recoil, spread, hit geometry, metric definitions.
- `docs/FOOTSTEP_CALIBRATION.md` — tactical/footsteps algorithm and tests.
- `docs/MANUAL_TESTING.md` — unexecuted real-browser acceptance checklist.
- `docs/VALIDATION.md`, `docs/test-output.txt`, `docs/test-results.json` — historical evidence.
- `docs/PRODUCTION.md`, `deployment/`, `.openai/hosting.json` — historical production setup and Sites distinction.
- `docs/migration/`, `unreal/`, `src/streaming/`, `infrastructure/pixel-streaming/` — native staging and streaming.
- `src/engine/`, `src/ui/`, `src/config/`, `src/storage/`, `src/training/`, `src/components/` — current implementation; enumerate files from Git rather than trusting this summary.
- `git log --all --oneline --decorate` — auditable full Git history. Memorix Git Memory indexes commit facts; the Git tree itself remains the canonical full source archive.

## Durable memory policy

Store verified, high-signal **atomic** entries with file/commit provenance: design choices, algorithm tradeoffs, tests/reproductions, unresolved blockers and handoff summaries. Mark source-verified, user-requested, and hypothesized claims distinctly; supersede stale facts after a code change. Never store complete raw transcripts or secrets. Git + documented code is the complete code record; Memorix is a search/index layer rather than a replacement for version control.
