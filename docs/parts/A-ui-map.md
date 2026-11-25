# Part A: UI/UX + 3D map (Ibrahim)

**Your job:** make it look unreal. Judges remember the 3D map and the replay. You own `web/`.

## Stack
Vite + React (JavaScript) + MapLibre GL JS (free, no key). 3D terrain from AWS Terrain Tiles (terrarium format). Free basemap: OpenFreeMap or MapTiler free styles (check the terms). Charts: Recharts or plain SVG. Animations: Framer Motion.

## What to build (in order)
1. **Set up** `web/` (`npm create vite@latest web -- --template react`), plus `vercel.json` at the repo root (build `web`, output `web/dist`, keep `/api`).
2. **National 3D map:** dark, cinematic, all of Pakistan with terrain (exaggeration about 1.5) and a sky/fog layer. The rivers and the `national_points` glow in their risk colour from `/api/national`. **Tap anywhere** → `/api/risk?lat&lon` → the same risk card as a house. A "Showcase districts" button flies the camera into Nowshera.
3. **Houses in 3D:** `fill-extrusion` from `houses.geojson`, coloured by risk level. Hovering highlights a house, clicking selects it.
4. **House card** (bottom sheet on mobile, side panel on desktop): big risk badge, peak date, the 3 "why" reasons, a 7-day river chart with threshold lines, and a play button for the voice note, plus a language switch (اردو / سنڌي / پنجابی / English).
5. **Replay 2022 mode:** a timeline slider from Aug 1 to Sep 15 2022 with play/pause. A water layer rises (houses whose `height_above_river_m` is below the day's level turn blue/red), the 2022 extent fades in, and a discharge graph draws as it plays. This is the money shot.
6. **Search:** "find my house" by tapping or using the GPS location button.
7. **Landing screen:** one line ("Flood warnings for your house, not your district") plus a "See my risk" button.
8. **Polish:** loading states, Urdu text right-to-left with a nice Urdu font (Noto Nastaliq Urdu), mobile layout, no console errors.

## Inputs (until real data lands, use `shared/mock/`)
`houses.geojson`, `flood2022.geojson`, `rivers.geojson`, `/api/forecast`, `/api/house`, `/api/replay`, `alerts.json`. See `shared/CONTRACT.md`.

## Done when
- [ ] Live on Vercel, loads in under 5 s, works on a phone
- [ ] Fly-in, 3D houses, click a house → card with real API data + voice
- [ ] 2022 replay plays smoothly end to end
- [ ] Looks good enough to screenshot for the deck

## Paste this to your Claude
> I'm Part A on the Sailaab hackathon team (repo cloned here). Read CLAUDE.md, docs/PLAN.md, shared/CONTRACT.md and docs/parts/A-ui-map.md. I own web/. Build it in the order listed, on mock data from shared/mock/ until the real files exist. I care most about the UI/UX and the 3D map looking amazing. Explain each piece before you build it.
