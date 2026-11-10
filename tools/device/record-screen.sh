#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
OUTPUT=${1:?Usage: yarn record <output.mov>}
SOURCE=tools/device/record-screen.swift
BINARY=tools/device/.build/record-screen

if [[ ! -x $BINARY || $SOURCE -nt $BINARY ]]; then
  mkdir -p "$(dirname "$BINARY")"
  swiftc -O -swift-version 5 -o "$BINARY" "$SOURCE"
fi
mkdir -p "$(dirname "$OUTPUT")"
exec "$BINARY" "$OUTPUT"
