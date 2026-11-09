"""ffprobe and ffmpeg wrappers shared by the verification scripts."""
import json
import subprocess
from pathlib import Path

import numpy as np

GRAY_SIDE = 32


def probe(path: Path) -> dict:
    output = subprocess.run(
        ["ffprobe", "-v", "error", "-print_format", "json", "-show_streams", "-show_format", str(path)],
        check=True, capture_output=True, text=True,
    ).stdout
    return json.loads(output)


def packet_times(path: Path, stream: str = "v:0") -> list[float]:
    """Presentation times of every packet in display order, without decoding."""
    output = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", stream, "-show_entries", "packet=pts_time", "-of", "csv=p=0", str(path)],
        check=True, capture_output=True, text=True,
    ).stdout
    return sorted(float(value) for value in output.split() if value not in ("", "N/A"))


def decode_errors(path: Path) -> list[str]:
    result = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "null", "-"], capture_output=True, text=True)
    errors = [line for line in result.stderr.splitlines() if line.strip()]
    return errors if result.returncode == 0 else [*errors, f"ffmpeg exited with {result.returncode}"]


def audio_samples(path: Path, rate: int) -> np.ndarray:
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-vn", "-ac", "1", "-ar", str(rate), "-f", "f32le", "-"],
        check=True, capture_output=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def gray_frames(path: Path) -> np.ndarray:
    """Every frame scaled to 32x32 gray, one row per frame, in presentation order."""
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-an", "-vf", f"scale={GRAY_SIDE}:{GRAY_SIDE},format=gray",
         "-fps_mode", "passthrough", "-f", "rawvideo", "-"],
        check=True, capture_output=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.uint8).reshape(-1, GRAY_SIDE * GRAY_SIDE).astype(np.float64)
