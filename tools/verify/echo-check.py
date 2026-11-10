#!/usr/bin/env python3
"""Looks for the interviewer's voice in what the room received from the phone.

`sent` is what the interviewer page published, `received` is what it got back from the phone;
both recordings start with the same click on the page, so the echo can only lag by the round trip.
"""
import argparse
import sys
from pathlib import Path

import media
from echo_analysis import ECHO_THRESHOLD, SAMPLE_RATE, echo_peaks
from report import emit


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("sent", type=Path)
    parser.add_argument("received", type=Path)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    sent = media.audio_samples(args.sent, SAMPLE_RATE)
    peaks = echo_peaks(sent, media.audio_samples(args.received, SAMPLE_RATE))
    max_correlation = max((peak["correlation"] for peak in peaks), default=0.0)
    report = {
        "windows": len(peaks),
        "maxCorrelation": max_correlation,
        "threshold": ECHO_THRESHOLD,
        "peaks": peaks,
    }
    text = (
        f"windows with interviewer speech: {len(peaks)}, "
        f"max correlation {max_correlation:.3f} (echo if > {ECHO_THRESHOLD})"
    )
    emit(report, args.json, text)
    return 0 if max_correlation < ECHO_THRESHOLD else 1


if __name__ == "__main__":
    sys.exit(main())
