"""Captions made on this computer with Whisper (faster-whisper, small.en model, MIT licence).

Whisper listens to each voiceover clip in public/vo-local/ and returns every word with its start
and end time. We give it the script line as a hint so names like Khabardar and Johi come out right,
then check what it heard against the script and print any differences.
The words are grouped into short caption lines (at most 7 words, breaking at punctuation and pauses).

Run from pitch/video after scripts/vo_local.py. Writes public/vo-local/captions.json:
  {"s0": [{"start": 0.0, "end": 1.4, "text": "Khabardar."}, ...], ...}   (seconds from the start of the clip)
"""
import json
import re
import subprocess
from pathlib import Path

import numpy as np

from faster_whisper import WhisperModel

DIR = Path("public/vo-local")
MAX_WORDS = 7

lines = json.loads((DIR / "lines.json").read_text(encoding="utf-8"))
model = WhisperModel("small.en", device="cpu", compute_type="int8")


def load(path):
    """mp3 -> 16 kHz mono float32, decoded by ffmpeg (what Whisper expects)."""
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", str(path), "-f", "f32le", "-ac", "1", "-ar", "16000", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32)


def norm(s):
    return re.sub(r"[^a-z0-9 ]", "", s.lower().replace("-", " ")).split()


captions, problems = {}, 0
for key, script in lines.items():
    segments, _ = model.transcribe(load(DIR / f"{key}.mp3"), language="en", word_timestamps=True,
                                   initial_prompt=script, beam_size=5, vad_filter=False)
    words = [w for seg in segments for w in seg.words]
    heard = " ".join(w.word.strip() for w in words)
    if norm(heard) != norm(script):
        problems += 1
        print(f"!! {key} differs from the script\n   script: {script}\n   heard:  {heard}")
    chunks, cur = [], []
    for i, w in enumerate(words):
        cur.append(w)
        nxt = words[i + 1] if i + 1 < len(words) else None
        ends_clause = re.search(r"[.?!,;:]$", w.word.strip()) is not None
        pause = nxt is not None and nxt.start - w.end > 0.35
        # don't strand 1-2 words: if the clause ends within the next two words, keep going
        soon = any(re.search(r"[.?!,;:]$", x.word.strip()) for x in words[i + 1:i + 3])
        full = len(cur) >= MAX_WORDS and not (soon and len(cur) < MAX_WORDS + 2)
        if nxt is None or full or (ends_clause and len(cur) >= 3) or pause:
            text = "".join(x.word for x in cur).strip().rstrip(",;:")
            chunks.append({"start": round(cur[0].start, 2), "end": round(cur[-1].end, 2), "text": text})
            cur = []
    captions[key] = chunks
    print(f"{key}: {len(words)} words, {len(chunks)} caption lines")

(DIR / "captions.json").write_text(json.dumps(captions, indent=1, ensure_ascii=False), encoding="utf-8")
print("all lines match the script" if not problems else f"{problems} line(s) differ, see above")
