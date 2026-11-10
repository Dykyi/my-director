#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/device-env.sh"
DESTINATION="pulled/${1:-$(date +%Y-%m-%d_%H-%M)}"
mkdir -p "$DESTINATION"
xcrun devicectl device copy from --device "$DEVICE" --domain-type appDataContainer \
  --domain-identifier "$BUNDLE_ID" --source Documents/Recordings --destination "$DESTINATION"
shopt -s nullglob
segments=("$DESTINATION"/*/segment-*.mov)
if (( ${#segments[@]} == 0 )); then
  echo "No segments in $DESTINATION"
  exit 1
fi
tools/verify/.venv/bin/python tools/verify/verify-recording.py "${segments[@]}"
