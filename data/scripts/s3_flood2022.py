"""Step 3: the area that really flooded in 2022 (UNOSAT, from HDX).

UNOSAT's map "Satellite detected water extents ... 1 July - 31 August 2022"
(event FL20220808PAK) is made from VIIRS satellite images (375 m pixels).
It's every place seen under water at least once in Jul-Aug 2022.
We cut it to each district box.
Output: web/public/data/flood2022.geojson + data/raw/flood_<district>.geojson.
"""
import io
import json
import zipfile

import geopandas as gpd
import pandas as pd
from shapely.geometry import box

from common import DISTRICTS, OUT, RAW, get, write_json

URL = ("https://data.humdata.org/dataset/f685e623-a539-4af0-92ff-19b737ec95b3/resource/"
       "fa89ec39-8dd0-4abe-b97e-0a3d9e9627a5/download/viirs_20220701_20220831_floodextent_pak.zip")
SHP = RAW / "unosat" / "VIIRS_20220701_20220831_FloodExtent_PAK.shp"


def main():
    if not SHP.exists():
        SHP.parent.mkdir(parents=True, exist_ok=True)
        zipfile.ZipFile(io.BytesIO(get(URL).content)).extractall(SHP.parent)
    flood = gpd.read_file(SHP).to_crs(4326)[["geometry"]]
    parts = []
    for name, d in DISTRICTS.items():
        c = flood.clip(box(*d["box"])).explode(index_parts=False)
        c = c[c.geometry.geom_type == "Polygon"].reset_index(drop=True)
        c.to_file(RAW / f"flood_{name}.geojson", driver="GeoJSON")
        km2 = c.to_crs(d["utm"]).area.sum() / 1e6
        print(f"  {name}: {len(c)} flood polygons, {km2:.0f} km2 flooded in Jul-Aug 2022")
        parts.append(c)
    allf = gpd.GeoDataFrame(pd.concat(parts, ignore_index=True), crs=4326)
    allf["geometry"] = allf.geometry.simplify(0.0003)  # ~30 m; the source pixels are 375 m
    allf["date"] = "2022-08-31"
    allf["source"] = "UNOSAT"
    fc = json.loads(allf[["date", "source", "geometry"]].to_json(drop_id=True))
    rnd = lambda ring: [[round(x, 5), round(y, 5)] for x, y in ring]
    for f in fc["features"]:
        f["geometry"]["coordinates"] = [rnd(r) for r in f["geometry"]["coordinates"]]
    write_json(OUT / "flood2022.geojson", fc)


if __name__ == "__main__":
    main()
