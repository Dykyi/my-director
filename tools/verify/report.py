import json


def emit(report: dict, as_json: bool, text: str) -> None:
    print(json.dumps(report, indent=2) if as_json else text)
