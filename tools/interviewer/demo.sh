#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
readonly PORT=8080
readonly PAGE="http://localhost:$PORT/"
readonly IDENTITY=${1:-}
readonly SERVER_WAIT_TRIES=20

node --env-file=.env.local tools/livekit-token/token.mjs ${IDENTITY:+"$IDENTITY"} >/dev/null

if ! lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null; then
  nohup python3 -m http.server "$PORT" --bind 127.0.0.1 --directory tools/interviewer >/dev/null 2>&1 &
  for _ in $(seq "$SERVER_WAIT_TRIES"); do
    curl -fs -o /dev/null "$PAGE" && break
    sleep 0.25
  done
fi

open "$PAGE${IDENTITY:+?as=$IDENTITY}"
echo "Interviewer page opened${IDENTITY:+ as $IDENTITY}. Press \"Play script\" to start talking."
