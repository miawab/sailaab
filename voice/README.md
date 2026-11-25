# voice/ (Part D)

Sailaab sends a short voice note with every alert, in 4 languages, so people who can't read still get the warning.

## What's here
| File | What it does |
|---|---|
| `../shared/alerts.json` | The alert text: 4 levels (safe / watch / warning / danger) × 4 languages (ur / sd / pa / en). The website reads this. |
| `make_voices.py` | Turns that text into `web/public/voice/{level}_{lang}.mp3` and fills in the `audio` paths in `alerts.json`. |
| `recordings/` | Drop real human recordings here. They replace the computer voice. |

## How `make_voices.py` picks the audio for each note
1. **Real recording** in `recordings/` (e.g. `warning_ur.m4a`)? Use it. ffmpeg cuts the silence at the start and end, evens out the volume and saves it as mp3.
2. Otherwise, **edge-tts** (free Microsoft neural voices) reads the text. It only has Urdu and English, not Sindhi or Punjabi.
3. Otherwise there's **no audio** (`"audio": null`) and the app shows the text only.

Run it from the repo root after any change to the text or recordings:
```bash
pip install edge-tts          # ffmpeg also needs to be installed for recordings
python voice/make_voices.py   # add --male for male computer voices
```
It prints every note with its length and flags any over 20 seconds.

## Recording the voice notes
- Name each file `{level}_{lang}` plus any extension: `danger_ur.m4a`, `watch_sd.opus`. A WhatsApp voice note you send to yourself and save works fine.
- Read the text from `shared/alerts.json` word for word, calmly and clearly, like you're sending a voice note to a relative. Each note must be **under 20 seconds**.
- Record in a quiet room, with the phone about 20 cm from your mouth.
- Sindhi and Punjabi need native speakers. Ask them to fix the wording first if anything sounds unnatural (then update `alerts.json`).

## Where the advice comes from
The steps follow the standard flood "do's and don'ts" that NDMA and the PDMAs publish (ndma.gov.pk):
- Keep documents in a waterproof bag.
- Keep a bag ready with medicines, water and dry food.
- Keep your phone charged.
- Move valuables and animals to higher ground.
- Follow evacuation orders from the district administration.
- Switch off the electricity and gas before you leave.
- Never walk or drive through flowing water.
- Call Rescue 1122 for help.

Check each line against NDMA's current page before the pitch, and cite it on the deck.

## Still to do
- [ ] Native speakers check the Urdu, Sindhi and Punjabi text (the drafts were written with AI help)
- [ ] Record the notes (at least Urdu + English; Sindhi and Punjabi if we find speakers)
- [ ] Re-run `make_voices.py` and commit the mp3s
