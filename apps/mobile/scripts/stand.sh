#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/device-env.sh"
ACTION=${1:?Usage: yarn stand <action>}
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
