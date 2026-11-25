# Part C: Risk engine + API

**Your job:** the brain. You take the live river forecast and the house data and decide each house's risk. You own `api/`. These are Vercel serverless functions (Node.js), so they deploy with the website for free.

## Endpoints (exact shapes in `shared/CONTRACT.md`)
1. **`/api/forecast?point=ID`:** calls `https://flood-api.open-meteo.com/v1/flood?latitude=..&longitude=..&daily=river_discharge,river_discharge_max&forecast_days=7`. Each day gets a level compared with the point's thresholds from `shared/river_points.json`:
   - under p90 → `safe`, p90-p99 → `watch`, p99 to 2022 peak → `warning`, over 2022 peak → `danger`
   - Cache the response for 1 hour (`Cache-Control: s-maxage=3600`).
2. **`/api/house?id=ID`:** looks up the house in `web/public/data/houses.geojson` and gets its river point's forecast. `score = river_severity (0..1) × exposure (0..1) × 100`, mapped to a level. Returns 3 plain-language reasons ("2.1 m above the river", "Flooded in 2022"...). Writing these well matters, because the judges will read them.
3. **`/api/replay?point=ID`:** daily discharge for Aug 1 - Sep 15 2022 from the same API (`start_date` / `end_date`), with a level per day. This drives the replay.
3b. **`/api/national`:** current worst level for every point in `national_points.geojson`. Use Open-Meteo's multi-location request (comma-separated lat/lon lists) so it's a few calls, not 300, and cache for 3 hours.
3c. **`/api/risk?lat&lon`:** risk for ANY spot in Pakistan. Nearest national point → its forecast; ground height at the spot (Open-Meteo's free Elevation API, `api.open-meteo.com/v1/elevation`) minus the river point's height → exposure. Same reply shape as `/api/house`. This is what makes it "all of Pakistan".
4. **Demo mode:** `?demo=1` on any endpoint pretends today is 2022-08-25, so we can show a real WARNING on stage even though the rivers are calm in November. **This is important.** The live river is "safe" right now and that's a boring demo.

## Also
- Write `api/README.md` explaining the risk formula in 5 lines. It's the first thing judges will ask about ("how do you calculate risk?").
- Sanity check: does the 2022 replay mark houses as `danger` around Aug 26-30? If not, tune the thresholds with Part B.
- Handle errors: if Open-Meteo is down, return the last cached data with `"stale": true` instead of crashing.

## Done when
- [ ] All 3 endpoints live on the Vercel deployment and matching CONTRACT.md
- [ ] `?demo=1` gives a convincing warning
- [ ] Risk formula explained in `api/README.md`

## Paste this to your Claude
> I'm Part C on the Sailaab hackathon team (repo cloned here). Read CLAUDE.md, docs/PLAN.md, shared/CONTRACT.md and docs/parts/C-risk-api.md. I own api/ (Vercel serverless functions in Node). Build /api/forecast first, then /api/replay, then /api/house, then demo mode. Use shared/mock/ data until Part B's real files land. Explain the logic simply because I'll be asked about it in the pitch.
