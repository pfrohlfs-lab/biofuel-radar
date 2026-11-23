import type { ImageryFile, PriceFile, Region } from '../lib/types'
import { INSTRUMENTS } from '../data/instruments'
import type { Group } from '../data/instruments'
import { Sparkline } from './Charts'
import { fmt, signed } from '../lib/model'

export type Tab = Group | 'regions'

export function Watchlist({ tab, setTab, prices, regions, imagery, instrument, region, onInstrument, onRegion }: {
  tab: Tab
  setTab: (t: Tab) => void
  prices: PriceFile
  regions: Region[]
  imagery: ImageryFile | null
  instrument: string
  region: string
  onInstrument: (k: string) => void
  onRegion: (id: string) => void
}) {
  return (
    <div className="watch">
      <div className="panel-head"><span>Markets</span><span className="muted">monthly</span></div>
      <div className="tabs">
        {(['fuels', 'feedstocks', 'regions'] as Tab[]).map((t) => (
          <button key={t} className={t === tab ? 'active' : ''} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>
        ))}
      </div>
      {tab !== 'regions' ? (
        <div className="rows">
          {INSTRUMENTS.filter((i) => i.group === tab).map((i) => {
            const s = prices.series[i.key]
            const d = s.data
            const last = d[d.length - 1][1]
            const ch = ((last - d[d.length - 2][1]) / d[d.length - 2][1]) * 100
            return (
              <button key={i.key} className={`row${i.key === instrument ? ' active' : ''}`} onClick={() => onInstrument(i.key)}>
                <span className="code">{i.code}{s.status === 'example' && <em title="Example data">ex</em>}</span>
                <span className="num last">{fmt(last, s.unit === '$/bbl' ? 1 : 0)}</span>
                <span className={`num ch ${ch < 0 ? 'down' : 'up'}`}>{signed(ch, 1, '%')}</span>
                <span className="name muted">{i.name}</span>
                <span className="spark"><Sparkline data={d.slice(-24)} height={22} dashed={s.status === 'example'} /></span>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="rows">
          {regions.map((r, k) => {
            const nd = imagery?.regions[r.id]
            const last = nd?.ndvi.filter((x) => x[1] != null).at(-1)
            const ly = last ? nd?.ndviLastYear.find((x) => x[0] === last[0]) : undefined
            const delta = last && ly?.[1] != null ? ((last[1]! - ly[1]) / ly[1]) * 100 : null
            return (
              <button key={r.id} className={`row${r.id === region ? ' active' : ''}`} onClick={() => onRegion(r.id)}>
                <span className="code">{String(k + 1).padStart(2, '0')} {r.crop.split(' ')[0].toUpperCase()}</span>
                <span className={`num last ${delta != null && delta < 0 ? 'down' : ''}`}>{delta != null ? signed(delta, 1, '%') : '—'}</span>
                <span className={`num ch ${(r.weather?.precipAnomalyPct ?? 0) < -15 ? 'down' : 'muted'}`}>{r.weather ? signed(r.weather.precipAnomalyPct, 0, '%') : '—'}</span>
                <span className="name muted">{r.name}</span>
              </button>
            )
          })}
          <div className="small muted" style={{ padding: '8px 10px' }}>NDVI vs. last year · rain 90 d vs. normal</div>
        </div>
      )}
      <Alerts regions={regions} imagery={imagery} onRegion={onRegion} />
    </div>
  )
}

function Alerts({ regions, imagery, onRegion }: { regions: Region[]; imagery: ImageryFile | null; onRegion: (id: string) => void }) {
  const items: { id: string; text: string; score: number; neg: boolean }[] = []
  for (const r of regions) {
    const w = r.weather
    if (w && Math.abs(w.precipAnomalyPct) >= 25) {
      items.push({ id: r.id, text: `${r.name}: rain ${signed(w.precipAnomalyPct, 0, '%')} vs. normal (90 d)`, score: Math.abs(w.precipAnomalyPct), neg: w.precipAnomalyPct < 0 })
    }
    const nd = imagery?.regions[r.id]
    const last = nd?.ndvi.filter((x) => x[1] != null).at(-1)
    const ly = last ? nd?.ndviLastYear.find((x) => x[0] === last[0]) : undefined
    if (last && ly?.[1] != null) {
      const d = ((last[1]! - ly[1]) / ly[1]) * 100
      if (Math.abs(d) >= 5) items.push({ id: r.id, text: `${r.name}: NDVI ${signed(d, 1, '%')} vs. last year`, score: Math.abs(d) * 4, neg: d < 0 })
    }
  }
  items.sort((a, b) => b.score - a.score)
  return (
    <div className="alerts">
      <div className="panel-head"><span>Satellite alerts</span><span className="muted">{items.length}</span></div>
      {items.slice(0, 7).map((a, k) => (
        <button key={k} className="alert" onClick={() => onRegion(a.id)}>
          <i className={a.neg ? '' : 'pos'} />
          <span>{a.text}</span>
        </button>
      ))}
    </div>
  )
}
