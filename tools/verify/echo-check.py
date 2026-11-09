#!/usr/bin/env python3
"""Looks for the interviewer's voice in what the room received from the phone (TP-ECHO).

`sent` is what the interviewer page published, `received` is what it got back from the phone; both recordings
start with the same click on the page, so the echo can only lag by the round trip.
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np

import media

RATE = 16_000
WINDOW_SEC = 5
MAX_LAG_SEC = 1.5
SPEECH_RMS = 0.01
ECHO_THRESHOLD = 0.1


def peak_correlation(reference: np.ndarray, segment: np.ndarray) -> float:
    """Largest normalized cross-correlation of `reference` inside `segment`, over all lags, via FFT."""
    size = len(segment)
    spectrum = np.fft.rfft(segment, size) * np.conj(np.fft.rfft(reference, size))
    correlation = np.fft.irfft(spectrum, size)[: size - len(reference) + 1]
    energy = np.concatenate(([0.0], np.cumsum(segment**2)))
    window_energy = energy[len(reference):] - energy[: size - len(reference) + 1]
    norms = np.sqrt(window_energy * np.sum(reference**2))
    return float(np.max(np.abs(correlation) / np.maximum(norms, 1e-12)))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("sent", type=Path)
    parser.add_argument("received", type=Path)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    sent = media.audio_samples(args.sent, RATE)
    received = media.audio_samples(args.received, RATE)
    window, max_lag = WINDOW_SEC * RATE, int(MAX_LAG_SEC * RATE)
    peaks = []
    for start in range(0, len(sent) - window, window):
        reference = sent[start : start + window]
        segment = received[start : start + window + max_lag]
        if len(segment) < window + max_lag:
            break
        if np.sqrt(np.mean(reference**2)) < SPEECH_RMS:
            continue
        peaks.append({"atSec": start / RATE, "correlation": peak_correlation(reference, segment)})

    max_correlation = max((peak["correlation"] for peak in peaks), default=0.0)
    report = {"windows": len(peaks), "maxCorrelation": max_correlation, "threshold": ECHO_THRESHOLD, "peaks": peaks}
    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print(f"windows with interviewer speech: {len(peaks)}, max correlation {max_correlation:.3f} (echo if > {ECHO_THRESHOLD})")
    return 0 if max_correlation < ECHO_THRESHOLD else 1


if __name__ == "__main__":
    sys.exit(main())
