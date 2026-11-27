"""Subtitle file for YouTube from the local captions: out/khabardar-local.srt.

Whisper's times (public/vo-local/captions.json) are from the start of each voice clip; the voice starts
0.3 s into its scene, and the scenes run in the order of public/vo-local/scenes.json.
Run from pitch/video:  python scripts/srt_local.py
"""
import json
from pathlib import Path

VO_DELAY = 0.3
scenes = json.loads(Path("public/vo-local/scenes.json").read_text(encoding="utf-8"))
captions = json.loads(Path("public/vo-local/captions.json").read_text(encoding="utf-8"))


def stamp(t):
    ms = round(t * 1000)
    return f"{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02},{ms % 1000:03}"


out, n, t0 = [], 0, 0.0
for sc in scenes:
    lines = captions.get(sc["id"], [])
    for i, line in enumerate(lines):
        end = min(lines[i + 1]["start"] if i + 1 < len(lines) else line["end"] + 0.5, sc["len"] - VO_DELAY)
        n += 1
        out.append(f"{n}\n{stamp(t0 + VO_DELAY + line['start'])} --> {stamp(t0 + VO_DELAY + end)}\n{line['text']}\n")
    t0 += sc["len"]

Path("out").mkdir(exist_ok=True)
Path("out/khabardar-local.srt").write_text("\n".join(out), encoding="utf-8")
print(f"{n} subtitles, video length {t0:.1f} s -> out/khabardar-local.srt")
