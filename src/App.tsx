import { useEffect, useMemo, useState } from 'react'
import type { DriversFile, ImageryFile, PriceFile, RegionFile } from './lib/types'
import { DriverMatrix } from './components/DriverMatrix'
import { Macro } from './components/Macro'
import { buildFactors } from './lib/drivers'
import { Watchlist } from './components/Watchlist'
import type { Tab } from './components/Watchlist'
import { InstrumentView } from './components/InstrumentView'
import { SupplyMap } from './components/SupplyMap'
import { SatPanel } from './components/SatPanel'
import { Prices } from './components/Prices'
import { Policy } from './components/Policy'
import { Signal } from './components/Signal'
import { Badge } from './components/Badge'
import { INSTRUMENTS } from './data/instruments'
import { fmt } from './lib/model'
import { loadJson } from './lib/asset'

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

const BOTTOM = ['Shipping, FX & trade', 'Signal & credibility', 'Spreads', 'Policy & demand', 'Data & method'] as const

export default function App() {
  const [prices, setPrices] = useState<PriceFile | null>(null)
  const [regionFile, setRegionFile] = useState<RegionFile | null>(null)
  const [imagery, setImagery] = useState<ImageryFile | null>(null)
  const [drivers, setDrivers] = useState<DriversFile | null>(null)
  const [grid, setGrid] = useState(false)
  const [dark, setDark] = useState(true)
  const [tab, setTab] = useState<Tab>('feedstocks')
  const [instKey, setInstKey] = useState('palm')
  const [regionId, setRegionId] = useState('id-palm')
  const [bottom, setBottom] = useState<(typeof BOTTOM)[number]>('Shipping, FX & trade')
  const [clock, setClock] = useState(() => new Date())

  useEffect(() => {
    loadJson<PriceFile>('data/prices.json').then(setPrices)
    loadJson<RegionFile>('data/regions.json').then(setRegionFile)
    loadJson<DriversFile>('data/drivers.json').then(setDrivers).catch(() => setDrivers(null))
    loadJson<ImageryFile>('data/imagery.json').then(setImagery).catch(() => setImagery(null))
    const t = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  }, [dark])

  const regions = regionFile?.regions ?? []
  const inst = INSTRUMENTS.find((i) => i.key === instKey) ?? INSTRUMENTS[0]
  const regionIdx = Math.max(0, regions.findIndex((r) => r.id === regionId))
  const region = regions[regionIdx]

  const selectInstrument = (k: string) => {
    setInstKey(k)
    const i = INSTRUMENTS.find((x) => x.key === k)
    if (i && i.regions[0]) setRegionId(i.regions[0])
  }
  const selectRegion = (id: string) => {
    setRegionId(id)
    if (!inst.regions.includes(id)) {
      const feed = INSTRUMENTS.find((i) => i.group === 'feedstocks' && i.regions.includes(id))
      if (feed) setInstKey(feed.key)
    }
  }

  const factors = useMemo(() => (prices && regionFile ? buildFactors(inst, regionFile.regions, prices, imagery, drivers) : []), [inst, prices, regionFile, imagery, drivers])

  const ticker = useMemo(() => {
    if (!prices) return []
    return INSTRUMENTS.map((i) => {
      const s = prices.series[i.key]
      const d = s.data
      const last = d[d.length - 1][1]
      const ch = ((last - d[d.length - 2][1]) / d[d.length - 2][1]) * 100
      return { ...i, last, ch, unit: s.unit, ex: s.status === 'example' }
    })
  }, [prices])

  if (!prices || !regionFile) {
    return <div className="loading">■ BIOFUEL RADAR · loading market data…</div>
  }

  return (
    <>
      <div className={`grid-overlay${grid ? ' on' : ''}`} aria-hidden>
        {Array.from({ length: 12 }, (_, i) => <div key={i} />)}
      </div>

      <header className="topbar wrap">
        <div className="topbar-inner">
          <div className="brand"><i />BIOFUEL RADAR <span className="muted" style={{ fontWeight: 400 }}>· feedstock intelligence terminal</span></div>
          <nav className="nav">
            <a href="#terminal">Terminal</a><span>/</span>
            <a href="#analysis">Analysis</a><span>/</span>
            <a href="#about">About</a>
          </nav>
          <Toggle label="Grid" value={grid} onChange={setGrid} className="hide-sm" />
          <Toggle label="Mode" value={!dark} onChange={(v) => setDark(!v)} a="Light" b="Dark" />
          <div className="right num">{clock.toISOString().slice(0, 19).replace('T', ' ')} UTC</div>
        </div>
      </header>

      <div className="ticker" aria-label="Latest monthly prices">
        <div className="ticker-track">
          {[0, 1].map((rep) => (
            <div key={rep} style={{ display: 'inline-flex', paddingLeft: 30 }}>
              {ticker.map((t) => (
                <button key={t.key + rep} className="tick" onClick={() => { setTab(t.group); selectInstrument(t.key) }}>
                  <b>{t.code}</b>
                  <span className="num">{fmt(t.last, t.unit === '$/bbl' ? 1 : 0)}</span>
                  <span className={`num ${t.ch < 0 ? 'down' : 'up'}`}>{t.ch < 0 ? '▼' : '▲'} {Math.abs(t.ch).toFixed(1)}%</span>
                  {t.ex && <span className="badge example">ex</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      <main className="wrap">
        <section className="terminal" id="terminal">
          <aside className="t-left">
            <Watchlist
              tab={tab}
              setTab={setTab}
              prices={prices}
              regions={regions}
              imagery={imagery}
              instrument={instKey}
              region={regionId}
              onInstrument={selectInstrument}
              onRegion={selectRegion}
            />
          </aside>
          <div className="t-center">
            <InstrumentView inst={inst} prices={prices} regions={regions} selectedRegion={regionId} onRegion={selectRegion} />
            <DriverMatrix factors={factors} onRegion={selectRegion} />
            {imagery && imagery.world.length > 0 && (
              <SupplyMap frames={imagery.world} regions={regions} linked={inst.regions} selected={regionId} onSelect={selectRegion} />
            )}
          </div>
          <aside className="t-right">
            {region && <SatPanel region={region} img={imagery?.regions[region.id]} index={regionIdx} forecast={drivers?.forecast[region.id]} />}
          </aside>
        </section>

        <section className="analysis" id="analysis">
          <div className="tabs big-tabs">
            {BOTTOM.map((b, i) => (
              <button key={b} className={b === bottom ? 'active' : ''} onClick={() => setBottom(b)}>
                <span className="muted">({String(i + 1).padStart(2, '0')})</span> {b}
              </button>
            ))}
          </div>
          <div className="analysis-body">
            {bottom === 'Shipping, FX & trade' && drivers && <Macro drivers={drivers} />}
            {bottom === 'Signal & credibility' && <Signal regions={regions} prices={prices} />}
            {bottom === 'Spreads' && <Prices prices={prices} />}
            {bottom === 'Policy & demand' && <Policy />}
            {bottom === 'Data & method' && <DataMethod prices={prices} imagery={imagery} weatherEnd={regionFile.weatherEnd} />}
          </div>
        </section>

        <section className="about g12" id="about">
          <div style={{ gridColumn: '1 / span 7' }}>
            <h2 className="h2">What is a satellite signal worth?</h2>
          </div>
          <p className="lead" style={{ gridColumn: '8 / span 5' }}>
            From orbit to the single field: satellites watch every growing region behind FAME, HVO, SAF and ethanol, weeks before harvest data or prices react.
            This demo links those images to feedstock prices and mandates. The research question is how much such a signal is worth in trading — and how much it can be trusted.
          </p>
        </section>

        <footer className="footer g12">
          <span style={{ gridColumn: '1 / span 4' }}>■ Biofuel Radar — research demo · not investment advice</span>
          <span style={{ gridColumn: '5 / span 5' }} className="muted">Prices to {prices.series.palm.data.at(-1)?.[0]} · weather to {regionFile.weatherEnd} · imagery to {imagery?.dates.at(-1) ?? '—'}</span>
          <span style={{ gridColumn: '10 / span 3', textAlign: 'right' }} className="muted">Contains modified Copernicus Sentinel data 2023</span>
        </footer>
      </main>
    </>
  )
}

function DataMethod({ prices, imagery, weatherEnd }: { prices: PriceFile; imagery: ImageryFile | null; weatherEnd: string }) {
  return (
    <div className="g12" style={{ rowGap: 24 }}>
      <div style={{ gridColumn: '1 / span 8' }} className="table-scroll">
        <table className="sources-table">
          <thead><tr><th>Layer</th><th>Source</th><th>Resolution / as of</th><th>Status</th></tr></thead>
          <tbody>
            <tr><td>Vegetation (NDVI)</td><td><a href="https://gibs.earthdata.nasa.gov/" target="_blank" rel="noreferrer">NASA GIBS · MODIS Terra NDVI 8-day</a></td><td>~250 m · to {imagery?.dates.at(-1) ?? '—'}</td><td><Badge status="real" /></td></tr>
            <tr><td>Field imagery</td><td><a href="https://s2maps.eu" target="_blank" rel="noreferrer">Sentinel-2 cloudless 2023 by EOX</a> (CC BY-NC-SA 4.0)</td><td>10 m · annual mosaic</td><td><Badge status="real" /></td></tr>
            <tr><td>Mean NDVI per frame</td><td>Decoded from GIBS colour map MODIS_NDVI v1.3</td><td>12 monthly frames + year before</td><td><Badge status="real" /></td></tr>
            <tr><td>Weather forecast</td><td><a href="https://open-meteo.com/en/docs" target="_blank" rel="noreferrer">Open-Meteo forecast API</a></td><td>16 days, daily</td><td><Badge status="real" /></td></tr>
            <tr><td>Shipping</td><td><a href="https://portwatch.imf.org/" target="_blank" rel="noreferrer">IMF PortWatch chokepoints</a></td><td>daily transits</td><td><Badge status="real" /></td></tr>
            <tr><td>ENSO</td><td><a href="https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt" target="_blank" rel="noreferrer">NOAA CPC ONI</a></td><td>3-month seasons</td><td><Badge status="real" /></td></tr>
            <tr><td>FX</td><td><a href="https://frankfurter.dev/" target="_blank" rel="noreferrer">ECB reference rates (Frankfurter)</a></td><td>daily</td><td><Badge status="real" /></td></tr>
            <tr><td>Trade policy</td><td>Curated tariffs, levies, export taxes</td><td>event-based</td><td><Badge status="check" /></td></tr>
            <tr><td>Weather</td><td><a href="https://open-meteo.com/en/docs/historical-weather-api" target="_blank" rel="noreferrer">Open-Meteo historical API (ERA5)</a></td><td>daily · to {weatherEnd}</td><td><Badge status="real" /></td></tr>
            <tr><td>Feedstock & crude prices</td><td><a href="https://www.worldbank.org/en/research/commodity-markets" target="_blank" rel="noreferrer">World Bank Pink Sheet</a></td><td>monthly · {prices.series.palm.updated}</td><td><Badge status="real" /></td></tr>
            <tr><td>Diesel</td><td><a href="https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=EER_EPD2DXL0_PF4_Y35NY_DPG&f=M" target="_blank" rel="noreferrer">U.S. EIA · NY Harbor ULSD</a></td><td>monthly · $/gal → $/t</td><td><Badge status="real" /></td></tr>
            <tr><td>HVO, SAF, FAME, ethanol, UCO</td><td>Simulated from feedstock and diesel — real assessments are paywalled</td><td>monthly</td><td><Badge status="example" /></td></tr>
            <tr><td>Yield, supply, price links</td><td>Transparent illustrative model</td><td>—</td><td><Badge status="model" /></td></tr>
            <tr><td>Mandates</td><td>Legal texts and agencies</td><td>annual</td><td><Badge status="real" /> <Badge status="check" /></td></tr>
          </tbody>
        </table>
      </div>
      <div style={{ gridColumn: '9 / span 4' }}>
        <p className="lead" style={{ fontSize: 17 }}>
          Next step: estimate the links — NDVI and weather to yields, yields to supply, supply to price — with valid uncertainty, then measure what the signal is worth after accounting for how far it can be trusted.
        </p>
      </div>
    </div>
  )
}
