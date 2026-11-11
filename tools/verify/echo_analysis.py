import numpy as np

SAMPLE_RATE = 16_000
WINDOW_SEC = 5
MAX_LAG_SEC = 1.5
SPEECH_RMS = 0.01
FRAME_SEC = 0.02
# A window with a short burst of speech correlates with anything by chance:
# 0.345 over 0.1 s of speech.
MIN_SPEECH_SHARE = 0.5
ECHO_THRESHOLD = 0.1
SILENCE_FLOOR = 1e-12


def speech_share(samples: np.ndarray) -> float:
    frame = int(SAMPLE_RATE * FRAME_SEC)
    frames = samples[: len(samples) // frame * frame].reshape(-1, frame)
    return float(np.mean(np.sqrt(np.mean(frames**2, axis=1)) >= SPEECH_RMS))


def normalized_correlation(reference: np.ndarray, segment: np.ndarray) -> np.ndarray:
    size = len(segment)
    spectrum = np.fft.rfft(segment, size) * np.conj(np.fft.rfft(reference, size))
    correlation = np.fft.irfft(spectrum, size)[: size - len(reference) + 1]
    energy = np.concatenate(([0.0], np.cumsum(segment**2)))
    window_energy = energy[len(reference):] - energy[: size - len(reference) + 1]
    norms = np.sqrt(window_energy * np.sum(reference**2))
    return correlation / np.maximum(norms, SILENCE_FLOOR)


def peak_correlation(reference: np.ndarray, segment: np.ndarray) -> float:
    return float(np.max(np.abs(normalized_correlation(reference, segment))))


def echo_peaks(sent: np.ndarray, received: np.ndarray) -> list[dict]:
    window, max_lag = WINDOW_SEC * SAMPLE_RATE, int(MAX_LAG_SEC * SAMPLE_RATE)
    peaks = []
    for start in range(0, len(sent) - window, window):
        reference = sent[start : start + window]
        segment = received[start : start + window + max_lag]
        if len(segment) < window + max_lag:
            break
        if speech_share(reference) < MIN_SPEECH_SHARE:
            continue
        correlation = peak_correlation(reference, segment)
        peaks.append({"atSec": start / SAMPLE_RATE, "correlation": correlation})
    return peaks
