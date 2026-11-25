# Part D: Voice alerts + pitch

**Your job:** make it human and make us win. You own `voice/`, `pitch/` and `shared/alerts.json`. You also own the submission checklist.

## 1. Alert messages (Thu)
- Write a short message (2-3 sentences) for each level: safe / watch / warning / danger. Each one says what's happening, what to do now (move valuables, documents, animals up, charge the phone) and where to go (nearest high ground or relief point). Base the advice on NDMA/PDMA flood guidance.
- Translate into **Urdu, Sindhi, Punjabi and English**. Get a native speaker to check them, not just an AI.
- Save as `shared/alerts.json` (shape in CONTRACT.md).

## 2. Voice notes (Thu)
- Use `edge-tts` (free Python tool: `pip install edge-tts`). Urdu voices: `ur-PK-UzmaNeural`, `ur-PK-AsadNeural`. Check whether it has Sindhi or Punjabi voices. If not, record them yourselves on a phone (it sounds more real anyway) or leave text only.
- Write `voice/make_voices.py` to generate `web/public/voice/{level}_{lang}.mp3`. Keep each note under 20 seconds and make it sound like a WhatsApp voice note.

## 3. Pitch deck (Fri-Sat), saved as `pitch/Sailaab.pdf`
About 8 slides: Problem (2022: 33M people affected, warnings at district level) → Solution → Live demo screenshot → How it works (the data diagram) → Why it's real (free global data, scales to every house) → Impact + next steps (WhatsApp/SMS with PDMA, more districts) → Team. Get the final screenshots from Part A. Check every statistic and cite its source.

## 4. Demo video (Sat 5-7 PM), 2:00 max
Follow the "demo story" in `docs/PLAN.md`. Screen-record the live site (OBS is free), voice-over in English, captions on. Upload to YouTube (unlisted) and put the link in the README.

## 5. Submission checklist (you own this)
- [ ] Team registered on hh.etlonline.org, Climate track picked
- [ ] Repo public, README complete (every API/library listed)
- [ ] Live link works on a phone and in incognito
- [ ] Video ≤ 2:00, link in README
- [ ] Deck PDF in `pitch/` + uploaded
- [ ] **Submitted by 9 PM Sat Nov 28**
- [ ] Dec 2: everyone has their original student card + QR pass. Pitch practised 3 times.

## Paste this to your Claude
> I'm Part D on the Sailaab hackathon team (repo cloned here). Read CLAUDE.md, docs/PLAN.md, shared/CONTRACT.md and docs/parts/D-voice-pitch.md. I own voice/, pitch/ and shared/alerts.json. Start with the alert messages in 4 languages, then the edge-tts voice script. Later help me with the pitch deck and the 2-minute video script.
