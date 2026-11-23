import { useMemo, useState } from 'react'
import type { PriceFile, Region } from '../lib/types'
import type { Instrument } from '../data/instruments'
import { LineChart } from './Charts'
import type { LineSpec } from './Charts'
import { Badge } from './Badge'
import { fmt, logReturns, signed, std } from '../lib/model'

const RANGES = { '1Y': 12, '3Y': 36, '5Y': 60, MAX: 999 } as const

export function InstrumentView({ inst, prices, regions, selectedRegion, onRegion }: {
  inst: Instrument
  prices: PriceFile
  regions: Region[]
  selectedRegion: string
  onRegion: (id: string) => void
}) {
  const s = prices.series[inst.key]
  const [range, setRange] = useState<keyof typeof RANGES>('3Y')
  const [vsDiesel, setVsDiesel] = useState(true)
  const d = s.data
  const last = d[d.length - 1]
  const chg = (n: number) => (d.length > n ? ((last[1] - d[d.length - 1 - n][1]) / d[d.length - 1 - n][1]) * 100 : 0)
  const yr = d.slice(-12).map((x) => x[1])
  const vol = std(logReturns(s, 12)) * Math.sqrt(12) * 100

  const lines: LineSpec[] = useMemo(() => {
    const out: LineSpec[] = [{ key: inst.key, label: s.label, data: d.slice(-RANGES[range]), dashed: s.status === 'example', color: 'var(--up)', weight: 1.8 }]
    if (vsDiesel && inst.key !== 'diesel' && inst.key !== 'brent' && s.unit === '$/t') {
      out.push({ key: 'diesel', label: 'Diesel benchmark', data: prices.series.diesel.data.slice(-RANGES[range]), color: 'var(--muted)', weight: 1 })
    }
    return out
  }, [inst.key, s, d, range, vsDiesel, prices.series.diesel.data])

  const linked = regions.filter((r) => inst.regions.includes(r.id))

  return (
    <div className="instrument">
      <div className="inst-head">
        <div>
          <div className="inst-code">{inst.code} <span className="muted">· {inst.group === 'fuels' ? 'Fuel' : 'Feedstock'}</span></div>
          <div className="inst-name">{inst.name}</div>
          <div className="small muted">{inst.pathway}</div>
        </div>
        <div className="inst-price">
          <div className="num big">{fmt(last[1], s.unit === '$/bbl' ? 1 : 0)}<span className="unit">{s.unit}</span></div>
          <div className="small">
            <span className={`num ${chg(1) < 0 ? 'down' : 'up'}`}>{signed(chg(1), 1, '%')} 1M</span>
            <span className="muted"> · {last[0]} · </span>
            <Badge status={s.status} />
          </div>
        </div>
      </div>

      <div className="chart-bar">
        <div className="pill">
          {(Object.keys(RANGES) as (keyof typeof RANGES)[]).map((r) => (
            <button key={r} className={r === range ? 'active' : ''} onClick={() => setRange(r)}>{r}</button>
          ))}
        </div>
        {s.unit === '$/t' && inst.key !== 'diesel' && (
          <label className="small toggle-line"><input type="checkbox" checked={vsDiesel} onChange={(e) => setVsDiesel(e.target.checked)} /> vs. diesel</label>
        )}
        <span className="small muted" style={{ marginLeft: 'auto' }}>{s.source}</span>
      </div>
      <LineChart lines={lines} height={300} unit={s.unit} />

      <div className="stats">
        <div><span className="muted small">3M</span><b className={`num ${chg(3) < 0 ? 'down' : 'up'}`}>{signed(chg(3), 1, '%')}</b></div>
        <div><span className="muted small">1Y</span><b className={`num ${chg(12) < 0 ? 'down' : 'up'}`}>{signed(chg(12), 1, '%')}</b></div>
        <div><span className="muted small">12M high</span><b className="num">{fmt(Math.max(...yr))}</b></div>
        <div><span className="muted small">12M low</span><b className="num">{fmt(Math.min(...yr))}</b></div>
        <div><span className="muted small">Vol (ann.)</span><b className="num">{vol.toFixed(0)}%</b></div>
      </div>

      <div className="linked">
        <span className="small muted">Supply regions</span>
        <div className="select-pills">
          {linked.length === 0 && <span className="small muted">Fossil benchmark — no crop exposure. Pick a fuel or feedstock to see its regions.</span>}
          {linked.map((r) => (
            <button key={r.id} className={r.id === selectedRegion ? 'active' : ''} onClick={() => onRegion(r.id)}>
              {r.name}
              <span className={`num ${(r.weather?.precipAnomalyPct ?? 0) < -15 ? 'down' : 'muted'}`} style={{ marginLeft: 6 }}>{r.weather ? signed(r.weather.precipAnomalyPct, 0, '%') : ''}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
