# Part B: Data pipeline

**Your job:** turn free global datasets into the clean files the map and API use. You own `data/`. Output files go to `web/public/data/` and `shared/river_points.json` (shapes are in `shared/CONTRACT.md`).

## Stack
Python 3 with geopandas, shapely, rasterio, requests, numpy. Scripts in `data/scripts/`, raw downloads in `data/raw/` (not committed).

## Steps
1. **Check coverage (do this first, tonight):** confirm that Open Buildings, the UNOSAT 2022 extent and the terrain tiles all cover the pilot box `[71.60, 33.95, 72.10, 34.25]`. If the 2022 extent doesn't cover Nowshera, tell the group straight away and pick a better box (Charsadda, or Dadu in Sindh).
2. **Houses:** download Google Open Buildings v3 (the polygons CSV for the S2 cell covering the box), clip to the box, drop tiny buildings (under 20 m², usually noise), simplify the shapes.
3. **Rivers:** get river lines from OpenStreetMap (Overpass API: `waterway=river` in the box) → `rivers.geojson`.
4. **2022 flood:** download the UNOSAT Pakistan 2022 flood extent (on HDX, search "UNOSAT Pakistan flood 2022"), clip it → `flood2022.geojson`, and flag `flooded_2022` on each house that touches it.
5. **Elevation:** sample terrain elevation (AWS terrain tiles, or Copernicus DEM 30 m) at each house centre → `elev_m`. For each house, find the nearest river line → `dist_to_river_m`, and the river's ground elevation there → `height_above_river_m`.
6. **River points + thresholds:** pick 1-3 forecast points on the rivers. For each, pull daily discharge for 1984-2021 from `https://flood-api.open-meteo.com/v1/flood?latitude=..&longitude=..&daily=river_discharge&start_date=1984-01-01&end_date=2021-12-31`, then compute p90 and p99 and the 2022 peak → `shared/river_points.json`. Give each house the id of its nearest point.
6b. **National points (all of Pakistan, do this Thu):** take Pakistan's major rivers from OSM or HydroRIVERS (free), place a point every ~25 km (about 150-300 in total) and compute p90/p99/2022 peak for each the same way → `web/public/data/national_points.geojson`. Wait ~0.2 s between API calls, and save the results so you only download once.
7. **Exposure score** (agree on the formula with Part C): for example `exposure = 0.5*f(height_above_river) + 0.3*f(dist) + 0.2*flooded_2022`, scaled 0..1.
8. Export `houses.geojson` (under 15 MB) and write `data/README.md` saying exactly how to rebuild everything.

Tested already: the flood API works with no key. Near Nowshera, the Kabul River is at about 200 m³/s now and was over 1,200 m³/s in late Aug 2022.

## Done when
- [ ] `houses.geojson`, `flood2022.geojson`, `rivers.geojson`, `river_points.json` committed and matching CONTRACT.md
- [ ] One command rebuilds them (`python data/scripts/build_all.py`)
- [ ] Sources + licenses added to the README table

## Paste this to your Claude
> I'm Part B on the Sailaab hackathon team (repo cloned here). Read CLAUDE.md, docs/PLAN.md, shared/CONTRACT.md and docs/parts/B-data.md. I own data/. Start with step 1 (check coverage) and tell me the result before going further. Explain each step simply because I have to explain it to judges.
