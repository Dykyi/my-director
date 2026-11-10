import json
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
import pytest

TOOLS = Path(__file__).resolve().parents[1]
FIXTURES = TOOLS / "fixtures"
RATE = 16_000


@pytest.fixture(scope="session", autouse=True)
def fixtures():
    if not (FIXTURES / "sync.mov").exists():
        subprocess.run([str(TOOLS / "make-fixtures.sh")], check=True)


def run(script, *args):
    result = subprocess.run([sys.executable, str(TOOLS / script), *map(str, args), "--json"], capture_output=True, text=True)
    return result.returncode, json.loads(result.stdout)


def failed_checks(report):
    return {check["id"] for checks in report["files"].values() for check in checks if not check["pass"]}


def write_wav(path, samples):
    with wave.open(str(path), "wb") as file:
        file.setnchannels(1)
        file.setsampwidth(2)
        file.setframerate(RATE)
        file.writeframes((np.clip(samples, -1, 1) * 32_767).astype(np.int16).tobytes())


def test_good_segment_passes():
    code, report = run("verify-recording.py", FIXTURES / "good.mov")
    assert code == 0, report
    assert failed_checks(report) == set()


def test_dropped_frames_fail_gaps():
    code, report = run("verify-recording.py", FIXTURES / "dropped.mov")
    assert code == 1
    assert "gaps" in failed_checks(report)


def test_small_segment_fails_resolution():
    _, report = run("verify-recording.py", FIXTURES / "small.mov")
    assert failed_checks(report) == {"resolution"}


def test_av_sync_measures_known_offset_and_drift():
    code, report = run("av-sync.py", FIXTURES / "sync.mov")
    assert code == 0, report
    assert report["pairs"] >= 590
    assert abs(report["startOffsetMs"] - 40) <= 5
    assert abs(report["driftMs"] - 30) <= 5


def test_echo_check_finds_echo(tmp_path):
    rng = np.random.default_rng(1)
    sent = rng.normal(0, 0.2, RATE * 30)
    delay = int(RATE * 0.4)
    received = 0.3 * np.concatenate([np.zeros(delay), sent[:-delay]]) + rng.normal(0, 0.05, sent.size)
    write_wav(tmp_path / "sent.wav", sent)
    write_wav(tmp_path / "received.wav", received)
    code, report = run("echo-check.py", tmp_path / "sent.wav", tmp_path / "received.wav")
    assert code == 1
    assert report["maxCorrelation"] > 0.5


def test_echo_check_passes_without_echo(tmp_path):
    rng = np.random.default_rng(2)
    write_wav(tmp_path / "sent.wav", rng.normal(0, 0.2, RATE * 30))
    write_wav(tmp_path / "received.wav", rng.normal(0, 0.2, RATE * 30))
    code, report = run("echo-check.py", tmp_path / "sent.wav", tmp_path / "received.wav")
    assert code == 0
    assert report["maxCorrelation"] < 0.1


def test_echo_check_skips_windows_with_little_interviewer_speech(tmp_path):
    rng = np.random.default_rng(3)
    sent = np.zeros(RATE * 30)
    burst = RATE // 20
    for start in range(0, sent.size, RATE * 5):
        sent[start : start + burst] = rng.normal(0, 0.2, burst)
    write_wav(tmp_path / "sent.wav", sent)
    write_wav(tmp_path / "received.wav", rng.normal(0, 0.2, sent.size))
    code, report = run("echo-check.py", tmp_path / "sent.wav", tmp_path / "received.wav")
    assert code == 0, report
    assert report["windows"] == 0
