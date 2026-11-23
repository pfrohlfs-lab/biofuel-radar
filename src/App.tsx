import { useEffect, useState } from 'react'
import type { PriceFile, RegionFile } from './lib/types'
import { WorldMap } from './components/WorldMap'
import { RegionPanel } from './components/RegionPanel'
import { Prices } from './components/Prices'
import { Policy } from './components/Policy'
import { Signal } from './components/Signal'
import { Badge } from './components/Badge'
import { fmt, signed } from './lib/model'
import { MANDATES } from './data/policy'

function useReveal(ready: boolean) {
  useEffect(() => {
    if (!ready) return
    const els = document.querySelectorAll('.reveal')
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add('in')),
      { threshold: 0.05 },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [ready])
}

function Toggle({ label, value, onChange, a = 'On', b = 'Off', className = '' }: { label: string; value: boolean; onChange: (v: boolean) => void; a?: string; b?: string; className?: string }) {
  return (
    <span className={`toggle ${className}`}>
      {label}:
      <span className="pill">
        <button className={value ? 'active' : ''} onClick={() => onChange(true)}>{a}</button>
        <button className={!value ? 'active' : ''} onClick={() => onChange(false)}>{b}</button>
      </span>
    </span>
  )
}

function SectionHead({ n, title, about, id }: { n: string; title: string; about: string; id: string }) {
  return (
    <div id={id} style={{ scrollMarginTop: 60 }}>
      <div className="section-index"><span>({n})</span><span className="muted">{title.toLowerCase()}</span></div>
      <div className="g12 section-head" style={{ marginTop: 10 }}>
        <h2 className="h2">{title}</h2>
        <p className="about muted" style={{ margin: 0 }}>{about}</p>
      </div>
    </div>
  )
}

export default function App() {
  const [prices, setPrices] = useState<PriceFile | null>(null)
  const [regionFile, setRegionFile] = useState<RegionFile | null>(null)
  const [grid, setGrid] = useState(false)
  const [dark, setDark] = useState(false)
  const [selected, setSelected] = useState('id-palm')

  useEffect(() => {
    fetch('/data/prices.json').then((r) => r.json()).then(setPrices)
    fetch('/data/regions.json').then((r) => r.json()).then(setRegionFile)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  }, [dark])

  useReveal(!!prices && !!regionFile)

  const regions = regionFile?.regions ?? []
  const selIdx = Math.max(0, regions.findIndex((r) => r.id === selected))
  const region = regions[selIdx]

  const tickerKeys = ['palm', 'soyoil', 'rapeoil', 'maize', 'sugar', 'brent', 'diesel', 'hvo', 'saf', 'ethanol']
  const tickerItems = prices
    ? tickerKeys.map((k) => {
        const s = prices.series[k]
        const d = s.data
        const last = d[d.length - 1]
        const prev = d[d.length - 2]
        const ch = ((last[1] - prev[1]) / prev[1]) * 100
        return { k, label: s.label, last: last[1], unit: s.unit, ch, ex: s.status === 'example' }
      })
    : []

  return (
    <>
      <div className={`grid-overlay${grid ? ' on' : ''}`} aria-hidden>
        {Array.from({ length: 12 }, (_, i) => <div key={i} />)}
      </div>

      <header className="topbar wrap">
        <div className="topbar-inner">
          <div className="brand"><i />BIOFUEL RADAR</div>
          <nav className="nav">
            <a href="#map">Feedstock</a><span>/</span>
            <a href="#prices">Prices</a><span>/</span>
            <a href="#policy">Policy</a><span>/</span>
            <a href="#signal">Signal</a><span>/</span>
            <a href="#sources">Sources</a>
          </nav>
          <Toggle label="Grid" value={grid} onChange={setGrid} className="hide-sm" />
          <Toggle label="Mode" value={!dark} onChange={(v) => setDark(!v)} a="Light" b="Dark" />
          <div className="right">Research demo ©2026</div>
        </div>
      </header>

      <main className="wrap">
        <section className="hero">
          <h1 className="mega">
            Feedstock<br />→ Fuel → Price
          </h1>
          <div className="g12 hero-meta">
            <div className="label small muted">(About the demo)</div>
            <p className="lead">
              A global view of what drives biofuel markets — FAME, HVO, SAF and ethanol — from the field to the spread.
              Satellite vegetation and weather anomalies in ten growing regions, real feedstock and fuel prices, and the mandates that set demand.
              The question behind it: <em>what is a satellite signal worth in trading, and how far can you trust it?</em>
            </p>
          </div>
          <div className="g12 hero-stats">
            <div className="stat"><span className="small muted">Growing regions</span><b>{regions.length || '—'}</b></div>
            <div className="stat"><span className="small muted">Fuels</span><b>4</b></div>
            <div className="stat"><span className="small muted">Mandates tracked</span><b>{MANDATES.length}</b></div>
            <div className="stat"><span className="small muted">Weather data to</span><b style={{ fontSize: 'clamp(24px, 3vw, 40px)', marginTop: 14 }}>{regionFile?.weatherEnd ?? '—'}</b></div>
          </div>
        </section>
      </main>

      {prices && (
        <div className="ticker" aria-label="Latest monthly prices">
          <div className="ticker-track">
            {[0, 1].map((rep) => (
              <div key={rep} style={{ display: 'inline-flex', paddingLeft: 30 }}>
                {tickerItems.map((t) => (
                  <span key={t.k + rep} className="tick">
                    <span>{t.label}</span>
                    <span className="num">{fmt(t.last, t.unit === '$/bbl' ? 1 : 0)} {t.unit}</span>
                    <span className={`num ${t.ch < 0 ? 'down' : 'up'}`}>{signed(t.ch, 1, ' %')}</span>
                    {t.ex && <span className="badge example">ex.</span>}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <main className="wrap">
        {region && (
          <section className="section reveal">
            <SectionHead id="map" n="01" title="Feedstock radar" about="Click a region. Dashed frames show the satellite window; pulsing rings flag 90-day rainfall more than 15 % below normal." />
            <div className="g12" style={{ marginTop: 22, rowGap: 28 }}>
              <div className="map-wrap">
                <WorldMap regions={regions} selected={selected} onSelect={setSelected} />
                <div className="region-list">
                  <div className="region-row head">
                    <span>#</span><span>Region</span><span className="crop">Crop</span><span className="r">Rain 90d</span><span className="r">Temp</span>
                  </div>
                  {regions.map((r, i) => (
                    <div key={r.id} className={`region-row${r.id === selected ? ' active' : ''}`} onClick={() => setSelected(r.id)}>
                      <span className="muted">{String(i + 1).padStart(2, '0')}</span>
                      <span>{r.name}</span>
                      <span className="crop muted">{r.crop}</span>
                      <span className={`r num${(r.weather?.precipAnomalyPct ?? 0) < -15 ? ' neg' : ''}`}>{r.weather ? signed(r.weather.precipAnomalyPct, 0, ' %') : '—'}</span>
                      <span className={`r num${(r.weather?.tempAnomaly ?? 0) > 1 ? ' neg' : ''}`}>{r.weather ? signed(r.weather.tempAnomaly, 1, '°') : '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="map-side">
                <RegionPanel key={region.id} region={region} index={selIdx} />
              </div>
            </div>
          </section>
        )}

        {prices && (
          <section className="section reveal">
            <SectionHead id="prices" n="02" title="Prices & spreads" about="Feedstock oils against fossil diesel. When vegetable oil trades far above diesel, blending only works because mandates force it — the spread is the cost of compliance." />
            <Prices prices={prices} />
          </section>
        )}

        <section className="section reveal">
          <SectionHead id="policy" n="03" title="Policy & demand" about="Mandates are the demand side of the market. Values from legal texts where marked real; others still to be checked against the primary source." />
          <Policy />
        </section>

        {prices && regions.length > 0 && (
          <section className="section reveal">
            <SectionHead id="signal" n="04" title="Signal & credibility" about="From a weather anomaly to a feedstock cost, step by step, with uncertainty carried along. Then: what the signal is worth if you trust it the right amount." />
            <Signal regions={regions} prices={prices} />
          </section>
        )}

        <section className="section reveal">
          <SectionHead id="sources" n="05" title="Data & method" about="Every number carries its status. Nothing here is investment advice." />
          <div className="g12" style={{ marginTop: 22, rowGap: 24 }}>
            <div style={{ gridColumn: '1 / span 8' }} className="table-scroll">
              <table className="sources-table">
                <thead><tr><th>Layer</th><th>Source</th><th>Resolution</th><th>Status</th></tr></thead>
                <tbody>
                  <tr><td>Vegetation</td><td><a href="https://gibs.earthdata.nasa.gov/" target="_blank" rel="noreferrer">NASA GIBS · MODIS Terra NDVI</a></td><td>8-day composite, ~1 km</td><td><Badge status="real" /></td></tr>
                  <tr><td>Weather</td><td><a href="https://open-meteo.com/en/docs/historical-weather-api" target="_blank" rel="noreferrer">Open-Meteo historical API (ERA5)</a></td><td>daily, one point per region, 2016–today</td><td><Badge status="real" /></td></tr>
                  <tr><td>Feedstock & crude prices</td><td><a href="https://www.worldbank.org/en/research/commodity-markets" target="_blank" rel="noreferrer">World Bank Pink Sheet</a></td><td>monthly, {prices?.series.palm.updated}</td><td><Badge status="real" /></td></tr>
                  <tr><td>Diesel</td><td><a href="https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=EER_EPD2DXL0_PF4_Y35NY_DPG&f=M" target="_blank" rel="noreferrer">U.S. EIA · NY Harbor ULSD</a></td><td>monthly, $/gal → $/t</td><td><Badge status="real" /></td></tr>
                  <tr><td>HVO, SAF, ethanol</td><td>Simulated from feedstock and diesel</td><td>monthly</td><td><Badge status="example" /></td></tr>
                  <tr><td>Yield, supply, price links</td><td>Transparent illustrative model</td><td>—</td><td><Badge status="model" /></td></tr>
                  <tr><td>Mandates</td><td>Legal texts and agencies (see table)</td><td>annual</td><td><Badge status="real" /> <Badge status="check" /></td></tr>
                </tbody>
              </table>
            </div>
            <div style={{ gridColumn: '9 / span 4' }}>
              <p className="lead" style={{ fontSize: 17 }}>
                Next step: replace the illustrative links with estimated ones — NDVI and weather to yields, yields to supply, supply to price — and attach valid uncertainty to each. Then measure what the signal is worth after accounting for how much it can be trusted.
              </p>
            </div>
          </div>
        </section>

        <footer className="footer g12">
          <span style={{ gridColumn: '1 / span 4' }}>■ Biofuel Radar — research demo</span>
          <span style={{ gridColumn: '5 / span 4' }} className="muted">Prices to {prices?.series.palm.data.at(-1)?.[0]} · weather to {regionFile?.weatherEnd} · built {prices?.generated}</span>
          <span style={{ gridColumn: '9 / span 4', textAlign: 'right' }} className="muted">Not investment advice</span>
        </footer>
      </main>
    </>
  )
}
