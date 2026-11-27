"""Step 1: house footprints from Google Open Buildings v3.

Open Buildings is split into big S2 cells (Nowshera is in cell "38d", a 1.3 GB
gzip CSV; Dadu in "395", 3.4 GB). We stream each file once, line by line, and
keep only buildings whose centre is inside the district box, so the full file
never has to sit on disk or in RAM.
Output: data/raw/buildings_<district>.csv (centre lat/lon, area, confidence, WKT polygon).
"""
import csv
import gzip
import sys

from common import DISTRICTS, RAW, UA

import requests

URL = "https://storage.googleapis.com/open-buildings-data/v3/polygons_s2_level_4_gzip/{cell}_buildings.csv.gz"
MIN_CONFIDENCE = 0.70  # Google's suggested cut-off for fewer false buildings

csv.field_size_limit(sys.maxsize)


def download(name, box, cell):
    OUT_CSV = RAW / f"buildings_{name}.csv"
    if OUT_CSV.exists():
        print(f"  {OUT_CSV.name} already downloaded, skipping")
        return
    print(f"  streaming Open Buildings cell {cell} for {name}...")
    w, s, e, n = box
    tmp = OUT_CSV.with_suffix(".part")
    kept = seen = 0
    with requests.get(URL.format(cell=cell), headers=UA, stream=True, timeout=120) as r:
        r.raise_for_status()
        r.raw.decode_content = False
        with gzip.GzipFile(fileobj=r.raw) as gz, open(tmp, "w", newline="") as out:
            lines = (line.decode("utf-8") for line in gz)
            reader = csv.DictReader(lines)
            writer = csv.writer(out)
            writer.writerow(["latitude", "longitude", "area_in_meters", "confidence", "geometry"])
            for row in reader:
                seen += 1
                if seen % 2_000_000 == 0:
                    print(f"  read {seen:,} buildings, kept {kept:,}")
                lat, lon = float(row["latitude"]), float(row["longitude"])
                if s <= lat <= n and w <= lon <= e and float(row["confidence"]) >= MIN_CONFIDENCE:
                    writer.writerow([lat, lon, row["area_in_meters"], row["confidence"], row["geometry"]])
                    kept += 1
    tmp.rename(OUT_CSV)
    print(f"  done: {kept:,} buildings in the {name} box (out of {seen:,} in the cell)")


def main():
    for name, d in DISTRICTS.items():
        download(name, d["box"], d["cell"])


if __name__ == "__main__":
    main()
