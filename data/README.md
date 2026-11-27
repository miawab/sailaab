# Part B: data pipeline

Turns free global datasets into the files the map and the API use. Every file
follows `shared/CONTRACT.md`.

## Rebuild everything (one command)
```bash
python3 -m venv data/.venv
data/.venv/bin/pip install -r data/requirements.txt
data/.venv/bin/python data/scripts/build_all.py
```
Downloads are cached in `data/raw/` (not committed). The first run takes about
an hour: it streams ~5 GB of building files and stays inside Open-Meteo's free
rate limit. Re-runs take a few minutes.

## What it makes
| File | What's in it |
|---|---|
| `web/public/data/houses.geojson` | 44,000 buildings (25,000 Nowshera, 19,000 Dadu), 14.8 MB, with `elev_m`, `height_above_river_m`, `dist_to_river_m`, `flooded_2022`, `river_point`, `exposure` |
| `web/public/data/flood2022.geojson` | Area seen under water in Jul-Aug 2022 (UNOSAT), both districts |
| `web/public/data/rivers.geojson` | River lines in both districts (OpenStreetMap) |
| `web/public/data/national_points.geojson` | ~250 forecast points along 21 major rivers of Pakistan, with `p90`, `p99`, `peak_2022` |
| `shared/river_points.json` | The 4 showcase forecast points the houses use, with thresholds |
| `web/public/data/proof_kabul_nowshera.json` | Proof 1: real 2022 flows at Nowshera (FFC) next to GloFAS, day by day |
| `data/proof/ffc_vs_glofas_nowshera.csv` | Same numbers as a spreadsheet |

## The two showcase districts (and why there are two)
- **Nowshera / Charsadda (KP)**: the box in CONTRACT.md. Kabul + Swat rivers.
- **Dadu (Sindh)**: box `[67.60, 26.55, 68.00, 26.82]`, Indus + the channel past Johi town.

We checked GloFAS (the free river forecast we use) against 2022:

| Point | p90 | p99 | 2022 peak | 2022 rank (of 26 years since 1997) |
|---|---|---|---|---|
| `kabul_nowshera` Kabul River at Nowshera | 1,155 | 2,054 | 1,591 | 11th |
| `swat_charsadda` Swat River near Charsadda | 354 | 622 | 453 | 11th |
| `indus_dadu` Indus River at Dadu | 8,994 | 17,257 | 13,489 | 18th |
| `johi_dadu` Johi flood channel near Johi | 12 | 305 | 16,481 | **1st** |

(m³/s.) At Nowshera, GloFAS sees 2022 as an ordinary year, so the 2022 replay there
never passes "watch". West of Dadu, the channel past Johi is almost dry in a
normal year, then carried 16,481 m³/s on 27 Aug 2022. That matches what happened:
Dadu's 2022 flood came from the west (hill torrents and rain heading for Manchar
Lake), not from the Indus itself. **So the 2022 replay should use
`/api/replay?point=johi_dadu`**, where it climbs to danger on 27 Aug.

`johi_dadu` is a real GloFAS river cell. In OpenStreetMap the channel there has
no name, so we call it "Johi flood channel".

## How each step works (what to tell judges)
1. **Buildings** (`s1_buildings.py`): Google Open Buildings v3 polygons. Only
   buildings Google is ≥70% sure about, and ≥20 m² (smaller ones are mostly noise).
   ~886,000 in the Nowshera box, ~141,000 in Dadu.
2. **Rivers** (`s2_rivers.py`): every `waterway=river` line in OpenStreetMap
   (Overpass API).
3. **2022 flood** (`s3_flood2022.py`): UNOSAT's map of everything seen under
   water by the VIIRS satellite between 1 Jul and 31 Aug 2022 (event FL20220808PAK).
   A house is `flooded_2022` if its footprint touches that area.
4. **Ground height** (`s4_dem.py`): Copernicus DEM, 30 m pixels.
5. **River points** (`s5_river_points.py`): we scanned every 5 km GloFAS cell in
   each box for Jul-Sep 2022 and kept the cells that carry the river. Thresholds come
   from the cell's daily flow 1997-2021: **p90** = flow beaten on 10% of days
   ("watch"), **p99** = 1% of days ("warning"), **peak_2022** = the biggest day of 2022.
   (Open-Meteo's GloFAS history is empty before 1997 at these cells, even though
   the API takes 1984 dates.)
6. **National points** (`s6_national.py`): a point every 30 km along 21 rivers
   (Indus, Jhelum, Chenab, Ravi, Sutlej from Natural Earth; Kabul, Swat, Gilgit,
   Hunza, Chitral, Kurram, etc. from OSM). Each point is moved to the GloFAS cell
   with the most water within one cell (~5 km), so the live forecast and the
   thresholds are for the same cell. Thresholds use 2013-2021: the free API
   allows ~10,000 units a day, and the full history for 250 points would cost ~25,000.
   Ids run upstream to downstream (`indus_001`, `indus_002`…) as Part C's
   nearest-river code expects. Points with p99 under 10 m³/s are dry
   channels, and the API shows them as "no data".
7. **Houses** (`s7_houses.py`): for each building:
   - `dist_to_river_m`: distance to the nearest main river (the ones with a forecast).
   - `height_above_river_m`: house ground height minus the river's height at the
     closest bit of river. The river's height is the lowest DEM value within 500 m
     along the river, because the DEM is noisy over water.
   - `exposure` = 0.5 × height part (0 m → 1, 10 m+ → 0) + 0.3 × distance
     part (0 m → 1, 2 km+ → 0) + 0.2 × flooded in 2022. This is the same formula as `api/_lib/risk.js`.
   - Which houses: the full box would be a 250 MB file, so we keep the houses
     **closest to the main rivers** (Nowshera: within 0.6 km; Dadu: within 2.7 km),
     which are also the ones that can flood.
8. **Proof 1** (`s8_proof_ffc.py`): reads the Kabul-at-Nowshera number from every
   Federal Flood Commission daily report (1 Aug-15 Sep 2022) and lines it up with GloFAS.

## Proof 1 result: GloFAS vs the real river at Nowshera (be honest about this)
| | Real (FFC, 06:00 reading) | GloFAS |
|---|---|---|
| 2022 peak | 307,000 cusecs = **8,693 m³/s** on 28 Aug (official peak 336,000 cusecs at 19:00) | **1,591 m³/s** on 30 Aug |

GloFAS caught the flood **wave** (rising from 26 Aug, a peak around 28-30 Aug,
correlation 0.52 over 27 days). But it saw only **about 1/5 of the real flow**, and its
peak came 2 days late. The Kabul flood came from very heavy local rain in KP plus the
Swat River, which a global 5 km model smooths out. What to say to judges: *"We
checked our data source against Pakistan's own flood gauges. It got the timing
right but badly underestimated Nowshera, so the next step is to plug in FFD's
gauge readings where they exist. Where the flood came down a big channel, like
Dadu, GloFAS clearly showed 2022 as the worst year on record."*

## Proof 2: would it have warned days early? (`s9_proof_forecasts.py`)
This needs the GloFAS forecasts as they were issued in Aug 2022. Those are only on
Copernicus's Early Warning Data Store (free account). The script and the steps are
ready (see the top of the file), but **it has not been run yet**: it needs
the account token in `~/.cdsapirc`. Never put the token in the repo.

## Known limits
- GloFAS is a 5 km global model. It underestimates small and flashy rivers (see Proof 1).
- Copernicus DEM is a surface model: where buildings are dense it includes some
  roof height, and its heights are only good to about ±2 m. The app rounds to whole metres.
- The UNOSAT flood map uses 375 m satellite pixels, so `flooded_2022` is
  "in a flooded neighbourhood", not "this exact house had water inside".
- Houses far from the main rivers (rain or hill-torrent flooding) are not in the file.

## Sources (also in the main README table)
Google Open Buildings v3 (CC BY 4.0) · OpenStreetMap via Overpass (ODbL) · UNOSAT
FL20220808PAK on HDX (CC BY-SA) · Copernicus DEM GLO-30 on AWS (free, attribution) ·
GloFAS v4 via Open-Meteo Flood API (CC BY 4.0) · Natural Earth (public domain) ·
Federal Flood Commission daily reports, ffc.gov.pk (public).
