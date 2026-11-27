"""Step 6: forecast points every ~30 km along Pakistan's major rivers, with
their danger thresholds. Output: web/public/data/national_points.geojson

How it works:
1. River lines: Indus, Jhelum, Chenab, Ravi and Sutlej from Natural Earth
   (clean single lines); Kabul, Swat, Gilgit, Hunza, Chitral, etc. from
   OpenStreetMap. Cut to Pakistan's outline.
2. Drop a point every 30 km along each river (~250 points).
3. "Snap" each point to the river in GloFAS: GloFAS works on a 5 km grid and
   its river can be one cell off the real one, so we look at the 3x3 cells
   around the point (Jul-Sep 2022, cheap) and keep the cell with the most water.
   The point is moved to that cell's centre, so the live forecast the API
   asks for is for the same cell as the thresholds.
4. Thresholds from that cell's daily flow, 2013-2021:
     p90 = flow beaten on 10% of days, p99 = on 1% of days,
     peak_2022 = the highest day in 2022.
   (Only 9 years here, not 1997-2021 like the showcase points, because the
   free Open-Meteo plan allows ~10,000 units a day and 39 years for 250
   points would cost ~25,000.)
5. Points are numbered in order along each river from upstream (low flow)
   to downstream, e.g. indus_001, indus_002... The API joins neighbours
   with straight lines to find "the nearest river" for any spot.
"""
import json
import statistics

import geopandas as gpd
import pandas as pd
from shapely.geometry import LineString, MultiLineString, Point
from shapely.ops import linemerge, unary_union

from common import OUT, RAW, ROOT, get, write_json
from glofas import discharge, percentile

SPACING_M = 30_000  # ~250 points; 25 km would be ~300 and go over the free daily API limit
NE_RIVERS = {"Indus", "Jhelum", "Chenab", "Ravi", "Sutlej"}
NE_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_rivers_lake_centerlines.geojson"
PLACES_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places_simple.geojson"
OSM_Q = ('[out:json][timeout:300];way["waterway"="river"]["name:en"~"^(Kabul|Swat|Gilgit|Hunza|Kunhar|Neelum|Chitral|'
         'Kunar|Panjkora|Kurram|Gomal|Zhob|Shyok|Haro|Soan|Poonch|Hub|Tochi)( River)?$"](23.6,60.8,37.1,77.9);out geom tags;')
OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]
# The Kunar is called the Chitral inside Pakistan.
RENAME = {"Kunar": "Chitral"}
CELL = 0.05  # GloFAS grid (degrees)
UTM = "EPSG:32642"


def cached(path, url):
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(get(url, timeout=300).content)
    return path


def river_lines():
    pk = gpd.read_file(ROOT / "web" / "public" / "geo" / "pakistan.geojson").to_crs(UTM)
    pk_shape = pk.buffer(2000).union_all()

    ne = gpd.read_file(cached(RAW / "ne" / "rivers10.geojson", NE_URL))
    ne = ne[ne["name"].isin(NE_RIVERS)][["name", "geometry"]]

    osm_file = RAW / "osm_national_rivers.json"
    if not osm_file.exists():
        for srv in OVERPASS:
            try:
                osm_file.write_text(get(srv, params={"data": OSM_Q}, timeout=320, tries=3).text)
                break
            except Exception as e:  # noqa: BLE001
                print(f"  overpass {srv} failed: {e}")
    rows = []
    for el in json.loads(osm_file.read_text())["elements"]:
        nm = el["tags"]["name:en"].replace(" River", "")
        rows.append({"name": RENAME.get(nm, nm),
                     "geometry": LineString([(p["lon"], p["lat"]) for p in el["geometry"]])})
    osm = gpd.GeoDataFrame(rows, crs=4326)

    allr = gpd.GeoDataFrame(pd.concat([ne, osm], ignore_index=True), crs=4326).to_crs(UTM)
    out = {}
    for name, grp in allr.groupby("name"):
        u = unary_union(list(grp.geometry))
        merged = linemerge(u) if isinstance(u, MultiLineString) else u
        merged = merged.intersection(pk_shape)
        parts = list(merged.geoms) if isinstance(merged, MultiLineString) else [merged]
        parts = [p for p in parts if isinstance(p, LineString) and p.length > 15_000]
        parts.sort(key=lambda p: -p.length)
        if parts:
            out[name] = parts
            print(f"  {name}: {sum(p.length for p in parts) / 1000:.0f} km in {len(parts)} piece(s)")
    return out


def place_names():
    pl = gpd.read_file(cached(RAW / "ne" / "places10.geojson", PLACES_URL))
    pl = pl[pl["adm0name"] == "Pakistan"][["name", "geometry"]].to_crs(UTM)
    return pl


def nearest_place(pt_utm, places):
    d = places.distance(pt_utm)
    i = d.idxmin()
    return places.loc[i, "name"] if d[i] < 40_000 else None


def snap(lat, lon):
    """Best GloFAS cell (most water in Jul-Sep 2022) among the 3x3 around (lat, lon)."""
    c_lat = round((lat - 0.025) / CELL) * CELL + 0.025
    c_lon = round((lon - 0.025) / CELL) * CELL + 0.025
    cands = [(round(c_lat + i * CELL, 3), round(c_lon + j * CELL, 3)) for i in (-1, 0, 1) for j in (-1, 0, 1)]
    res = discharge(cands, "2022-07-15", "2022-09-15")
    best = None
    for (la, lo), r in zip(cands, res):
        q = [x for x in r["q"] if x is not None]
        m = statistics.fmean(q) if q else 0
        if best is None or m > best[2]:
            best = (la, lo, m)
    return best


def main():
    lines = river_lines()
    places = place_names()
    to_wgs = lambda geom: gpd.GeoSeries([geom], crs=UTM).to_crs(4326).iloc[0]

    features = []
    used_cells = set()
    # The Indus goes first, so cells where a tributary meets it belong to the Indus.
    order = sorted(lines, key=lambda n: (n != "Indus", n))
    for name in order:
        pieces = []
        for part in lines[name]:
            n = max(1, int(part.length // SPACING_M))
            piece = []
            for k in range(n + 1):
                p = part.interpolate(min(k * SPACING_M + (part.length - n * SPACING_M) / 2, part.length))
                g = to_wgs(p)
                la, lo, mean = snap(g.y, g.x)
                if (la, lo) in used_cells:
                    continue
                used_cells.add((la, lo))
                piece.append({"lat": la, "lon": lo, "mean": mean, "utm": p})
            if piece:
                # Each piece runs upstream (less water) to downstream (more water).
                if piece[0]["mean"] > piece[-1]["mean"]:
                    piece.reverse()
                pieces.append(piece)
        # Pieces of the same river in upstream-to-downstream order too.
        pieces.sort(key=lambda pc: statistics.median(p["mean"] for p in pc))
        river_pts = [p for pc in pieces for p in pc]
        # A tributary point next to a junction can snap onto the bigger river
        # (e.g. the last Kabul point grabbing an Indus cell). Drop points with
        # over 3x the river's typical flow.
        if name != "Indus" and len(river_pts) >= 3:
            typical = statistics.median(p["mean"] for p in river_pts)
            jumped = [p for p in river_pts if typical > 0 and p["mean"] > 3 * typical]
            if jumped:
                print(f"  {name}: dropped {len(jumped)} point(s) that snapped onto a bigger river")
            river_pts = [p for p in river_pts if p not in jumped]
        if not river_pts:
            continue

        key = name.lower().replace(" ", "")
        for i, rp in enumerate(river_pts, start=1):
            props = {"id": f"{key}_{i:03d}", "p90": 0.0, "p99": 0.0, "peak_2022": 0.0}
            if rp["mean"] >= 1:  # a real channel: get its history
                h = discharge([(rp["lat"], rp["lon"])], "2013-01-01", "2022-12-31")[0]
                hist = [q for t, q in zip(h["time"], h["q"]) if q is not None and t < "2022"]
                y22 = [q for t, q in zip(h["time"], h["q"]) if q is not None and t.startswith("2022")]
                props.update(p90=round(percentile(hist, 0.90), 1), p99=round(percentile(hist, 0.99), 1),
                             peak_2022=round(max(y22), 1) if y22 else 0.0)
            place = nearest_place(rp["utm"], places)
            props["name"] = f"{name} River" + (f" near {place}" if place else "")
            features.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": [rp["lon"], rp["lat"]]},
                             "properties": {k: props[k] for k in ("id", "name", "p90", "p99", "peak_2022")}})
        print(f"  {name}: {len(river_pts)} points")
        # Save as we go, so a crash or rate limit doesn't lose work.
        write_json(OUT / "national_points.geojson", {"type": "FeatureCollection", "features": features})

    nodata = sum(1 for f in features if f["properties"]["p99"] < 10)
    print(f"  total {len(features)} points ({nodata} with too little water to rate)")


if __name__ == "__main__":
    main()
