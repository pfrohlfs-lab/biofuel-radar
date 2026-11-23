import { useState } from 'react'
import type { Factor, Category } from '../lib/drivers'
import { Badge } from './Badge'

const CATS: Category[] = ['Weather', 'Forecast', 'Vegetation', 'Climate', 'Shipping', 'FX', 'Energy', 'Trade policy']

export function DriverMatrix({ factors, onRegion }: { factors: Factor[]; onRegion: (id: string) => void }) {
  const [cat, setCat] = useState<Category | 'All'>('All')
  const bull = factors.filter((f) => f.dir === 1).length
  const bear = factors.filter((f) => f.dir === -1).length
  const neutral = factors.length - bull - bear
  const net = bull - bear
  const shown = cat === 'All' ? factors : factors.filter((f) => f.category === cat)
  const counts = Object.fromEntries(CATS.map((c) => [c, factors.filter((f) => f.category === c).length]))

  return (
    <div className="drivers">
      <div className="panel-head">
        <span>Price drivers · {factors.length} inputs</span>
        <span className="muted">▲ supports price · ▼ weighs on price</span>
      </div>
      <div className="balance">
        <div className="gauge">
          <div className="gauge-bull" style={{ width: `${(bull / Math.max(1, factors.length)) * 100}%` }} />
          <div className="gauge-neu" style={{ width: `${(neutral / Math.max(1, factors.length)) * 100}%` }} />
          <div className="gauge-bear" style={{ width: `${(bear / Math.max(1, factors.length)) * 100}%` }} />
        </div>
        <div className="balance-row">
          <span className="up num">▲ {bull}</span>
          <span className="muted num">● {neutral}</span>
          <span className="down num">▼ {bear}</span>
          <span className={`net num ${net > 0 ? 'up' : net < 0 ? 'down' : 'muted'}`}>Net {net > 0 ? '+' : ''}{net} · {net > 1 ? 'supportive' : net < -1 ? 'bearish' : 'balanced'}</span>
          <Badge status="model" />
        </div>
      </div>
      <div className="cat-tabs">
        <button className={cat === 'All' ? 'active' : ''} onClick={() => setCat('All')}>All</button>
        {CATS.filter((c) => counts[c] > 0).map((c) => (
          <button key={c} className={cat === c ? 'active' : ''} onClick={() => setCat(c)}>{c} <span className="muted">{counts[c]}</span></button>
        ))}
      </div>
      <div className="factor-list">
        {shown.map((f, i) => (
          <div key={i} className={`factor${f.regionId ? ' link' : ''}`} onClick={() => f.regionId && onRegion(f.regionId)}>
            <span className={`dir ${f.dir === 1 ? 'up' : f.dir === -1 ? 'down' : 'muted'}`}>{f.dir === 1 ? '▲' : f.dir === -1 ? '▼' : '●'}</span>
            <span className="cat muted">{f.category}</span>
            <span className="fname">{f.name}</span>
            <span className="num fval">{f.value}</span>
            <span className="why muted">{f.why}</span>
            <Badge status={f.status} />
          </div>
        ))}
        {shown.length === 0 && <div className="small muted" style={{ padding: 12 }}>No inputs in this category for this instrument.</div>}
      </div>
    </div>
  )
}
