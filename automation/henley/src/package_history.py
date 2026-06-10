#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import argparse
import gzip
import json
from pathlib import Path
from typing import Any


def canonical_dumps(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def read_events(path: Path) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    if not path.exists():
        return events
    for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.strip():
            continue
        row = json.loads(line)
        row["__source"] = path.as_posix()
        row["__line"] = line_no
        events.append(row)
    return events


def find_event_files(data_root: Path) -> list[Path]:
    root = data_root / "history" / "events"
    if not root.exists():
        return []
    return sorted(root.glob("*/*.jsonl"))


def gzip_json(path: Path, obj: Any) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    raw = canonical_dumps(obj).encode("utf-8")
    with gzip.open(path, "wb", compresslevel=9) as f:
        f.write(raw)
    return path.stat().st_size


def clean_event(event: dict[str, Any]) -> dict[str, Any]:
    return {
        "changedAt": event["changedAt"],
        "code": event["code"],
        "semanticSha256": event.get("semanticSha256"),
        "access": event["access"],
    }


def month_from_event_file(path: Path) -> str:
    # history/events/2026/06.jsonl -> 2026-06
    return f"{path.parent.name}-{path.stem}"


def package_history(data_root: Path, out_root: Path) -> dict[str, Any]:
    event_files = find_event_files(data_root)
    all_events_by_month: dict[str, list[dict[str, Any]]] = {}

    for path in event_files:
        month = month_from_event_file(path)
        events = read_events(path)
        events.sort(key=lambda e: (e["changedAt"], e["code"]))
        all_events_by_month[month] = events

    state: dict[str, dict[str, str]] = {}
    monthly_index: list[dict[str, Any]] = []
    yearly_changes: dict[str, list[dict[str, Any]]] = {}
    yearly_base: dict[str, dict[str, dict[str, str]]] = {}

    for month in sorted(all_events_by_month):
        year = month[:4]
        events = all_events_by_month[month]
        if not events:
            continue

        if year not in yearly_base:
            yearly_base[year] = {code: access for code, access in sorted(state.items())}

        base = {code: access for code, access in sorted(state.items())}
        changes = [clean_event(e) for e in events]

        pack = {
            "schemaVersion": 1,
            "type": "monthly-pack",
            "month": month,
            "base": base,
            "changes": changes,
        }

        yyyy, mm = month.split("-")
        rel = Path("monthly") / yyyy / f"{mm}.json.gz"
        size = gzip_json(out_root / rel, pack)

        monthly_index.append({
            "month": month,
            "path": f"/data/history/{rel.as_posix()}",
            "format": "monthly-pack-v1",
            "compressed": True,
            "sizeBytes": size,
            "changes": len(changes),
            "firstChangedAt": changes[0]["changedAt"],
            "lastChangedAt": changes[-1]["changedAt"],
        })

        yearly_changes.setdefault(year, []).extend(changes)

        for event in events:
            state[event["code"]] = event["access"]

    yearly_index: list[dict[str, Any]] = []

    for year in sorted(yearly_changes):
        changes = sorted(yearly_changes[year], key=lambda e: (e["changedAt"], e["code"]))
        pack = {
            "schemaVersion": 1,
            "type": "yearly-pack",
            "year": year,
            "base": yearly_base.get(year, {}),
            "changes": changes,
        }
        rel = Path("yearly") / f"{year}.json.gz"
        size = gzip_json(out_root / rel, pack)
        yearly_index.append({
            "year": year,
            "path": f"/data/history/{rel.as_posix()}",
            "format": "yearly-pack-v1",
            "compressed": True,
            "sizeBytes": size,
            "changes": len(changes),
            "firstChangedAt": changes[0]["changedAt"] if changes else None,
            "lastChangedAt": changes[-1]["changedAt"] if changes else None,
        })

    index = {
        "schemaVersion": 1,
        "monthly": monthly_index,
        "yearly": yearly_index,
    }

    out_root.mkdir(parents=True, exist_ok=True)
    (out_root / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return index


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-root", type=Path, required=True)
    parser.add_argument("--out-root", type=Path, required=True)
    args = parser.parse_args()

    index = package_history(args.data_root, args.out_root)
    print(json.dumps({
        "status": "ok",
        "monthly": len(index["monthly"]),
        "yearly": len(index["yearly"]),
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
