"""Step 4: ground height (terrain) for each district.

Copernicus DEM GLO-30 (30 m pixels, free on AWS, no account). It's a surface
model, so where buildings are dense it includes some roof height; at 30 m that's
a metre or two, which is why heights are only shown to the nearest metre.
Output: data/raw/dem_<district>.tif (cut to the district box).
"""
import math

import rasterio
from rasterio.merge import merge

from common import DISTRICTS, RAW, get

TILE = ("https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_{ns}{lat:02d}_00_{ew}{lon:03d}_00_DEM/"
        "Copernicus_DSM_COG_10_{ns}{lat:02d}_00_{ew}{lon:03d}_00_DEM.tif")
DEM_DIR = RAW / "dem"
DEM_DIR.mkdir(parents=True, exist_ok=True)


def tile(lat, lon):
    f = DEM_DIR / f"cop30_N{lat:02d}_E{lon:03d}.tif"
    if not f.exists():
        print(f"  downloading DEM tile N{lat} E{lon}")
        r = get(TILE.format(ns="N", lat=lat, ew="E", lon=lon), timeout=300)
        f.write_bytes(r.content)
    return f


def main():
    for name, d in DISTRICTS.items():
        out = RAW / f"dem_{name}.tif"
        if out.exists():
            continue
        w, s, e, n = d["box"]
        files = [tile(la, lo) for la in range(math.floor(s), math.floor(n) + 1)
                 for lo in range(math.floor(w), math.floor(e) + 1)]
        srcs = [rasterio.open(f) for f in files]
        pad = 0.02
        arr, transform = merge(srcs, bounds=(w - pad, s - pad, e + pad, n + pad))
        meta = srcs[0].meta.copy()
        meta.update(height=arr.shape[1], width=arr.shape[2], transform=transform, driver="GTiff", compress="deflate")
        with rasterio.open(out, "w", **meta) as dst:
            dst.write(arr)
        print(f"  {name}: DEM {arr.shape[2]}x{arr.shape[1]} px, {arr.min():.0f}-{arr.max():.0f} m")


if __name__ == "__main__":
    main()
