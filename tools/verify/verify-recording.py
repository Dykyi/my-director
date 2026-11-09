#!/usr/bin/env python3
"""Checks recorded segments with the thresholds of the app's VerificationRules (spec 8.15)."""
import argparse
import json
import sys
from pathlib import Path

import media

VIDEO_CODECS = {"hevc", "h264"}
MIN_SHORT_SIDE = 1080
NOMINAL_FPS = 30.0
FPS_TOLERANCE = 0.5
GAP_FACTOR = 1.5
MAX_GAP_RATIO = 0.005
MAX_INTERVAL_SEC = 0.1
AUDIO_CODEC = "aac"
MIN_AUDIO_RATE = 44_100
MAX_DURATION_MISMATCH_SEC = 0.1


def check(check_id: str, expected: str, actual: str, passed: bool) -> dict:
    return {"id": check_id, "expected": expected, "actual": actual, "pass": bool(passed)}


def display_size(stream: dict) -> tuple[int, int]:
    width, height = int(stream["width"]), int(stream["height"])
    rotation = next(
        (int(data["rotation"]) for data in stream.get("side_data_list", []) if "rotation" in data),
        int(stream.get("tags", {}).get("rotate", 0)),
    )
    return (height, width) if abs(rotation) % 180 == 90 else (width, height)


def verify(path: Path) -> list[dict]:
    info = media.probe(path)
    video = next((s for s in info["streams"] if s["codec_type"] == "video"), None)
    audio = next((s for s in info["streams"] if s["codec_type"] == "audio"), None)
    errors = media.decode_errors(path)
    checks = [check("decode", "0 errors", f"{len(errors)} errors", not errors)]
    if video is None:
        return [*checks, check("video", "a video track", "none", False)]

    checks.append(check("videoCodec", "hevc or h264", video["codec_name"], video["codec_name"] in VIDEO_CODECS))
    width, height = display_size(video)
    checks.append(check("resolution", f"short side >= {MIN_SHORT_SIDE}", f"{width}x{height}", min(width, height) >= MIN_SHORT_SIDE))

    times = media.packet_times(path)
    intervals = [b - a for a, b in zip(times, times[1:])]
    fps = (len(times) - 1) / (times[-1] - times[0]) if len(times) > 1 else 0.0
    checks.append(check("fps", f">= {NOMINAL_FPS - FPS_TOLERANCE}", f"{fps:.2f}", fps >= NOMINAL_FPS - FPS_TOLERANCE))
    gap_count = sum(1 for interval in intervals if interval > GAP_FACTOR / NOMINAL_FPS)
    gap_ratio = gap_count / max(len(intervals), 1)
    longest = max(intervals, default=0.0)
    checks.append(check(
        "gaps", f"<= {MAX_GAP_RATIO * 100:.1f} %, longest <= {MAX_INTERVAL_SEC * 1000:.0f} ms",
        f"{gap_ratio * 100:.2f} %, longest {longest * 1000:.0f} ms",
        gap_ratio <= MAX_GAP_RATIO and longest <= MAX_INTERVAL_SEC,
    ))

    if audio is None:
        return [*checks, check("audio", f"{AUDIO_CODEC} >= {MIN_AUDIO_RATE} Hz", "none", False)]
    rate = int(audio["sample_rate"])
    checks.append(check(
        "audio", f"{AUDIO_CODEC} >= {MIN_AUDIO_RATE} Hz", f"{audio['codec_name']} {rate} Hz {audio['channels']} ch",
        audio["codec_name"] == AUDIO_CODEC and rate >= MIN_AUDIO_RATE,
    ))
    mismatch = abs(float(video["duration"]) - float(audio["duration"]))
    checks.append(check(
        "durations", f"differ <= {MAX_DURATION_MISMATCH_SEC * 1000:.0f} ms", f"{mismatch * 1000:.0f} ms",
        mismatch <= MAX_DURATION_MISMATCH_SEC,
    ))
    return checks


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("files", nargs="+", type=Path)
    parser.add_argument("--json", action="store_true", help="print a JSON report")
    args = parser.parse_args()
    results = {str(path): verify(path) for path in args.files}
    passed = all(item["pass"] for checks in results.values() for item in checks)
    if args.json:
        print(json.dumps({"pass": passed, "files": results}, indent=2))
    else:
        for path, checks in results.items():
            print(path)
            for item in checks:
                print(f"  {'PASS' if item['pass'] else 'FAIL'}  {item['id']:<11} {item['actual']}  (expected {item['expected']})")
    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main())
