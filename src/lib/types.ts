export type Status = 'real' | 'example' | 'model' | 'check'

export interface Series {
  label: string
  unit: string
  status: Status
  source: string
  sourceUrl: string
  updated: string
  note?: string
  data: [string, number][]
}

export interface PriceFile {
  generated: string
  series: Record<string, Series>
}

export interface MonthlyPrecip {
  month: string
  precip: number
  normal: number | null
}

export interface Weather {
  window: string
  precip90: number
  precipNormal90: number
  precipAnomalyPct: number
  temp90: number
  tempNormal90: number
  tempAnomaly: number
  monthly: MonthlyPrecip[]
  source: string
  sourceUrl: string
  status: Status
}

export interface Region {
  id: string
  name: string
  country: string
  crop: string
  fuels: string[]
  lat: number
  lon: number
  bbox: [number, number, number, number]
  share: string
  sens: { precip: number; temp: number }
  weather: Weather | null
  ndvi: {
    current: string | null
    lastYear: string | null
    date: string
    dateLastYear: string
    source: string
    sourceUrl: string
    status: Status
  }
}

export interface Frame { date: string; src: string }
export interface View { src: string; bbox: [number, number, number, number]; label: string }

export interface RegionImagery {
  focus: { lat: number; lon: number; place: string }
  frames: Frame[]
  ndvi: [string, number | null][]
  ndviLastYear: [string, number | null][]
  views: Partial<Record<'orbit' | 'region' | 'district' | 'districtNdvi' | 'field' | 'farm', View>>
  farm?: { lat: number; lon: number; place: string; source: string }
}

export interface ImageryFile {
  generated: string
  dates: string[]
  world: Frame[]
  regions: Record<string, RegionImagery>
  sources: { modis: string; s2: string; farm?: string }
}

export interface RegionFile {
  generated: string
  weatherEnd: string
  regions: Region[]
}

export interface RegionForecast {
  days: string[]
  precip: number[]
  precipNormal: number[]
  temp: (number | null)[]
  tempNormal: number[]
  precipAnomalyPct: number
  tempAnomaly: number
}

export interface Chokepoint {
  last: string
  transits30d: number | null
  transitsLY: number | null
  tankers30d: number | null
  tankersLY: number | null
  weekly: [string, number, number][]
}

export interface DriversFile {
  generated: string
  forecast: Record<string, RegionForecast>
  enso: { series: [string, number][]; source: string; url: string }
  shipping: { chokepoints: Record<string, Chokepoint>; source: string; url: string }
  fx: { perUSD: Record<string, [string, number][]>; source: string; url: string }
}
