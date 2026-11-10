import numpy as np

ENVELOPE_WINDOW_SEC = 0.001
CLICK_THRESHOLD_FRACTION = 0.5
CLICK_PERCENTILE = 99.9
REFRACTORY_SEC = 0.5
PAIR_WINDOW_SEC = 0.2
EDGE_WINDOW_SEC = 60.0
FLASH_PIXEL_PERCENTILE = 90
DARK_PERCENTILE, BRIGHT_PERCENTILE = 5, 95
MS_PER_SEC = 1000
SEC_PER_MIN = 60


def onsets(times: np.ndarray, refractory: float) -> np.ndarray:
    result: list[float] = []
    for time in times:
        if not result or time - result[-1] >= refractory:
            result.append(float(time))
    return np.array(result)


def click_onsets(samples: np.ndarray, sample_rate: int) -> np.ndarray:
    window = max(1, int(sample_rate * ENVELOPE_WINDOW_SEC))
    envelope = np.convolve(np.abs(samples), np.ones(window) / window, mode="same")
    threshold = CLICK_THRESHOLD_FRACTION * np.percentile(envelope, CLICK_PERCENTILE)
    return onsets(np.flatnonzero(envelope > threshold) / sample_rate, REFRACTORY_SEC)


def flash_onsets(frames: np.ndarray, times: np.ndarray) -> np.ndarray:
    count = min(len(frames), len(times))
    frames, times = frames[:count], times[:count]
    # The beacon covers only part of the picture: follow the pixels that change the most.
    variation = frames.std(axis=0)
    changing = variation >= np.percentile(variation, FLASH_PIXEL_PERCENTILE)
    brightness = frames[:, changing].mean(axis=1)
    dark = np.percentile(brightness, DARK_PERCENTILE)
    threshold = (dark + np.percentile(brightness, BRIGHT_PERCENTILE)) / 2
    rising = np.flatnonzero((brightness[1:] > threshold) & (brightness[:-1] <= threshold)) + 1
    return onsets(times[rising], REFRACTORY_SEC)


def pair(flashes: np.ndarray, clicks: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    if len(clicks) == 0:
        return np.array([]), np.array([])
    indices = np.clip(np.searchsorted(clicks, flashes), 1, len(clicks) - 1)
    before, after = clicks[indices - 1], clicks[indices]
    nearest = np.where(np.abs(before - flashes) < np.abs(after - flashes), before, after)
    offsets = nearest - flashes
    keep = np.abs(offsets) <= PAIR_WINDOW_SEC
    return flashes[keep], offsets[keep] * MS_PER_SEC


def sync_report(times: np.ndarray, offsets: np.ndarray) -> dict:
    start = float(np.median(offsets[times <= times[0] + EDGE_WINDOW_SEC]))
    end = float(np.median(offsets[times >= times[-1] - EDGE_WINDOW_SEC]))
    slope_per_min = float(np.polyfit(times / SEC_PER_MIN, offsets, 1)[0])
    duration = float(times[-1] - times[0])
    return {
        "pairs": int(len(times)),
        "durationSec": duration,
        "startOffsetMs": start,
        "endOffsetMs": end,
        "driftMsPerMin": slope_per_min,
        "driftMs": slope_per_min * duration / SEC_PER_MIN,
        "minOffsetMs": float(offsets.min()),
        "maxOffsetMs": float(offsets.max()),
    }
