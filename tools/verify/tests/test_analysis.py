import json

import numpy as np

from echo_analysis import SAMPLE_RATE, echo_peaks, speech_share
from mix_analysis import interviewer_lines, match_lines, mix_report, user_level_db
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


def _line(rng, seconds=2.0):
    return rng.normal(0, 0.2, int(SAMPLE_RATE * seconds))


def _quiet(seconds):
    return np.zeros(int(SAMPLE_RATE * seconds))


def test_interviewer_lines_split_on_a_second_of_quiet_and_skip_blips():
    rng = np.random.default_rng(5)
    sent = np.concatenate([
        _line(rng), _quiet(0.5), _line(rng), _quiet(1.5), _line(rng), _quiet(1.5), _line(rng, 0.3), _quiet(1.5),
    ])
    lines = interviewer_lines(sent)
    assert len(lines) == 2
    assert abs(lines[0][1] / SAMPLE_RATE - 4.5) < 0.05


def test_match_lines_find_every_line_at_one_offset():
    rng = np.random.default_rng(7)
    sent = np.concatenate([_quiet(2), _line(rng), _quiet(2), _line(rng), _quiet(2), _line(rng), _quiet(2)])
    shift = int(SAMPLE_RATE * 1.234)
    recorded = np.concatenate([np.zeros(shift), sent * 0.5])
    user_at = shift + SAMPLE_RATE * 4 + SAMPLE_RATE // 2
    recorded[user_at : user_at + SAMPLE_RATE] = rng.normal(0, 0.1, SAMPLE_RATE)
    matches = match_lines(sent, [recorded])
    assert [round(match["offsetSec"], 3) for match in matches] == [1.234, 1.234, 1.234]
    assert min(match["correlation"] for match in matches) > 0.9
    report = mix_report(matches, user_level_db([recorded], matches))
    assert report["pass"] is True
    assert abs(report["levelGapDb"]) < 1


def test_mix_report_fails_a_line_missing_from_the_recording():
    rng = np.random.default_rng(9)
    sent = np.concatenate([_quiet(2), _line(rng), _quiet(2), _line(rng), _quiet(2)])
    recorded = sent.copy()
    recorded[SAMPLE_RATE * 6 : SAMPLE_RATE * 8] = 0
    report = mix_report(match_lines(sent, [recorded]), None)
    assert report["linesFound"] == 1
    assert report["pass"] is False


def test_a_recording_shorter_than_a_line_finds_nothing():
    rng = np.random.default_rng(11)
    sent = np.concatenate([_quiet(2), _line(rng, 3.0), _quiet(2)])
    (match,) = match_lines(sent, [sent[: SAMPLE_RATE]])
    assert match["correlation"] == 0.0


def _two_segments(rng, step_sec):
    lines = [_line(rng) for _ in range(4)]
    sent = np.concatenate([part for line in lines for part in (_quiet(2), line)] + [_quiet(2)])
    first = np.concatenate([_quiet(1), lines[0], _quiet(2), lines[1], _quiet(1)])
    second = np.concatenate([_quiet(1 + step_sec), lines[2], _quiet(2), lines[3], _quiet(1)])
    return sent, first, second


def test_lines_are_found_across_segments_and_measured_per_segment():
    sent, first, second = _two_segments(np.random.default_rng(13), step_sec=0.3)
    report = mix_report(match_lines(sent, [first, second]), None)
    assert report["linesFound"] == 4
    assert [match["segment"] for match in report["matches"]] == [1, 1, 2, 2]
    assert report["offsetSpreadMs"] < 1
    assert report["pass"] is True


def test_a_route_change_starts_a_new_stretch_of_offsets():
    rng = np.random.default_rng(17)
    lines = [_line(rng) for _ in range(4)]
    sent = np.concatenate([part for line in lines for part in (_quiet(2), line)] + [_quiet(2)])
    recorded = np.concatenate([_quiet(1), lines[0], _quiet(2), lines[1], _quiet(2.06), lines[2], _quiet(2), lines[3]])
    matches = match_lines(sent, [recorded])
    assert mix_report(matches, None)["pass"] is False
    report = mix_report(matches, None, route_changes=[(1, 9.0)])
    assert report["pass"] is True
    assert [round(stretch["offsetMs"]) for stretch in report["stretches"]] == [-1000, -940]
    json.dumps(report)
