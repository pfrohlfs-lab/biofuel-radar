import type { Status } from '../lib/types'

export type Dir = 1 | -1 | 0 // effect on the international USD price of the affected instrument

export interface TradeMeasure {
  id: string
  country: string
  title: string
  detail: string
  since: string
  affects: string[] // instrument keys
  dir: Dir
  why: string
  source: string
  url: string
  status: Status
}

// Curated from memory of 2024–2025 measures. Every item is marked "to verify"
// until checked against the official text; rates have changed repeatedly.
export const TRADE: TradeMeasure[] = [
  {
    id: 'id-levy', country: 'ID', title: 'Palm oil export levy', detail: 'Levy on CPO exports, raised to ~10 % of the reference price in 2025 to fund B40.',
    since: '2025-05', affects: ['palm', 'fame', 'hvo'], dir: 1, why: 'Less export supply, more domestic biodiesel use',
    source: 'Indonesia Ministry of Finance / BPDPKS', url: 'https://www.bpdp.or.id/', status: 'check',
  },
  {
    id: 'my-duty', country: 'MY', title: 'CPO export duty', detail: 'Sliding export duty (up to ~10 %) set monthly from a reference price.',
    since: 'monthly', affects: ['palm'], dir: 1, why: 'Higher duty at high prices caps exports',
    source: 'Royal Malaysian Customs', url: 'https://www.customs.gov.my/', status: 'check',
  },
  {
    id: 'in-duty', country: 'IN', title: 'Import duty cut on crude edible oils', detail: 'Basic customs duty on crude palm, soy and sunflower oil cut from 20 % to 10 %.',
    since: '2025-05', affects: ['palm', 'soyoil'], dir: 1, why: 'Higher import demand from the largest buyer',
    source: 'India CBIC notification', url: 'https://www.cbic.gov.in/', status: 'check',
  },
  {
    id: 'eu-ad', country: 'EU', title: 'Anti-dumping duties on Chinese biodiesel', detail: 'Definitive duties on FAME/HVO from China, roughly 10–36 % by producer.',
    since: '2025-02', affects: ['fame', 'hvo'], dir: 1, why: 'Removes cheap imports from the EU market',
    source: 'European Commission, trade defence', url: 'https://policy.trade.ec.europa.eu/enforcement-and-protection/trade-defence_en', status: 'check',
  },
  {
    id: 'cn-uco', country: 'CN', title: 'UCO export VAT rebate removed', detail: 'China cancelled the 13 % export VAT rebate for used cooking oil.',
    since: '2024-12', affects: ['uco', 'hvo', 'saf'], dir: 1, why: 'Higher cost of the largest UCO export flow',
    source: 'China Ministry of Finance', url: 'http://www.mof.gov.cn/', status: 'check',
  },
  {
    id: 'us-45z', country: 'US', title: '45Z feedstock origin rule', detail: 'From 2026 the clean fuel credit only counts feedstock from the US, Canada or Mexico.',
    since: '2026-01', affects: ['uco', 'soyoil', 'hvo', 'saf'], dir: 0, why: 'Bearish for imported UCO, bullish for US soybean oil',
    source: 'U.S. Treasury / IRS', url: 'https://www.irs.gov/credits-deductions/clean-fuel-production-credit', status: 'check',
  },
  {
    id: 'ar-tax', country: 'AR', title: 'Soybean oil export tax changes', detail: 'Export tax on soy products cut and changed several times in 2025.',
    since: '2025', affects: ['soyoil', 'fame'], dir: -1, why: 'Lower tax encourages exports from the largest soy oil exporter',
    source: 'Argentina Ministry of Economy', url: 'https://www.argentina.gob.ar/economia', status: 'check',
  },
  {
    id: 'eudr', country: 'EU', title: 'EU Deforestation Regulation (EUDR)', detail: 'Due-diligence rules for palm oil and soy imports; application date postponed.',
    since: 'postponed', affects: ['palm', 'soyoil'], dir: 1, why: 'Premium for verified deforestation-free supply',
    source: 'European Commission', url: 'https://environment.ec.europa.eu/topics/forests/deforestation/regulation-deforestation-free-products_en', status: 'check',
  },
]
