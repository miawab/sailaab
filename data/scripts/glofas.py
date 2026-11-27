"""Tiny client for the free Open-Meteo Flood API (GloFAS v4 river discharge).

- Every answer is saved in data/raw/glofas_cache/, so re-running costs nothing.
- Open-Meteo's free plan allows 600 "units" a minute, 5,000 an hour and
  10,000 a day. A request costs about 1 unit per 140 days per location, so
  39 years of history for one point is ~100 units. We pace ourselves with the
  X-RateLimit headers it sends back.
"""
import hashlib
import json
import time

from common import RAW, get

URL = "https://flood-api.open-meteo.com/v1/flood"
CACHE = RAW / "glofas_cache"
CACHE.mkdir(parents=True, exist_ok=True)

HOURLY_BUDGET = 4500        # stay under the 5,000/hour limit
_spent = []                 # (time, cost) of recent calls


def _pace(expected_cost):
    now = time.time()
    while _spent and now - _spent[0][0] > 3600:
        _spent.pop(0)
    used = sum(c for _, c in _spent)
    if used + expected_cost > HOURLY_BUDGET and _spent:
        wait = 3600 - (now - _spent[0][0]) + 1
        print(f"  hourly budget used ({used:.0f}), waiting {wait / 60:.1f} min")
        time.sleep(wait)


def discharge(points, start, end):
    """points = [(lat, lon), ...]. Returns one dict per point:
    {"lat", "lon" (the GloFAS cell centre), "time": [...], "q": [...]}"""
    key = json.dumps([[round(a, 4), round(b, 4)] for a, b in points]) + start + end
    f = CACHE / (hashlib.sha1(key.encode()).hexdigest()[:16] + ".json")
    if f.exists():
        return json.loads(f.read_text())

    days = 1 + (time.mktime(time.strptime(end, "%Y-%m-%d")) - time.mktime(time.strptime(start, "%Y-%m-%d"))) / 86400
    _pace(len(points) * days / 140)
    r = get(URL, params={
        "latitude": ",".join(f"{a:.4f}" for a, _ in points),
        "longitude": ",".join(f"{b:.4f}" for _, b in points),
        "daily": "river_discharge",
        "start_date": start,
        "end_date": end,
    })
    cost = float(r.headers.get("X-RateLimit-Cost", len(points) * days / 140))
    _spent.append((time.time(), cost))
    remaining = float(r.headers.get("X-RateLimit-Remaining", 600))
    if remaining < 150:  # per-minute window nearly used up
        time.sleep(60)
    data = r.json()
    data = data if isinstance(data, list) else [data]
    out = [{"lat": d["latitude"], "lon": d["longitude"],
            "time": d["daily"]["time"], "q": d["daily"]["river_discharge"]} for d in data]
    f.write_text(json.dumps(out))
    return out


def percentile(values, p):
    v = sorted(x for x in values if x is not None)
    if not v:
        return 0.0
    k = (len(v) - 1) * p
    lo, hi = int(k), min(int(k) + 1, len(v) - 1)
    return v[lo] + (v[hi] - v[lo]) * (k - lo)
