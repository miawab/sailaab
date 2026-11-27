"""Shared settings for every Part B script: the area we cover and where files go."""
import json
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[2]          # repo root
RAW = ROOT / "data" / "raw"                           # downloads (not committed)
OUT = ROOT / "web" / "public" / "data"                # files the website loads
SHARED = ROOT / "shared"
RAW.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)

# House-level showcase districts. Boxes are (west, south, east, north).
# - nowshera: the box from shared/CONTRACT.md (Kabul + Swat rivers).
# - dadu: Dadu, Sindh, on the Indus. Added because GloFAS sees 2022 as only an
#   average year at Nowshera but the 2nd-biggest year (since 1997) at Dadu,
#   so Dadu is where the 2022 replay really reaches "danger".
#   Box kept south of 26.82 N so it fits in one Open Buildings file.
# "cell" = the Open Buildings S2 level-4 file that covers the box.
DISTRICTS = {
    "nowshera": {"box": (71.60, 33.95, 72.10, 34.25), "cell": "38d", "utm": "EPSG:32642"},
    "dadu": {"box": (67.60, 26.55, 68.00, 26.82), "cell": "395", "utm": "EPSG:32642"},
}
BOX = DISTRICTS["nowshera"]["box"]

# Pakistan, for the national river points.
PAKISTAN_BOX = (60.8, 23.6, 77.9, 37.1)

# Metric map projection for this part of Pakistan (UTM zone 42N), so distances
# and areas come out in metres.
UTM = "EPSG:32642"

UA = {"User-Agent": "sailaab-hackathon-data/1.0"}


def get(url, params=None, tries=5, timeout=120, **kw):
    """requests.get with polite retries (waits longer after each failure)."""
    for i in range(tries):
        try:
            r = requests.get(url, params=params, headers=UA, timeout=timeout, **kw)
            if r.status_code == 429 or r.status_code >= 500:
                raise requests.HTTPError(f"{r.status_code} {r.text[:200]}")
            r.raise_for_status()
            return r
        except Exception as e:  # noqa: BLE001
            if i == tries - 1:
                raise
            wait = 5 * 2 ** i
            print(f"  retry in {wait}s ({e})")
            time.sleep(wait)


def write_json(path, data, indent=None):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=indent, separators=None if indent else (",", ":"))
    print(f"  wrote {path.relative_to(ROOT)} ({path.stat().st_size / 1e6:.2f} MB)")
