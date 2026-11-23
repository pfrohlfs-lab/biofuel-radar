"""Fetch additional market drivers for Biofuel Radar into public/data/drivers.json.

All free, no API key:
  - Open-Meteo forecast API: 16-day precipitation/temperature forecast per region,
    compared with the 2016–2025 normal for the same calendar days (Open-Meteo archive, ERA5)
  - NOAA CPC Oceanic Niño Index (ONI)
  - IMF PortWatch: daily chokepoint transits (all ships and tankers)
  - Frankfurter (ECB reference rates): producer-country currencies vs. USD

Run:  python3 scripts/fetch_drivers.py
"""

from __future__ import annotations

import datetime as dt
import json
import urllib.parse
from pathlib import Path

from fetch_data import REGIONS, get

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public" / "data"

CHOKEPOINTS = ["Malacca Strait", "Suez Canal", "Bab el-Mandeb Strait", "Strait of Hormuz", "Panama Canal", "Cape of Good Hope", "Sunda Strait"]
PORTWATCH = "https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services/Daily_Chokepoints_Data/FeatureServer/0/query"
CURRENCIES = ["MYR", "IDR", "BRL", "INR", "CNY", "CAD", "AUD", "EUR"]


def forecast(region: dict) -> dict:
    lat, lon = region["lat"], region["lon"]
    f = json.loads(get(
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}&daily=precipitation_sum,temperature_2m_mean&forecast_days=16&timezone=UTC"
    ))["daily"]
    days = [dt.date.fromisoformat(t) for t in f["time"]]
    a = json.loads(get(
        "https://archive-api.open-meteo.com/v1/archive"
        f"?latitude={lat}&longitude={lon}&start_date=2016-01-01&end_date=2025-12-31"
        "&daily=precipitation_sum,temperature_2m_mean&timezone=UTC", 120
    ))["daily"]
    hist = {t: (p, tm) for t, p, tm in zip(a["time"], a["precipitation_sum"], a["temperature_2m_mean"])}
    normal_p, normal_t = [], []
    for d in days:
        ps, ts = [], []
        for y in range(2016, 2026):
            try:
                key = d.replace(year=y).isoformat()
            except ValueError:
                continue
            if key in hist and hist[key][0] is not None and hist[key][1] is not None:
                ps.append(hist[key][0])
                ts.append(hist[key][1])
        normal_p.append(sum(ps) / len(ps) if ps else 0)
        normal_t.append(sum(ts) / len(ts) if ts else 0)
    fp = [p or 0 for p in f["precipitation_sum"]]
    ft = [t for t in f["temperature_2m_mean"] if t is not None]
    sum_f, sum_n = sum(fp), sum(normal_p)
    return {
        "days": [d.isoformat() for d in days],
        "precip": [round(x, 1) for x in fp],
        "precipNormal": [round(x, 1) for x in normal_p],
        "temp": [round(x, 1) if x is not None else None for x in f["temperature_2m_mean"]],
        "tempNormal": [round(x, 1) for x in normal_t],
        "precipAnomalyPct": round(100 * (sum_f - sum_n) / sum_n, 1) if sum_n > 1 else 0.0,
        "tempAnomaly": round(sum(ft) / len(ft) - sum(normal_t[: len(ft)]) / len(ft), 2) if ft else 0.0,
    }


def oni() -> dict:
    txt = get("https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt").decode()
    rows = []
    for line in txt.strip().splitlines()[1:]:
        parts = line.split()
        if len(parts) == 4:
            rows.append([f"{parts[1]} {parts[0]}", float(parts[3])])
    return {"series": rows[-36:], "source": "NOAA CPC Oceanic Niño Index", "url": "https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt"}


def chokepoints(today: dt.date) -> dict:
    start = (today - dt.timedelta(days=430)).isoformat()
    out = {}
    for name in CHOKEPOINTS:
        q = urllib.parse.urlencode({
            "where": f"portname='{name}' AND date>='{start}'",
            "outFields": "date,n_total,n_tanker",
            "orderByFields": "date ASC",
            "resultRecordCount": 2000,
            "f": "json",
        })
        d = json.loads(get(f"{PORTWATCH}?{q}", 90))
        rows = [(f["attributes"]["date"], f["attributes"]["n_total"], f["attributes"]["n_tanker"]) for f in d.get("features", [])]
        if not rows:
            continue
        # dates come as epoch ms or ISO depending on service; normalise
        def iso(x):
            return dt.datetime.utcfromtimestamp(x / 1000).date().isoformat() if isinstance(x, (int, float)) else str(x)[:10]
        rows = [(iso(a), b, c) for a, b, c in rows]
        last = dt.date.fromisoformat(rows[-1][0])

        def avg(lo: dt.date, hi: dt.date, idx: int):
            v = [r[idx] for r in rows if lo <= dt.date.fromisoformat(r[0]) <= hi]
            return sum(v) / len(v) if v else None

        cur_t = avg(last - dt.timedelta(days=29), last, 1)
        ly_t = avg(last - dt.timedelta(days=394), last - dt.timedelta(days=365), 1)
        cur_k = avg(last - dt.timedelta(days=29), last, 2)
        ly_k = avg(last - dt.timedelta(days=394), last - dt.timedelta(days=365), 2)
        # weekly series for sparkline
        weekly = []
        for i in range(0, len(rows), 7):
            chunk = rows[i:i + 7]
            weekly.append([chunk[0][0], round(sum(c[1] for c in chunk) / len(chunk), 1), round(sum(c[2] for c in chunk) / len(chunk), 1)])
        out[name] = {
            "last": rows[-1][0],
            "transits30d": round(cur_t, 1) if cur_t else None,
            "transitsLY": round(ly_t, 1) if ly_t else None,
            "tankers30d": round(cur_k, 1) if cur_k else None,
            "tankersLY": round(ly_k, 1) if ly_k else None,
            "weekly": weekly,
        }
    return {"chokepoints": out, "source": "IMF PortWatch (daily transit calls)", "url": "https://portwatch.imf.org/"}


def fx(today: dt.date) -> dict:
    start = (today - dt.timedelta(days=400)).isoformat()
    d = json.loads(get(f"https://api.frankfurter.app/{start}..?to=USD,{','.join(c for c in CURRENCIES if c != 'EUR')}"))
    series = {c: [] for c in CURRENCIES}
    for day, rates in sorted(d["rates"].items()):
        usd = rates.get("USD")
        if not usd:
            continue
        for c in CURRENCIES:
            if c == "EUR":
                series[c].append([day, round(1 / usd, 5)])  # EUR per USD
            elif c in rates:
                series[c].append([day, round(rates[c] / usd, 5)])  # local currency per USD
    return {"perUSD": series, "source": "ECB reference rates via Frankfurter", "url": "https://frankfurter.dev/"}


def main() -> None:
    today = dt.date.today()
    out = {"generated": today.isoformat(), "forecast": {}}
    print("forecasts …")
    for r in REGIONS:
        try:
            out["forecast"][r["id"]] = forecast(r)
            print(" ", r["id"], out["forecast"][r["id"]]["precipAnomalyPct"])
        except Exception as exc:  # noqa: BLE001
            print("  forecast failed", r["id"], exc)
    print("enso …")
    out["enso"] = oni()
    print("shipping …")
    out["shipping"] = chokepoints(today)
    print("fx …")
    out["fx"] = fx(today)
    (DATA / "drivers.json").write_text(json.dumps(out))
    print("done")


if __name__ == "__main__":
    main()
