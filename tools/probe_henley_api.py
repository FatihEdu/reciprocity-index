#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import hashlib
import json
import requests
from urllib.parse import urlencode

BASE = "https://api.henleypassportindex.com/api/v3"
HEADERS = {
    "accept": "application/json",
    "referer": "https://www.henleyglobal.com/",
    "user-agent": "Mozilla/5.0 henley-probe/0.1",
}


def sha(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def get(path: str, params=None):
    url = f"{BASE}{path}"
    if params:
        url += "?" + urlencode(params)
    r = requests.get(url, headers=HEADERS, timeout=30)
    print("\n===", url)
    print("status:", r.status_code)
    print("content-type:", r.headers.get("content-type"))
    print("etag:", r.headers.get("etag"))
    print("last-modified:", r.headers.get("last-modified"))
    print("size:", len(r.content))
    print("sha256:", sha(r.content))
    try:
        data = r.json()
        print("json type:", type(data).__name__)
        return r, data
    except Exception as e:
        print("json error:", e)
        return r, None


def main():
    r, countries = get("/countries")
    if isinstance(countries, dict):
        print("top keys:", list(countries.keys()))
        rows = countries.get("countries", [])
        print("countries len:", len(rows))
        print("has_data true:", sum(1 for x in rows if isinstance(x, dict) and x.get("has_data") is True))
        if rows:
            print("first keys:", sorted(rows[0].keys()))
            print("first sample:", json.dumps(rows[0], ensure_ascii=False, indent=2)[:1200])

    r, years = get("/year-options")
    print("year-options:", json.dumps(years, ensure_ascii=False, indent=2))

    r, ranking = get("/global-ranking-map")
    print("ranking type:", type(ranking).__name__)
    if isinstance(ranking, list):
        print("ranking len:", len(ranking))
        print("ranking sample:", json.dumps(ranking[:3], ensure_ascii=False, indent=2)[:1200])

    hashes = {}
    for y in [None, 2026, 2025, 2024, 2020, 2016]:
        params = None if y is None else {"year": y}
        r, _ = get("/visa-single/TR", params)
        hashes[str(y or "no_year")] = sha(r.content)

    print("\nvisa-single/TR year hash comparison")
    base = hashes["no_year"]
    for k, v in hashes.items():
        print(k, v, "same_as_no_year=", v == base)


if __name__ == "__main__":
    main()
