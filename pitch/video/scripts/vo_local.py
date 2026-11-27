"""Voiceover made on this computer with Kokoro (an open 82M-parameter TTS model, Apache-2.0).

Same script as scripts/vo.py (public/vo/lines.json), plus line s9 for the 3D Dadu flyover.
Each line is read a little faster (at most 12%) when it is longer than the edge-tts line it
replaces; src/Local.tsx stretches the scenes for whatever is left.

Setup once (big, so use its own venv):
  python -m venv .venv-local && .venv-local/Scripts/pip install kokoro soundfile faster-whisper
Run from pitch/video:
  .venv-local/Scripts/python scripts/vo_local.py      then   .venv-local/Scripts/python scripts/captions_local.py
Writes public/vo-local/{id}.mp3, lines.json and durations.json.
"""
import json
import subprocess
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro import KPipeline

VOICE = "am_michael"   # American English, male
RATE = 24000
OUT = Path("public/vo-local")

lines = json.loads(Path("public/vo/lines.json").read_text(encoding="utf-8"))
target = json.loads(Path("public/vo/durations.json").read_text(encoding="utf-8"))
lines["s9"] = ("This is Dadu in 3D, on the twenty-seventh of August 2022, the day the Johi channel peaked. "
               "The blue is what satellites saw under water. Every house is coloured by its own risk.")

OUT.mkdir(parents=True, exist_ok=True)
tts = KPipeline(lang_code="a", repo_id="hexgrad/Kokoro-82M")


def speak(text, speed):
    parts = [audio.numpy() if hasattr(audio, "numpy") else np.asarray(audio)
             for _, _, audio in tts(text, voice=VOICE, speed=speed)]
    return np.concatenate(parts)


durations = {}
for key, text in lines.items():
    speed = 1.0
    wav = speak(text, speed)
    secs = len(wav) / RATE
    goal = target.get(key)
    if goal and secs > goal:  # too long for the footage: read it a little faster
        speed = min(secs / goal * 1.02, 1.12)
        wav = speak(text, speed)
        secs = len(wav) / RATE
    tmp = OUT / f"{key}.wav"
    sf.write(tmp, wav, RATE)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(tmp), "-ar", "44100", "-b:a", "128k", str(OUT / f"{key}.mp3")], check=True)
    tmp.unlink()
    durations[key] = round(secs, 2)
    print(f"{key}: {secs:5.2f}s (edge-tts {goal or '-'}s, speed {speed:.2f})")

(OUT / "lines.json").write_text(json.dumps(lines, indent=1, ensure_ascii=False), encoding="utf-8")
(OUT / "durations.json").write_text(json.dumps(durations, indent=1), encoding="utf-8")
