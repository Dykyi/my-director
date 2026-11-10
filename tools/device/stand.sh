#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
set -a && . ./.env.local && set +a
: "${DEVICE:?Set DEVICE in .env.local to the iPhone identifier from: xcrun devicectl list devices}"
ACTION=${1:?Usage: yarn stand <action>}
BUNDLE_ID=$(node --import tsx tools/device/bundle-id.ts)
SETTINGS_BUNDLE_ID=com.apple.Preferences

launch() {
  xcrun devicectl device process launch --device "$DEVICE" "$@" >/dev/null
}

case "$ACTION" in
  home) launch "$SETTINGS_BUNDLE_ID" ;;
  open) launch "$BUNDLE_ID" ;;
  *) launch --payload-url "$BUNDLE_ID://stand/$ACTION" "$BUNDLE_ID" ;;
esac
echo "sent $ACTION"
