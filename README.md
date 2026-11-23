# Biofuel Radar

Research demo: **what is a satellite signal worth in global biofuel feedstock markets — and how far can you trust it?**

A single-page dashboard that follows the chain *field → harvest → feedstock supply → prices & spreads → trading signal* for FAME, HVO, SAF and ethanol, with an uncertainty band at every step.

## Terminal
- **Markets watchlist** — fuels (HVO, SAF, FAME, ethanol, diesel, Brent) and feedstocks (palm, soybean, rapeseed oil, UCO, corn, sugar), plus a regions tab and live satellite alerts.
- **Instrument view** — price chart vs. diesel, 3M/1Y change, 12M range, volatility, linked supply regions.
- **Global vegetation map** — 12 monthly MODIS NDVI frames as a time-lapse, supply regions highlighted for the selected product.
- **Satellite intelligence** — zoom from orbit → region → district → field → single farm (MODIS 250 m → Sentinel-2 10 m → sub-metre aerial), 'fly in' animation, NDVI time-lapse, NDVI/Sentinel overlay, mean NDVI vs. last year decoded from the satellite frames, weather anomalies and a yield signal.
- **Price drivers** — every input for the selected product in one matrix (weather, 16-day forecast, NDVI, ENSO, shipping chokepoints, producer FX, diesel, trade policy), each marked ▲ supports / ▼ weighs on price, with a net balance gauge.
- **Shipping, FX & trade** — IMF PortWatch chokepoint transits (incl. tankers), NOAA ENSO index, producer currencies vs. USD, curated tariffs, levies and export taxes.
- **Analysis tabs** — signal & credibility (scenario chain, value of a trusted signal), spreads, policy & demand (11 mandates), data & method.

## Data
| Layer | Source | Status |
|---|---|---|
| Vegetation (NDVI) | NASA GIBS, MODIS Terra 8-day | real |
| Field imagery | Sentinel-2 cloudless 2023 by EOX (CC BY-NC-SA 4.0) | real |
| Farm imagery | Esri World Imagery (non-commercial demo use, attribution) · USDA NAIP (public domain) | real |
| Weather | Open-Meteo historical API (ERA5) | real |
| Weather forecast | Open-Meteo forecast API (16 days) | real |
| Shipping | IMF PortWatch chokepoint transits | real |
| ENSO | NOAA CPC Oceanic Niño Index | real |
| FX | ECB reference rates via Frankfurter | real |
| Trade policy | curated list of tariffs, levies, export taxes | to verify |
| Feedstock & crude prices | World Bank Pink Sheet (monthly) | real |
| Diesel | U.S. EIA, NY Harbor ULSD (monthly) | real |
| HVO, SAF, FAME, ethanol, UCO | simulated — real assessments are paywalled | example |
| Yield / supply / price links | transparent illustrative model | model |

No API keys needed. Not investment advice.

## Run
```bash
npm install
python3 scripts/fetch_data.py      # prices + weather (needs openpyxl)
python3 scripts/fetch_imagery.py   # satellite frames, field and farm views (needs Pillow)
python3 scripts/fetch_drivers.py   # forecast, ENSO, shipping, FX
npm run dev
```

Stack: React, TypeScript, Vite, d3 (geo, scale, shape), topojson. No backend — data is fetched by the script and served as static files.
