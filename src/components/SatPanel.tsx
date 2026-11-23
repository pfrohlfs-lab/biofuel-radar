import { useEffect, useMemo, useState } from 'react'
import { scaleLinear, scalePoint } from 'd3-scale'
import { line } from 'd3-shape'
import type { Region, RegionImagery, View } from '../lib/types'
import { signed, yieldDeviation } from '../lib/model'
import { Badge } from './Badge'

const LEVELS = ['orbit', 'region', 'district', 'field'] as const
type Level = (typeof LEVELS)[number]
const LEVEL_LABEL: Record<Level, string> = { orbit: 'Orbit', region: 'Region', district: 'District', field: 'Field' }
const SCALE: Record<Level, string> = { orbit: '~2,000 km', region: '~800 km', district: '~60 km', field: '~12 km' }

const fmtLat = (v: number) => `${Math.abs(v).toFixed(2)}°${v >= 0 ? 'N' : 'S'}`
const fmtLon = (v: number) => `${Math.abs(v).toFixed(2)}°${v >= 0 ? 'E' : 'W'}`

/** Position of an inner bbox inside an outer one, in % of the outer image (plate carrée). */
function inner(outer: View['bbox'], innerBox: View['bbox']) {
  const [la0, lo0, la1, lo1] = outer
  const [b0, c0, b1, c1] = innerBox
  return {
    left: ((c0 - lo0) / (lo1 - lo0)) * 100,
    top: ((la1 - b1) / (la1 - la0)) * 100,
    width: ((c1 - c0) / (lo1 - lo0)) * 100,
    height: ((b1 - b0) / (la1 - la0)) * 100,
  }
}

export function SatPanel({ region, img, index }: { region: Region; img: RegionImagery | undefined; index: number }) {
  const [level, setLevel] = useState<Level>('region')
  const [overlay, setOverlay] = useState(false)
  const [auto, setAuto] = useState(false)
  const [frame, setFrame] = useState(0)
  const [playing, setPlaying] = useState(false)

  const frames = img?.frames ?? []
  useEffect(() => {
    setFrame(Math.max(0, frames.length - 1))
    setLevel('region')
  }, [region.id, frames.length])

  // auto zoom sequence: orbit -> field
  useEffect(() => {
    if (!auto) return
    let i = 0
    setLevel(LEVELS[0])
    const t = setInterval(() => {
      i += 1
      if (i >= LEVELS.length) {
        setAuto(false)
        return
      }
      setLevel(LEVELS[i])
    }, 1800)
    return () => clearInterval(t)
  }, [auto])

  // time-lapse
  useEffect(() => {
    if (!playing || frames.length === 0) return
    const t = setInterval(() => setFrame((f) => (f + 1) % frames.length), 650)
    return () => clearInterval(t)
  }, [playing, frames.length])

  const views = img?.views ?? {}
  const view = level === 'region' && frames[frame] ? { ...views.region!, src: frames[frame].src } : views[level]
  const nextLevel = LEVELS[LEVELS.indexOf(level) + 1] as Level | undefined
  const nextView = nextLevel ? views[nextLevel] : undefined
  const focus = img?.focus
  const w = region.weather
  const y = w ? yieldDeviation(region, w.precipAnomalyPct, w.tempAnomaly) : null

  const cross = view && focus ? {
    x: ((focus.lon - view.bbox[1]) / (view.bbox[3] - view.bbox[1])) * 100,
    y: ((view.bbox[2] - focus.lat) / (view.bbox[2] - view.bbox[0])) * 100,
  } : null

  const latestNdvi = img?.ndvi.filter((d) => d[1] != null).at(-1)
  const lyMatch = latestNdvi ? img?.ndviLastYear.find((d) => d[0] === latestNdvi[0]) : undefined
  const ndviDelta = latestNdvi && lyMatch?.[1] != null ? ((latestNdvi[1]! - lyMatch[1]) / lyMatch[1]) * 100 : null

  return (
    <div className="sat">
      <div className="panel-head">
        <span>Satellite intelligence</span>
        <span className="muted">{String(index + 1).padStart(2, '0')} · {region.country}</span>
      </div>
      <div className="sat-title">
        <div className="sat-name">{region.name}</div>
        <div className="chips" style={{ marginTop: 6 }}>
          <span className="chip solid">{region.crop}</span>
          {region.fuels.map((f) => <span key={f} className="chip">→ {f}</span>)}
        </div>
      </div>

      <div className="zoom-tabs">
        {LEVELS.map((l, i) => (
          <button key={l} className={l === level ? 'active' : ''} disabled={!views[l]} onClick={() => { setAuto(false); setLevel(l) }}>
            <span className="muted">{i + 1}</span> {LEVEL_LABEL[l]}
          </button>
        ))}
        <button className={`zoom-auto${auto ? ' on' : ''}`} onClick={() => setAuto(!auto)} title="Fly from orbit to field">
          {auto ? '■' : '▶'} Fly in
        </button>
      </div>

      <div className="viewer">
        {view && (
          <div key={view.src + level} className="viewer-img">
            <img src={view.src} alt={view.label} className={level === 'district' || level === 'field' ? 's2' : ''} />
            {level === 'district' && overlay && views.districtNdvi && (
              <img src={views.districtNdvi.src} alt="NDVI overlay" className="overlay" />
            )}
          </div>
        )}
        {view && nextView && (
          <div className="next-box" style={(() => { const p = inner(view.bbox, nextView.bbox); return { left: `${p.left}%`, top: `${p.top}%`, width: `${Math.max(p.width, 3)}%`, height: `${Math.max(p.height, 3)}%` } })()}>
            <span>{LEVEL_LABEL[nextLevel!]}</span>
          </div>
        )}
        {cross && (
          <>
            <div className="cross-h" style={{ top: `${cross.y}%` }} />
            <div className="cross-v" style={{ left: `${cross.x}%` }} />
          </>
        )}
        <div className="hud tl">{view?.label}</div>
        <div className="hud tr">{level === 'region' && frames[frame] ? frames[frame].date : level === 'district' || level === 'field' ? '2023 mosaic' : frames.at(-1)?.date}</div>
        <div className="hud bl">{focus ? `${fmtLat(focus.lat)}  ${fmtLon(focus.lon)}` : ''}<br />{focus?.place}</div>
        <div className="hud br">▭ {SCALE[level]}</div>
        <div className="brackets"><i /><i /><i /><i /></div>
        <div className="scan" />
      </div>

      <div className="viewer-controls">
        {level === 'region' && frames.length > 0 && (
          <div className="timelapse">
            <button className="play" onClick={() => setPlaying(!playing)}>{playing ? '❚❚' : '▶'}</button>
            <input type="range" min={0} max={frames.length - 1} value={frame} onChange={(e) => { setPlaying(false); setFrame(+e.target.value) }} />
            <span className="num small">{frames[frame]?.date.slice(0, 7)}</span>
          </div>
        )}
        {level === 'district' && views.districtNdvi && (
          <label className="small toggle-line">
            <input type="checkbox" checked={overlay} onChange={(e) => setOverlay(e.target.checked)} />
            Overlay MODIS NDVI (250 m) on Sentinel-2 (10 m)
          </label>
        )}
        {(level === 'orbit' || level === 'field') && (
          <span className="small muted">{level === 'orbit' ? 'Green = dense vegetation. Box shows the region window.' : 'Individual fields, roads and plantation blocks at 10 m.'}</span>
        )}
      </div>

      <div className="sat-kpis">
        <div>
          <span className="small muted">NDVI (sat.) vs. last year</span>
          <b className={`num ${ndviDelta != null && ndviDelta < 0 ? 'down' : 'up'}`}>{ndviDelta != null ? signed(ndviDelta, 1, ' %') : '—'}</b>
          <span className="small muted">{latestNdvi ? `${latestNdvi[1]?.toFixed(2)} · ${latestNdvi[0]}` : ''}</span>
        </div>
        <div>
          <span className="small muted">Rain 90 d</span>
          <b className={`num ${w && w.precipAnomalyPct < -15 ? 'down' : ''}`}>{w ? signed(w.precipAnomalyPct, 0, ' %') : '—'}</b>
          <span className="small muted">vs. 10-y normal</span>
        </div>
        <div>
          <span className="small muted">Temp 90 d</span>
          <b className={`num ${w && w.tempAnomaly > 1 ? 'down' : ''}`}>{w ? signed(w.tempAnomaly, 1, '°') : '—'}</b>
          <span className="small muted">vs. 10-y normal</span>
        </div>
        <div>
          <span className="small muted">Yield signal</span>
          <b className={`num ${y && y.dev < 0 ? 'down' : 'up'}`}>{y ? signed(y.dev, 1, ' %') : 'n/a'}</b>
          <span className="small muted">model · ±{y ? ((y.hi - y.lo) / 2).toFixed(1) : '–'}</span>
        </div>
      </div>

      {img && <NdviCurve img={img} frame={frames[frame]?.date} />}
      <div className="src-line">
        <Badge status="real" /> <span className="muted small">MODIS NDVI via NASA GIBS · Sentinel-2 cloudless 2023 by EOX (CC BY-NC-SA 4.0) · weather ERA5 via Open-Meteo</span>
      </div>
    </div>
  )
}

function NdviCurve({ img, frame }: { img: RegionImagery; frame?: string }) {
  const W = 400
  const H = 120
  const m = { t: 10, r: 8, b: 18, l: 28 }
  const dates = img.ndvi.map((d) => d[0])
  const x = useMemo(() => scalePoint<string>().domain(dates).range([m.l, W - m.r]), [dates, m.l, m.r])
  const vals = [...img.ndvi, ...img.ndviLastYear].map((d) => d[1]).filter((v): v is number => v != null)
  const lo = Math.min(...vals, 0.2)
  const hi = Math.max(...vals, 0.6)
  const y = scaleLinear().domain([lo - 0.03, hi + 0.03]).range([H - m.b, m.t])
  const gen = line<[string, number | null]>().defined((d) => d[1] != null).x((d) => x(d[0]) ?? 0).y((d) => y(d[1] ?? 0))
  return (
    <div style={{ marginTop: 10 }}>
      <div className="small" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Mean NDVI from satellite frames</span>
        <span className="muted"><span style={{ color: 'var(--up)' }}>━</span> 12 m &nbsp;<span className="muted">┅</span> year before</span>
      </div>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`}>
        {y.ticks(3).map((t) => (
          <g key={t}>
            <line className="gridline" x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} />
            <text x={m.l - 4} y={y(t) + 3} textAnchor="end">{t.toFixed(2)}</text>
          </g>
        ))}
        {dates.map((d, i) => i % 2 === 0 && (
          <text key={d} x={x(d)} y={H - 4} textAnchor="middle">{new Date(d).toLocaleDateString('en-US', { month: 'short' })}</text>
        ))}
        <path d={gen(img.ndviLastYear) ?? ''} fill="none" stroke="var(--muted)" strokeDasharray="3 3" />
        <path d={gen(img.ndvi) ?? ''} fill="none" stroke="var(--up)" strokeWidth={1.6} />
        {frame && <line x1={x(frame)} x2={x(frame)} y1={m.t} y2={H - m.b} stroke="var(--accent)" />}
      </svg>
    </div>
  )
}
