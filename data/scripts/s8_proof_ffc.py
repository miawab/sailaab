"""Proof 1: real 2022 river flow at Nowshera (Pakistan's Federal Flood
Commission) vs what GloFAS says for the same days.

The FFC posts a Daily Flood Situation Report (DFSR) PDF each day at
ffc.gov.pk. Its table "River Flow Situation" gives the Kabul River at
Nowshera at 06:00 in cusecs (cubic feet per second). We download every
report from 1 Aug to 15 Sep 2022, read the Nowshera number, convert to m3/s
(1 cusec = 0.0283168 m3/s) and put it next to GloFAS's daily flow.

Output: web/public/data/proof_kabul_nowshera.json and data/proof/ffc_vs_glofas_nowshera.csv
"""
import csv
import datetime as dt
import re
import subprocess

from common import RAW, OUT, ROOT, get, write_json
from glofas import discharge

CUSEC = 0.0283168
PDF_DIR = RAW / "ffc_dfsr"
PDF_DIR.mkdir(parents=True, exist_ok=True)
URL = "https://ffc.gov.pk/wp-content/uploads/2022/{mm}/DFSR-{dd}-{m2}-2022.pdf"
CLASS = r"(?:Low|Med|Medium|High|V\.\s*High|Very\s*High|Ex\.\s*High|Exceptionally\s*High|Normal|Below)"
ROW = re.compile(r"^[ \t\uf0b7•]*Nowshera\s+(.*)$", re.M)  # rows start with a bullet character


def fetch_pdf(day):
    f = PDF_DIR / f"DFSR-{day:%d-%m}-2022.pdf"
    if f.exists():
        return f if f.stat().st_size > 1000 else None
    # Reports are usually filed in that month's upload folder, sometimes the next.
    for mm in sorted({f"{day:%m}", f"{(day + dt.timedelta(days=5)):%m}"}):
        try:
            r = get(URL.format(mm=mm, dd=f"{day:%d}", m2=f"{day:%m}"), tries=2, timeout=60)
            if r.content[:4] == b"%PDF":
                f.write_bytes(r.content)
                return f
        except Exception:  # noqa: BLE001
            pass
    f.write_bytes(b"")  # remember it's missing
    return None


def nowshera_flow(pdf):
    text = subprocess.run(["pdftotext", "-layout", str(pdf), "-"], capture_output=True, text=True).stdout
    for m in ROW.finditer(text):
        hit = re.search(r"([\d,]{4,})\s+" + CLASS, m.group(1))
        if hit:
            return int(hit.group(1).replace(",", ""))
    return None


def main():
    days = [dt.date(2022, 8, 1) + dt.timedelta(days=i) for i in range(46)]
    ffc = {}
    for d in days:
        pdf = fetch_pdf(d)
        q = nowshera_flow(pdf) if pdf else None
        if q:
            ffc[d.isoformat()] = q
    print(f"  FFC reports with a Nowshera reading: {len(ffc)} of {len(days)} days")

    g = discharge([(34.025, 71.975)], "2022-08-01", "2022-09-15")[0]
    glofas = dict(zip(g["time"], g["q"]))

    rows = []
    for d in days:
        k = d.isoformat()
        cus = ffc.get(k)
        rows.append({"date": k, "ffc_cusecs": cus,
                     "ffc_m3s": round(cus * CUSEC, 1) if cus else None,
                     "glofas_m3s": round(glofas[k], 1) if glofas.get(k) is not None else None})
    out_csv = ROOT / "data" / "proof" / "ffc_vs_glofas_nowshera.csv"
    out_csv.parent.mkdir(parents=True, exist_ok=True)
    with open(out_csv, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)

    both = [r for r in rows if r["ffc_m3s"] and r["glofas_m3s"]]
    ffc_peak = max(both, key=lambda r: r["ffc_m3s"])
    gl_peak = max(both, key=lambda r: r["glofas_m3s"])
    # Pearson correlation of the day-to-day shape
    xs, ys = [r["ffc_m3s"] for r in both], [r["glofas_m3s"] for r in both]
    mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
    cov = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    corr = cov / ((sum((x - mx) ** 2 for x in xs) * sum((y - my) ** 2 for y in ys)) ** 0.5)
    summary = {
        "point": "kabul_nowshera",
        "source": "Federal Flood Commission Daily Flood Situation Reports (06:00 readings), ffc.gov.pk",
        "days_compared": len(both),
        "ffc_peak": {"date": ffc_peak["date"], "m3s": ffc_peak["ffc_m3s"], "cusecs": ffc_peak["ffc_cusecs"]},
        "glofas_peak": {"date": gl_peak["date"], "m3s": gl_peak["glofas_m3s"]},
        "glofas_over_real_at_peak": round(gl_peak["glofas_m3s"] / ffc_peak["ffc_m3s"], 2),
        "correlation": round(corr, 2),
        "days": rows,
    }
    write_json(OUT / "proof_kabul_nowshera.json", summary, indent=1)
    print(f"  real peak {ffc_peak['ffc_m3s']:.0f} m3/s on {ffc_peak['date']}, GloFAS peak {gl_peak['glofas_m3s']:.0f} "
          f"on {gl_peak['date']} (GloFAS = {summary['glofas_over_real_at_peak']}x real), shape correlation {corr:.2f}")


if __name__ == "__main__":
    main()
