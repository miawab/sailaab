# Data contract

Every part follows these shapes. If you need a change, edit this file first and tell the group.
Mock versions of every file live in `shared/mock/`, so Part A can build before the real data exists.

## Coverage
- **National:** all of Pakistan, bbox `[60.8, 23.6, 77.9, 37.1]`, map center `[69.3, 30.4]`, zoom 5.
- **House-level showcase district 1:** Nowshera + Charsadda, KP (Kabul + Swat rivers, badly flooded Aug 2022). Bbox `[71.60, 33.95, 72.10, 34.25]` (west, south, east, north), center `[71.98, 34.02]`, zoom 13. District 2 (if time): Dadu, Sindh.

## 0. `web/public/data/national_points.geojson` (Part B)
Point features every ~25 km along Pakistan's major rivers, about 150-300 points. Properties are the same as a `river_points.json` entry (`id, name, p90, p99, peak_2022`). Part C's API colours them with the live forecast.

## 0b. `GET /api/national` (Part C)
`{ "points": [{ "id": "indus_014", "level": "watch", "worst_date": "2026-11-29" }] }` gives the current worst level for every national point. Cache it for 3 hours.

## 0c. `GET /api/risk?lat=..&lon=..` (Part C) gives risk for ANY spot in Pakistan
Finds the nearest national point, gets its forecast and uses the ground height at the spot to say how exposed it is.
`{ "level": "watch", "score": 40, "river": "Chenab River", "dist_to_river_m": 2300, "reasons": ["..."], "alert_key": "watch" }`

## 1. `web/public/data/houses.geojson` (Part B makes it)
A FeatureCollection of building polygons. Keep it **under 15 MB** (cut the area or simplify if it's bigger).
```json
{ "type": "Feature",
  "geometry": { "type": "Polygon", "coordinates": [[[71.98, 34.02], "..."]] },
  "properties": {
    "id": "h_000123",
    "elev_m": 291.4,             // ground height (m above sea level)
    "height_above_river_m": 2.1, // elev_m minus nearest river water level
    "dist_to_river_m": 180,
    "flooded_2022": true,        // inside the UNOSAT 2022 extent
    "river_point": "kabul_nowshera", // which forecast point this house uses
    "exposure": 0.78              // 0..1, how exposed the house is (see C's formula)
  } }
```

## 2. `web/public/data/flood2022.geojson` (Part B)
Polygons of the area that flooded in 2022. Properties: `{ "date": "2022-08-30", "source": "UNOSAT" }`.

## 3. `web/public/data/rivers.geojson` (Part B)
LineStrings of the rivers in the area. Properties: `{ "name": "Kabul River" }`.

## 4. `shared/river_points.json` (Part B makes it, Part C reads it)
Forecast points on the rivers with their danger thresholds, worked out from GloFAS history 1984-2021.
```json
[{ "id": "kabul_nowshera", "name": "Kabul River at Nowshera", "lat": 34.01, "lon": 71.98,
   "p90": 650, "p99": 1100, "peak_2022": 1400 }]   // m³/s
```

## 5. `GET /api/forecast?point=kabul_nowshera` (Part C)
```json
{ "point": "kabul_nowshera", "updated": "2026-11-27T06:00Z",
  "days": [{ "date": "2026-11-27", "discharge": 199.4, "level": "safe" }],   // 7 items
  "worst": { "date": "2026-11-29", "level": "watch" } }
```
`level` is one of `"safe" | "watch" | "warning" | "danger"`.

## 6. `GET /api/house?id=h_000123` (Part C)
```json
{ "id": "h_000123", "level": "warning", "score": 72, "peak_date": "2026-11-29",
  "reasons": ["2.1 m above the river", "180 m from the Kabul River", "Flooded in 2022"],
  "alert_key": "warning" }
```

## 7. `GET /api/replay?point=kabul_nowshera` (Part C)
The 2022 replay. Daily discharge from Aug 1 to Sep 15 2022, plus which houses were "underwater" each day.
```json
{ "days": [{ "date": "2022-08-26", "discharge": 1249.0, "level": "danger", "flooded_ids_count": 3120 }] }
```
(Per-day house flooding is worked out by the web app from `height_above_river_m` against the day's level, so the API only sends the river numbers.)

## 8. `shared/alerts.json` + `web/public/voice/` (Part D)
```json
{ "warning": {
    "ur": { "text": "...", "audio": "/voice/warning_ur.mp3" },
    "sd": { "text": "...", "audio": null },
    "pa": { "text": "...", "audio": null },
    "en": { "text": "...", "audio": "/voice/warning_en.mp3" } },
  "safe": {}, "watch": {}, "danger": {} }
```

## Colours (Part A owns the final palette, everyone uses these names)
`safe` green, `watch` yellow, `warning` orange, `danger` red.
