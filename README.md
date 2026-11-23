# Biofuel Radar

Research demo: **what is a satellite signal worth in global biofuel feedstock markets — and how far can you trust it?**

A single-page dashboard that follows the chain *field → harvest → feedstock supply → prices & spreads → trading signal* for FAME, HVO, SAF and ethanol, with an uncertainty band at every step.

## Sections
1. **Feedstock radar** — ten growing regions on a dot-matrix world map; real MODIS NDVI satellite images (this year vs. last year), 90-day rainfall and temperature anomalies, and an illustrative yield assumption.
2. **Prices & spreads** — real monthly vegetable-oil, grain, sugar, crude and diesel prices; feedstock-vs-diesel spreads; HVO/SAF/ethanol as clearly labelled example series.
3. **Policy & demand** — mandates 2025–2035 (ReFuelEU, FuelEU, RED III, THG-Quote, UK SAF, RFS, 45Z, Brazil, Indonesia, India, IMO).
4. **Signal & credibility** — scenario sliders from weather anomaly to feedstock cost, and the research question: expected P&L vs. signal skill, and the cost of over-trusting a signal.
5. **Data & method** — every number carries a status: *real data*, *example data*, *model* or *to verify*.

## Data
| Layer | Source | Status |
|---|---|---|
| Vegetation (NDVI) | NASA GIBS, MODIS Terra 8-day | real |
| Weather | Open-Meteo historical API (ERA5) | real |
| Feedstock & crude prices | World Bank Pink Sheet (monthly) | real |
| Diesel | U.S. EIA, NY Harbor ULSD (monthly) | real |
| HVO, SAF, ethanol | simulated — real assessments are paywalled | example |
| Yield / supply / price links | transparent illustrative model | model |

No API keys needed. Not investment advice.

## Run
```bash
npm install
python3 scripts/fetch_data.py   # refresh data into public/data and public/ndvi (needs openpyxl)
npm run dev
```

Stack: React, TypeScript, Vite, d3 (geo, scale, shape), topojson. No backend — data is fetched by the script and served as static files.
