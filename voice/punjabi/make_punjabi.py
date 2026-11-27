"""Make Punjabi voice notes with Meta's MMS-TTS Punjabi model (facebook/mms-tts-pan).

The model reads Gurmukhi only, so the audio is made from the same Punjabi words
written in Gurmukhi (pa_gurmukhi.json). The site still shows the Shahmukhi text.

Model: https://huggingface.co/facebook/mms-tts-pan (Meta MMS, CC-BY-NC 4.0, runs offline, no key).

Setup (once, in its own environment because PyTorch is big):
  python -m venv voice/punjabi/.venv
  voice/punjabi/.venv/Scripts/pip install torch --index-url https://download.pytorch.org/whl/cpu
  voice/punjabi/.venv/Scripts/pip install transformers scipy

Usage (from the repo root):
  voice/punjabi/.venv/Scripts/python voice/punjabi/make_punjabi.py   # all four levels
  python voice/make_voices.py                                        # then build the mp3s

Writes voice/tts/{level}_pa.wav. make_voices.py turns those into the site's mp3s.
If someone records real Punjabi notes in voice/recordings/, those win.
"""
import json
import sys
import unicodedata
from pathlib import Path

import scipy.io.wavfile
import torch
from transformers import AutoTokenizer, VitsModel

sys.stdout.reconfigure(encoding="utf-8")
MODEL = "facebook/mms-tts-pan"

HERE = Path(__file__).resolve().parent
texts = json.loads((HERE / "pa_gurmukhi.json").read_text(encoding="utf-8"))
out_dir = HERE.parent / "tts"
out_dir.mkdir(exist_ok=True)
levels = sys.argv[1:] or ["safe", "watch", "warning", "danger"]

tok = AutoTokenizer.from_pretrained(MODEL)
model = VitsModel.from_pretrained(MODEL)
vocab = tok.get_vocab()


def fit_to_vocab(text):
    """Keep letters the model knows; split unknown ones (e.g. ਜ਼ -> ਜ + dot) and keep the known parts."""
    out, dropped = [], set()
    for ch in unicodedata.normalize("NFC", text.lower()):
        if ch in vocab or ch == " ":
            out.append(ch)
            continue
        parts = [p for p in unicodedata.normalize("NFD", ch) if p in vocab]
        if not parts:
            dropped.add(ch)
        out.extend(parts)
    return "".join(out), dropped


for level in levels:
    clean, dropped = fit_to_vocab(texts[level])
    ids = tok(clean, return_tensors="pt")
    torch.manual_seed(0)  # same voice every run
    with torch.no_grad():
        wav = model(**ids).waveform[0].numpy()
    out = out_dir / f"{level}_pa.wav"
    scipy.io.wavfile.write(out, model.config.sampling_rate, wav)
    secs = len(wav) / model.config.sampling_rate
    print(f"{level:8} {secs:5.1f}s  dropped: {' '.join(sorted(dropped)) or '-'}  -> {out.name}")
