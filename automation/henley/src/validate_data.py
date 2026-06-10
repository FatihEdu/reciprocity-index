#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

VALID_STATUSES = {
    "visa_free",
    "electronic_travel_authorisation",
    "visa_on_arrival",
    "visa_online",
    "visa_required",
}


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    rows = []
    for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.strip():
            continue
        try:
            row = json.loads(line)
        except Exception as exc:
            raise ValueError(f"{path}:{line_no}: invalid JSONL: {exc}") from exc
        rows.append(row)
    return rows


def validate_passport_row(path: Path, row: dict[str, Any], line_no: int | None = None) -> None:
    loc = f"{path}:{line_no}" if line_no else str(path)
    code = row.get("code")
    if not isinstance(code, str) or not code:
        raise ValueError(f"{loc}: missing code")
    access = row.get("access")
    if not isinstance(access, dict):
        raise ValueError(f"{loc}: access not object")
    if code in access:
        raise ValueError(f"{loc}: self entry present")
    for dest, status in access.items():
        if not isinstance(dest, str) or not dest:
            raise ValueError(f"{loc}: bad dest")
        if status not in VALID_STATUSES:
            raise ValueError(f"{loc}: bad status {status!r} for {dest}")


def validate_data(data_root: Path) -> None:
    countries_path = data_root / "latest" / "countries.json"
    passports_path = data_root / "latest" / "passports.jsonl"
    manifest_path = data_root / "latest" / "manifest.json"

    if not countries_path.exists():
        raise ValueError("missing latest/countries.json")
    if not passports_path.exists():
        raise ValueError("missing latest/passports.jsonl")
    if not manifest_path.exists():
        raise ValueError("missing latest/manifest.json")

    countries = load_json(countries_path)
    if not isinstance(countries, dict):
        raise ValueError("countries.json not object")

    origin_codes = {code for code, item in countries.items() if item.get("hasData") is True}
    if len(countries) < 200:
        raise ValueError(f"countries too low: {len(countries)}")
    if len(origin_codes) < 150:
        raise ValueError(f"origin codes too low: {len(origin_codes)}")

    lines = passports_path.read_text(encoding="utf-8").splitlines()
    seen = set()
    for i, line in enumerate(lines, start=1):
        if not line.strip():
            continue
        row = json.loads(line)
        validate_passport_row(passports_path, row, i)
        code = row["code"]
        if code in seen:
            raise ValueError(f"duplicate passport row: {code}")
        seen.add(code)

    if seen != origin_codes:
        missing = sorted(origin_codes - seen)
        extra = sorted(seen - origin_codes)
        raise ValueError(f"passport origin mismatch missing={missing[:20]} extra={extra[:20]}")

    event_root = data_root / "history" / "events"
    if event_root.exists():
        for path in sorted(event_root.glob("*/*.jsonl")):
            rows = read_jsonl(path)
            for row in rows:
                if "changedAt" not in row or "code" not in row or "access" not in row:
                    raise ValueError(f"{path}: malformed event")
                validate_passport_row(path, {"code": row["code"], "access": row["access"]})

    manifest = load_json(manifest_path)
    if manifest.get("schemaVersion") != 1:
        raise ValueError("manifest schemaVersion must be 1")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-root", type=Path, required=True)
    args = parser.parse_args()
    validate_data(args.data_root)
    print("validation ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
