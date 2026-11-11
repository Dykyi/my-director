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
    rms = _frame_rms(samples)
    voiced = rms[rms >= SPEECH_RMS]
    return float(20 * np.log10(np.sqrt(np.mean(voiced**2)))) if voiced.size else None


def interviewer_lines(sent: np.ndarray) -> list[tuple[int, int]]:
    speaking = np.flatnonzero(_frame_rms(sent) >= SPEECH_RMS)
    if speaking.size == 0:
        return []
    breaks = np.flatnonzero(np.diff(speaking) > LINE_GAP_SEC / FRAME_SEC)
    starts = np.concatenate(([speaking[0]], speaking[breaks + 1]))
    ends = np.concatenate((speaking[breaks], [speaking[-1]])) + 1
    return [
        (int(start) * FRAME, int(end) * FRAME)
        for start, end in zip(starts, ends)
        if (end - start) * FRAME_SEC >= MIN_LINE_SEC
    ]


def match_lines(sent: np.ndarray, segments: list[np.ndarray]) -> list[dict]:
    """Each line is looked for across every segment: the page records on through the phone's pauses."""
    matches = []
    for start, end in interviewer_lines(sent):
        best = {"segment": None, "atSec": None, "offsetSec": None, "correlation": 0.0, "levelDb": None}
        for number, recorded in enumerate(segments, start=1):
            if len(recorded) < end - start:
                continue
            correlation = np.abs(normalized_correlation(sent[start:end], recorded))
            at = int(np.argmax(correlation))
            if correlation[at] > best["correlation"]:
                best = {
                    "segment": number,
                    "atSec": at / SAMPLE_RATE,
                    "offsetSec": (at - start) / SAMPLE_RATE,
                    "correlation": float(correlation[at]),
                    "levelDb": speech_level_db(recorded[at : at + end - start]),
                }
        matches.append({"lineSec": start / SAMPLE_RATE, "durationSec": (end - start) / SAMPLE_RATE, **best})
    return matches


def user_level_db(segments: list[np.ndarray], matches: list[dict]) -> float | None:
    rest = []
    for number, recorded in enumerate(segments, start=1):
        outside = np.ones(len(recorded), dtype=bool)
        for match in matches:
            if match["segment"] == number:
                start = int(match["atSec"] * SAMPLE_RATE)
                outside[start : start + int(match["durationSec"] * SAMPLE_RATE)] = False
        rest.append(recorded[outside])
    return speech_level_db(np.concatenate(rest)) if rest else None


def _stretches(found: list[dict], route_changes: list[tuple[int, float]]) -> list[dict]:
    """Offsets hold steady between pauses and route changes; a new output latency moves them on purpose."""
    groups: dict[tuple[int, int], list[float]] = {}
    for match in found:
        part = sum(1 for segment, at in route_changes if segment == match["segment"] and at <= match["atSec"])
        groups.setdefault((match["segment"], part), []).append(match["offsetSec"])
    return [
        {
            "segment": segment,
            "part": part,
            "lines": len(offsets),
            "offsetMs": float(np.median(offsets)) * 1000,
            "spreadMs": (max(offsets) - min(offsets)) * 1000,
        }
        for (segment, part), offsets in sorted(groups.items())
    ]


def mix_report(matches: list[dict], user_db: float | None, route_changes: list[tuple[int, float]] = ()) -> dict:
    found = [match for match in matches if match["correlation"] >= FOUND_CORRELATION]
    stretches = _stretches(found, list(route_changes))
    spread_ms = max((stretch["spreadMs"] for stretch in stretches), default=None)
    levels = [match["levelDb"] for match in found if match["levelDb"] is not None]
    interviewer_db = float(np.median(levels)) if levels else None
    level_gap = user_db - interviewer_db if user_db is not None and interviewer_db is not None else None
    passed = (
        bool(matches)
        and len(found) == len(matches)
        and spread_ms is not None
        and spread_ms <= MAX_OFFSET_SPREAD_MS
        and (level_gap is None or level_gap <= MAX_LEVEL_GAP_DB)
    )
    return {
        "lines": len(matches),
        "linesFound": len(found),
        "offsetSpreadMs": spread_ms,
        "stretches": stretches,
        "interviewerDb": interviewer_db,
        "userDb": user_db,
        "levelGapDb": level_gap,
        "pass": bool(passed),
        "matches": matches,
    }
