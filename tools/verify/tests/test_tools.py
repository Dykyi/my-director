import json
import shutil
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
import pytest

TOOLS = Path(__file__).resolve().parents[1]
FIXTURES = TOOLS / "fixtures"
SAMPLE_RATE = 16_000


FIXTURE_FILES = ("sync.mov", "good.mov", "dropped.mov", "small.mov", "late-audio.mov")


@pytest.fixture(scope="session", autouse=True)
def ensure_fixtures():
    if not all((FIXTURES / name).exists() for name in FIXTURE_FILES):
        subprocess.run([str(TOOLS / "make-fixtures.sh")], check=True)


def run_tool(script, *args):
    command = [sys.executable, str(TOOLS / script), *map(str, args), "--json"]
    result = subprocess.run(command, capture_output=True, text=True)
    return result.returncode, json.loads(result.stdout)


def failed_checks(report):
    checks = [check for file_checks in report["files"].values() for check in file_checks]
    return {check["id"] for check in checks if not check["pass"]}


def write_wav(path, samples):
    with wave.open(str(path), "wb") as file:
        file.setnchannels(1)
        file.setsampwidth(2)
        file.setframerate(SAMPLE_RATE)
        file.writeframes((np.clip(samples, -1, 1) * 32_767).astype(np.int16).tobytes())


def test_good_segment_passes():
    code, report = run_tool("verify-recording.py", FIXTURES / "good.mov")
    assert code == 0, report
    assert failed_checks(report) == set()


def test_dropped_frames_fail_gaps():
    code, report = run_tool("verify-recording.py", FIXTURES / "dropped.mov")
    assert code == 1
    assert "gaps" in failed_checks(report)


def test_small_segment_fails_resolution():
    _, report = run_tool("verify-recording.py", FIXTURES / "small.mov")
    assert failed_checks(report) == {"resolution"}


def test_late_audio_fails_audio_start():
    _, report = run_tool("verify-recording.py", FIXTURES / "late-audio.mov")
    assert failed_checks(report) == {"audioStart"}


def write_manifest(folder, fps, duration_sec):
    segment = {"file": "segment-001.mov", "durationSec": duration_sec}
    manifest = {"config": {"camera": {"fps": fps}}, "segments": [segment]}
    (folder / "session.json").write_text(json.dumps(manifest))


def test_manifest_sets_the_frame_rate_and_the_expected_length(tmp_path):
    shutil.copy(FIXTURES / "good.mov", tmp_path / "segment-001.mov")
    write_manifest(tmp_path, fps=24, duration_sec=5.0)
    _, report = run_tool("verify-recording.py", tmp_path / "segment-001.mov")
    checks = {check["id"]: check for check in next(iter(report["files"].values()))}
    assert checks["fps"]["expected"] == ">= 23.5"
    assert not checks["manifestDuration"]["pass"]


def test_av_sync_measures_known_offset_and_drift():
    code, report = run_tool("av-sync.py", FIXTURES / "sync.mov")
    assert code == 0, report
    assert report["pairs"] >= 590
    assert abs(report["startOffsetMs"] - 40) <= 5
    assert abs(report["driftMs"] - 30) <= 5


def test_echo_check_finds_echo(tmp_path):
    rng = np.random.default_rng(1)
    sent = rng.normal(0, 0.2, SAMPLE_RATE * 30)
    delay = int(SAMPLE_RATE * 0.4)
    echo = 0.3 * np.concatenate([np.zeros(delay), sent[:-delay]])
    received = echo + rng.normal(0, 0.05, sent.size)
    write_wav(tmp_path / "sent.wav", sent)
    write_wav(tmp_path / "received.wav", received)
    code, report = run_tool("echo-check.py", tmp_path / "sent.wav", tmp_path / "received.wav")
    assert code == 1
    assert report["maxCorrelation"] > 0.5


def test_echo_check_passes_without_echo(tmp_path):
    rng = np.random.default_rng(2)
    write_wav(tmp_path / "sent.wav", rng.normal(0, 0.2, SAMPLE_RATE * 30))
    write_wav(tmp_path / "received.wav", rng.normal(0, 0.2, SAMPLE_RATE * 30))
    code, report = run_tool("echo-check.py", tmp_path / "sent.wav", tmp_path / "received.wav")
    assert code == 0
    assert report["maxCorrelation"] < 0.1


def test_echo_check_skips_windows_with_little_interviewer_speech(tmp_path):
    rng = np.random.default_rng(3)
    sent = np.zeros(SAMPLE_RATE * 30)
    burst = SAMPLE_RATE // 20
    for start in range(0, sent.size, SAMPLE_RATE * 5):
        sent[start : start + burst] = rng.normal(0, 0.2, burst)
    write_wav(tmp_path / "sent.wav", sent)
    write_wav(tmp_path / "received.wav", rng.normal(0, 0.2, sent.size))
    code, report = run_tool("echo-check.py", tmp_path / "sent.wav", tmp_path / "received.wav")
    assert code == 0, report
    assert report["windows"] == 0
