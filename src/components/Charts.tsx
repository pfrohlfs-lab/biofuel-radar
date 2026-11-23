import { useMemo, useRef, useState } from 'react'
import { scaleLinear, scaleTime } from 'd3-scale'
import { line, area } from 'd3-shape'
import { extent, max, min, bisector } from 'd3-array'
import { fmt } from '../lib/model'

export interface LineSpec {
  key: string
  label: string
  data: [string, number][]
  dashed?: boolean
  weight?: number
  color?: string
}

const toDate = (m: string) => new Date(`${m}-15T00:00:00Z`)
const monthLabel = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })

export function LineChart({ lines, height = 360, unit = '$/t' }: { lines: LineSpec[]; height?: number; unit?: string }) {
  const W = 1000
  const H = height
  const m = { t: 14, r: 64, b: 26, l: 8 }
  const ref = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<Date | null>(null)

  const { x, y, paths, ticks, yTicks } = useMemo(() => {
    const all = lines.flatMap((l) => l.data)
    const xd = extent(all, (d) => toDate(d[0])) as [Date, Date]
    const lo = min(all, (d) => d[1]) ?? 0
    const hi = max(all, (d) => d[1]) ?? 1
    const pad = (hi - lo) * 0.08
    const x = scaleTime().domain(xd).range([m.l, W - m.r])
    const y = scaleLinear().domain([Math.max(0, lo - pad), hi + pad]).nice().range([H - m.b, m.t])
    const gen = line<[string, number]>().x((d) => x(toDate(d[0]))).y((d) => y(d[1]))
    return {
      x,
      y,
      paths: lines.map((l) => ({ ...l, d: gen(l.data) ?? '' })),
      ticks: x.ticks(7),
      yTicks: y.ticks(5),
    }
  }, [lines, H, m.b, m.l, m.r, m.t])

  const onMove = (e: React.MouseEvent) => {
    const svg = ref.current
    if (!svg) return
    const r = svg.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    setHover(x.invert(Math.min(Math.max(px, m.l), W - m.r)))
  }

  const bis = bisector((d: [string, number]) => toDate(d[0])).center
  const hoverVals = hover
    ? lines.map((l) => {
        const i = bis(l.data, hover)
        return { ...l, point: l.data[i] }
      })
    : []

  return (
    <div style={{ position: 'relative' }}>
      <svg ref={ref} className="chart" viewBox={`0 0 ${W} ${H}`} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {yTicks.map((t) => (
          <g key={t}>
            <line className="gridline" x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} />
            <text x={W - m.r + 8} y={y(t) + 3}>{fmt(t)}</text>
          </g>
        ))}
        {ticks.map((t) => (
          <text key={+t} x={x(t)} y={H - 6} textAnchor="middle">{t.getUTCFullYear()}</text>
        ))}
        <text x={W - m.r + 8} y={m.t - 2}>{unit}</text>
        {paths.map((p) => (
          <path
            key={p.key}
            d={p.d}
            fill="none"
            stroke={p.color ?? 'var(--ink)'}
            strokeWidth={p.weight ?? 1.2}
            strokeDasharray={p.dashed ? '5 4' : undefined}
            style={{ transition: 'd 0.6s ease' }}
          />
        ))}
        {paths.map((p) => {
          const last = p.data[p.data.length - 1]
          if (!last) return null
          return <circle key={p.key + 'dot'} cx={x(toDate(last[0]))} cy={y(last[1])} r={2.5} fill={p.color ?? 'var(--ink)'} />
        })}
        {hover && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={m.t} y2={H - m.b} stroke="var(--accent)" strokeWidth={1} />
            {hoverVals.map((h) => h.point && (
              <circle key={h.key} cx={x(toDate(h.point[0]))} cy={y(h.point[1])} r={3.5} fill="var(--bg)" stroke={h.color ?? 'var(--ink)'} />
            ))}
          </g>
        )}
      </svg>
      {hover && (
        <div className="tooltip" style={{ position: 'absolute', top: 6, left: `${(x(hover) / W) * 100}%`, transform: x(hover) > W * 0.6 ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)', background: 'var(--bg)', border: '1px solid var(--ink)', padding: '8px 10px', fontSize: 12, pointerEvents: 'none', minWidth: 180 }}>
          <div className="muted" style={{ marginBottom: 4 }}>{monthLabel(hover)}</div>
          {hoverVals.map((h) => h.point && (
            <div key={h.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
              <span>{h.label}</span>
              <span className="num">{fmt(h.point[1])}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function Sparkline({ data, height = 36, dashed }: { data: [string, number][]; height?: number; dashed?: boolean }) {
  const W = 200
  const H = height
  const xs = scaleLinear().domain([0, data.length - 1]).range([1, W - 3])
  const lo = min(data, (d) => d[1]) ?? 0
  const hi = max(data, (d) => d[1]) ?? 1
  const ys = scaleLinear().domain([lo, hi]).range([H - 2, 2])
  const d = line<[string, number]>().x((_, i) => xs(i)).y((p) => ys(p[1]))(data) ?? ''
  const a = area<[string, number]>().x((_, i) => xs(i)).y0(H).y1((p) => ys(p[1]))(data) ?? ''
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height }}>
      <path d={a} fill="var(--ink)" opacity={0.06} />
      <path d={d} fill="none" stroke={dashed ? 'var(--accent)' : 'var(--ink)'} strokeWidth={1.2} strokeDasharray={dashed ? '4 3' : undefined} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export function PrecipBars({ months }: { months: { month: string; precip: number; normal: number | null }[] }) {
  const W = 400
  const H = 120
  const hi = max(months, (d) => Math.max(d.precip, d.normal ?? 0)) ?? 1
  const y = scaleLinear().domain([0, hi * 1.1]).range([H - 18, 4])
  const bw = (W - 10) / months.length
  const normalLine = line<{ month: string; normal: number | null }>()
    .defined((d) => d.normal != null)
    .x((_, i) => 5 + i * bw + bw / 2)
    .y((d) => y(d.normal ?? 0))(months) ?? ''
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`}>
      {months.map((d, i) => (
        <g key={d.month}>
          <rect x={5 + i * bw + 3} width={bw - 6} y={y(d.precip)} height={H - 18 - y(d.precip)} fill={d.normal != null && d.precip < d.normal * 0.7 ? 'var(--accent)' : 'var(--ink)'} opacity={0.85} />
          <text x={5 + i * bw + bw / 2} y={H - 4} textAnchor="middle">{toDate(d.month).toLocaleDateString('en-US', { month: 'narrow', timeZone: 'UTC' })}</text>
        </g>
      ))}
      <path d={normalLine} fill="none" stroke="var(--muted)" strokeDasharray="3 3" strokeWidth={1.2} />
    </svg>
  )
}
