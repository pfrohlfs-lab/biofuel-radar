"""Fetch the free, real data for Biofuel Radar into public/data and public/ndvi.

Sources (all free, no API key):
  - World Bank Commodity Price Data (Pink Sheet), monthly
  - U.S. EIA, New York Harbor ULSD spot price, monthly (HTML table)
  - Open-Meteo Historical Weather API (ERA5), daily
  - NASA GIBS WMS, MODIS Terra NDVI 8-day composites

Simulated series (HVO, SAF, ethanol) are generated deterministically and
flagged with status "example": real prices for these are paywalled.

Run:  python3 scripts/fetch_data.py
Needs: Python 3.10+, openpyxl
"""

from __future__ import annotations

import datetime as dt
import io
import json
import math
import random
import re
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public" / "data"
NDVI = ROOT / "public" / "ndvi"
UA = {"User-Agent": "Mozilla/5.0 (research demo)"}

PINK_PAGE = "https://www.worldbank.org/en/research/commodity-markets"
EIA_ULSD = (
    "https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx"
    "?n=PET&s=EER_EPD2DXL0_PF4_Y35NY_DPG&f=M"
)
GAL_PER_TONNE_DIESEL = 312.6  # density 0.845 kg/l -> 1183 l/t -> 312.6 US gal/t

# id, name, country, crop, fuels, weather point (lat, lon), NDVI bbox (lat_min, lon_min, lat_max, lon_max)
REGIONS = [
    dict(id="eu-rapeseed", name="EU rapeseed belt", country="FR · DE · PL", crop="Rapeseed",
         fuels=["FAME", "HVO"], lat=50.5, lon=10.0, bbox=(45.5, -1.0, 55.0, 23.0), share="~20 Mt seed / yr",
         sens=dict(precip=0.10, temp=-2.2)),
    dict(id="ca-canola", name="Canadian Prairies", country="CA", crop="Canola",
         fuels=["FAME", "HVO", "SAF"], lat=51.5, lon=-106.0, bbox=(48.0, -116.0, 56.0, -96.0), share="~19 Mt seed / yr",
         sens=dict(precip=0.14, temp=-2.8)),
    dict(id="au-canola", name="NSW & Victoria", country="AU", crop="Canola",
         fuels=["FAME", "HVO"], lat=-34.0, lon=147.0, bbox=(-38.5, 140.0, -29.0, 153.0), share="~6 Mt seed / yr",
         sens=dict(precip=0.16, temp=-2.5)),
    dict(id="us-cornbelt", name="US Corn Belt", country="US", crop="Corn · Soy",
         fuels=["Ethanol", "HVO", "SAF"], lat=41.5, lon=-92.0, bbox=(37.0, -101.0, 46.5, -81.0), share="~380 Mt corn / yr",
         sens=dict(precip=0.12, temp=-3.0)),
    dict(id="br-matogrosso", name="Mato Grosso", country="BR", crop="Soybean",
         fuels=["FAME", "HVO"], lat=-13.0, lon=-56.0, bbox=(-18.0, -62.0, -8.0, -50.0), share="~45 Mt soy / yr",
         sens=dict(precip=0.11, temp=-1.8)),
    dict(id="br-saopaulo", name="São Paulo cane", country="BR", crop="Sugarcane",
         fuels=["Ethanol", "SAF"], lat=-21.5, lon=-48.5, bbox=(-24.5, -53.0, -19.0, -44.5), share="~350 Mt cane / yr",
         sens=dict(precip=0.13, temp=-1.5)),
    dict(id="ar-pampas", name="Argentine Pampas", country="AR", crop="Soybean",
         fuels=["FAME"], lat=-34.0, lon=-62.0, bbox=(-38.5, -66.0, -30.0, -57.5), share="~50 Mt soy / yr",
         sens=dict(precip=0.15, temp=-2.0)),
    dict(id="id-palm", name="Sumatra · Kalimantan · Malaysia", country="ID · MY", crop="Palm oil",
         fuels=["FAME", "HVO", "SAF"], lat=1.5, lon=102.0, bbox=(-5.0, 95.0, 8.0, 120.0), share="~67 Mt oil / yr",
         sens=dict(precip=0.08, temp=-1.2)),
    dict(id="in-cane", name="Uttar Pradesh · Maharashtra", country="IN", crop="Sugarcane",
         fuels=["Ethanol"], lat=23.0, lon=78.0, bbox=(16.0, 72.0, 30.0, 84.0), share="~450 Mt cane / yr",
         sens=dict(precip=0.12, temp=-1.6)),
    dict(id="cn-uco", name="East China UCO collection", country="CN", crop="Used cooking oil",
         fuels=["HVO", "SAF"], lat=31.0, lon=117.0, bbox=(24.0, 108.0, 38.0, 123.0), share="collection, not a crop",
         sens=dict(precip=0.0, temp=0.0)),
]


def get(url: str, timeout: int = 60, tries: int = 3) -> bytes:
    """HTTP GET with retries."""
    for attempt in range(tries):
        try:
            return _get_once(url, timeout)
        except Exception:  # noqa: BLE001
            if attempt == tries - 1:
                raise
            time.sleep(3 * (attempt + 1))
    raise RuntimeError("unreachable")


def _get_once(url: str, timeout: int) -> bytes:
    """HTTP GET via urllib; falls back to curl if the local Python has no CA bundle."""
    try:
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read()
    except urllib.error.URLError as exc:
        if "CERTIFICATE_VERIFY_FAILED" not in str(exc):
            raise
        res = subprocess.run(
            ["curl", "-sSL", "--fail", "-m", str(timeout), "-A", UA["User-Agent"], url],
            capture_output=True, check=True,
        )
        return res.stdout


# ---------------------------------------------------------------- prices
def fetch_pink_sheet() -> dict:
    page = get(PINK_PAGE).decode("utf-8", "ignore")
    m = re.search(r"https://thedocs\.worldbank\.org[^\"]*CMO-Historical-Data-Monthly\.xlsx", page)
    if not m:
        raise RuntimeError("Pink Sheet link not found")
    url = m.group(0)
    wb = openpyxl.load_workbook(io.BytesIO(get(url, 120)), read_only=True, data_only=True)
    rows = list(wb["Monthly Prices"].iter_rows(values_only=True))
    updated = str(rows[3][0]).replace("Updated on ", "")
    cols = {h: j for j, h in enumerate(rows[4]) if h}
    wanted = {
        "palm": ("Palm oil", "Palm oil", "$/t", 1.0),
        "soyoil": ("Soybean oil", "Soybean oil", "$/t", 1.0),
        "rapeoil": ("Rapeseed oil", "Rapeseed oil", "$/t", 1.0),
        "maize": ("Maize", "Maize", "$/t", 1.0),
        "sugar": ("Sugar, world", "Sugar (world)", "$/t", 1000.0),
        "brent": ("Crude oil, Brent", "Brent crude", "$/bbl", 1.0),
    }
    out = {}
    for key, (col, label, unit, mult) in wanted.items():
        j = cols[col]
        data = []
        for r in rows[6:]:
            if not r[0] or not isinstance(r[j], (int, float)):
                continue
            y, mo = str(r[0]).split("M")
            if int(y) < 2015:
                continue
            data.append([f"{y}-{int(mo):02d}", round(r[j] * mult, 1)])
        out[key] = dict(label=label, unit=unit, status="real",
                        source="World Bank Pink Sheet", sourceUrl=url, updated=updated, data=data)
    return out


def fetch_diesel() -> dict:
    html = get(EIA_ULSD).decode("latin-1")
    cells = re.findall(r"<td class='(B4|B3)'>([^<]*)</td>", html)
    data, year, month = [], None, 0
    for cls, val in cells:
        if cls == "B4":
            year, month = int(val.replace("&nbsp;", "").strip()), 0
            continue
        month += 1
        if year and year >= 2015 and val.strip():
            data.append([f"{year}-{month:02d}", round(float(val) * GAL_PER_TONNE_DIESEL, 1)])
    rel = re.search(r"Release Date: ([0-9/]+)", html)
    return dict(label="Diesel (NY Harbor ULSD)", unit="$/t", status="real",
                source="U.S. EIA", sourceUrl=EIA_ULSD.replace("LeafHandler.ashx", "LeafHandler.ashx"),
                updated=rel.group(1) if rel else "", data=data,
                note="Converted from $/gal at 312.6 gal/t")


def simulate(series: dict) -> dict:
    """Deterministic, plausible example series for paywalled prices."""
    rnd = random.Random(42)
    diesel = dict(series["diesel"]["data"])
    soy = dict(series["soyoil"]["data"])
    maize = dict(series["maize"]["data"])
    months = sorted(set(diesel) & set(soy) & set(maize))
    rape = dict(series["rapeoil"]["data"])
    palm = dict(series["palm"]["data"])
    hvo, saf, eth, fame, uco = [], [], [], [], []
    noise_h = noise_s = noise_e = noise_f = noise_u = 0.0
    for i, m in enumerate(months):
        noise_h = 0.8 * noise_h + rnd.gauss(0, 45)
        noise_s = 0.8 * noise_s + rnd.gauss(0, 70)
        noise_e = 0.8 * noise_e + rnd.gauss(0, 18)
        noise_f = 0.8 * noise_f + rnd.gauss(0, 30)
        noise_u = 0.8 * noise_u + rnd.gauss(0, 25)
        h = max(diesel[m] + 380, 1.08 * soy[m] + 520) + noise_h
        s = h + 520 + 120 * math.sin(i / 9) + noise_s
        e = 2.9 * maize[m] + 160 + noise_e
        f = max(diesel[m] + 150, 1.02 * rape.get(m, soy[m]) + 190) + noise_f
        u = 0.92 * palm.get(m, soy[m]) + 120 + noise_u
        hvo.append([m, round(h, 1)])
        saf.append([m, round(s, 1)])
        eth.append([m, round(e, 1)])
        fame.append([m, round(f, 1)])
        uco.append([m, round(u, 1)])
    common = dict(unit="$/t", status="example", source="Simulated (real prices: Argus, Platts — paywalled)",
                  sourceUrl="", updated="model")
    return {
        "hvo": dict(label="HVO / renewable diesel", data=hvo, **common),
        "saf": dict(label="SAF (HEFA)", data=saf, **common),
        "ethanol": dict(label="Ethanol", data=eth, **common),
        "fame": dict(label="FAME / biodiesel (RME)", data=fame, **common),
        "uco": dict(label="Used cooking oil (UCO)", data=uco, **common),
    }


# ---------------------------------------------------------------- weather
def fetch_weather(region: dict, end: dt.date) -> dict:
    url = (
        "https://archive-api.open-meteo.com/v1/archive"
        f"?latitude={region['lat']}&longitude={region['lon']}"
        f"&start_date=2016-01-01&end_date={end.isoformat()}"
        "&daily=precipitation_sum,temperature_2m_mean&timezone=UTC"
    )
    d = json.loads(get(url, 120))["daily"]
    days = [dt.date.fromisoformat(t) for t in d["time"]]
    pr = d["precipitation_sum"]
    tm = d["temperature_2m_mean"]

    def window(year: int):
        e = end.replace(year=year)
        s = e - dt.timedelta(days=89)
        idx = [i for i, day in enumerate(days) if s <= day <= e and pr[i] is not None and tm[i] is not None]
        if len(idx) < 80:
            return None
        return sum(pr[i] for i in idx), sum(tm[i] for i in idx) / len(idx)

    cur = window(end.year)
    hist = [w for y in range(end.year - 10, end.year) if (w := window(y))]
    p_norm = sum(h[0] for h in hist) / len(hist)
    t_norm = sum(h[1] for h in hist) / len(hist)

    # monthly precipitation: last 12 full months vs. 10-year monthly normal
    monthly = {}
    for i, day in enumerate(days):
        if pr[i] is None:
            continue
        monthly.setdefault((day.year, day.month), 0.0)
        monthly[(day.year, day.month)] += pr[i]
    last_full = (end.replace(day=1) - dt.timedelta(days=1))
    months = []
    y, m = last_full.year, last_full.month
    for _ in range(12):
        months.append((y, m))
        y, m = (y - 1, 12) if m == 1 else (y, m - 1)
    months.reverse()
    series = []
    for (y, m) in months:
        norm_vals = [monthly[(yy, m)] for yy in range(y - 10, y) if (yy, m) in monthly]
        series.append(dict(month=f"{y}-{m:02d}", precip=round(monthly.get((y, m), 0.0), 1),
                           normal=round(sum(norm_vals) / len(norm_vals), 1) if norm_vals else None))

    return dict(
        window=f"{(end - dt.timedelta(days=89)).isoformat()} – {end.isoformat()}",
        precip90=round(cur[0], 1), precipNormal90=round(p_norm, 1),
        precipAnomalyPct=round(100 * (cur[0] - p_norm) / p_norm, 1) if p_norm else 0.0,
        temp90=round(cur[1], 2), tempNormal90=round(t_norm, 2),
        tempAnomaly=round(cur[1] - t_norm, 2),
        monthly=series, source="Open-Meteo Historical Weather API (ERA5)", sourceUrl=url, status="real",
    )


# ---------------------------------------------------------------- NDVI
def fetch_ndvi(region: dict, date: dt.date, suffix: str) -> str | None:
    la0, lo0, la1, lo1 = region["bbox"]
    w = 720
    h = max(200, int(w * (la1 - la0) / (lo1 - lo0)))
    url = (
        "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0"
        f"&LAYERS=MODIS_Terra_NDVI_8Day&CRS=EPSG:4326&BBOX={la0},{lo0},{la1},{lo1}"
        f"&WIDTH={w}&HEIGHT={h}&FORMAT=image/png&TIME={date.isoformat()}&STYLES="
    )
    try:
        png = get(url, 90)
    except Exception as exc:  # noqa: BLE001
        print("  ndvi failed", region["id"], exc)
        return None
    if not png.startswith(b"\x89PNG") or len(png) < 5000:
        return None
    name = f"{region['id']}-{suffix}.png"
    (NDVI / name).write_bytes(png)
    return name


def main() -> None:
    DATA.mkdir(parents=True, exist_ok=True)
    NDVI.mkdir(parents=True, exist_ok=True)
    today = dt.date.today()
    end = today - dt.timedelta(days=6)  # ERA5 archive lag

    print("prices …")
    series = fetch_pink_sheet()
    series["diesel"] = fetch_diesel()
    series.update(simulate(series))
    (DATA / "prices.json").write_text(json.dumps(dict(generated=today.isoformat(), series=series)))

    print("regions …")
    ndvi_date = today - dt.timedelta(days=21)
    out = []
    for r in REGIONS:
        print(" ", r["id"])
        item = {k: v for k, v in r.items()}
        item["bbox"] = list(r["bbox"])
        try:
            item["weather"] = fetch_weather(r, end)
        except Exception as exc:  # noqa: BLE001
            print("  weather failed", exc)
            item["weather"] = None
        item["ndvi"] = dict(
            current=fetch_ndvi(r, ndvi_date, "now"),
            lastYear=fetch_ndvi(r, ndvi_date.replace(year=ndvi_date.year - 1), "ly"),
            date=ndvi_date.isoformat(),
            dateLastYear=ndvi_date.replace(year=ndvi_date.year - 1).isoformat(),
            source="NASA GIBS · MODIS Terra NDVI 8-day", status="real",
            sourceUrl="https://gibs.earthdata.nasa.gov/",
        )
        out.append(item)
        time.sleep(0.5)
    (DATA / "regions.json").write_text(json.dumps(dict(generated=today.isoformat(), weatherEnd=end.isoformat(), regions=out)))
    print("done")


if __name__ == "__main__":
    main()
