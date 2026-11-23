import type { Status } from '../lib/types'

export interface Mandate {
  region: string
  name: string
  fuel: string
  values: Partial<Record<'2025' | '2026' | '2027' | '2028' | '2030' | '2035', string>>
  note: string
  source: string
  url: string
  status: Status // 'real' = checked against the legal text summary, 'check' = to verify
}

export const YEARS = ['2025', '2026', '2027', '2028', '2030', '2035'] as const

export const MANDATES: Mandate[] = [
  {
    region: 'EU', name: 'ReFuelEU Aviation', fuel: 'SAF',
    values: { '2025': '2 %', '2030': '6 %', '2035': '20 %' },
    note: 'Minimum SAF share at EU airports; synthetic sub-target from 2030.',
    source: 'Regulation (EU) 2023/2405', url: 'https://eur-lex.europa.eu/eli/reg/2023/2405/oj', status: 'real',
  },
  {
    region: 'EU', name: 'FuelEU Maritime', fuel: 'FAME · HVO · Bio-LNG',
    values: { '2025': '−2 %', '2030': '−6 %', '2035': '−14.5 %' },
    note: 'GHG-intensity reduction of energy used on board vs. 2020 baseline.',
    source: 'Regulation (EU) 2023/1805', url: 'https://eur-lex.europa.eu/eli/reg/2023/1805/oj', status: 'real',
  },
  {
    region: 'EU', name: 'RED III — transport', fuel: 'All',
    values: { '2030': '29 % RES or −14.5 % GHG' },
    note: 'Plus combined 5.5 % advanced biofuels & RFNBO sub-target (≥1 % RFNBO).',
    source: 'Directive (EU) 2023/2413', url: 'https://eur-lex.europa.eu/eli/dir/2023/2413/oj', status: 'real',
  },
  {
    region: 'DE', name: 'GHG quota (THG-Quote)', fuel: 'FAME · HVO · Ethanol',
    values: { '2025': '10.5 %', '2026': '12 %', '2027': '14.5 %', '2028': '17.5 %', '2030': '25 %' },
    note: 'Path from the 2021 amendment; RED III transposition may change it — to verify.',
    source: '§ 37a BImSchG', url: 'https://www.gesetze-im-internet.de/bimschg/__37a.html', status: 'check',
  },
  {
    region: 'UK', name: 'SAF Mandate', fuel: 'SAF',
    values: { '2025': '2 %', '2030': '10 %', '2035': '15 %' },
    note: 'Rising to 22 % in 2040; HEFA cap applies.',
    source: 'UK DfT', url: 'https://www.gov.uk/government/collections/sustainable-aviation-fuel-mandate', status: 'check',
  },
  {
    region: 'US', name: 'Renewable Fuel Standard', fuel: 'Ethanol · Biodiesel · RD',
    values: { '2026': '24.0 bn RINs', '2027': '24.5 bn RINs' },
    note: 'EPA proposal of June 2025; final volumes to verify.',
    source: 'U.S. EPA', url: 'https://www.epa.gov/renewable-fuel-standard', status: 'check',
  },
  {
    region: 'US', name: '45Z Clean Fuel Production Credit', fuel: 'SAF · RD · Ethanol',
    values: { '2025': 'active', '2026': 'active', '2027': 'active', '2028': 'active' },
    note: 'Carbon-intensity-based producer credit; extension to 2029 to verify.',
    source: 'IRS / U.S. Treasury', url: 'https://www.irs.gov/credits-deductions/clean-fuel-production-credit', status: 'check',
  },
  {
    region: 'BR', name: 'Fuel of the Future', fuel: 'Ethanol · FAME',
    values: { '2025': 'E30 · B15', '2030': 'B20' },
    note: 'Ethanol blend 30 %, biodiesel stepping up 1 pp per year.',
    source: 'Law 14.993/2024', url: 'https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2024/lei/l14993.htm', status: 'check',
  },
  {
    region: 'ID', name: 'Biodiesel mandate', fuel: 'FAME (palm)',
    values: { '2025': 'B40', '2026': 'B50 planned' },
    note: 'Absorbs a growing share of palm oil output domestically.',
    source: 'ESDM', url: 'https://www.esdm.go.id/', status: 'check',
  },
  {
    region: 'IN', name: 'Ethanol blending', fuel: 'Ethanol (cane, grain)',
    values: { '2025': 'E20' },
    note: 'E20 nationwide target reached in 2025.',
    source: 'MoPNG', url: 'https://mopng.gov.in/', status: 'check',
  },
  {
    region: 'IMO', name: 'Net-Zero Framework', fuel: 'Marine fuels',
    values: { '2025': 'postponed' },
    note: 'Adoption vote delayed by one year in Oct 2025.',
    source: 'DNV', url: 'https://www.dnv.com/news/2025/decision-on-the-imo-net-zero-framework-delayed-for-one-year/', status: 'real',
  },
]

export const DEMAND_PULL = [
  { fuel: 'SAF', strength: 3, why: 'EU 2 % → 6 % → 20 %, UK 2 % → 10 %' },
  { fuel: 'HVO / RD', strength: 2, why: 'GHG quotas, FuelEU, 45Z; feeds SAF via HEFA' },
  { fuel: 'FAME', strength: 1, why: 'Blend walls in EU; growth in BR (B15→B20), ID (B40→B50)' },
  { fuel: 'Ethanol', strength: 2, why: 'BR E30, IN E20, US RFS' },
]
