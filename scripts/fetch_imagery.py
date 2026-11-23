"""Fetch satellite imagery for Biofuel Radar into public/img and public/data/imagery.json.

All free, no API key:
  - NASA GIBS WMS, MODIS Terra NDVI 8-day composites (~250 m): world + region frames,
    12 monthly frames for a time-lapse, plus the same months a year earlier for comparison.
    Mean NDVI per frame is decoded from the official GIBS colour map (MODIS_NDVI.xml).
  - EOX Sentinel-2 cloudless 2023 mosaic (10 m), CC BY-NC-SA 4.0: district and field views.

Run:  python3 scripts/fetch_imagery.py      (needs Pillow)
"""

from __future__ import annotations

import datetime as dt
import io
import json
import re
import time
from pathlib import Path

from PIL import Image

from fetch_data import REGIONS, get  # reuse region list and HTTP helper

ROOT = Path(__file__).resolve().parents[1]
IMG = ROOT / "public" / "img"
DATA = ROOT / "public" / "data"

GIBS = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi"
EOX = "https://tiles.maps.eox.at/wms"
COLORMAP = "https://gibs.earthdata.nasa.gov/colormaps/v1.3/MODIS_NDVI.xml"

# Field-level focus points (lat, lon) inside each region: typical farmland / plantation / collection hub.
FOCUS = {
    "eu-rapeseed": (53.25, 13.85, "Uckermark, Germany"),
    "ca-canola": (51.55, -107.98, "Rosetown, Saskatchewan"),
    "au-canola": (-34.95, 147.35, "Riverina, NSW"),
    "us-cornbelt": (42.03, -93.62, "Story County, Iowa"),
    "br-matogrosso": (-12.55, -55.72, "Sorriso, Mato Grosso"),
    "br-saopaulo": (-21.15, -47.95, "Ribeirão Preto, São Paulo"),
    "ar-pampas": (-33.9, -60.57, "Pergamino, Buenos Aires"),
    "id-palm": (0.45, 101.75, "Riau, Sumatra"),
    "in-cane": (29.47, 77.7, "Muzaffarnagar, Uttar Pradesh"),
    "cn-uco": (30.27, 120.15, "Hangzhou (collection hub)"),
}


def load_colormap() -> dict[tuple[int, int, int], float]:
    xml = get(COLORMAP).decode()
    cmap = {}
    for m in re.finditer(r'<ColorMapEntry rgb="(\d+),(\d+),(\d+)"([^>]*)/>', xml):
        attrs = m.group(4)
        if 'nodata="true"' in attrs or 'transparent="true"' in attrs:
            continue
        v = re.search(r'value="\[([-0-9.]+),([-0-9.]+)\)"', attrs) or re.search(r'value="\[([-0-9.]+),([-0-9.]+)\]"', attrs)
        if not v:
            continue
        lo, hi = float(v.group(1)), float(v.group(2))
        cmap[(int(m.group(1)), int(m.group(2)), int(m.group(3)))] = (lo + hi) / 2
    return cmap


def wms(base: str, layer: str, bbox: tuple[float, float, float, float], width: int, time_: str | None, fmt: str, version="1.3.0") -> bytes | None:
    la0, lo0, la1, lo1 = bbox
    h = max(120, int(width * (la1 - la0) / (lo1 - lo0)))
    if version == "1.3.0":
        q = f"VERSION=1.3.0&CRS=EPSG:4326&BBOX={la0},{lo0},{la1},{lo1}"
    else:
        q = f"VERSION=1.1.1&SRS=EPSG:4326&BBOX={lo0},{la0},{lo1},{la1}"
    url = f"{base}?SERVICE=WMS&REQUEST=GetMap&{q}&LAYERS={layer}&WIDTH={width}&HEIGHT={h}&FORMAT={fmt}&STYLES="
    if time_:
        url += f"&TIME={time_}"
    try:
        b = get(url, 90)
    except Exception as exc:  # noqa: BLE001
        print("   fail", layer, exc)
        return None
    if len(b) < 3000:
        return None
    return b


def mean_ndvi(png: bytes, cmap: dict) -> float | None:
    im = Image.open(io.BytesIO(png)).convert("RGBA")
    im.thumbnail((240, 240))
    total = n = 0.0
    for r, g, b, a in im.getdata():
        if a < 200:
            continue
        v = cmap.get((r, g, b))
        if v is None:
            continue
        total += v
        n += 1
    return round(total / n, 3) if n > 50 else None


def save(path: Path, data: bytes, quality: int | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if quality and path.suffix == ".jpg":
        Image.open(io.BytesIO(data)).convert("RGB").save(path, quality=quality, optimize=True)
    else:
        path.write_bytes(data)


def box(lat: float, lon: float, half_lat: float) -> tuple[float, float, float, float]:
    import math
    half_lon = half_lat / max(0.3, math.cos(math.radians(lat))) * 1.25
    return (lat - half_lat, lon - half_lon, lat + half_lat, lon + half_lon)


def main() -> None:
    cmap = load_colormap()
    print("colormap entries", len(cmap))
    today = dt.date.today()
    latest = today - dt.timedelta(days=21)
    dates = [latest - dt.timedelta(days=round(30.44 * k)) for k in range(11, -1, -1)]

    out = {"generated": today.isoformat(), "dates": [d.isoformat() for d in dates], "world": [], "regions": {}}

    print("world frames …")
    for d in dates:
        b = wms(GIBS, "MODIS_Terra_NDVI_8Day", (-58, -180, 84, 180), 1400, d.isoformat(), "image/png")
        if b:
            name = f"world/ndvi-{d.isoformat()}.png"
            save(IMG / name, b)
            out["world"].append({"date": d.isoformat(), "src": f"/img/{name}"})
        time.sleep(0.3)

    for r in REGIONS:
        rid = r["id"]
        print(" ", rid)
        bbox = tuple(r["bbox"])
        frames, series, series_ly = [], [], []
        for d in dates:
            b = wms(GIBS, "MODIS_Terra_NDVI_8Day", bbox, 640, d.isoformat(), "image/png")
            if b:
                name = f"{rid}/ndvi-{d.isoformat()}.png"
                save(IMG / name, b)
                frames.append({"date": d.isoformat(), "src": f"/img/{name}"})
                series.append([d.isoformat(), mean_ndvi(b, cmap)])
            ly = d.replace(year=d.year - 1)
            b2 = wms(GIBS, "MODIS_Terra_NDVI_8Day", bbox, 400, ly.isoformat(), "image/png")
            series_ly.append([d.isoformat(), mean_ndvi(b2, cmap) if b2 else None])
            time.sleep(0.2)

        lat, lon, place = FARMS[rid] if rid in FARMS else FOCUS[rid]
        orbit_box = (max(-80, bbox[0] - 12), max(-180, bbox[1] - 22), min(84, bbox[2] + 12), min(180, bbox[3] + 22))
        views = {}
        b = wms(GIBS, "MODIS_Terra_NDVI_8Day", orbit_box, 900, latest.isoformat(), "image/png")
        if b:
            save(IMG / rid / "orbit.png", b)
            views["orbit"] = {"src": f"/img/{rid}/orbit.png", "bbox": orbit_box, "label": "Orbit · MODIS NDVI 250 m"}
        if frames:
            views["region"] = {"src": frames[-1]["src"], "bbox": bbox, "label": "Region · MODIS NDVI 250 m"}
        dbox = box(lat, lon, 0.28)
        b = wms(EOX, "s2cloudless-2023", dbox, 1000, None, "image/jpeg", version="1.1.1")
        if b:
            save(IMG / rid / "district.jpg", b, quality=82)
            views["district"] = {"src": f"/img/{rid}/district.jpg", "bbox": dbox, "label": "District · Sentinel-2 10 m"}
        b = wms(GIBS, "MODIS_Terra_NDVI_8Day", dbox, 600, latest.isoformat(), "image/png")
        if b:
            save(IMG / rid / "district-ndvi.png", b)
            views["districtNdvi"] = {"src": f"/img/{rid}/district-ndvi.png", "bbox": dbox, "label": "MODIS NDVI over the same district"}
        fbox = box(lat, lon, 0.055)
        b = wms(EOX, "s2cloudless-2023", fbox, 1100, None, "image/jpeg", version="1.1.1")
        if b:
            save(IMG / rid / "field.jpg", b, quality=84)
            views["field"] = {"src": f"/img/{rid}/field.jpg", "bbox": fbox, "label": "Field · Sentinel-2 10 m"}

        out["regions"][rid] = {
            "focus": {"lat": lat, "lon": lon, "place": place},
            "frames": frames,
            "ndvi": series,
            "ndviLastYear": series_ly,
            "views": views,
        }

    out["sources"] = {
        "modis": "NASA GIBS · MODIS Terra NDVI 8-day (MOD13), colour map MODIS_NDVI v1.3",
        "s2": "Sentinel-2 cloudless 2023 by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2023), CC BY-NC-SA 4.0",
    }
    (DATA / "imagery.json").write_text(json.dumps(out))
    print("done")




# ---------------------------------------------------------------- farm level (sub-metre)
# Farm points: a single farm / plantation block inside each region.
FARMS = {
    "eu-rapeseed": (53.30, 13.95, "Farmland near Prenzlau, Uckermark"),
    "ca-canola": (51.50, -107.90, "Section farms near Rosetown, SK"),
    "au-canola": (-34.90, 147.30, "Cropping farms, Riverina NSW"),
    "us-cornbelt": (42.12, -93.40, "Corn & soy fields, Story County IA"),
    "br-matogrosso": (-12.45, -55.60, "Soy farms near Sorriso MT"),
    "br-saopaulo": (-21.25, -48.05, "Sugarcane blocks, Ribeirão Preto SP"),
    "ar-pampas": (-33.95, -60.50, "Soy fields near Pergamino"),
    "id-palm": (0.45, 101.75, "Oil-palm plantation, Riau"),
    "in-cane": (29.50, 77.65, "Sugarcane smallholdings, Muzaffarnagar"),
    "cn-uco": (30.27, 120.16, "Hangzhou: restaurants = UCO collection"),
}
ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export"
NAIP = "https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer/exportImage"


def fetch_farms() -> None:
    meta = json.loads((DATA / "imagery.json").read_text())
    for rid, (lat, lon, place) in FARMS.items():
        fb = box(lat, lon, 0.008)
        la0, lo0, la1, lo1 = fb
        us = rid == "us-cornbelt"
        base = NAIP if us else ESRI
        url = (f"{base}?bbox={lo0},{la0},{lo1},{la1}&bboxSR=4326&imageSR=4326&size=1100,{int(1100 * (la1 - la0) / (lo1 - lo0))}"
               f"&format=jpg&f=image")
        try:
            b = get(url, 90)
        except Exception as exc:  # noqa: BLE001
            print("  farm fail", rid, exc)
            continue
        save(IMG / rid / "farm.jpg", b, quality=84)
        src = "USDA NAIP aerial (~0.6 m), public domain" if us else "Esri World Imagery (sub-metre)"
        meta["regions"][rid]["views"]["farm"] = {"src": f"/img/{rid}/farm.jpg", "bbox": fb, "label": f"Farm · {'NAIP 0.6 m' if us else 'aerial < 1 m'}"}
        meta["regions"][rid]["farm"] = {"lat": lat, "lon": lon, "place": place, "source": src}
        print("  farm", rid, len(b))
    meta["sources"]["farm"] = "Esri World Imagery (Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community); USDA NAIP via USGS (public domain)"
    (DATA / "imagery.json").write_text(json.dumps(meta))


if __name__ == "__main__":
    import sys
    if sys.argv[-1] != "--farms":
        main()
    fetch_farms()
