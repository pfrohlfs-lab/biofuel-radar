export type Group = 'fuels' | 'feedstocks'

export interface Instrument {
  key: string // series key in prices.json
  code: string // short ticker-style code
  name: string
  group: Group
  regions: string[] // linked growing / collection regions
  pathway: string
}

export const INSTRUMENTS: Instrument[] = [
  { key: 'hvo', code: 'HVO', name: 'HVO / renewable diesel', group: 'fuels', regions: ['id-palm', 'cn-uco', 'us-cornbelt', 'eu-rapeseed'], pathway: 'Hydrotreated vegetable oils, waste fats and UCO' },
  { key: 'saf', code: 'SAF', name: 'Sustainable aviation fuel (HEFA)', group: 'fuels', regions: ['cn-uco', 'id-palm', 'us-cornbelt', 'br-saopaulo'], pathway: 'HEFA from oils and fats; alcohol-to-jet from ethanol' },
  { key: 'fame', code: 'FAME', name: 'FAME / biodiesel', group: 'fuels', regions: ['eu-rapeseed', 'id-palm', 'br-matogrosso', 'ar-pampas'], pathway: 'Transesterified rapeseed, palm and soybean oil' },
  { key: 'ethanol', code: 'ETH', name: 'Fuel ethanol', group: 'fuels', regions: ['us-cornbelt', 'br-saopaulo', 'in-cane'], pathway: 'Fermented corn and sugarcane' },
  { key: 'diesel', code: 'ULSD', name: 'Diesel (fossil benchmark)', group: 'fuels', regions: [], pathway: 'NY Harbor ultra-low sulphur diesel' },
  { key: 'brent', code: 'BRENT', name: 'Brent crude', group: 'fuels', regions: [], pathway: 'Fossil benchmark' },
  { key: 'palm', code: 'CPO', name: 'Palm oil', group: 'feedstocks', regions: ['id-palm'], pathway: '→ FAME, HVO, SAF' },
  { key: 'soyoil', code: 'SBO', name: 'Soybean oil', group: 'feedstocks', regions: ['br-matogrosso', 'ar-pampas', 'us-cornbelt'], pathway: '→ FAME, HVO, SAF' },
  { key: 'rapeoil', code: 'RSO', name: 'Rapeseed / canola oil', group: 'feedstocks', regions: ['eu-rapeseed', 'ca-canola', 'au-canola'], pathway: '→ FAME, HVO' },
  { key: 'uco', code: 'UCO', name: 'Used cooking oil', group: 'feedstocks', regions: ['cn-uco'], pathway: '→ HVO, SAF' },
  { key: 'maize', code: 'CORN', name: 'Maize / corn', group: 'feedstocks', regions: ['us-cornbelt'], pathway: '→ Ethanol' },
  { key: 'sugar', code: 'SUGAR', name: 'Sugar (world)', group: 'feedstocks', regions: ['br-saopaulo', 'in-cane'], pathway: '→ Ethanol' },
]
