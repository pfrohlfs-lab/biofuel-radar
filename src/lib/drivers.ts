// Turns all inputs into one factor matrix per instrument. Directions are a
// transparent rule set (status "model"); the numbers behind them are real data.
import type { DriversFile, ImageryFile, PriceFile, Region, Status } from './types'
import type { Instrument } from '../data/instruments'
import { TRADE } from '../data/trade'
import type { Dir } from '../data/trade'
import { signed } from './model'

export type Category = 'Weather' | 'Forecast' | 'Vegetation' | 'Climate' | 'Shipping' | 'FX' | 'Energy' | 'Trade policy'

export interface Factor {
  category: Category
  name: string
  value: string
  dir: Dir
  why: string
  status: Status
  regionId?: string
}

const CHOKE: Record<string, string[]> = {
  palm: ['Malacca Strait', 'Sunda Strait', 'Suez Canal'],
  soyoil: ['Panama Canal', 'Cape of Good Hope'],
  rapeoil: ['Suez Canal'],
  uco: ['Malacca Strait', 'Suez Canal', 'Cape of Good Hope'],
  maize: ['Panama Canal'],
  sugar: ['Cape of Good Hope'],
  hvo: ['Malacca Strait', 'Suez Canal', 'Strait of Hormuz'],
  saf: ['Malacca Strait', 'Suez Canal', 'Strait of Hormuz'],
  fame: ['Malacca Strait', 'Suez Canal'],
  ethanol: ['Panama Canal'],
  diesel: ['Strait of Hormuz', 'Bab el-Mandeb Strait', 'Suez Canal'],
  brent: ['Strait of Hormuz', 'Bab el-Mandeb Strait'],
}

const CCY: Record<string, [string, string][]> = {
  palm: [['MYR', 'Malaysia'], ['IDR', 'Indonesia']],
  soyoil: [['BRL', 'Brazil']],
  rapeoil: [['EUR', 'EU'], ['CAD', 'Canada'], ['AUD', 'Australia']],
  uco: [['CNY', 'China']],
  sugar: [['BRL', 'Brazil'], ['INR', 'India']],
  ethanol: [['BRL', 'Brazil']],
  fame: [['EUR', 'EU'], ['MYR', 'Malaysia']],
  hvo: [['CNY', 'China'], ['MYR', 'Malaysia']],
  saf: [['CNY', 'China']],
}

// El Niño teleconnections (typical, simplified): +1 = drier / supply risk in that crop region
const ENSO_EFFECT: Record<string, Dir> = {
  'id-palm': 1, 'au-canola': 1, 'in-cane': 1, 'ar-pampas': -1, 'br-matogrosso': 0, 'us-cornbelt': 0,
}

const pct = (a: number, b: number) => ((a - b) / b) * 100

export function buildFactors(inst: Instrument, regions: Region[], prices: PriceFile, imagery: ImageryFile | null, drivers: DriversFile | null): Factor[] {
  const out: Factor[] = []
  const linked = regions.filter((r) => inst.regions.includes(r.id))

  for (const r of linked) {
    const w = r.weather
    if (w && r.sens.precip !== 0) {
      const a = w.precipAnomalyPct
      out.push({ category: 'Weather', name: `${r.name} · rain 90 d`, value: signed(a, 0, ' %'), dir: a < -15 ? 1 : 0, why: a < -15 ? 'Dry spell → yield risk' : a > 40 ? 'Very wet — harvest delays possible' : 'Near normal', status: 'real', regionId: r.id })
      if (w.tempAnomaly > 1) out.push({ category: 'Weather', name: `${r.name} · heat 90 d`, value: signed(w.tempAnomaly, 1, ' °C'), dir: 1, why: 'Heat stress on crops', status: 'real', regionId: r.id })
    }
    const f = drivers?.forecast[r.id]
    if (f && r.sens.precip !== 0) {
      const a = f.precipAnomalyPct
      out.push({ category: 'Forecast', name: `${r.name} · rain next 16 d`, value: signed(a, 0, ' %'), dir: a < -40 ? 1 : 0, why: a < -40 ? 'Forecast dry vs. normal' : a > 60 ? 'Forecast wet' : 'Forecast near normal', status: 'real', regionId: r.id })
    }
    const nd = imagery?.regions[r.id]
    const last = nd?.ndvi.filter((x) => x[1] != null).at(-1)
    const ly = last ? nd?.ndviLastYear.find((x) => x[0] === last[0]) : undefined
    if (last && ly?.[1] != null && r.sens.precip !== 0) {
      const d = pct(last[1]!, ly[1])
      out.push({ category: 'Vegetation', name: `${r.name} · NDVI vs. last year`, value: signed(d, 1, ' %'), dir: d < -3 ? 1 : d > 3 ? -1 : 0, why: d < -3 ? 'Weaker crop than last year' : d > 3 ? 'Greener than last year → supply' : 'Similar to last year', status: 'real', regionId: r.id })
    }
  }

  const oni = drivers?.enso.series.at(-1)
  if (oni) {
    const strong = Math.abs(oni[1]) >= 1
    const effects = linked.map((r) => ENSO_EFFECT[r.id] ?? 0).filter((x) => x !== 0)
    const dir: Dir = !strong || effects.length === 0 ? 0 : oni[1] > 0 ? (effects[0] as Dir) : ((-effects[0]) as Dir)
    out.push({ category: 'Climate', name: `ENSO (ONI, ${oni[0]})`, value: signed(oni[1], 2), dir, why: oni[1] >= 1 ? 'El Niño: drier SE Asia, Australia, India; wetter Argentina (typical, lagged)' : oni[1] <= -1 ? 'La Niña' : 'Neutral', status: 'model' })
  }

  for (const name of CHOKE[inst.key] ?? []) {
    const c = drivers?.shipping.chokepoints[name]
    if (!c || !c.transits30d || !c.transitsLY) continue
    const d = pct(c.transits30d, c.transitsLY)
    out.push({ category: 'Shipping', name: `${name} · transits 30 d`, value: `${c.transits30d.toFixed(0)}/d · ${signed(d, 0, ' %')}`, dir: d < -20 ? 1 : 0, why: d < -20 ? 'Disrupted route → longer voyages, higher freight' : 'Normal flow vs. last year', status: 'real' })
  }

  for (const [code, label] of CCY[inst.key] ?? []) {
    const s = drivers?.fx.perUSD[code]
    if (!s || s.length < 70) continue
    const d = pct(s[s.length - 1][1], s[s.length - 64][1])
    out.push({ category: 'FX', name: `${code}/USD (${label}) · 3 M`, value: signed(-d, 1, ' %'), dir: d > 3 ? -1 : d < -3 ? 1 : 0, why: d > 3 ? 'Weaker producer currency → cheaper exports' : d < -3 ? 'Stronger producer currency → costlier exports' : 'Stable', status: 'real' })
  }

  const diesel = prices.series.diesel.data
  if (diesel.length > 4 && inst.key !== 'brent') {
    const d = pct(diesel[diesel.length - 1][1], diesel[diesel.length - 4][1])
    out.push({ category: 'Energy', name: 'Diesel · 3 M', value: signed(d, 1, ' %'), dir: d > 10 ? 1 : d < -10 ? -1 : 0, why: d > 10 ? 'Expensive fossil diesel lifts blending demand' : 'Little change', status: 'real' })
  }

  for (const t of TRADE.filter((x) => x.affects.includes(inst.key))) {
    out.push({ category: 'Trade policy', name: `${t.country} · ${t.title}`, value: t.since, dir: t.dir, why: t.why, status: 'check' })
  }
  return out
}
