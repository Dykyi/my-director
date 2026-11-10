import numpy as np

from echo_analysis import SAMPLE_RATE, echo_peaks, speech_share
from recording_checks import display_size, video_checks
from sync_analysis import onsets, pair, sync_report

FRAME_SEC = 1 / 30


def failed(checks):
    return {item["id"] for item in checks if not item["pass"]}


def test_display_size_turns_a_rotated_stream_upright():
    stream = {"width": 1920, "height": 1080, "side_data_list": [{"rotation": -90}]}
    assert display_size(stream) == (1080, 1920)


def test_video_checks_pass_steady_frames_and_fail_a_long_hole():
    video = {"codec_name": "hevc", "width": 1080, "height": 1920}
    steady = [index * FRAME_SEC for index in range(300)]
    assert failed(video_checks(video, steady, 30.0)) == set()
    holed = steady[:150] + [time + 0.33 for time in steady[160:]]
    assert "gaps" in failed(video_checks(video, holed, 30.0))


def test_onsets_keep_the_first_time_of_each_burst():
    assert onsets(np.array([1.0, 1.1, 1.2, 2.0]), refractory=0.5).tolist() == [1.0, 2.0]


def test_pairs_and_report_measure_a_late_sound():
    flashes = np.arange(0.0, 300.0, 1.0)
    clicks = flashes + 0.04
    times, offsets = pair(flashes, clicks)
    report = sync_report(times, offsets)
    assert report["pairs"] == 300
    assert abs(report["startOffsetMs"] - 40) < 0.01
    assert abs(report["driftMs"]) < 0.01


def test_echo_peaks_find_a_delayed_copy_and_ignore_silence():
    rng = np.random.default_rng(4)
    sent = rng.normal(0, 0.2, SAMPLE_RATE * 20)
    delay = int(SAMPLE_RATE * 0.3)
    received = np.concatenate([np.zeros(delay), sent[:-delay]])
    assert max(peak["correlation"] for peak in echo_peaks(sent, received)) > 0.9
    assert echo_peaks(np.zeros(SAMPLE_RATE * 20), received) == []
    assert speech_share(np.zeros(SAMPLE_RATE)) == 0.0
