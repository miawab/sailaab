"""Step 7: one row per house with everything the risk engine needs.
Output: web/public/data/houses.geojson (both districts, under 15 MB).

For each building:
  elev_m               ground height at the house (Copernicus DEM, m above sea level)
  dist_to_river_m      distance to the nearest MAIN river (the ones we have a
                       forecast for: Kabul, Swat, Indus, Johi channel)
  height_above_river_m house ground height minus the river's height at the
                       closest bit of river (0 if the DEM says it's lower)
  flooded_2022         the footprint touches the UNOSAT 2022 flood area
  river_point          id of the forecast point for that river (shared/river_points.json)
  exposure             0..1, same formula as Part C's api/_lib/risk.js:
                       0.5 * height part (0 m = 1, 10 m+ = 0)
                     + 0.3 * distance part (0 m = 1, 2 km+ = 0)
                     + 0.2 * flooded in 2022

Which houses are kept: there are ~1 million buildings in the Nowshera box,
which would be a 250 MB file. We drop buildings under 20 m2 (mostly noise),
then keep the houses closest to the main rivers (the ones that can flood)
until each district hits its share of the 15 MB limit.
"""
import json

import geopandas as gpd
import numpy as np
import pandas as pd
import rasterio
import shapely
from scipy.spatial import cKDTree

from common import DISTRICTS, OUT, RAW, write_json
from s5_river_points import RIVER_TO_POINT

MIN_AREA_M2 = 20
KEEP = {"nowshera": 25_000, "dadu": 19_000}   # houses per district (fits under 15 MB)
RIVER_SAMPLE_M = 30          # sample the river every 30 m (one DEM pixel)
RIVER_LEVEL_RADIUS_M = 500   # river height = low point of the river within 500 m
HEIGHT_FULL_M, DIST_FULL_M = 10, 2000


def sample_dem(dem, xs, ys):
    """DEM value at lon/lat points (nearest pixel)."""
    rows, cols = rasterio.transform.rowcol(dem.transform, xs, ys)
    arr = dem.read(1)
    rows = np.clip(np.asarray(rows), 0, arr.shape[0] - 1)
    cols = np.clip(np.asarray(cols), 0, arr.shape[1] - 1)
    return arr[rows, cols].astype(float)


def river_samples(name, utm, dem):
    """Points every 30 m along the main rivers, with the river's ground height."""
    rv = gpd.read_file(RAW / f"rivers_{name}.geojson")
    rv = rv[[(name, n) in RIVER_TO_POINT for n in rv["name"]]].to_crs(utm)
    pts, names = [], []
    for geom, nm in zip(rv.geometry, rv["name"]):
        n = max(2, int(geom.length // RIVER_SAMPLE_M))
        for d in np.linspace(0, geom.length, n):
            p = geom.interpolate(d)
            pts.append((p.x, p.y))
            names.append(nm)
    pts = np.array(pts)
    ll = gpd.GeoSeries(gpd.points_from_xy(pts[:, 0], pts[:, 1]), crs=utm).to_crs(4326)
    elev = sample_dem(dem, ll.x.values, ll.y.values)
    # The DEM is noisy over water, so the river's height at each sample is the
    # LOW point of the river within 500 m (water surface ~ the lowest ground).
    tree = cKDTree(pts)
    level = np.array([elev[idx].min() for idx in tree.query_ball_point(pts, RIVER_LEVEL_RADIUS_M)])
    return tree, level, np.array(names)


def build_district(name, cfg, id_start):
    utm = cfg["utm"]
    df = pd.read_csv(RAW / f"buildings_{name}.csv")
    df = df[df["area_in_meters"] >= MIN_AREA_M2].reset_index(drop=True)
    print(f"  {name}: {len(df):,} buildings of 20 m2 or more")

    dem = rasterio.open(RAW / f"dem_{name}.tif")
    tree, river_level, river_names = river_samples(name, utm, dem)

    # Distance to main river for every building (centre points, cheap).
    cx = gpd.GeoSeries(gpd.points_from_xy(df["longitude"], df["latitude"]), crs=4326).to_crs(utm)
    xy = np.column_stack([cx.x.values, cx.y.values])
    dist, idx = tree.query(xy)
    df["dist"] = dist
    df["ridx"] = idx

    # Keep the houses closest to the rivers.
    df = df.nsmallest(KEEP[name], "dist").reset_index(drop=True)
    print(f"  {name}: kept the {len(df):,} closest to a main river (all within {df['dist'].max() / 1000:.1f} km)")

    geoms = shapely.from_wkt(df["geometry"].values)
    g = gpd.GeoDataFrame(df.drop(columns=["geometry"]), geometry=geoms, crs=4326)

    flood = gpd.read_file(RAW / f"flood_{name}.geojson")
    flood_union = flood.union_all()
    g["flooded_2022"] = g.intersects(flood_union)

    g["elev_m"] = sample_dem(dem, g["longitude"].values, g["latitude"].values)
    g["height_above_river_m"] = np.maximum(0.0, g["elev_m"] - river_level[g["ridx"].values])
    g["river_point"] = [RIVER_TO_POINT[(name, river_names[i])] for i in g["ridx"].values]

    h = np.clip(1 - g["height_above_river_m"] / HEIGHT_FULL_M, 0, 1)
    d = np.clip(1 - g["dist"] / DIST_FULL_M, 0, 1)
    g["exposure"] = np.clip(0.5 * h + 0.3 * d + 0.2 * g["flooded_2022"].astype(float), 0, 1)

    g = g.sort_values(["latitude", "longitude"]).reset_index(drop=True)
    g["id"] = [f"h_{id_start + i:06d}" for i in range(len(g))]

    print(f"  {name}: {g['flooded_2022'].mean() * 100:.0f}% flooded in 2022, "
          f"median {g['height_above_river_m'].median():.1f} m above the river, "
          f"points used: {g['river_point'].value_counts().to_dict()}")
    return g


def to_feature(row):
    geom = row.geometry
    if geom.geom_type == "MultiPolygon":
        geom = max(geom.geoms, key=lambda p: p.area)
    ring = [[round(x, 5), round(y, 5)] for x, y in geom.exterior.coords]
    return {"type": "Feature", "geometry": {"type": "Polygon", "coordinates": [ring]},
            "properties": {
                "id": row["id"],
                "elev_m": round(float(row["elev_m"]), 1),
                "height_above_river_m": round(float(row["height_above_river_m"]), 1),
                "dist_to_river_m": int(round(row["dist"])),
                "flooded_2022": bool(row["flooded_2022"]),
                "river_point": row["river_point"],
                "exposure": round(float(row["exposure"]), 2),
            }}


def main():
    feats, start = [], 1
    for name, cfg in DISTRICTS.items():
        g = build_district(name, cfg, start)
        start += len(g)
        feats += [to_feature(r) for _, r in g.iterrows()]
    write_json(OUT / "houses.geojson", {"type": "FeatureCollection", "features": feats})


if __name__ == "__main__":
    main()
