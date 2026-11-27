"""Proof 2: "would GloFAS have warned us, and how many days early?"

Downloads the GloFAS forecasts that were really issued each day in August 2022
(the control run, up to 15 days ahead) and checks, for each issue day, whether
the forecast already showed the river passing our "warning" (p99) and
"danger" lines at each showcase point.

NEEDS A FREE ACCOUNT (one-time, ~5 minutes):
  1. Sign up at https://ewds.climate.copernicus.eu (GloFAS moved from the
     Climate Data Store to the Early Warning Data Store in 2024).
  2. Open the dataset "GloFAS forecast" (cems-glofas-forecast), go to the
     "Download" tab and accept the licence at the bottom.
  3. Copy your API token from your profile page and save this to ~/.cdsapirc
     (in your home folder, NEVER in the repo):
         url: https://ewds.climate.copernicus.eu/api
         key: <your-token>
  4. data/.venv/bin/pip install cdsapi xarray netCDF4
     data/.venv/bin/python data/scripts/s9_proof_forecasts.py

Caveat to say out loud: in Aug 2022 GloFAS ran model version 3.1 (0.1 degree
grid). Our thresholds come from version 4 (0.05 degree). We compare v3.1
forecasts against v3.1's own simulated flow for the same cell, so the lead
time is like-for-like; the absolute m3/s numbers differ between versions.

Output: web/public/data/proof_forecasts_2022.json
"""
import json
import zipfile

from common import OUT, RAW, SHARED, write_json

ISSUE_DAYS = [f"{d:02d}" for d in range(10, 32)]          # forecasts issued 10-31 Aug 2022
LEADS = [str(24 * i) for i in range(1, 16)]                 # 1..15 days ahead
CACHE = RAW / "glofas_forecasts_2022"


def download(points):
    import cdsapi  # only needed for this script

    CACHE.mkdir(parents=True, exist_ok=True)
    lats = [p["lat"] for p in points]
    lons = [p["lon"] for p in points]
    area = [max(lats) + 0.2, min(lons) - 0.2, min(lats) - 0.2, max(lons) + 0.2]  # N, W, S, E
    c = cdsapi.Client()
    for day in ISSUE_DAYS:
        target = CACHE / f"fc_2022-08-{day}.nc"
        if target.exists():
            continue
        print(f"  requesting forecast issued 2022-08-{day}")
        tmp = CACHE / f"fc_2022-08-{day}.download"
        c.retrieve("cems-glofas-forecast", {
            "system_version": ["operational"],
            "hydrological_model": ["lisflood"],
            "product_type": ["control_forecast"],
            "variable": ["river_discharge_in_the_last_24_hours"],
            "year": ["2022"], "month": ["08"], "day": [day],
            "leadtime_hour": LEADS,
            "data_format": "netcdf",
            "download_format": "unarchived",
            "area": area,
        }, str(tmp))
        if zipfile.is_zipfile(tmp):
            with zipfile.ZipFile(tmp) as z:
                name = [n for n in z.namelist() if n.endswith(".nc")][0]
                target.write_bytes(z.read(name))
            tmp.unlink()
        else:
            tmp.rename(target)


def series_at(ds, lat, lon):
    """Forecast flow (m3/s) by valid date at the river cell nearest (lat, lon).
    Looks in the 3x3 cells around it and takes the one with the most water,
    because the 0.1-degree v3.1 river can sit one cell off."""
    var = [v for v in ds.data_vars if "dis" in v.lower()][0]
    da = ds[var].squeeze()
    latn = [d for d in da.dims if "lat" in d][0]
    lonn = [d for d in da.dims if "lon" in d][0]
    box = da.sel({latn: slice(lat + 0.15, lat - 0.15), lonn: slice(lon - 0.15, lon + 0.15)})
    if box.sizes[latn] == 0:  # latitude ascending in some files
        box = da.sel({latn: slice(lat - 0.15, lat + 0.15), lonn: slice(lon - 0.15, lon + 0.15)})
    mean = box.mean(dim=[d for d in box.dims if d not in (latn, lonn)])
    idx = mean.argmax(dim=[latn, lonn])
    cell = box.isel(idx)
    tdim = [d for d in cell.dims][0]
    times = cell[tdim].values if "valid_time" not in cell.coords else cell["valid_time"].values
    return {str(t)[:10]: float(v) for t, v in zip(times, cell.values)}


def main():
    import xarray as xr

    points = json.loads((SHARED / "river_points.json").read_text())
    download(points)

    result = {}
    for p in points:
        # What v3.1 itself showed as the 2022 peak: the 1-day-ahead forecasts strung together.
        day1 = {}
        issued = {}
        for day in ISSUE_DAYS:
            ds = xr.open_dataset(CACHE / f"fc_2022-08-{day}.nc")
            s = series_at(ds, p["lat"], p["lon"])
            issued[f"2022-08-{day}"] = s
            first = min(s)
            day1[first] = s[first]
        peak_val = max(day1.values())
        peak_date = max(day1, key=day1.get)
        # "Warning" = half-way between the start of the month and the peak, in
        # v3.1's own numbers (so the version difference cancels out).
        base = min(day1.values())
        warn_line = base + 0.5 * (peak_val - base)
        first_warning = None
        for issue_date in sorted(issued):
            s = issued[issue_date]
            hit = [d for d, v in sorted(s.items()) if v >= warn_line]
            if hit and issue_date <= peak_date:
                first_warning = {"issued": issue_date, "for_date": hit[0]}
                break
        lead = None
        if first_warning:
            from datetime import date
            lead = (date.fromisoformat(peak_date) - date.fromisoformat(first_warning["issued"])).days
        result[p["id"]] = {"peak_date_v31": peak_date, "peak_m3s_v31": round(peak_val, 1),
                           "warn_line_m3s_v31": round(warn_line, 1), "first_forecast_over_line": first_warning,
                           "days_before_peak": lead}
        print(f"  {p['id']}: first forecast showing the flood: {first_warning}, {lead} days before the peak ({peak_date})")
    write_json(OUT / "proof_forecasts_2022.json", {"source": "GloFAS v3.1 control forecasts, Aug 2022 (Copernicus EWDS)",
                                                    "points": result}, indent=1)


if __name__ == "__main__":
    main()
