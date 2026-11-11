#!/usr/bin/env python3
"""Finds the interviewer's lines in the phone's recording.

`sent` is what the interviewer page published (its sent-*.webm), `segments` are the phone's segments of that session
in order. The lines must all be there, at an offset that holds steady within a segment and between route changes,
and about as loud as the user. A route change moves the offset by the change in output latency the app logs.
"""
import argparse
import sys
from pathlib import Path

import media
from echo_analysis import SAMPLE_RATE
from mix_analysis import MAX_LEVEL_GAP_DB, MAX_OFFSET_SPREAD_MS, match_lines, mix_report, user_level_db
from report import emit


def route_change(value: str) -> tuple[int, float]:
    segment, _, at = value.rpartition(":")
    return (int(segment) if segment else 1, float(at))


def _db(value: float | None) -> str:
    return "n/a" if value is None else f"{value:.1f} dB"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("sent", type=Path)
    parser.add_argument("segments", type=Path, nargs="+")
    parser.add_argument("--route-change", type=route_change, action="append", default=[], metavar="[SEGMENT:]SEC")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    sent = media.audio_samples(args.sent, SAMPLE_RATE)
    segments = [media.audio_samples(path, SAMPLE_RATE) for path in args.segments]
    matches = match_lines(sent, segments)
    report = mix_report(matches, user_level_db(segments, matches), args.route_change)
    stretches = [
        f"  segment {stretch['segment']} part {stretch['part'] + 1}: {stretch['lines']} lines,"
        f" offset {stretch['offsetMs']:.1f} ms, spread {stretch['spreadMs']:.1f} ms"
        for stretch in report["stretches"]
    ]
    spread = report["offsetSpreadMs"]
    text = "\n".join([
        f"interviewer lines found: {report['linesFound']} of {report['lines']}",
        *stretches,
        f"largest spread: {'n/a' if spread is None else f'{spread:.1f} ms'} (pass if <= {MAX_OFFSET_SPREAD_MS} ms)",
        f"interviewer {_db(report['interviewerDb'])}, user {_db(report['userDb'])}"
        f" (pass if the interviewer is at most {MAX_LEVEL_GAP_DB} dB quieter)",
        "PASS" if report["pass"] else "FAIL",
    ])
    emit(report, args.json, text)
    return 0 if report["pass"] else 1


if __name__ == "__main__":
    sys.exit(main())
