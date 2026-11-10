#!/usr/bin/env python3
"""Measures audio offset and drift against video from the sync beacon.

The beacon shows one flash and plays one click per second.

Positive offsets mean the sound comes later than the picture.
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np

import media
from report import emit
from sync_analysis import click_onsets, flash_onsets, pair, sync_report

SAMPLE_RATE = 48_000


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("file", type=Path)
    parser.add_argument(
        "--calibration-ms", type=float, default=0.0,
        help="the beacon's own offset, measured once with the system Camera app",
    )
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    flashes = flash_onsets(media.gray_frames(args.file), np.array(media.packet_times(args.file)))
    clicks = click_onsets(media.audio_samples(args.file, SAMPLE_RATE), SAMPLE_RATE)
    times, offsets = pair(flashes, clicks)
    if len(times) < 2:
        print(json.dumps({"error": "fewer than two flash and click pairs found"}))
        return 2
    report = sync_report(times, offsets - args.calibration_ms)
    text = "\n".join(
        f"{key:>15}: {value:.1f}" if isinstance(value, float) else f"{key:>15}: {value}"
        for key, value in report.items()
    )
    emit(report, args.json, text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
