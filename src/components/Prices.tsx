import { useMemo, useState } from 'react'
import type { PriceFile, Series } from '../lib/types'
import { LineChart, Sparkline } from './Charts'
import type { LineSpec } from './Charts'
import { Badge } from './Badge'
import { fmt, signed } from '../lib/model'

const MAIN = ['palm', 'soyoil', 'rapeoil', 'diesel', 'hvo', 'saf'] as const
const STYLE: Record<string, { color: string; weight?: number }> = {
  palm: { color: 'var(--ink)', weight: 1.8 },
  soyoil: { color: 'var(--ink)', weight: 1 },
  rapeoil: { color: 'var(--muted)', weight: 1.4 },
  diesel: { color: 'var(--accent)', weight: 1.6 },
  hvo: { color: 'var(--ink)', weight: 1.1 },
  saf: { color: 'var(--muted)', weight: 1.1 },
}
const RANGES = { '3Y': 36, '5Y': 60, Max: 999 } as const

function spread(a: Series, b: Series): [string, number][] {
  const bm = new Map(b.data)
  return a.data.filter(([m]) => bm.has(m)).map(([m, v]) => [m, v - (bm.get(m) as number)])
}

export function Prices({ prices }: { prices: PriceFile }) {
  const s = prices.series
  const [on, setOn] = useState<Record<string, boolean>>({ palm: true, soyoil: true, rapeoil: true, diesel: true, hvo: true, saf: true })
  const [range, setRange] = useState<keyof typeof RANGES>('5Y')

  const lines: LineSpec[] = useMemo(
    () =>
      MAIN.filter((k) => on[k]).map((k) => ({
        key: k,
        label: s[k].label,
        data: s[k].data.slice(-RANGES[range]),
        dashed: s[k].status === 'example',
        ...STYLE[k],
      })),
    [on, range, s],
  )

  const spreads = [
    { key: 'pogo', label: 'Palm oil − diesel', sub: 'POGO-type spread', data: spread(s.palm, s.diesel), status: 'real' as const },
    { key: 'boho', label: 'Soybean oil − diesel', sub: 'BOHO-type spread', data: spread(s.soyoil, s.diesel), status: 'real' as const },
    { key: 'rape', label: 'Rapeseed oil − diesel', sub: 'EU FAME feedstock', data: spread(s.rapeoil, s.diesel), status: 'real' as const },
    { key: 'hvop', label: 'HVO premium', sub: 'HVO − diesel', data: spread(s.hvo, s.diesel), status: 'example' as const },
    { key: 'safp', label: 'SAF premium', sub: 'SAF − HVO', data: spread(s.saf, s.hvo), status: 'example' as const },
  ]

  const last = (d: [string, number][]) => d[d.length - 1]
  const yoy = (d: [string, number][]) => (d.length > 12 ? last(d)[1] - d[d.length - 13][1] : 0)

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', margin: '18px 0 10px' }}>
        <div className="legend">
          {MAIN.map((k) => (
            <button key={k} className={on[k] ? '' : 'off'} onClick={() => setOn({ ...on, [k]: !on[k] })}>
              <i className={`sw${s[k].status === 'example' ? ' dash' : ''}`} style={{ borderTopColor: STYLE[k].color }} />
              {s[k].label}
            </button>
          ))}
        </div>
        <div className="pill">
          {(Object.keys(RANGES) as (keyof typeof RANGES)[]).map((r) => (
            <button key={r} className={range === r ? 'active' : ''} onClick={() => setRange(r)}>{r}</button>
          ))}
        </div>
      </div>
      <LineChart lines={lines} height={380} />
      <div className="small muted" style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 8 }}>
        <span>Solid: real monthly prices (World Bank, EIA) to {last(s.palm.data)[0]}.</span>
        <span style={{ color: 'var(--accent)' }}>Dashed: example series — real HVO/SAF assessments are paywalled (Argus, Platts).</span>
      </div>

      <div className="spreads">
        {spreads.map((sp) => {
          const l = last(sp.data)
          return (
            <div key={sp.key} className="spread">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span className="small">{sp.label}</span>
                <Badge status={sp.status} />
              </div>
              <b className="num">{signed(l[1], 0)}</b>
              <div className="small muted">$/t · {sp.sub} · {signed(yoy(sp.data), 0)} y/y</div>
              <div style={{ marginTop: 8 }}>
                <Sparkline data={sp.data.slice(-36)} dashed={sp.status === 'example'} />
              </div>
            </div>
          )
        })}
      </div>

      <div className="g12" style={{ marginTop: 34 }}>
        {(['maize', 'sugar', 'ethanol', 'brent'] as const).map((k) => {
          const ser = s[k]
          const l = last(ser.data)
          return (
            <div key={k} style={{ gridColumn: 'span 3', borderTop: '1px solid var(--ink)', paddingTop: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="small">{ser.label}</span>
                <Badge status={ser.status} />
              </div>
              <div style={{ fontSize: 30, letterSpacing: '-0.03em', margin: '6px 0 2px' }} className="num">{fmt(l[1], k === 'brent' ? 1 : 0)}</div>
              <div className="small muted">{ser.unit} · {l[0]}</div>
              <Sparkline data={ser.data.slice(-60)} dashed={ser.status === 'example'} />
            </div>
          )
        })}
      </div>
    </>
  )
}
