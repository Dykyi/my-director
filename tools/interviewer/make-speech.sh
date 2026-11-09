#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
say -v Samantha -f script.txt -o speech.aiff
ffmpeg -y -loglevel error -i speech.aiff -ac 1 -ar 48000 -c:a aac -b:a 128k speech.m4a
rm speech.aiff
echo "speech.m4a: $(ffprobe -v error -show_entries format=duration -of csv=p=0 speech.m4a) s"
