"""Step 5: the forecast points the showcase houses use, with danger thresholds.
Output: shared/river_points.json

Each point is a GloFAS grid cell (5 km) that sits on the river. We picked them
by scanning every cell in the district box for Jul-Sep 2022 and keeping the
ones carrying the river (see data/README.md).

Thresholds come from that cell's daily river flow, 1997-2021 (Open-Meteo's
GloFAS v4 history is empty before 1997 at these cells, even though the API
accepts 1984 dates):
  p90       = flow beaten on 10% of days  -> "watch" line
  p99       = flow beaten on 1% of days   -> "warning" line
  peak_2022 = highest single day in 2022  (Part C's "danger" = 90% of this)
"""
from collections import defaultdict

from common import SHARED, write_json
from glofas import discharge, percentile

POINTS = [
    # id, name, district, GloFAS cell centre, the OSM rivers that use this point
    ("kabul_nowshera", "Kabul River at Nowshera", "nowshera", 34.025, 71.975, ["Kabul River"]),
    ("swat_charsadda", "Swat River near Charsadda", "nowshera", 34.175, 71.625, ["Swat River"]),
    ("indus_dadu", "Indus River at Dadu", "dadu", 26.725, 67.825, ["Indus River"]),
    ("johi_dadu", "Johi flood channel near Johi", "dadu", 26.775, 67.625, ["Johi flood channel"]),
]


def build():
    out = []
    for pid, name, district, lat, lon, rivers in POINTS:
        r = discharge([(lat, lon)], "1997-01-01", "2022-12-31")[0]
        hist = [q for t, q in zip(r["time"], r["q"]) if q is not None and t < "2022"]
        yearly = defaultdict(float)
        for t, q in zip(r["time"], r["q"]):
            if q is not None:
                yearly[t[:4]] = max(yearly[t[:4]], q)
        peak = yearly["2022"]
        rank = sorted(yearly.values(), reverse=True).index(peak) + 1
        p = {"id": pid, "name": name, "lat": lat, "lon": lon,
             "p90": round(percentile(hist, 0.90), 1), "p99": round(percentile(hist, 0.99), 1),
             "peak_2022": round(peak, 1)}
        out.append(p)
        print(f"  {pid}: p90 {p['p90']:.0f}, p99 {p['p99']:.0f}, 2022 peak {peak:.0f} m3/s "
              f"(2022 was year #{rank} of {len(yearly)} since 1997)")
    write_json(SHARED / "river_points.json", out, indent=2)
    return out


# Which point each OSM river name uses, per district (for s7_houses.py).
RIVER_TO_POINT = {(d, rv): pid for pid, _, d, _, _, rivers in POINTS for rv in rivers}

if __name__ == "__main__":
    build()
