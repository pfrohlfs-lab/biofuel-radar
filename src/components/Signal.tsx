import { useEffect, useMemo, useState } from 'react'
import { scaleLinear } from 'd3-scale'
import { area, line } from 'd3-shape'
import type { PriceFile, Region } from '../lib/types'
import { expectedPnl, fmt, logReturns, overconfidenceLoss, signed, std, yieldDeviation } from '../lib/model'
import { Badge } from './Badge'

// Illustrative: share of global supply of the feedstock that the region represents,
// and which price series it moves. To be estimated properly in the thesis.
const LINK: Record<string, { series: string; share: number; feedstock: string }> = {
  'id-palm': { series: 'palm', share: 0.84, feedstock: 'palm oil' },
  'eu-rapeseed': { series: 'rapeoil', share: 0.22, feedstock: 'rapeseed oil' },
  'ca-canola': { series: 'rapeoil', share: 0.22, feedstock: 'rapeseed oil' },
  'au-canola': { series: 'rapeoil', share: 0.07, feedstock: 'rapeseed oil' },
  'us-cornbelt': { series: 'maize', share: 0.31, feedstock: 'corn' },
  'br-matogrosso': { series: 'soyoil', share: 0.12, feedstock: 'soybean oil' },
  'ar-pampas': { series: 'soyoil', share: 0.12, feedstock: 'soybean oil' },
  'br-saopaulo': { series: 'sugar', share: 0.2, feedstock: 'sugar' },
  'in-cane': { series: 'sugar', share: 0.16, feedstock: 'sugar' },
}
const PRICE_FLEX = 2.0 // % price change per −1 % global supply (illustrative)

const SKILL = [
  { label: 'Weather only', rho: 0.1 },
  { label: '+ Satellite NDVI', rho: 0.2 },
  { label: '+ Credible, verified signal', rho: 0.3 },
]

export function Signal({ regions, prices }: { regions: Region[]; prices: PriceFile }) {
  const candidates = regions.filter((r) => LINK[r.id])
  const [id, setId] = useState('id-palm')
  const region = candidates.find((r) => r.id === id) ?? candidates[0]
  const [rain, setRain] = useState(0)
  const [heat, setHeat] = useState(0)
  const [believed, setBelieved] = useState(0.3)
  const [trueRho, setTrueRho] = useState(0.15)

  useEffect(() => {
    setRain(Number((region.weather?.precipAnomalyPct ?? 0).toFixed(0)))
    setHeat(Math.round((region.weather?.tempAnomaly ?? 0) * 10) / 10)
  }, [region])

  const link = LINK[region.id]
  const ser = prices.series[link.series]
  const lastPrice = ser.data[ser.data.length - 1][1]
  const y = yieldDeviation(region, rain, heat) ?? { dev: 0, lo: 0, hi: 0 }
  const supply = { dev: y.dev * link.share, lo: y.lo * link.share, hi: y.hi * link.share }
  const price = { dev: -supply.dev * PRICE_FLEX, lo: -supply.hi * PRICE_FLEX, hi: -supply.lo * PRICE_FLEX }
  const usd = { dev: (price.dev / 100) * lastPrice, lo: (price.lo / 100) * lastPrice, hi: (price.hi / 100) * lastPrice }

  const sigma = useMemo(() => std(logReturns(ser, 120)), [ser])

  const steps = [
    { n: '01', title: 'Weather anomaly', sub: `${region.name}, 90 days`, value: `${signed(rain, 0, ' %')}`, band: `rain · ${signed(heat, 1, ' °C')} temperature`, status: 'real' as const, neg: rain < -10 },
    { n: '02', title: 'Yield deviation', sub: 'vs. trend, from weather signal', value: signed(y.dev, 1, ' %'), band: `band ${signed(y.lo, 1)} to ${signed(y.hi, 1, ' %')}`, status: 'model' as const, neg: y.dev < 0 },
    { n: '03', title: 'Global supply', sub: `of ${link.feedstock} (~${Math.round(link.share * 100)} % share)`, value: signed(supply.dev, 1, ' %'), band: `band ${signed(supply.lo, 1)} to ${signed(supply.hi, 1, ' %')}`, status: 'model' as const, neg: supply.dev < 0 },
    { n: '04', title: 'Price impact', sub: `${ser.label}, price flexibility ${PRICE_FLEX}`, value: signed(price.dev, 1, ' %'), band: `band ${signed(price.lo, 1)} to ${signed(price.hi, 1, ' %')}`, status: 'model' as const, neg: price.dev > 0 },
    { n: '05', title: 'Feedstock cost', sub: `on ${fmt(lastPrice)} $/t (${ser.data[ser.data.length - 1][0]})`, value: `${signed(usd.dev, 0)} $/t`, band: `HVO/SAF margin moves the other way`, status: 'model' as const, neg: usd.dev > 0 },
  ]

  return (
    <>
      <div className="g12" style={{ marginTop: 26, rowGap: 24 }}>
        <div style={{ gridColumn: '1 / span 4' }} className="controls">
          <div>
            <div className="small" style={{ marginBottom: 8 }}>Region</div>
            <div className="select-pills">
              {candidates.map((r) => (
                <button key={r.id} className={r.id === region.id ? 'active' : ''} onClick={() => setId(r.id)}>{r.crop} · {r.country}</button>
              ))}
            </div>
          </div>
          <div className="slider">
            <label><span>Rainfall anomaly, 90 days</span><span className="num">{signed(rain, 0, ' %')}</span></label>
            <input type="range" min={-60} max={60} step={1} value={rain} onChange={(e) => setRain(+e.target.value)} />
          </div>
          <div className="slider">
            <label><span>Temperature anomaly</span><span className="num">{signed(heat, 1, ' °C')}</span></label>
            <input type="range" min={-2} max={3} step={0.1} value={heat} onChange={(e) => setHeat(+e.target.value)} />
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            Sliders start at the real, observed anomaly for the selected region. Move them to run a scenario.
          </p>
        </div>
        <div style={{ gridColumn: '5 / span 8' }}>
          <div className="chain">
            {steps.map((s) => (
              <div key={s.n} className="step">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                  <span className="small">({s.n})</span>
                  <Badge status={s.status} />
                </div>
                <div style={{ marginTop: 10, fontSize: 15 }}>{s.title}</div>
                <div className="small muted">{s.sub}</div>
                <b className={`num${s.neg ? ' neg' : ''}`}>{s.value}</b>
                <div className="band">{s.band}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <CredibilityPanel sigma={sigma} seriesLabel={ser.label} believed={believed} trueRho={trueRho} setBelieved={setBelieved} setTrueRho={setTrueRho} />
    </>
  )
}

function CredibilityPanel({ sigma, seriesLabel, believed, trueRho, setBelieved, setTrueRho }: {
  sigma: number
  seriesLabel: string
  believed: number
  trueRho: number
  setBelieved: (v: number) => void
  setTrueRho: (v: number) => void
}) {
  const W = 640
  const H = 300
  const m = { t: 16, r: 16, b: 30, l: 56 }
  const x = scaleLinear().domain([0, 0.6]).range([m.l, W - m.r])
  const maxP = expectedPnl(0.6, sigma)
  const y = scaleLinear().domain([0, maxP]).nice().range([H - m.b, m.t])
  const pts = Array.from({ length: 61 }, (_, i) => i / 100)
  const curve = line<number>().x((r) => x(r)).y((r) => y(expectedPnl(r, sigma)))(pts) ?? ''
  const band = area<number>()
    .x((r) => x(r))
    .y0((r) => y(expectedPnl(Math.max(0, r - 0.08), sigma)))
    .y1((r) => y(expectedPnl(Math.min(0.6, r + 0.08), sigma)))(pts) ?? ''
  const loss = overconfidenceLoss(believed, trueRho, sigma)
  const gap = expectedPnl(believed, sigma) - expectedPnl(trueRho, sigma)

  return (
    <div className="inverse" style={{ marginTop: 46 }}>
      <div className="inverse-block g12" style={{ rowGap: 24 }}>
        <div style={{ gridColumn: '1 / span 5' }}>
          <div className="small" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>(06) Research question</span>
            <Badge status="model" />
          </div>
          <h3 style={{ fontSize: 'clamp(30px, 3.6vw, 52px)', lineHeight: 0.95, letterSpacing: '-0.04em', fontWeight: 400, margin: '14px 0 14px', textTransform: 'uppercase' }}>
            What is a credible satellite signal worth?
          </h3>
          <p className="lead" style={{ fontSize: 17 }}>
            The value of a signal grows with its true skill ρ. But ρ is estimated from short, noisy histories — and acting on an over-estimated ρ costs money.
            The thesis would measure ρ with valid uncertainty (prediction-powered inference on satellite-derived variables) and price the gap.
          </p>
          <div className="controls" style={{ marginTop: 22 }}>
            <div className="slider">
              <label><span>Skill you believe (ρ)</span><span className="num">{believed.toFixed(2)}</span></label>
              <input type="range" min={0} max={0.6} step={0.01} value={believed} onChange={(e) => setBelieved(+e.target.value)} style={{ background: 'var(--inverse-ink)' }} />
            </div>
            <div className="slider">
              <label><span>True skill (ρ)</span><span className="num">{trueRho.toFixed(2)}</span></label>
              <input type="range" min={0} max={0.6} step={0.01} value={trueRho} onChange={(e) => setTrueRho(+e.target.value)} style={{ background: 'var(--inverse-ink)' }} />
            </div>
          </div>
          <div className="g12" style={{ marginTop: 20, borderTop: '1px solid var(--inverse-ink)' }}>
            <div style={{ gridColumn: 'span 6', paddingTop: 10 }}>
              <div className="small muted">Shortfall vs. the P&L you planned</div>
              <div style={{ fontSize: 34, letterSpacing: '-0.03em' }} className="num">{signed(-gap / 1000, 1, 'k')}</div>
              <div className="small muted">$ per month per $1m notional</div>
            </div>
            <div style={{ gridColumn: 'span 6', paddingTop: 10 }}>
              <div className="small muted">Cost of mis-sizing (over-trust)</div>
              <div style={{ fontSize: 34, letterSpacing: '-0.03em', color: 'var(--accent)' }} className="num">−{fmt(loss / 1000, 1)}k</div>
              <div className="small muted">$ per month per $1m notional</div>
            </div>
          </div>
        </div>
        <div style={{ gridColumn: '7 / span 6' }}>
          <div className="small" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span>Expected monthly P&L vs. signal skill — {seriesLabel}, σ = {(sigma * 100).toFixed(1)} % / month (real, 10y)</span>
          </div>
          <svg className="chart" viewBox={`0 0 ${W} ${H}`}>
            {y.ticks(4).map((t) => (
              <g key={t}>
                <line className="gridline" x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} />
                <text x={m.l - 8} y={y(t) + 3} textAnchor="end">{fmt(t / 1000)}k</text>
              </g>
            ))}
            {x.ticks(6).map((t) => (
              <text key={t} x={x(t)} y={H - 10} textAnchor="middle">ρ {t.toFixed(1)}</text>
            ))}
            <path d={band} fill="var(--inverse-ink)" opacity={0.12} />
            <path d={curve} fill="none" stroke="var(--inverse-ink)" strokeWidth={1.5} />
            {SKILL.map((s, i) => (
              <g key={s.label}>
                <line x1={x(s.rho)} x2={x(s.rho)} y1={y(expectedPnl(s.rho, sigma))} y2={H - m.b} stroke="var(--inverse-ink)" strokeDasharray="2 3" opacity={0.5} />
                <circle cx={x(s.rho)} cy={y(expectedPnl(s.rho, sigma))} r={4} fill="var(--inverse-bg)" stroke="var(--inverse-ink)" />
                <text x={x(s.rho) + 8} y={y(expectedPnl(s.rho, sigma)) - 8 - i * 2} style={{ fill: 'var(--inverse-ink)', fontSize: 11 }}>{s.label}</text>
              </g>
            ))}
            <line x1={x(believed)} x2={x(believed)} y1={m.t} y2={H - m.b} stroke="var(--accent)" />
            <line x1={x(trueRho)} x2={x(trueRho)} y1={m.t} y2={H - m.b} stroke="var(--accent)" strokeDasharray="4 3" />
            <text x={x(believed) + 4} y={m.t + 10} style={{ fill: 'var(--accent)', fontSize: 10 }}>believed</text>
            <text x={x(trueRho) + 4} y={m.t + 22} style={{ fill: 'var(--accent)', fontSize: 10 }}>true</text>
          </svg>
          <p className="small muted" style={{ marginTop: 8 }}>
            Curve: E[P&L] = √(2/π)·σ·ρ for a sign-trading strategy. Skill levels per data layer are illustrative assumptions, not estimates. Band: ±0.08 uncertainty in ρ.
          </p>
        </div>
      </div>
    </div>
  )
}
