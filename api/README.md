# Sailaab API (Part C): the risk engine

## How we calculate risk (the 5-line version)
1. **River forecast:** every day we get the 7-day river discharge forecast (m³/s) from GloFAS via the free Open-Meteo Flood API.
2. **River level:** we compare it with that river's own history (1984-2021). Top 10% of days = **watch**, top 1% = **warning**, 90% of the 2022 flood peak or more = **danger**.
3. **House exposure (0-1):** how low the house sits above the river (50%), how close it is (30%), and whether it flooded in 2022 (20%).
4. **House score = river severity (0-1) × exposure (0-1) × 100**, for each of the 7 days. 75+ = danger, 50+ = warning, 25+ = watch.
5. So when the river rises, the low house by the bank turns red first, and the house on high ground 1 km away stays green. That's the difference from a district warning.

**2022 check** (with the mock thresholds; re-run when Part B's real ones land): replaying the real Kabul River at Nowshera gives **danger from 27 Aug to 9 Sep 2022**. Nowshera was flooded in the last days of August.

## Endpoints
| URL | What it gives |
|---|---|
| `/api/forecast?point=kabul_nowshera` | 7 days of discharge + river level per day + worst day |
| `/api/replay?point=kabul_nowshera` | Real daily discharge 1 Aug-15 Sep 2022 with levels (drives the replay slider) |
| `/api/house?id=h_000001` | One house: level, score, dates, 3 plain-language reasons, per-day levels |
| `/api/national` | Worst level this week for every river point in Pakistan (colours the national map) |
| `/api/risk?lat=34.02&lon=71.97` | Risk for **any spot in Pakistan**, same shape as `/api/house` |
| add `&demo=1` to any of these (not replay) | Pretends today is **25 Aug 2022** so the stage demo shows a real warning |

Shapes match `shared/CONTRACT.md`. Extra fields for Part A:
- `first_date` (house, risk): first day the house **reaches** its level. Use this for "DANGER in N days". `peak_date` is the worst day. `first_date` is `null` when the level is safe.
- `days` (house, risk): `[{ date, discharge, river_level, score, level }]` for the 7-day chart. For spots more than 10 km from a major river, `/api/risk` answers `safe` straight away with `days: []` and `peak_date: null`.
- `river`, `point` (house, risk); `exposure` (house); `height_above_river_m` (risk; `null` if unknown or far from a river).
- `level: null` + `no_data: true` (national): we have no river data there. Show it grey, not green.
- `stale: true`: Open-Meteo was down, this is the last good data. `demo: true`: demo mode.
- `thresholds` (replay). Replay has no `flooded_ids_count`; the web works that out from house heights (as the contract note says).
- Forecast `days` can be shorter than 7 if Open-Meteo is missing a day (it never invents numbers).

## Details
- **River severity (0-1)** is a smooth version of the level: 0 m³/s → 0, p90 → 0.3, p99 → 0.6, danger line → 0.9, 2022 peak → 1, with straight lines in between.
- **Why houses can be one level above the river:** a house right on the bank (exposure ~1) scores higher than the river level alone. For example, river at "warning" near the top of its band → bank house at "danger". This is on purpose: the lowest houses flood first, so they get warned first. Houses on high ground score lower than the river.
- **Why 90% of the 2022 peak, not 100%?** `peak_2022` is the single highest day of 2022. If danger meant "above it", even 2022 itself would never show danger. Danger is also always at least 10% above p99, so there's always a warning band.
- **No-data points:** if a point's biggest days are under 10 m³/s, it isn't on a real river (GloFAS cell off the channel), so we don't rate it.
- **Exposure** comes from Part B's `houses.geojson`. If a house has none, we compute it with the formula in step 3 (0 m above river = 1, 10 m+ = 0; 0 m away = 1, 2 km+ = 0).
- **Any spot (`/api/risk`):** river points on the same river are numbered in order (`indus_014`, `indus_015`), so we join neighbours with straight lines (not if they're over 60 km apart). We take the nearest line, use the forecast of its nearer end, and compare the ground height at the spot (Open-Meteo Elevation API) with the river's height there (a blend of the two ends' heights). We don't know if a random spot flooded in 2022, so exposure uses only height (5/8) and distance (3/8). More than 10 km from a major river = safe. Heights below the river count as 0.
- **National map:** asks Open-Meteo about 50 points per request, all requests at once, so ~250 points = 5 parallel requests.
- **Caching:** the Vercel CDN keeps forecasts 1 hour, national 3 hours, replay 1 day. Each server also keeps answers in memory (1 hour; national 3 hours; heights 1 day), and identical requests at the same moment share one call. Calls time out after 5 s.
- **When Open-Meteo is down or sends junk:** we serve the last good answer with `stale: true`. A saved copy of Aug-Sep 2022 at Nowshera (`_lib/snapshot_2022.json`) means demo mode and the replay work even with no answer at all. Live mode with nothing saved returns a clear error, never made-up numbers.
- **Data:** real files (`shared/river_points.json`, `web/public/data/*.geojson`) are used when they exist, otherwise `shared/mock/`.

## Limitations (say these before the judges do)
- **Major rivers only.** GloFAS works on a ~5 km grid, so small streams and nullahs aren't covered.
- **River floods only.** No rain flooding (urban drainage), flash floods, dam releases or embankment breaches.
- **Heights are approximate.** Free terrain data is 30-90 m resolution and off by a few metres, which is why we say "about 1 m" and not "1.2 m".
- **The weights (50/30/20) are our choice**, checked against 2022 at one river, not fitted on lots of floods. With more time: tune them on every 2022 district.
- **Tap-anywhere distance** is to a straight line between river points ~25 km apart, not the real winding channel, so it can be off by a few km. The showcase districts use the real river lines.
- **GloFAS forecasts are uncertain**, more so for days 5-7. A warning means "get ready", not "certain to flood".

## Run locally
```bash
node api/_dev-server.js
# http://localhost:3001/api/forecast?point=kabul_nowshera&demo=1
# http://localhost:3001/api/house?id=h_000001&demo=1
# http://localhost:3001/api/replay
# http://localhost:3001/api/national?demo=1
# http://localhost:3001/api/risk?lat=34.02&lon=71.97&demo=1
```

## Deploying (needs the group)
The Vercel project must be rooted at the **repo root** (not `web/`), or the `api/` folder isn't deployed. The build command and output folder (`web/dist`) go in a root `vercel.json` or the Vercel dashboard. Part B's data files must be committed so they're bundled with the functions.

## Files
- `forecast.js`, `replay.js`, `house.js`, `national.js`, `risk.js`: the endpoints
- `_lib/risk.js`: all the risk maths (levels, severity, exposure, scores, reasons)
- `_lib/geo.js`: finds the nearest river line to any spot
- `_lib/openmeteo.js`: Open-Meteo calls (flood + elevation), caching, fallbacks
- `_lib/data.js`: loads Part B's files (or mocks)
- `_lib/common.js`: demo mode, JSON replies, the shared 7-day forecast
- `_lib/snapshot_2022.json`: saved Aug-Sep 2022 discharge at Nowshera (offline demo)
- `package.json`: pins CommonJS so a root `"type": "module"` can't break these files
