import pytest

from recording_checks import (
    DURATIONS_TAIL_NOTE,
    GAPS_TAIL_NOTE,
    audio_checks,
    tail_allowance,
    video_checks,
)

FPS = 30.0
ALLOWANCE_SEC = 0.57
VIDEO = {"codec_name": "hevc", "width": 1080, "height": 1920, "duration": "134.06"}
AUDIO = {"codec_name": "aac", "sample_rate": "48000", "channels": 1, "duration": "134.06"}


def frame_times(count: int, gap_after: int | None = None) -> list[float]:
    """Frames at 30 fps; a gap of four frame times (133 ms) after frame `gap_after`."""
    return [(index + (3 if gap_after is not None and index > gap_after else 0)) / FPS
            for index in range(count)]


def by_id(checks: list[dict]) -> dict[str, dict]:
    return {item["id"]: item for item in checks}


def test_last_interval_after_the_crash_is_a_crash_tail():
    gaps = by_id(video_checks(VIDEO, frame_times(300, gap_after=298), FPS, ALLOWANCE_SEC))["gaps"]
    assert gaps["pass"] and gaps["crashTail"]
    assert gaps["actual"].endswith("longest 133 ms")
    assert gaps["note"] == GAPS_TAIL_NOTE


def test_the_same_gap_fails_in_a_segment_that_was_not_recovered():
    gaps = by_id(video_checks(VIDEO, frame_times(300, gap_after=298), FPS))["gaps"]
    assert not gaps["pass"] and "crashTail" not in gaps


def test_a_gap_before_the_tail_still_fails():
    gaps = by_id(video_checks(VIDEO, frame_times(300, gap_after=150), FPS, ALLOWANCE_SEC))["gaps"]
    assert not gaps["pass"] and "crashTail" not in gaps


def test_audio_that_outlives_the_last_frame_within_the_allowance_is_a_crash_tail():
    audio = {**AUDIO, "duration": "134.249"}
    durations = by_id(audio_checks(VIDEO, audio, ALLOWANCE_SEC))["durations"]
    assert durations["pass"] and durations["crashTail"]
    assert durations["actual"] == "189 ms"
    assert durations["note"] == DURATIONS_TAIL_NOTE


def test_video_longer_than_audio_still_fails():
    audio = {**AUDIO, "duration": "133.871"}
    assert not by_id(audio_checks(VIDEO, audio, ALLOWANCE_SEC))["durations"]["pass"]


def test_audio_longer_than_the_allowance_still_fails():
    audio = {**AUDIO, "duration": "134.96"}
    assert not by_id(audio_checks(VIDEO, audio, ALLOWANCE_SEC))["durations"]["pass"]


def test_the_allowance_comes_from_a_recovered_segment_only():
    loss = {"knownLossSec": 0.07, "maxUnseenLossSec": 0.5}
    assert tail_allowance({"recoveryLoss": loss}, {"state": "recovered"}) == pytest.approx(0.57)
    assert tail_allowance({"recoveryLoss": loss}, {"state": "finalized"}) is None
    assert tail_allowance({}, {"state": "finalized"}) is None


def test_a_gap_is_judged_in_whole_milliseconds_like_the_app():
    # Two lost frames leave 100 ms, which ffprobe's six decimals turn into 0.1000001 s.
    times = [round(index / FPS, 6) for index in range(300) if index not in (100, 101)]
    gaps = by_id(video_checks(VIDEO, times, FPS))["gaps"]
    assert gaps["actual"].endswith("longest 100 ms")
    assert gaps["pass"]
