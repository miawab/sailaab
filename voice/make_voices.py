"""Make the Sailaab voice notes.

For every alert level (safe/watch/warning/danger) and language (ur/sd/pa/en):
  1. If a human recording exists in voice/recordings/ (e.g. warning_ur.m4a),
     clean it up with ffmpeg and use it. Real voices always win.
  2. Otherwise, if edge-tts has a voice for that language (Urdu, English),
     generate the note from the text in shared/alerts.json.
  3. Otherwise there is no audio and the app shows the text only.

Output goes to web/public/voice/{level}_{lang}.mp3, and the "audio" fields in
shared/alerts.json are updated to match.

Usage (from the repo root):
  python voice/make_voices.py              # recordings + edge-tts for the rest
  python voice/make_voices.py --male       # male edge-tts voices instead of female
  python voice/make_voices.py --only-recordings
"""

import argparse
import asyncio
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ALERTS = ROOT / "shared" / "alerts.json"
RECORDINGS = ROOT / "voice" / "recordings"
OUT = ROOT / "web" / "public" / "voice"

LEVELS = ["safe", "watch", "warning", "danger"]
LANGS = ["ur", "sd", "pa", "en"]
RECORDING_EXTS = [".m4a", ".mp3", ".wav", ".ogg", ".opus", ".aac", ".amr", ".mp4"]
MAX_SECONDS = 20

# edge-tts has no Sindhi or Punjabi voices, so those need human recordings.
TTS_VOICES = {
    "female": {"ur": "ur-PK-UzmaNeural", "en": "en-IN-NeerjaNeural"},
    "male": {"ur": "ur-PK-AsadNeural", "en": "en-IN-PrabhatNeural"},
}

# The text shows "1122", but people say it digit by digit.
SPOKEN_FIXES = {
    "ur": {"1122": "وَن وَن ٹُو ٹُو"},
    "en": {"1122": "one one two two"},
}


def have_ffmpeg():
    return shutil.which("ffmpeg") is not None and shutil.which("ffprobe") is not None


def duration_seconds(path):
    if not shutil.which("ffprobe"):
        return None
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
        capture_output=True, text=True,
    )
    try:
        return float(result.stdout.strip())
    except ValueError:
        return None


def find_recording(level, lang):
    for ext in RECORDING_EXTS:
        path = RECORDINGS / f"{level}_{lang}{ext}"
        if path.exists():
            return path
    return None


def convert_recording(src, dst):
    """Phone recording -> clean mono mp3: trim silence at both ends, even out loudness."""
    trim = ("silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.2,"
            "areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.3,"
            "areverse")
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(src),
         "-af", f"highpass=f=80,{trim},loudnorm=I=-16:TP=-1.5:LRA=11",
         "-ac", "1", "-ar", "44100", "-b:a", "96k", str(dst)],
        check=True,
    )


async def synthesize(text, voice, dst):
    import edge_tts  # imported here so --only-recordings works without it
    await edge_tts.Communicate(text, voice, rate="+0%").save(str(dst))


def spoken(text, lang):
    for written, said in SPOKEN_FIXES.get(lang, {}).items():
        text = text.replace(written, said)
    return text


async def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--male", action="store_true", help="use male edge-tts voices")
    parser.add_argument("--only-recordings", action="store_true", help="skip edge-tts")
    args = parser.parse_args()

    alerts = json.loads(ALERTS.read_text(encoding="utf-8"))
    OUT.mkdir(parents=True, exist_ok=True)
    RECORDINGS.mkdir(parents=True, exist_ok=True)
    voices = TTS_VOICES["male" if args.male else "female"]
    ffmpeg_ok = have_ffmpeg()
    report = []

    for level in LEVELS:
        for lang in LANGS:
            entry = alerts[level][lang]
            dst = OUT / f"{level}_{lang}.mp3"
            recording = find_recording(level, lang)

            if recording and ffmpeg_ok:
                convert_recording(recording, dst)
                source = f"recording ({recording.name})"
            elif recording:
                print(f"!! {recording.name} found but ffmpeg is missing, skipping it", file=sys.stderr)
                recording = None

            if not recording:
                if lang in voices and not args.only_recordings:
                    await synthesize(spoken(entry["text"], lang), voices[lang], dst)
                    source = f"edge-tts ({voices[lang]})"
                else:
                    if dst.exists():
                        dst.unlink()  # stale file from an earlier run
                    entry["audio"] = None
                    report.append((level, lang, "text only", None))
                    continue

            entry["audio"] = f"/voice/{dst.name}"
            report.append((level, lang, source, duration_seconds(dst)))

    ALERTS.write_text(json.dumps(alerts, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"{'note':<14}{'source':<38}length")
    for level, lang, source, secs in report:
        length = "-" if secs is None else f"{secs:4.1f}s" + ("  TOO LONG (max 20s)" if secs > MAX_SECONDS else "")
        print(f"{level + '_' + lang:<14}{source:<38}{length}")


if __name__ == "__main__":
    asyncio.run(main())
