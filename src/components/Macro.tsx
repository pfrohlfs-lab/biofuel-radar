import type { DriversFile } from '../lib/types'
import { TRADE } from '../data/trade'
import { INSTRUMENTS } from '../data/instruments'
import { Sparkline } from './Charts'
import { Badge } from './Badge'
import { signed } from '../lib/model'

export function Macro({ drivers }: { drivers: DriversFile }) {
  const ch = drivers.shipping.chokepoints
  const oni = drivers.enso.series
  return (
    <div className="g12" style={{ rowGap: 34 }}>
      <div style={{ gridColumn: '1 / span 7' }}>
        <div className="sub-head"><span>Shipping chokepoints · daily transits, 30-day avg. vs. last year</span><Badge status="real" /></div>
        <div className="choke-grid">
          {Object.entries(ch).map(([name, c]) => {
            const d = c.transits30d && c.transitsLY ? ((c.transits30d - c.transitsLY) / c.transitsLY) * 100 : 0
            const t = c.tankers30d && c.tankersLY ? ((c.tankers30d - c.tankersLY) / c.tankersLY) * 100 : 0
            return (
              <div key={name} className="choke">
                <div className="small">{name}</div>
                <b className={`num ${d < -20 ? 'down' : ''}`}>{c.transits30d?.toFixed(0)}<span className="muted small"> /day</span></b>
                <div className="small num"><span className={d < -20 ? 'down' : 'muted'}>{signed(d, 0, '%')} all</span> · <span className={t < -20 ? 'down' : 'muted'}>{signed(t, 0, '%')} tankers</span></div>
                <Sparkline data={c.weekly.map((w) => [w[0], w[1]] as [string, number])} height={28} />
              </div>
            )
          })}
        </div>
        <div className="small muted" style={{ marginTop: 6 }}>Source: <a href={drivers.shipping.url} target="_blank" rel="noreferrer">{drivers.shipping.source}</a> · data to {Object.values(ch)[0]?.last}</div>
      </div>

      <div style={{ gridColumn: '8 / span 5' }}>
        <div className="sub-head"><span>ENSO · Oceanic Niño Index</span><Badge status="real" /></div>
        <div className="enso">
          <b className={`num ${oni.at(-1)![1] >= 1 ? 'down' : ''}`}>{signed(oni.at(-1)![1], 2)}</b>
          <span className="small muted">{oni.at(-1)![0]} · {oni.at(-1)![1] >= 1.5 ? 'strong El Niño' : oni.at(-1)![1] >= 0.5 ? 'El Niño' : oni.at(-1)![1] <= -0.5 ? 'La Niña' : 'neutral'}</span>
          <Sparkline data={oni.map((o) => [o[0], o[1]] as [string, number])} height={60} />
          <p className="small muted">Typical El Niño pattern (lagged 6–12 months): drier Indonesia/Malaysia (palm), eastern Australia (canola), weaker Indian monsoon (cane); wetter Argentina (soy).</p>
        </div>

        <div className="sub-head" style={{ marginTop: 22 }}><span>Producer currencies vs. USD · 3 months</span><Badge status="real" /></div>
        <div className="fx-list">
          {Object.entries(drivers.fx.perUSD).map(([code, s]) => {
            if (s.length < 70) return null
            const d = ((s[s.length - 1][1] - s[s.length - 64][1]) / s[s.length - 64][1]) * 100
            return (
              <div key={code} className="fx">
                <span>{code}</span>
                <span className="num">{s[s.length - 1][1].toLocaleString('en-US', { maximumFractionDigits: code === 'IDR' ? 0 : 3 })}</span>
                <span className={`num ${-d < 0 ? 'down' : 'up'}`}>{signed(-d, 1, '%')}</span>
                <Sparkline data={s.slice(-90)} height={20} />
              </div>
            )
          })}
        </div>
        <div className="small muted">Positive = producer currency stronger vs. USD. Source: {drivers.fx.source}</div>
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <div className="sub-head"><span>Trade policy · tariffs, levies, export taxes</span><Badge status="check" /></div>
        <div className="table-scroll">
          <table className="sources-table">
            <thead><tr><th>Country</th><th>Measure</th><th>Since</th><th>Affects</th><th>Price effect</th><th>Source</th></tr></thead>
            <tbody>
              {TRADE.map((t) => (
                <tr key={t.id}>
                  <td>{t.country}</td>
                  <td><div>{t.title}</div><div className="small muted">{t.detail}</div></td>
                  <td className="num small">{t.since}</td>
                  <td className="small">{t.affects.map((a) => INSTRUMENTS.find((i) => i.key === a)?.code).join(' · ')}</td>
                  <td className={`small ${t.dir === 1 ? 'up' : t.dir === -1 ? 'down' : 'muted'}`}>{t.dir === 1 ? '▲' : t.dir === -1 ? '▼' : '◆'} {t.why}</td>
                  <td className="small"><a href={t.url} target="_blank" rel="noreferrer">{t.source}</a><div><Badge status={t.status} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="small muted" style={{ marginTop: 6 }}>Curated list; rates change often and every item is still to be verified against the official text. Freight rates (Baltic indices) are paywalled and not included.</div>
      </div>
    </div>
  )
}
