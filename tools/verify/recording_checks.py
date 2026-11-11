"""The app's VerificationRules for one segment, from ffprobe facts."""
VIDEO_CODECS = {"hevc", "h264"}
MIN_SHORT_SIDE = 1080
DEFAULT_FPS = 30.0
FPS_TOLERANCE = 0.5
GAP_FACTOR = 1.5
MAX_GAP_RATIO = 0.005
# The longest gap is judged in whole milliseconds, as the app does: two lost frames leave 100 ms.
MAX_INTERVAL_MS = 100
AUDIO_CODEC = "aac"
MIN_AUDIO_RATE = 44_100
MAX_DURATION_MISMATCH_SEC = 0.1
MAX_AUDIO_START_OFFSET_SEC = 0.05
MAX_MANIFEST_MISMATCH_SEC = 1.0
MS_PER_SEC = 1000
PERCENT = 100
GAPS_TAIL_NOTE = "at the crash point: the app was closed here"
DURATIONS_TAIL_NOTE = "audio outlives the last frame after the crash"


def check(check_id: str, expected: str, actual: str, passed: bool) -> dict:
    return {"id": check_id, "expected": expected, "actual": actual, "pass": bool(passed)}


def crash_tail(item: dict, note: str) -> dict:
    """A check broken only by the tail a crash cut off passes, marked as such."""
    return {**item, "pass": True, "crashTail": True, "note": note}


def tail_allowance(manifest: dict, segment: dict) -> float | None:
    """How much a recovered segment may miss at its end, as the app's recovery estimates it."""
    loss = manifest.get("recoveryLoss")
    if segment.get("state") != "recovered" or loss is None:
        return None
    return loss["knownLossSec"] + loss["maxUnseenLossSec"]


def gap_stats(intervals: list[float], nominal_fps: float) -> tuple[float, float]:
    gap_count = sum(1 for interval in intervals if interval > GAP_FACTOR / nominal_fps)
    return gap_count / max(len(intervals), 1), max(intervals, default=0.0)


def gaps_pass(ratio: float, longest: float) -> bool:
    return ratio <= MAX_GAP_RATIO and round(longest * MS_PER_SEC) <= MAX_INTERVAL_MS


def display_size(stream: dict) -> tuple[int, int]:
    width, height = int(stream["width"]), int(stream["height"])
    rotation = next(
        (int(data["rotation"]) for data in stream.get("side_data_list", []) if "rotation" in data),
        int(stream.get("tags", {}).get("rotate", 0)),
    )
    return (height, width) if abs(rotation) % 180 == 90 else (width, height)


def video_checks(
    video: dict, times: list[float], nominal_fps: float, tail_allowance_sec: float | None = None
) -> list[dict]:
    width, height = display_size(video)
    intervals = [b - a for a, b in zip(times, times[1:])]
    fps = (len(times) - 1) / (times[-1] - times[0]) if len(times) > 1 else 0.0
    min_fps = nominal_fps - FPS_TOLERANCE
    gap_ratio, longest = gap_stats(intervals, nominal_fps)
    gaps = check(
        "gaps",
        f"<= {MAX_GAP_RATIO * PERCENT:.1f} %, "
        f"longest <= {MAX_INTERVAL_MS} ms",
        f"{gap_ratio * PERCENT:.2f} %, longest {longest * MS_PER_SEC:.0f} ms",
        gaps_pass(gap_ratio, longest),
    )
    if not gaps["pass"] and tail_allowance_sec is not None and gaps_pass(
        *gap_stats(intervals[:-1], nominal_fps)
    ):
        gaps = crash_tail(gaps, GAPS_TAIL_NOTE)
    return [
        check(
            "videoCodec", "hevc or h264", video["codec_name"],
            video["codec_name"] in VIDEO_CODECS,
        ),
        check(
            "resolution", f"short side >= {MIN_SHORT_SIDE}", f"{width}x{height}",
            min(width, height) >= MIN_SHORT_SIDE,
        ),
        check("fps", f">= {min_fps}", f"{fps:.2f}", fps >= min_fps),
        gaps,
    ]


def audio_checks(video: dict, audio: dict, tail_allowance_sec: float | None = None) -> list[dict]:
    rate = int(audio["sample_rate"])
    audio_outlives_sec = float(audio["duration"]) - float(video["duration"])
    mismatch = abs(audio_outlives_sec)
    durations = check(
        "durations", f"differ <= {MAX_DURATION_MISMATCH_SEC * MS_PER_SEC:.0f} ms",
        f"{mismatch * MS_PER_SEC:.0f} ms", mismatch <= MAX_DURATION_MISMATCH_SEC,
    )
    if not durations["pass"] and tail_allowance_sec is not None and (
        0 < audio_outlives_sec <= tail_allowance_sec
    ):
        durations = crash_tail(durations, DURATIONS_TAIL_NOTE)
    start_offset = float(audio.get("start_time", 0)) - float(video.get("start_time", 0))
    return [
        check(
            "audio", f"{AUDIO_CODEC} >= {MIN_AUDIO_RATE} Hz",
            f"{audio['codec_name']} {rate} Hz {audio['channels']} ch",
            audio["codec_name"] == AUDIO_CODEC and rate >= MIN_AUDIO_RATE,
        ),
        durations,
        check(
            "audioStart", f"within {MAX_AUDIO_START_OFFSET_SEC * MS_PER_SEC:.0f} ms of video",
            f"{start_offset * MS_PER_SEC:.0f} ms", abs(start_offset) <= MAX_AUDIO_START_OFFSET_SEC,
        ),
    ]


def manifest_check(video: dict, manifest_duration: float) -> dict:
    mismatch = abs(float(video["duration"]) - manifest_duration)
    return check(
        "manifestDuration", f"within {MAX_MANIFEST_MISMATCH_SEC:.1f} s", f"{mismatch:.1f} s",
        mismatch <= MAX_MANIFEST_MISMATCH_SEC,
    )
