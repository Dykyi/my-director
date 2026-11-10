#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../.."
OUTPUT=${1:?Usage: yarn record <output.mov>}
SOURCE=apps/mobile/scripts/record-screen.swift
BINARY=apps/mobile/scripts/.build/record-screen

if [[ ! -x $BINARY || $SOURCE -nt $BINARY ]]; then
  mkdir -p "$(dirname "$BINARY")"
  swiftc -O -swift-version 5 -o "$BINARY" "$SOURCE"
fi
mkdir -p "$(dirname "$OUTPUT")"
exec "$BINARY" "$OUTPUT"
