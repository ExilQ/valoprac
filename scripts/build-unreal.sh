#!/usr/bin/env bash
set -euo pipefail
: "${VALOPRAC_UE_ROOT:?Set licensed Unreal Engine 5.7 installation path}"
valoprac_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
valoprac_project="$valoprac_root/unreal/VALOPRAC/VALOPRAC.uproject"
valoprac_output="${VALOPRAC_UE_OUTPUT:-$valoprac_root/unreal/builds}"
node "$valoprac_root/scripts/export-unreal-data.mjs"
"$VALOPRAC_UE_ROOT/Engine/Build/BatchFiles/Linux/Build.sh" VALOPRACEditor Linux Development "$valoprac_project" -WaitMutex
"$VALOPRAC_UE_ROOT/Engine/Binaries/Linux/UnrealEditor-Cmd" "$valoprac_project" -unattended -nullrhi -ExecutePythonScript="$valoprac_root/unreal/VALOPRAC/Scripts/prepare_assets.py" -stdout -FullStdOutLogOutput
"$VALOPRAC_UE_ROOT/Engine/Build/BatchFiles/RunUAT.sh" BuildCookRun -project="$valoprac_project" -noP4 -platform=Linux -clientconfig=Shipping -build -cook -map=/Game/Maps/Range -stage -pak -archive -archivedirectory="$valoprac_output" -utf8output
