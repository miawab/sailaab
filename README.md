# Sailaab (سیلاب)

**Flood warnings for your house, not your district.**

In 2022, floods covered a third of Pakistan. The warnings that existed were district-wide text bulletins, written in English and sent too late. Sailaab tells one family whether **their own house** is at risk in the next 7 days and why, on a simple map and in a voice note in their own language.

**Live site:** https://sailaab-pk.vercel.app (add `?demo=1` to see the 2022 flood demo)

**Demo video:** _link added on submission_

## What it does
1. **Move the pin, tap "Safe here?"**: anywhere in Pakistan you get one answer (Safe / Watch / Warning / Danger) for the next 7 days, built from three checks:
   - **River**: the live GloFAS forecast at the nearest of 235 river points, against that river's own history
   - **Rain**: heavy-rain days ahead (Pakistan Met Department bands), with a "% sure" from 50 forecast runs
   - **Hills**: flash-flood risk where heavy rain meets steep ground
2. **Your house**: in Nowshera (KP) and Dadu (Sindh), all 44,000 buildings have their own level from height above the river, distance to it and whether they flooded in 2022.
3. **Hear it**: the warning as a short voice note in Urdu, Sindhi, Punjabi or English, saying what to do now.
4. **Air**: a second tab with the smog (PM2.5) forecast, because winter smog is Pakistan's other yearly emergency.
5. **Demo**: the Demo button at the bottom of the menu (or `?demo=1` on the link) opens a guided walkthrough that replays the real August 2022 floods, shows where our model was right and where it fell short, and plays the alert.

## Does it work? (our checks against 2022)
| Check | Result |
|---|---|
| Dadu, Johi flood channel | Crossed our Warning line on 17 Aug 2022, 10 days before its record peak on 27 Aug |
| Kabul River at Nowshera vs Federal Flood Commission gauges | Timing right (peak 28 Aug real, 30 Aug model), size too small (the model saw about a fifth of the real flow) |
| Blind house test, 44,000 houses | Houses we flag from height and distance alone really flooded 76% (Nowshera) and 62% (Dadu) of the time, against 46% and 39% for the rest |

Honest limits: the global river model covers big rivers only, free height data is rough (so we rank houses rather than promise depths), and the 50/30/20 weights were checked on 2022 only.

## How it works
```
GloFAS river forecast (Open-Meteo Flood API, free)  ─┐
Google Open Buildings (house footprints)            ─┼─► risk engine (/api) ─► map (web/) ─► voice alert
2022 flood extent (UNOSAT) + terrain elevation      ─┘
```

## Repo layout
| Folder | Owner | What's in it |
|---|---|---|
| `web/` | Part A | The website: Vite + React + MapLibre map, all UI/UX, the guided demo |
| `data/` | Part B | Python scripts that build the buildings + 2022 flood data files |
| `api/` | Part C | Vercel serverless functions: forecast + house risk |
| `voice/`, `pitch/` | Part D | Voice notes, alert text in 4 languages, deck, demo video |
| `shared/` | everyone | `CONTRACT.md` (data shapes everyone agrees on) + mock data |
| `docs/` | everyone | The plan and one brief per part |

Start with [docs/PLAN.md](docs/PLAN.md), then read your own part in `docs/parts/`.

## Run locally
```bash
cd web && npm install && npm run dev     # website on http://localhost:5173
npx vercel dev                           # website + /api together (from repo root)
```

## APIs, data and libraries used
(Every team member adds to this list when they add something.)

| Name | Used for | License / cost |
|---|---|---|
| [Open-Meteo Flood API](https://open-meteo.com/en/docs/flood-api) (GloFAS v4) | 7-day river discharge forecast + river history for the danger thresholds (data starts 1997) | Free, no key, CC BY 4.0 |
| [Open-Meteo Elevation API](https://open-meteo.com/en/docs/elevation-api) (Copernicus DEM 90 m) | Ground height for "tap anywhere" risk | Free, no key, CC BY 4.0 |
| [Google Open Buildings v3](https://sites.research.google/open-buildings/) | House footprints | CC BY 4.0 |
| [UNOSAT 2022 Pakistan flood extents](https://data.humdata.org/dataset/satellite-detected-water-extents-between-01-and-29-august-2022-over-pakistan) (HDX, event FL20220808PAK, VIIRS 1 Jul-31 Aug 2022) | 2022 flooded area, `flooded_2022` on each house | Free, CC BY-SA |
| [Copernicus DEM GLO-30](https://registry.opendata.aws/copernicus-dem/) (on AWS) | House ground height + height above the river (`data/`) | Free, no key, Copernicus licence (attribution) |
| [OpenStreetMap](https://www.openstreetmap.org/) via [Overpass API](https://overpass-api.de/) | River lines in the showcase districts + national rivers (Kabul, Swat, Gilgit...) | Free, ODbL |
| [Federal Flood Commission daily flood reports](https://ffc.gov.pk/) (Aug-Sep 2022) | Proof: real 2022 Kabul flows at Nowshera vs GloFAS | Public |
| [Copernicus EWDS](https://ewds.climate.copernicus.eu/) (GloFAS forecast archive) | Proof: forecasts issued in Aug 2022 (script ready, needs a free account) | Free account, CC BY 4.0 |
| geopandas, shapely, pyproj, rasterio, pandas, numpy, scipy, requests, s2sphere | Python data pipeline (`data/`) | BSD / MIT / Apache-2.0 |
| [MapLibre GL JS](https://maplibre.org/) | The map | BSD-3 |
| [OpenFreeMap](https://openfreemap.org/) (OpenStreetMap data) | Map tiles + fonts for our own Sailaab map style | Free, no key, ODbL (OSM) |
| [Open-Meteo Weather + Ensemble API](https://open-meteo.com/en/docs/ensemble-api) (ECMWF) | 7-day rain forecast, soil wetness, and the 50 forecast runs behind the rain "% sure" | Free, no key, CC BY 4.0 |
| [Open-Meteo Historical Forecast API](https://open-meteo.com/en/docs/historical-forecast-api) | Rain on the 2022 demo day | Free, no key, CC BY 4.0 |
| [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api) (Copernicus CAMS) | Smog (PM2.5) forecast for the Air mode | Free, no key, CC BY 4.0 |
| [Natural Earth](https://www.naturalearthdata.com/) | Pakistan outline + major river lines, place names for the national points | Public domain |
| [Google Fonts](https://fonts.google.com/) (Inter, Inter Tight, Noto Nastaliq Urdu, Noto Naskh Arabic) | Type, incl. Urdu and Sindhi | OFL |
| React, Vite | Website | MIT |
| [edge-tts](https://github.com/rany2/edge-tts) | Urdu + English voice notes (fallback when no human recording) | Free, LGPL-3.0 |
| [FFmpeg](https://ffmpeg.org/) | Cleans up phone recordings of the voice notes into mp3 | Free, LGPL/GPL |
| [Meta MMS-TTS Punjabi](https://huggingface.co/facebook/mms-tts-pan) via [Hugging Face Transformers](https://github.com/huggingface/transformers) + [PyTorch](https://pytorch.org/) | Punjabi voice notes (no Microsoft Punjabi voice exists). Runs offline, no key | Free; model CC-BY-NC 4.0, libraries Apache-2.0 / BSD |
| [Remotion](https://www.remotion.dev/) + [Playwright](https://playwright.dev/) | The demo video: Playwright records the real site, Remotion edits it with captions (`pitch/video/`) | Free (Remotion free licence for individuals), Playwright Apache-2.0 |
| Google Chrome (headless) | Exports the pitch deck slides to PDF (`pitch/deck/export.mjs`) | Free |
| Vercel | Hosting + API | Free tier |

## Team Puchkebataya
Built for the Capital Youth Expo 2026 Innovation Sprint. All core logic was written Nov 25-28, 2026.
