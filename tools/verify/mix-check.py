#!/usr/bin/env python3
"""Finds the interviewer's lines in the phone's recording (TP-MIX).

`sent` is what the interviewer page published (its sent-*.webm), `recorded` is one segment from the phone.
The lines must all be there, at one steady offset, and about as loud as the user.
"""
import argparse
import sys
from pathlib import Path

import media
from echo_analysis import SAMPLE_RATE
from mix_analysis import MAX_LEVEL_GAP_DB, MAX_OFFSET_SPREAD_MS, match_lines, mix_report, user_level_db
from report import emit


def _db(value: float | None) -> str:
    return "n/a" if value is None else f"{value:.1f} dB"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("sent", type=Path)
    parser.add_argument("recorded", type=Path)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    sent = media.audio_samples(args.sent, SAMPLE_RATE)
    recorded = media.audio_samples(args.recorded, SAMPLE_RATE)
    matches = match_lines(sent, recorded)
    report = mix_report(matches, user_level_db(recorded, matches))
    spread = report["offsetSpreadMs"]
    text = "\n".join([
        f"interviewer lines found: {report['linesFound']} of {report['lines']}",
        f"offset spread: {'n/a' if spread is None else f'{spread:.1f} ms'} (pass if <= {MAX_OFFSET_SPREAD_MS} ms)",
        f"interviewer {_db(report['interviewerDb'])}, user {_db(report['userDb'])}"
        f" (pass if the interviewer is at most {MAX_LEVEL_GAP_DB} dB quieter)",
        "PASS" if report["pass"] else "FAIL",
    ])
    emit(report, args.json, text)
    return 0 if report["pass"] else 1


if __name__ == "__main__":
    sys.exit(main())
