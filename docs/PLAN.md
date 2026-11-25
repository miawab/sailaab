# Sailaab: the whole plan

## Rules that can disqualify us (read these)
- Due **Sat Nov 28, 11:59 PM**. We submit at **9 PM** so we have buffer.
- We need: this **public repo** with a README that lists every API/library, a **live link**, a **demo video of 2 minutes or less**, and a **pitch deck** (PDF/PPTX).
- All core logic must be written during the hackathon. Don't paste in old projects.
- Finale + live pitch on **Wed Dec 2**, Pak-China Friendship Center. Everyone brings their **original student card** + QR pass.
- No paid APIs and no keys in the repo. Everything we use is free.

## The demo story (everything we build serves this 2-minute video)
1. Hook (0:00-0:15): footage/stat of the 2022 floods. "The warnings were for districts. Water doesn't flood districts, it floods houses."
2. Open Sailaab: **all of Pakistan** in 3D, every big river glowing in its forecast colour. Tap a random village in Punjab → its risk shows instantly. Then the camera flies into Nowshera, where every house is extruded in 3D.
3. **Replay 2022**: hit play, the slider runs Aug 20 → Sep 2 2022, the river level graph climbs and houses turn red one by one.
4. **Your house**: tap a house (or search). A card slides up: "WARNING: high risk in 3 days". It shows why (2.1 m above river, 180 m from river, flooded in 2022) and a 7-day river chart.
5. **Voice note** plays in Urdu: "your area's river is rising, move valuables up, the nearest safe place is X". Language switch: Urdu / Sindhi / Punjabi / English.
6. Close: "Built on free global data, so it works for every house in Pakistan. Next: SMS/WhatsApp alerts with PDMA."

## Scope: all of Pakistan, two zoom levels
- **National (whole country):** river forecast points along every major river (Indus, Jhelum, Chenab, Ravi, Sutlej, Kabul, Swat...), coloured by risk. Tapping any spot gives a risk from the nearest river's forecast plus the ground height there (from the terrain). This works everywhere from day 1.
- **House level (showcase districts):** every building in 3D with its own risk. We start with Nowshera/Charsadda, then add Dadu (Sindh) if there's time. On stage: "we did 2 districts in 3 days with one pipeline; every other district is the same script."

## How the parts fit
```
data/ (B)  ──builds──►  web/public/data/*.geojson   (houses + 2022 flood + river line)
api/  (C)  ──serves──►  /api/forecast, /api/house    (live risk, uses B's files)
voice/(D)  ──makes──►   web/public/voice/*.mp3 + shared/alerts.json
web/  (A)  ──shows──►   everything above, as the 3D map + cards + replay
```
**Everyone works in parallel from day 1** because `shared/CONTRACT.md` fixes every data shape and `shared/mock/` has fake data in those shapes. Part A builds the UI on mocks. B and C swap the mocks for real data. If a shape has to change, change CONTRACT.md first and tell the group.

## Timeline
| When | Goal |
|---|---|
| **Wed Nov 25 (tonight)** | Everyone: clone, read your part, give your Claude the brief. Team lead registers the team + picks the **Climate** track on hh.etlonline.org. B confirms the data covers Nowshera. |
| **Thu Nov 26** | Each part works alone on mock data. By night: A has the 3D map + house card, B has real houses file, C has /api/forecast live, D has Urdu voice notes. |
| **Fri Nov 27** | **Join everything.** Deploy to Vercel. Replay 2022 works end to end. D drafts the deck + video script. Bug list. |
| **Sat Nov 28** | Polish until 5 PM. Record video 5-7 PM. Final README + deck. **Submit by 9 PM.** |
| Nov 29 - Dec 1 | Practice the live pitch (3 min + Q&A). |

## Git rules (to stop us breaking each other's work)
- Only edit your own folder. `shared/` changes get announced in the group.
- `git pull` before you start, commit small, push often. Message like `api: add house risk`.
- Never commit `.env`, keys or big raw downloads (`data/raw/` is ignored).
- If you're stuck for 30+ minutes, say so in the group.

## Parts
- [A: UI/UX + 3D map](parts/A-ui-map.md) (Ibrahim)
- [B: Data pipeline](parts/B-data.md)
- [C: Risk engine + API](parts/C-risk-api.md)
- [D: Voice alerts + pitch](parts/D-voice-pitch.md)
