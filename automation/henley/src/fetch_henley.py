#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import random
import re
import shutil
import time
from pathlib import Path
from typing import Any

import requests

BASE = "https://api.henleypassportindex.com/api/v3"
COUNTRIES_URL = f"{BASE}/countries"
VISA_SINGLE_URL = f"{BASE}/visa-single"

CATEGORY_TO_ENUM = {
    "visa_free_access": "visa_free",
    "visa_on_arrival": "visa_on_arrival",
    "visa_required": "visa_required",
    "visa_online": "visa_online",
    "electronic_travel_authorisation": "electronic_travel_authorisation",
}
VISA_CATEGORIES = list(CATEGORY_TO_ENUM.keys())
RETRYABLE_STATUS = {408, 425, 429, 500, 502, 503, 504}

HEADERS = {
    "accept": "application/json",
    "referer": "https://www.henleyglobal.com/",
    "user-agent": "Mozilla/5.0 reciprocity-index/0.1",
}


def now_utc() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def canonical_dumps(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def pretty_json(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, obj: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(pretty_json(obj), encoding="utf-8")


def append_jsonl(path: Path, obj: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8", newline="\n") as f:
        f.write(canonical_dumps(obj) + "\n")


def sleep_between_requests(seconds: float) -> None:
    if seconds <= 0:
        return
    time.sleep(seconds + random.uniform(0, min(0.5, seconds)))


def get_with_retry(session: requests.Session, url: str, attempts: int, sleep: float) -> tuple[int, bytes]:
    last_error: Exception | None = None

    for attempt in range(1, attempts + 1):
        try:
            r = session.get(url, headers=HEADERS, timeout=30)
            if r.status_code == 200:
                return r.status_code, r.content
            if r.status_code in RETRYABLE_STATUS:
                raise RuntimeError(f"retryable HTTP {r.status_code}")
            return r.status_code, r.content
        except Exception as exc:
            last_error = exc
            if attempt < attempts:
                time.sleep(sleep * attempt)

    raise RuntimeError(f"GET failed after {attempts} attempts: {url}: {last_error}")


def get_json_required(session: requests.Session, url: str, attempts: int, sleep: float) -> tuple[bytes, Any]:
    status, body = get_with_retry(session, url, attempts, sleep)
    if status != 200:
        raise RuntimeError(f"expected HTTP 200, got {status}: {url}")
    try:
        return body, json.loads(body.decode("utf-8"))
    except Exception as exc:
        raise ValueError(f"invalid JSON: {url}: {exc}") from exc


def normalize_country_code(code: Any) -> str | None:
    if not isinstance(code, str):
        return None
    code = code.strip().upper()
    if not re.fullmatch(r"[A-Z0-9]{2,3}", code):
        return None
    return code


def normalize_countries_payload(payload: Any) -> dict[str, dict[str, Any]]:
    if not isinstance(payload, dict) or not isinstance(payload.get("countries"), list):
        raise ValueError("/countries expected shape: { countries: [...] }")

    out: dict[str, dict[str, Any]] = {}

    for item in payload["countries"]:
        if not isinstance(item, dict):
            continue
        code = normalize_country_code(item.get("code"))
        if not code:
            continue

        out[code] = {
            "code": code,
            "country": item.get("country"),
            "hasData": item.get("has_data") is True,
            "region": item.get("region"),
            "isSchengen": item.get("is_schengen") is True,
            "visaFreeCount": item.get("visa_free_count"),
            "openness": item.get("openness"),
            "rankHistory": item.get("data") or {},
        }

    return dict(sorted(out.items()))


def extract_origin_codes(countries: dict[str, dict[str, Any]]) -> list[str]:
    return sorted(code for code, item in countries.items() if item.get("hasData") is True)


def validate_visa_response(origin_code: str, data: Any) -> None:
    if not isinstance(data, dict):
        raise ValueError(f"{origin_code}: top-level JSON is not object")
    if data.get("code") != origin_code:
        raise ValueError(f"{origin_code}: code mismatch, got {data.get('code')!r}")
    if not isinstance(data.get("country"), str) or not data["country"].strip():
        raise ValueError(f"{origin_code}: country missing")

    for category in VISA_CATEGORIES:
        if category not in data:
            raise ValueError(f"{origin_code}: missing category {category}")
        if not isinstance(data[category], list):
            raise ValueError(f"{origin_code}: category {category} is not list")
        for i, item in enumerate(data[category]):
            if not isinstance(item, dict):
                raise ValueError(f"{origin_code}: {category}[{i}] is not object")
            dest = normalize_country_code(item.get("code"))
            if not dest:
                raise ValueError(f"{origin_code}: invalid dest code in {category}[{i}]")
            name = item.get("name")
            if not isinstance(name, str) or not name.strip():
                raise ValueError(f"{origin_code}: invalid dest name for {dest}")


def normalize_visa_response(origin_code: str, data: dict[str, Any]) -> dict[str, Any]:
    access: dict[str, str] = {}
    duplicates: list[dict[str, str]] = []

    for category, enum_value in CATEGORY_TO_ENUM.items():
        for item in data.get(category, []):
            dest = normalize_country_code(item.get("code"))
            if not dest:
                raise ValueError(f"{origin_code}: invalid destination code")

            # Henley self-entry veriyor. Skorda self-pair yok.
            if dest == origin_code:
                continue

            if dest in access:
                duplicates.append({"destination": dest, "old": access[dest], "new": enum_value})
            access[dest] = enum_value

    if duplicates:
        raise ValueError(f"{origin_code}: duplicate destinations: {duplicates[:10]}")

    return {
        "code": origin_code,
        "country": data["country"],
        "access": dict(sorted(access.items())),
    }


def semantic_hash_passport(row: dict[str, Any]) -> str:
    return sha256_text(canonical_dumps({"code": row["code"], "access": row["access"]}))


def semantic_hash_obj(obj: Any) -> str:
    return sha256_text(canonical_dumps(obj))


def read_latest_jsonl(path: Path) -> dict[str, dict[str, Any]]:
    rows: dict[str, dict[str, Any]] = {}
    if not path.exists():
        return rows
    for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.strip():
            continue
        row = json.loads(line)
        code = row.get("code")
        if not isinstance(code, str):
            raise ValueError(f"{path}: line {line_no}: missing code")
        rows[code] = row
    return rows


def write_latest_jsonl(path: Path, rows: dict[str, dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    ordered = [rows[code] for code in sorted(rows)]
    path.write_text("\n".join(canonical_dumps(row) for row in ordered) + "\n", encoding="utf-8")


def copy_config_to_latest(config_root: Path, data_root: Path) -> None:
    for name in ["score-models.json", "groups.json"]:
        src = config_root / name
        if src.exists():
            dst = data_root / "latest" / name
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(src, dst)


def run(args: argparse.Namespace) -> int:
    data_root: Path = args.data_root
    config_root: Path = args.config_root

    session = requests.Session()
    fetched_at = now_utc()

    latest_passports_path = data_root / "latest" / "passports.jsonl"
    latest_countries_path = data_root / "latest" / "countries.json"
    raw_countries_path = data_root / "raw" / "catalog" / "countries.json"
    hashes_path = data_root / "meta" / "hashes.json"
    manifest_path = data_root / "latest" / "manifest.json"

    hashes = load_json(hashes_path, {})
    latest_rows = read_latest_jsonl(latest_passports_path)

    print("[fetch] countries")
    countries_raw_bytes, countries_payload = get_json_required(session, COUNTRIES_URL, args.attempts, args.sleep)
    countries_normalized = normalize_countries_payload(countries_payload)
    origin_codes = extract_origin_codes(countries_normalized)

    if len(countries_normalized) < 200:
        raise RuntimeError(f"countries count too low: {len(countries_normalized)}")
    if len(origin_codes) < 150:
        raise RuntimeError(f"origin count too low: {len(origin_codes)}")

    countries_sem_hash = semantic_hash_obj(countries_normalized)
    old_countries_sem_hash = hashes.get("__countries__", {}).get("semanticSha256")
    countries_changed = old_countries_sem_hash != countries_sem_hash or not latest_countries_path.exists()

    print(f"[fetch] countries total={len(countries_normalized)} origins={len(origin_codes)} changed={countries_changed}")

    fetched_results: dict[str, dict[str, Any]] = {}
    changed_origins: list[str] = []
    unchanged_origins: list[str] = []

    # All-or-nothing: dosya yazmadan önce bütün originleri çek/validate et.
    for index, code in enumerate(origin_codes, start=1):
        sleep_between_requests(args.sleep)
        print(f"[fetch] {index}/{len(origin_codes)} {code}")
        raw_bytes, payload = get_json_required(session, f"{VISA_SINGLE_URL}/{code}", args.attempts, args.sleep)
        validate_visa_response(code, payload)
        normalized = normalize_visa_response(code, payload)
        sem_hash = semantic_hash_passport(normalized)
        raw_hash = sha256_bytes(raw_bytes)

        raw_path = data_root / "raw" / "visa-single" / f"{code}.json"
        old_sem_hash = hashes.get(code, {}).get("semanticSha256")
        changed = old_sem_hash != sem_hash or code not in latest_rows or not raw_path.exists()

        fetched_results[code] = {
            "payload": payload,
            "normalized": normalized,
            "semanticSha256": sem_hash,
            "rawSha256": raw_hash,
            "changed": changed,
        }

        if changed:
            changed_origins.append(code)
        else:
            unchanged_origins.append(code)

    if not countries_changed and not changed_origins:
        print(json.dumps({
            "status": "unchanged",
            "countries": len(countries_normalized),
            "origins": len(origin_codes),
            "changedOrigins": [],
        }, ensure_ascii=False, indent=2))
        return 0

    if args.dry_run:
        print(json.dumps({
            "status": "changed-dry-run",
            "countriesChanged": countries_changed,
            "changedOrigins": changed_origins,
        }, ensure_ascii=False, indent=2))
        return 0

    if countries_changed:
        write_json(latest_countries_path, countries_normalized)
        write_json(raw_countries_path, countries_payload)
        hashes["__countries__"] = {
            "semanticSha256": countries_sem_hash,
            "rawSha256": sha256_bytes(countries_raw_bytes),
            "lastChangedAt": fetched_at,
        }

    year, month = fetched_at[:7].split("-")
    history_path = data_root / "history" / "events" / year / f"{month}.jsonl"

    for code in changed_origins:
        result = fetched_results[code]
        normalized = result["normalized"]

        raw_path = data_root / "raw" / "visa-single" / f"{code}.json"
        write_json(raw_path, result["payload"])

        latest_rows[code] = normalized

        append_jsonl(history_path, {
            "changedAt": fetched_at,
            "code": code,
            "semanticSha256": result["semanticSha256"],
            "access": normalized["access"],
        })

        hashes[code] = {
            "semanticSha256": result["semanticSha256"],
            "rawSha256": result["rawSha256"],
            "lastChangedAt": fetched_at,
        }

    write_latest_jsonl(latest_passports_path, latest_rows)
    write_json(hashes_path, hashes)
    copy_config_to_latest(config_root, data_root)

    manifest = load_json(manifest_path, {})
    if changed_origins:
        manifest["lastSourceDataChangedAt"] = fetched_at
    else:
        manifest.setdefault("lastSourceDataChangedAt", None)

    manifest.update({
        "schemaVersion": 1,
        "source": "henley-passport-index",
        "countriesCount": len(countries_normalized),
        "originCount": len(origin_codes),
        "destinationCount": 227,
        "countriesChanged": countries_changed,
        "changedOrigins": changed_origins,
        "statusEnums": sorted(set(CATEGORY_TO_ENUM.values())),
        "historyEventPath": history_path.as_posix() if changed_origins else None,
    })
    write_json(manifest_path, manifest)

    print(json.dumps({
        "status": "changed",
        "countriesChanged": countries_changed,
        "changedOrigins": changed_origins,
        "unchangedOrigins": len(unchanged_origins),
    }, ensure_ascii=False, indent=2))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-root", type=Path, default=Path("data"))
    parser.add_argument("--config-root", type=Path, default=Path("automation/henley/config"))
    parser.add_argument("--attempts", type=int, default=3)
    parser.add_argument("--sleep", type=float, default=0.5)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    return run(args)


if __name__ == "__main__":
    raise SystemExit(main())
