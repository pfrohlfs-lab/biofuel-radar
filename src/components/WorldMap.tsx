import { useEffect, useMemo, useState } from 'react'
import { geoContains, geoEqualEarth, geoGraticule10, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import type { FeatureCollection, MultiPolygon, Polygon, Feature } from 'geojson'
import type { Region } from '../lib/types'

const W = 960
const H = 470

export function WorldMap({ regions, selected, onSelect }: { regions: Region[]; selected: string; onSelect: (id: string) => void }) {
  const [land, setLand] = useState<FeatureCollection<Polygon | MultiPolygon> | null>(null)

  useEffect(() => {
    fetch('/data/land-110m.json')
      .then((r) => r.json())
      .then((topo) => setLand(feature(topo, topo.objects.land) as unknown as FeatureCollection<Polygon | MultiPolygon>))
  }, [])

  const projection = useMemo(() => geoEqualEarth().scale(182).translate([W / 2, H / 2 + 10]), [])
  const path = useMemo(() => geoPath(projection), [projection])

  // dot-matrix land: sample a lat/lon lattice and keep points on land
  const dots = useMemo(() => {
    if (!land) return []
    const f = land.features as Feature<Polygon | MultiPolygon>[]
    const out: [number, number][] = []
    const step = 1.9
    for (let lat = -58; lat <= 82; lat += step) {
      for (let lon = -180; lon < 180; lon += step / Math.max(0.35, Math.cos((lat * Math.PI) / 180))) {
        if (f.some((g) => geoContains(g, [lon, lat]))) {
          const p = projection([lon, lat])
          if (p) out.push(p as [number, number])
        }
      }
    }
    return out
  }, [land, projection])

  const graticule = useMemo(() => path(geoGraticule10()) ?? '', [path])
  const sphere = useMemo(() => path({ type: 'Sphere' }) ?? '', [path])

  return (
    <div className="map">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="World map of feedstock regions">
        <path d={sphere} fill="none" stroke="var(--faint)" />
        <path d={graticule} fill="none" stroke="var(--faint)" strokeWidth={0.5} opacity={0.6} />
        <g fill="var(--ink)" opacity={0.78}>
          {dots.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={1.15} />
          ))}
        </g>
        {regions.map((r, i) => {
          const [la0, lo0, la1, lo1] = r.bbox
          const corners = [projection([lo0, la1]), projection([lo1, la0])]
          const p = projection([r.lon, r.lat])
          if (!p || !corners[0] || !corners[1]) return null
          const active = r.id === selected
          const anomaly = r.weather?.precipAnomalyPct ?? 0
          const dry = anomaly < -15
          return (
            <g key={r.id} className={`marker${active ? ' active' : ''}`} onClick={() => onSelect(r.id)}>
              <rect
                x={Math.min(corners[0][0], corners[1][0])}
                y={Math.min(corners[0][1], corners[1][1])}
                width={Math.abs(corners[1][0] - corners[0][0])}
                height={Math.abs(corners[1][1] - corners[0][1])}
                fill="none"
                stroke={active ? 'var(--accent)' : 'var(--ink)'}
                strokeDasharray={active ? undefined : '2 3'}
                strokeWidth={1}
                opacity={active ? 1 : 0.5}
              />
              {dry && <circle className="pulse" cx={p[0]} cy={p[1]} r={9} />}
              <rect className="box" x={p[0] - 11} y={p[1] - 8} width={22} height={16} />
              <text className="id" x={p[0]} y={p[1] + 3.5} textAnchor="middle">{String(i + 1).padStart(2, '0')}</text>
              {active && (
                <g>
                  <rect x={p[0] + 13} y={p[1] - 8} width={r.crop.length * 6 + 12} height={16} fill="var(--accent)" />
                  <text x={p[0] + 19} y={p[1] + 3.5} style={{ fontSize: 10.5, fill: '#fff' }}>{r.crop}</text>
                </g>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
