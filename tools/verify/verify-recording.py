#!/usr/bin/env python3
"""Checks recorded segments with the thresholds of the app's VerificationRules."""
import argparse
import json
import sys
from pathlib import Path

import media
from recording_checks import (
    AUDIO_CODEC,
    DEFAULT_FPS,
    MIN_AUDIO_RATE,
    audio_checks,
    check,
    manifest_check,
    tail_allowance,
    video_checks,
)
from report import emit

MANIFEST_FILE = "session.json"


def manifest_facts(path: Path) -> tuple[float, float | None, float | None]:
    """The frame rate, the expected length and, for a recovered segment, its crash tail allowance."""
    manifest_path = path.parent / MANIFEST_FILE
    if not manifest_path.exists():
        return DEFAULT_FPS, None, None
    manifest = json.loads(manifest_path.read_text())
    segments = manifest.get("segments", [])
    segment = next((entry for entry in segments if entry.get("file") == path.name), {})
    fps = float(manifest["config"]["camera"]["fps"])
    return fps, segment.get("durationSec"), tail_allowance(manifest, segment)


def verify(path: Path) -> list[dict]:
    nominal_fps, manifest_duration, allowance = manifest_facts(path)
    streams = media.probe(path)["streams"]
    video = next((stream for stream in streams if stream["codec_type"] == "video"), None)
    audio = next((stream for stream in streams if stream["codec_type"] == "audio"), None)
    errors = media.decode_errors(path)
    checks = [check("decode", "0 errors", f"{len(errors)} errors", not errors)]
    if video is None:
        return [*checks, check("video", "a video track", "none", False)]
    checks += video_checks(video, media.packet_times(path), nominal_fps, allowance)
    if audio is None:
        return [*checks, check("audio", f"{AUDIO_CODEC} >= {MIN_AUDIO_RATE} Hz", "none", False)]
    checks += audio_checks(video, audio, allowance)
    if manifest_duration is not None:
        checks.append(manifest_check(video, manifest_duration))
    return checks


def as_text(results: dict[str, list[dict]]) -> str:
    lines = []
    for path, checks in results.items():
        lines.append(path)
        for item in checks:
            verdict = "TAIL" if item.get("crashTail") else "PASS" if item["pass"] else "FAIL"
            expected = f"(expected {item['expected']})"
            note = f" · {item['note']}" if "note" in item else ""
            lines.append(f"  {verdict}  {item['id']:<11} {item['actual']}  {expected}{note}")
        if any(item.get("crashTail") for item in checks) and all(item["pass"] for item in checks):
            lines.append("  PASS (recovered): only the tail the crash cut off is out of limits")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("files", nargs="+", type=Path)
    parser.add_argument("--json", action="store_true", help="print a JSON report")
    args = parser.parse_args()
    results = {str(path): verify(path) for path in args.files}
    passed = all(item["pass"] for checks in results.values() for item in checks)
    emit({"pass": passed, "files": results}, args.json, as_text(results))
    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main())
