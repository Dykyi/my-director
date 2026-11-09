#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p fixtures
FF=(ffmpeg -y -loglevel error)
FLASH="drawbox=x=0:y=0:w=iw:h=ih:color=white:t=fill:enable='lt(mod(t\,1)\,0.066)'"

# 10 minutes, a flash every second, the click 40 ms late plus 30 ms of drift by the end.
"${FF[@]}" -f lavfi -i "color=c=black:s=320x180:r=30:d=600" \
  -f lavfi -i "aevalsrc='if(lt(mod(t-0.04-0.00005*t\,1)\,0.01)\,(random(0)*2-1)*0.8\,0)':s=48000:d=600" \
  -vf "$FLASH" -c:v libx264 -preset ultrafast -pix_fmt yuv420p -c:a aac -b:a 128k -shortest fixtures/sync.mov

"${FF[@]}" -f lavfi -i "testsrc2=s=1080x1920:r=30:d=10" -f lavfi -i "sine=f=440:sample_rate=48000:d=10" \
  -c:v hevc_videotoolbox -b:v 6M -tag:v hvc1 -c:a aac -ac 1 -b:a 128k fixtures/good.mov

# The same with frames 150-159 missing: their timestamps leave a 367 ms gap.
"${FF[@]}" -i fixtures/good.mov -vf "select='not(between(n\,150\,159))'" -fps_mode passthrough \
  -c:v hevc_videotoolbox -b:v 6M -tag:v hvc1 -c:a copy fixtures/dropped.mov

"${FF[@]}" -f lavfi -i "testsrc2=s=720x1280:r=30:d=10" -f lavfi -i "sine=f=440:sample_rate=48000:d=10" \
  -c:v hevc_videotoolbox -b:v 3M -tag:v hvc1 -c:a aac -ac 1 fixtures/small.mov

echo "fixtures ready: $(ls fixtures | tr '\n' ' ')"
