# Sourced by the device scripts: moves to the repo root and sets DEVICE and BUNDLE_ID.
cd "$(dirname "${BASH_SOURCE[0]}")/../../.."
# Yarn runs scripts in its own shell without `set`, so the environment is loaded here.
set -a && . ./.env.local && set +a
: "${DEVICE:?Set DEVICE in .env.local to the iPhone identifier from: xcrun devicectl list devices}"
BUNDLE_ID=$(cd apps/mobile && node --import tsx scripts/bundle-id.ts)
