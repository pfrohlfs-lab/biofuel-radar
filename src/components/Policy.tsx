import { DEMAND_PULL, MANDATES, YEARS } from '../data/policy'
import { Badge } from './Badge'

export function Policy() {
  return (
    <div className="g12" style={{ marginTop: 26, rowGap: 30 }}>
      <div style={{ gridColumn: '1 / span 9' }} className="table-scroll">
        <table className="policy">
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th>Mandate</th>
              <th>Fuel</th>
              {YEARS.map((y) => <th key={y}>{y}</th>)}
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {MANDATES.map((m, i) => (
              <tr key={m.name}>
                <td className="muted">{String(i + 1).padStart(2, '0')}</td>
                <td>
                  <div>{m.region} · {m.name}</div>
                  <div className="small muted" style={{ maxWidth: 300 }}>{m.note}</div>
                </td>
                <td className="small">{m.fuel}</td>
                {YEARS.map((y) => (
                  <td key={y} className="val">{m.values[y] ? <span>{m.values[y]}</span> : <span style={{ border: 0, color: 'var(--faint)' }}>—</span>}</td>
                ))}
                <td className="small">
                  <a href={m.url} target="_blank" rel="noreferrer">{m.source}</a>
                  <div style={{ marginTop: 3 }}><Badge status={m.status} /></div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ gridColumn: '10 / span 3' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <span className="small">Demand pull 2025 → 2030</span>
          <Badge status="model" />
        </div>
        <div className="bars">
          {DEMAND_PULL.map((d) => (
            <div key={d.fuel} className="bar-row">
              <span>{d.fuel}</span>
              <div>
                <div className="bar-cells">
                  {[1, 2, 3].map((n) => <i key={n} className={n <= d.strength ? 'on' : ''} />)}
                </div>
                <div className="small muted" style={{ marginTop: 5 }}>{d.why}</div>
              </div>
            </div>
          ))}
        </div>
        <p className="small muted" style={{ marginTop: 14 }}>
          Mandates set the demand floor; weather and harvests set the supply. The spread between the two is where feedstock prices move.
        </p>
      </div>
    </div>
  )
}
