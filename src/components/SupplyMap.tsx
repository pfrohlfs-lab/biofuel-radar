import { useEffect, useState } from 'react'
import type { Frame, Region } from '../lib/types'

// World frames are plate carrée, lat 84 … −58, lon −180 … 180.
const LAT_TOP = 84
const LAT_SPAN = 142

export function SupplyMap({ frames, regions, linked, selected, onSelect }: {
  frames: Frame[]
  regions: Region[]
  linked: string[]
  selected: string
  onSelect: (id: string) => void
}) {
  const [i, setI] = useState(frames.length - 1)
  const [playing, setPlaying] = useState(false)

  useEffect(() => setI(frames.length - 1), [frames.length])
  useEffect(() => {
    if (!playing) return
    const t = setInterval(() => setI((v) => (v + 1) % frames.length), 700)
    return () => clearInterval(t)
  }, [playing, frames.length])

  return (
    <div className="supply">
      <div className="panel-head">
        <span>Global vegetation · supply regions</span>
        <span className="muted">MODIS NDVI 8-day · {frames[i]?.date}</span>
      </div>
      <div className="supply-map">
        {frames.map((f, k) => (
          <img key={f.src} src={f.src} alt="" style={{ opacity: k === i ? 1 : 0 }} loading={k === frames.length - 1 ? 'eager' : 'lazy'} />
        ))}
        {regions.map((r, k) => {
          const [la0, lo0, la1, lo1] = r.bbox
          const isLinked = linked.includes(r.id)
          const isSel = r.id === selected
          return (
            <button
              key={r.id}
              className={`region-box${isLinked ? ' linked' : ''}${isSel ? ' sel' : ''}`}
              style={{
                left: `${((lo0 + 180) / 360) * 100}%`,
                top: `${((LAT_TOP - la1) / LAT_SPAN) * 100}%`,
                width: `${((lo1 - lo0) / 360) * 100}%`,
                height: `${((la1 - la0) / LAT_SPAN) * 100}%`,
              }}
              onClick={() => onSelect(r.id)}
              title={r.name}
            >
              <span>{String(k + 1).padStart(2, '0')}</span>
            </button>
          )
        })}
      </div>
      <div className="timelapse">
        <button className="play" onClick={() => setPlaying(!playing)}>{playing ? '❚❚' : '▶'}</button>
        <input type="range" min={0} max={frames.length - 1} value={i} onChange={(e) => { setPlaying(false); setI(+e.target.value) }} />
        <span className="num small">{frames[i]?.date.slice(0, 7)}</span>
      </div>
    </div>
  )
}
