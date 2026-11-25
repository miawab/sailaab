# Sailaab (سیلاب)

**Flood warnings for your house, not your district.**

In 2022, floods covered a third of Pakistan. The warnings that existed were district-wide text bulletins, written in English and sent too late. Sailaab tells one family whether **their own house** is at risk in the next 7 days and why. It does this with a 3D map and a voice note in their own language.

## What it does
0. **All of Pakistan, live:** a 3D map of the country with every major river coloured by its 7-day flood forecast. Tap **anywhere** in Pakistan to get the risk for that exact spot.
1. **Search or tap your house:** in the showcase districts (Nowshera / Charsadda first, then Dadu in Sindh), every building is shown in 3D with its own risk. The same pipeline extends district by district to the whole country.
2. **Get your risk level** (Safe / Watch / Warning / Danger) for the next 7 days. It combines a live river forecast with how exposed your house is (height above the river, distance to it, whether it flooded in 2022).
3. **Hear it**: a short voice note in Urdu (text in Urdu, Sindhi, Punjabi, English) that says what to do and where to go.
4. **Replay 2022**: watch the 2022 flood rise day by day over the real buildings, so people understand the warning is real.

## How it works
```
GloFAS river forecast (Open-Meteo Flood API, free)  ─┐
Google Open Buildings (house footprints)            ─┼─► risk engine (/api) ─► 3D map (web/) ─► voice alert
2022 flood extent (UNOSAT) + terrain elevation      ─┘
```

## Repo layout
| Folder | Owner | What's in it |
|---|---|---|
| `web/` | Part A | The website: Vite + React + MapLibre 3D map, all UI/UX |
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
| [Open-Meteo Flood API](https://open-meteo.com/en/docs/flood-api) (GloFAS v4) | 7-day river discharge forecast + 1984-today history | Free, no key, CC BY 4.0 |
| [Google Open Buildings v3](https://sites.research.google/open-buildings/) | House footprints | CC BY 4.0 |
| [UNOSAT 2022 Pakistan flood extents](https://data.humdata.org/) (HDX) | 2022 flooded area | Free, attribution |
| [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) | 3D terrain + house elevation | Free |
| [MapLibre GL JS](https://maplibre.org/) | 3D map | BSD-3 |
| React, Vite | Website | MIT |
| [edge-tts](https://github.com/rany2/edge-tts) | Urdu voice notes | Free |
| Vercel | Hosting + API | Free tier |

## Team Puchkebataya
Built for the Capital Youth Expo 2026 Innovation Sprint. All core logic was written Nov 25-28, 2026.
