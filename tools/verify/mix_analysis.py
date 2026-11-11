"""Where the interviewer's lines landed in the phone's recording, and how loud they are there."""
import numpy as np

from echo_analysis import FRAME_SEC, SAMPLE_RATE, SPEECH_RMS, normalized_correlation

LINE_GAP_SEC = 1.0
MIN_LINE_SEC = 1.0
FOUND_CORRELATION = 0.5
MAX_OFFSET_SPREAD_MS = 20
MAX_LEVEL_GAP_DB = 10
FRAME = int(SAMPLE_RATE * FRAME_SEC)


def _frame_rms(samples: np.ndarray) -> np.ndarray:
    frames = samples[: len(samples) // FRAME * FRAME].reshape(-1, FRAME)
    return np.sqrt(np.mean(frames**2, axis=1))


def speech_level_db(samples: np.ndarray) -> float | None:
    """Level of the 20 ms frames that hold speech; None when nobody speaks."""
    rms = _frame_rms(samples)
    voiced = rms[rms >= SPEECH_RMS]
    return float(20 * np.log10(np.sqrt(np.mean(voiced**2)))) if voiced.size else None


def interviewer_lines(sent: np.ndarray) -> list[tuple[int, int]]:
    """Sample ranges of the lines the page spoke: speech parted by at least a second of quiet."""
    speaking = np.flatnonzero(_frame_rms(sent) >= SPEECH_RMS)
    if speaking.size == 0:
        return []
    breaks = np.flatnonzero(np.diff(speaking) > LINE_GAP_SEC / FRAME_SEC)
    starts = np.concatenate(([speaking[0]], speaking[breaks + 1]))
    ends = np.concatenate((speaking[breaks], [speaking[-1]])) + 1
    return [
        (start * FRAME, end * FRAME)
        for start, end in zip(starts, ends)
        if (end - start) * FRAME_SEC >= MIN_LINE_SEC
    ]


def match_lines(sent: np.ndarray, recorded: np.ndarray) -> list[dict]:
    """Each line is looked for across the whole recording: the page and the phone start at different times."""
    matches = []
    for start, end in interviewer_lines(sent):
        correlation = np.abs(normalized_correlation(sent[start:end], recorded))
        at = int(np.argmax(correlation))
        matches.append({
            "lineSec": start / SAMPLE_RATE,
            "atSec": at / SAMPLE_RATE,
            "durationSec": (end - start) / SAMPLE_RATE,
            "offsetSec": (at - start) / SAMPLE_RATE,
            "correlation": float(correlation[at]),
            "levelDb": speech_level_db(recorded[at : at + end - start]),
        })
    return matches


def user_level_db(recorded: np.ndarray, matches: list[dict]) -> float | None:
    """Level of the speech outside the interviewer's lines: the user's voice."""
    outside = np.ones(len(recorded), dtype=bool)
    for match in matches:
        start = int(match["atSec"] * SAMPLE_RATE)
        outside[start : start + int(match["durationSec"] * SAMPLE_RATE)] = False
    return speech_level_db(recorded[outside])


def mix_report(matches: list[dict], user_db: float | None) -> dict:
    found = [match for match in matches if match["correlation"] >= FOUND_CORRELATION]
    offsets = [match["offsetSec"] for match in found]
    spread_ms = (max(offsets) - min(offsets)) * 1000 if offsets else None
    levels = [match["levelDb"] for match in found if match["levelDb"] is not None]
    interviewer_db = float(np.median(levels)) if levels else None
    level_gap = user_db - interviewer_db if user_db is not None and interviewer_db is not None else None
    passed = (
        bool(matches)
        and len(found) == len(matches)
        and spread_ms <= MAX_OFFSET_SPREAD_MS
        and (level_gap is None or level_gap <= MAX_LEVEL_GAP_DB)
    )
    return {
        "lines": len(matches),
        "linesFound": len(found),
        "offsetSpreadMs": spread_ms,
        "interviewerDb": interviewer_db,
        "userDb": user_db,
        "levelGapDb": level_gap,
        "pass": passed,
        "matches": matches,
    }
