"""Rebuild every Part B file with one command:

    data/.venv/bin/python data/scripts/build_all.py

Downloads are cached in data/raw/, so a second run takes a few minutes and
costs no Open-Meteo quota. The first run takes ~1 hour (big building files,
plus Open-Meteo's free rate limit for the national points).
Proof 2 (s9_proof_forecasts.py) needs a free Copernicus account, so it isn't run here.
"""
import importlib
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

STEPS = [
    ("s1_buildings", "1. Buildings (Google Open Buildings)"),
    ("s2_rivers", "2. River lines (OpenStreetMap)"),
    ("s3_flood2022", "3. 2022 flood area (UNOSAT)"),
    ("s4_dem", "4. Ground height (Copernicus DEM)"),
    ("s5_river_points", "5. Showcase river points + thresholds (GloFAS)"),
    ("s7_houses", "7. Houses file"),
    ("s6_national", "6. National river points (GloFAS)"),
    ("s8_proof_ffc", "8. Proof: real 2022 flows (FFC) vs GloFAS"),
]

for mod, title in STEPS:
    t = time.time()
    print(f"\n== {title}")
    m = importlib.import_module(mod)
    (m.build if mod == "s5_river_points" else m.main)()
    print(f"   ({time.time() - t:.0f} s)")
print("\nAll done.")
