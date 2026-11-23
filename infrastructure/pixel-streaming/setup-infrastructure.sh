#!/usr/bin/env bash
set -euo pipefail
: "${VALOPRAC_INFRA_ROOT:?Set an empty destination directory}"
readonly valoprac_commit=15f616198b7b33b1544f2a6a2d53b5f44e6ae707
if [[ -e "$VALOPRAC_INFRA_ROOT" ]]; then
  [[ "$(git -C "$VALOPRAC_INFRA_ROOT" rev-parse HEAD)" == "$valoprac_commit" ]] || { echo 'Existing infrastructure does not match the pin' >&2; exit 1; }
else
  git clone --branch UE5.7 --depth 1 https://github.com/EpicGames/PixelStreamingInfrastructure.git "$VALOPRAC_INFRA_ROOT"
  git -C "$VALOPRAC_INFRA_ROOT" fetch --depth 1 origin "$valoprac_commit"
  git -C "$VALOPRAC_INFRA_ROOT" checkout --detach "$valoprac_commit"
fi
cd "$VALOPRAC_INFRA_ROOT"
npm ci --ignore-scripts
npm run build:cjs --workspace Common
npm run build:cjs --workspace Signalling
npm run build --workspace SignallingWebServer
