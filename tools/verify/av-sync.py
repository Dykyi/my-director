#!/usr/bin/env python3
"""Measures audio offset and drift against video from the sync beacon: one flash and one click per second (TP-SYNC).

Positive offsets mean the sound comes later than the picture.
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np

import media

SAMPLE_RATE = 48_000
ENVELOPE_WINDOW_SEC = 0.001
CLICK_THRESHOLD_FRACTION = 0.5
CLICK_PERCENTILE = 99.9
REFRACTORY_SEC = 0.5
PAIR_WINDOW_SEC = 0.2
EDGE_WINDOW_SEC = 60.0
FLASH_PIXEL_PERCENTILE = 90


def onsets(times: np.ndarray, refractory: float) -> np.ndarray:
    result: list[float] = []
    for time in times:
        if not result or time - result[-1] >= refractory:
            result.append(float(time))
    return np.array(result)


def click_onsets(path: Path) -> np.ndarray:
    samples = media.audio_samples(path, SAMPLE_RATE)
    window = max(1, int(SAMPLE_RATE * ENVELOPE_WINDOW_SEC))
    envelope = np.convolve(np.abs(samples), np.ones(window) / window, mode="same")
    threshold = CLICK_THRESHOLD_FRACTION * np.percentile(envelope, CLICK_PERCENTILE)
    return onsets(np.flatnonzero(envelope > threshold) / SAMPLE_RATE, REFRACTORY_SEC)


def flash_onsets(path: Path) -> np.ndarray:
    frames = media.gray_frames(path)
    times = np.array(media.packet_times(path))
    count = min(len(frames), len(times))
    frames, times = frames[:count], times[:count]
    variation = frames.std(axis=0)
    brightness = frames[:, variation >= np.percentile(variation, FLASH_PIXEL_PERCENTILE)].mean(axis=1)
    threshold = (np.percentile(brightness, 5) + np.percentile(brightness, 95)) / 2
    rising = np.flatnonzero((brightness[1:] > threshold) & (brightness[:-1] <= threshold)) + 1
    return onsets(times[rising], REFRACTORY_SEC)


def pair(flashes: np.ndarray, clicks: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    if len(clicks) == 0:
        return np.array([]), np.array([])
    indices = np.clip(np.searchsorted(clicks, flashes), 1, len(clicks) - 1)
    nearest = np.where(np.abs(clicks[indices - 1] - flashes) < np.abs(clicks[indices] - flashes), clicks[indices - 1], clicks[indices])
    offsets = nearest - flashes
    keep = np.abs(offsets) <= PAIR_WINDOW_SEC
    return flashes[keep], offsets[keep] * 1000


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("file", type=Path)
    parser.add_argument("--calibration-ms", type=float, default=0.0, help="the beacon's own offset, measured once with the system Camera app")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    times, offsets = pair(flash_onsets(args.file), click_onsets(args.file))
    if len(times) < 2:
        print(json.dumps({"error": "fewer than two flash and click pairs found"}))
        return 2
    offsets = offsets - args.calibration_ms
    start = float(np.median(offsets[times <= times[0] + EDGE_WINDOW_SEC]))
    end = float(np.median(offsets[times >= times[-1] - EDGE_WINDOW_SEC]))
    slope_per_min = float(np.polyfit(times / 60, offsets, 1)[0])
    report = {
        "pairs": int(len(times)),
        "durationSec": float(times[-1] - times[0]),
        "startOffsetMs": start,
        "endOffsetMs": end,
        "driftMsPerMin": slope_per_min,
        "driftMs": slope_per_min * float(times[-1] - times[0]) / 60,
        "minOffsetMs": float(offsets.min()),
        "maxOffsetMs": float(offsets.max()),
    }
    if args.json:
        print(json.dumps(report, indent=2))
    else:
        for key, value in report.items():
            print(f"{key:>15}: {value:.1f}" if isinstance(value, float) else f"{key:>15}: {value}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
