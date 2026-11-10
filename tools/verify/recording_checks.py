"""The app's VerificationRules for one segment, from ffprobe facts."""
VIDEO_CODECS = {"hevc", "h264"}
MIN_SHORT_SIDE = 1080
DEFAULT_FPS = 30.0
FPS_TOLERANCE = 0.5
GAP_FACTOR = 1.5
MAX_GAP_RATIO = 0.005
MAX_INTERVAL_SEC = 0.1
AUDIO_CODEC = "aac"
MIN_AUDIO_RATE = 44_100
MAX_DURATION_MISMATCH_SEC = 0.1
MAX_AUDIO_START_OFFSET_SEC = 0.05
MAX_MANIFEST_MISMATCH_SEC = 1.0
MS_PER_SEC = 1000
PERCENT = 100


def check(check_id: str, expected: str, actual: str, passed: bool) -> dict:
    return {"id": check_id, "expected": expected, "actual": actual, "pass": bool(passed)}


def display_size(stream: dict) -> tuple[int, int]:
    width, height = int(stream["width"]), int(stream["height"])
    rotation = next(
        (int(data["rotation"]) for data in stream.get("side_data_list", []) if "rotation" in data),
        int(stream.get("tags", {}).get("rotate", 0)),
    )
    return (height, width) if abs(rotation) % 180 == 90 else (width, height)


def video_checks(video: dict, times: list[float], nominal_fps: float) -> list[dict]:
    width, height = display_size(video)
    intervals = [b - a for a, b in zip(times, times[1:])]
    fps = (len(times) - 1) / (times[-1] - times[0]) if len(times) > 1 else 0.0
    min_fps = nominal_fps - FPS_TOLERANCE
    gap_count = sum(1 for interval in intervals if interval > GAP_FACTOR / nominal_fps)
    gap_ratio = gap_count / max(len(intervals), 1)
    longest = max(intervals, default=0.0)
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
        check(
            "gaps",
            f"<= {MAX_GAP_RATIO * PERCENT:.1f} %, "
            f"longest <= {MAX_INTERVAL_SEC * MS_PER_SEC:.0f} ms",
            f"{gap_ratio * PERCENT:.2f} %, longest {longest * MS_PER_SEC:.0f} ms",
            gap_ratio <= MAX_GAP_RATIO and longest <= MAX_INTERVAL_SEC,
        ),
    ]


def audio_checks(video: dict, audio: dict) -> list[dict]:
    rate = int(audio["sample_rate"])
    mismatch = abs(float(video["duration"]) - float(audio["duration"]))
    start_offset = float(audio.get("start_time", 0)) - float(video.get("start_time", 0))
    return [
        check(
            "audio", f"{AUDIO_CODEC} >= {MIN_AUDIO_RATE} Hz",
            f"{audio['codec_name']} {rate} Hz {audio['channels']} ch",
            audio["codec_name"] == AUDIO_CODEC and rate >= MIN_AUDIO_RATE,
        ),
        check(
            "durations", f"differ <= {MAX_DURATION_MISMATCH_SEC * MS_PER_SEC:.0f} ms",
            f"{mismatch * MS_PER_SEC:.0f} ms", mismatch <= MAX_DURATION_MISMATCH_SEC,
        ),
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
