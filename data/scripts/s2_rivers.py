"""Step 2: river lines in each showcase district from OpenStreetMap.

Asks the free Overpass API for every `waterway=river` line in the district box.
Output: data/raw/rivers_<district>.geojson (used for house distances and
heights) and web/public/data/rivers.geojson (both districts, for the map).
"""
import json

import geopandas as gpd
from shapely.geometry import LineString

from common import DISTRICTS, OUT, RAW, get, write_json

OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]

# OSM lines that have no name but matter to us. 151957892 is the channel just
# west of Dadu past Johi town that carried the 2022 flood water (GloFAS shows
# it almost dry most years, then 16,000 m3/s in Aug 2022).
NAMES_BY_ID = {151957892: "Johi flood channel"}


def clean_name(tags, osm_id):
    if osm_id in NAMES_BY_ID:
        return NAMES_BY_ID[osm_id]
    nm = (tags.get("name:en") or tags.get("name") or "").split("/")[0].strip()
    if not any("a" <= ch.lower() <= "z" for ch in nm):
        return "River"  # unnamed, or the name is only in Urdu script
    if nm.lower().startswith("river "):
        nm = nm[6:].strip()
    if not nm.lower().endswith("river"):
        nm = f"{nm} River"
    return nm


def fetch(name, box):
    raw = RAW / f"osm_rivers_{name}.json"
    if not raw.exists():
        w, s, e, n = box
        q = f'[out:json][timeout:120];way["waterway"="river"]({s},{w},{n},{e});out geom tags;'
        for srv in OVERPASS:
            try:
                raw.write_text(get(srv, params={"data": q}, timeout=180, tries=3).text)
                break
            except Exception as e:  # noqa: BLE001
                print(f"  overpass {srv} failed: {e}")
    els = json.loads(raw.read_text())["elements"]
    rows = []
    for el in els:
        if el.get("type") != "way" or len(el.get("geometry", [])) < 2:
            continue
        nm = clean_name(el.get("tags", {}), el["id"])
        rows.append({"name": nm, "geometry": LineString([(p["lon"], p["lat"]) for p in el["geometry"]])})
    gdf = gpd.GeoDataFrame(rows, crs="EPSG:4326").clip(box)
    gdf = gdf[~gdf.geometry.is_empty]
    gdf = gdf.explode(index_parts=False).reset_index(drop=True)
    gdf = gdf[gdf.geometry.geom_type == "LineString"]
    gdf.to_file(RAW / f"rivers_{name}.geojson", driver="GeoJSON")
    print(f"  {name}: {len(gdf)} river lines: {sorted(gdf['name'].unique())}")
    return gdf


def main():
    parts = [fetch(name, d["box"]) for name, d in DISTRICTS.items()]
    allr = gpd.GeoDataFrame(gpd.pd.concat(parts, ignore_index=True), crs="EPSG:4326")
    allr["geometry"] = allr.geometry.simplify(0.00005)  # ~5 m, keeps the file small
    fc = json.loads(allr[["name", "geometry"]].to_json(drop_id=True))
    for f in fc["features"]:
        f["geometry"]["coordinates"] = [[round(x, 5), round(y, 5)] for x, y in f["geometry"]["coordinates"]]
    write_json(OUT / "rivers.geojson", fc)


if __name__ == "__main__":
    main()
