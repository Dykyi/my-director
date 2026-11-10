#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/device-env.sh"
ACTION=${1:?Usage: yarn stand <action>}
SETTINGS_BUNDLE_ID=com.apple.Preferences
APP_NAME=MyDirector
METRO_URL="http%3A%2F%2F$(ipconfig getifaddr en0 || ipconfig getifaddr en1)%3A8081"

launch() {
  xcrun devicectl device process launch --device "$DEVICE" "$@" >/dev/null
}

running() {
  xcrun devicectl device info processes --device "$DEVICE" 2>/dev/null | grep -q "/$APP_NAME.app/"
}

case "$ACTION" in
  home) launch "$SETTINGS_BUNDLE_ID" ;;
  # A cold start opens the dev launcher unless the link names the Metro server.
  open)
    if running; then launch "$BUNDLE_ID"; else launch --payload-url "$BUNDLE_ID://expo-development-client/?url=$METRO_URL" "$BUNDLE_ID"; fi
    ;;
  *)
    if ! running; then
      echo "$APP_NAME is not running and the dev launcher would drop the link: yarn stand open, wait for the app, then send $ACTION" >&2
      exit 1
    fi
    launch --payload-url "$BUNDLE_ID://stand/$ACTION" "$BUNDLE_ID"
    ;;
esac
echo "sent $ACTION"
