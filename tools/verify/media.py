import json
import subprocess
from pathlib import Path

import numpy as np

GRAY_SIDE = 32


def _run(command: list[str], text: bool = True):
    return subprocess.run(command, check=True, capture_output=True, text=text).stdout


def probe(path: Path) -> dict:
    command = ["ffprobe", "-v", "error", "-print_format", "json", "-show_streams", "-show_format"]
    return json.loads(_run([*command, str(path)]))


def packet_times(path: Path, stream: str = "v:0") -> list[float]:
    output = _run([
        "ffprobe", "-v", "error", "-select_streams", stream,
        "-show_entries", "packet=pts_time", "-of", "csv=p=0", str(path),
    ])
    return sorted(float(value) for value in output.split() if value not in ("", "N/A"))


def decode_errors(path: Path) -> list[str]:
    command = ["ffmpeg", "-v", "error", "-i", str(path), "-f", "null", "-"]
    result = subprocess.run(command, capture_output=True, text=True)
    errors = [line for line in result.stderr.splitlines() if line.strip()]
    if result.returncode != 0:
        errors.append(f"ffmpeg exited with {result.returncode}")
    return errors


def audio_samples(path: Path, rate: int) -> np.ndarray:
    command = ["ffmpeg", "-v", "error", "-i", str(path), "-vn", "-ac", "1", "-ar", str(rate)]
    raw = _run([*command, "-f", "f32le", "-"], text=False)
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def gray_frames(path: Path) -> np.ndarray:
    scale = f"scale={GRAY_SIDE}:{GRAY_SIDE},format=gray"
    raw = _run([
        "ffmpeg", "-v", "error", "-i", str(path), "-an", "-vf", scale,
        "-fps_mode", "passthrough", "-f", "rawvideo", "-",
    ], text=False)
    return np.frombuffer(raw, dtype=np.uint8).reshape(-1, GRAY_SIDE * GRAY_SIDE).astype(np.float64)
