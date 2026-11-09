#!/usr/bin/env bash
# Opt-in local Codex Memorix integration and source-backed initial memory.
# This script only runs when invoked in a Codex-capable environment.
set -euo pipefail
cd "$(dirname "$0")/.."
test -e .git || { echo "Run inside a cloned VALOPRAC Git repository" >&2; exit 1; }
command -v node >/dev/null || { echo "Node.js is required" >&2; exit 1; }
command -v npm >/dev/null || { echo "npm is required" >&2; exit 1; }
command -v git >/dev/null || { echo "Git is required" >&2; exit 1; }
node -e 'const v=process.versions.node.split(".").map(Number); if(v[0]!==24 || v[1]<22 || (v[1]===22 && v[2]<1)){ console.error("VALOPRAC requires Node >=24.22.1 <25; current",process.version); process.exit(1) }'
if ! command -v memorix >/dev/null 2>&1; then
  echo "Installing Memorix to this user environment (not the website)..."
  npm install -g memorix
fi
echo "Configuring the official user-level Codex integration..."
memorix setup --agent codex --global
echo "Backfilling the local Git commit history..."
memorix ingest log --count 500
echo "Indexing the current project source..."
memorix codegraph refresh
mkdir -p .memorix
seed_marker=".memorix/valoprac-baseline-20261109.done"
if [[ ! -f "$seed_marker" ]]; then
  echo "Creating source-backed baseline memory entries..."
  memorix memory store --title "VALOPRAC source provenance" --entity "valoprac" --text "Verified Git snapshot: ExilQ/valoprac main 6a4836d298264e2c9d45375abcb2f3932ac629bd is a 2026-10-25 version 2.3.0 tree. Source docs/CODEX_HANDOFF.md: prior imported source contained 171 matched files, but unpublished Sites revisions or old chats were not imported. Live site may differ; compare current source before changes."
  memorix memory store --title "VALOPRAC browser architecture" --entity "valoprac" --text "Source README.md AGENTS.md: React 19 TypeScript Vite Three.js Zustand, Korean UI, pnpm 11.25.0 Node 24.22.1. Preserve existing working browser runtime. All current complete source is in Git."
  memorix memory store --title "VALOPRAC movement and firing invariants" --entity "valoprac" --text "Source docs/MECHANICS.md: 120 Hz fixed-step simulation, velocity/acceleration braking and counter-strafe; bullets/spread, camera recoil, cosmetic weapon effects are distinct; head-only elimination and exact hit zones. Calibration values remain provisional, not proven Riot internals."
  memorix memory store --title "VALOPRAC footstep and tactical systems" --entity "valoprac" --text "Source docs/FOOTSTEP_CALIBRATION.md: 120 Hz actual horizontal displacement advances footsteps; walk preserves partial progress and physically stationary recovery reduces it. Event-only bot hearing and minimap audio circle; existing unit tests do not prove real VALORANT parity."
  memorix memory store --title "VALOPRAC streaming validation boundary" --entity "valoprac" --text "Source docs/migration/README.md and VALIDATION.md: Unreal 5.7 plus Pixel Streaming 2 staging is not compiled/running in Unreal here; actual GPU streaming, latency and native parity unverified. Browser path remains production default; no paid streaming, DNS or Sites deploy without approval."
  memorix memory store --title "VALOPRAC validation and security" --entity "valoprac" --text "Source AGENTS.md docs/MANUAL_TESTING.md: use frozen pnpm, tests, typecheck, build, broker/migration checks and actual browser Pointer Lock/graphics/storage tests before merge. Never store credentials, private training data or proprietary audio/assets; preserve valoprac.trade deployment."
  memorix memory store --title "VALOPRAC requested roadmap not validated" --entity "valoprac" --text "User-requested but not verified in this 2.3.0 Git snapshot: selectable CS vs VALORANT-inspired bunnyhop/air control, peeking variants and bots, Operator/wallbang, brighter UI, advanced analytics/replays, original polished art and legal BGM. Check newer Sites source and tests before claiming implementation."
  date -u +'%Y-%m-%dT%H:%M:%SZ' > "$seed_marker"
fi
echo "Diagnostics (hook review may still be required in Codex):"
memorix status
memorix doctor agents --agent codex
echo "In Codex, check plugin availability and approve reviewed Memorix hooks via /hooks."
