import { useState } from 'react'
import type { Region } from '../lib/types'
import { yieldDeviation, signed } from '../lib/model'
import { PrecipBars } from './Charts'
import { Badge } from './Badge'

export function RegionPanel({ region, index }: { region: Region; index: number }) {
  const [year, setYear] = useState<'now' | 'ly'>('now')
  const w = region.weather
  const y = w ? yieldDeviation(region, w.precipAnomalyPct, w.tempAnomaly) : null
  const img = year === 'now' ? region.ndvi.current : region.ndvi.lastYear
  const date = year === 'now' ? region.ndvi.date : region.ndvi.dateLastYear

  return (
    <div className="panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
        <span>● {String(index + 1).padStart(2, '0')} / {region.country}</span>
        <span className="muted">{region.share}</span>
      </div>
      <h3 className="h3" style={{ marginTop: 8, fontSize: 30, lineHeight: 1 }}>{region.name}</h3>
      <div className="chips">
        <span className="chip solid">{region.crop}</span>
        {region.fuels.map((f) => <span key={f} className="chip">→ {f}</span>)}
      </div>

      <div className="ndvi">
        {img ? <img key={img} src={`/ndvi/${img}`} alt={`MODIS NDVI ${region.name} ${date}`} /> : null}
        <div className="scan" />
        <div className="cap">NDVI · 8-day composite · {date}</div>
        <div className="cap-r pill" style={{ background: '#efefef', color: '#111', borderColor: '#111' }}>
          <button className={year === 'now' ? 'active' : ''} style={year === 'now' ? { background: '#111', color: '#efefef' } : undefined} onClick={() => setYear('now')}>{region.ndvi.date.slice(0, 4)}</button>
          <button className={year === 'ly' ? 'active' : ''} style={year === 'ly' ? { background: '#111', color: '#efefef' } : undefined} onClick={() => setYear('ly')}>{region.ndvi.dateLastYear.slice(0, 4)}</button>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        <span className="small muted">Satellite: {region.ndvi.source}</span>
        <Badge status="real" />
      </div>

      {w && (
        <>
          <div className="kpis">
            <div className="kpi">
              <span className="small muted">Rainfall, last 90 days</span>
              <b className={w.precipAnomalyPct < -15 ? 'neg' : ''}>{signed(w.precipAnomalyPct, 0, ' %')}</b>
              <span className="small muted">{w.precip90} mm vs. {w.precipNormal90} mm normal</span>
            </div>
            <div className="kpi">
              <span className="small muted">Temperature, last 90 days</span>
              <b className={w.tempAnomaly > 1 ? 'neg' : ''}>{signed(w.tempAnomaly, 1, ' °C')}</b>
              <span className="small muted">vs. 2016–2025 normal</span>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="small">Monthly rainfall vs. 10-year normal (dashed)</span>
              <Badge status="real" />
            </div>
            <PrecipBars months={w.monthly} />
          </div>
        </>
      )}

      <div className="kpis" style={{ gridTemplateColumns: '1fr' }}>
        <div className="kpi" style={{ borderRight: 0, paddingRight: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="small muted">Yield assumption from weather signal</span>
            <Badge status="model" />
          </div>
          {y ? (
            <>
              <b className={y.dev < 0 ? 'neg' : ''}>{signed(y.dev, 1, ' %')}</b>
              <span className="small muted">vs. trend · band {signed(y.lo, 1)} to {signed(y.hi, 1, ' %')} · illustrative sensitivities</span>
            </>
          ) : (
            <>
              <b>n/a</b>
              <span className="small muted">Used cooking oil depends on food consumption, not on weather.</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
