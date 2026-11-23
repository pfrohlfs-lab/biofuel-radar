// Deliberately simple, transparent models. Everything here is ILLUSTRATIVE
// and labelled as "model" in the UI. The thesis would replace these with
// estimated relationships and valid uncertainty statements.

import type { Region, Series } from './types'

export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

/** Yield deviation (%) from 90-day weather anomalies, with an uncertainty half-width. */
export function yieldDeviation(region: Region, precipAnomPct: number, tempAnom: number) {
  const { precip, temp } = region.sens
  if (precip === 0 && temp === 0) return null
  const p = clamp(precipAnomPct, -60, 60)
  // diminishing returns for very wet conditions, full penalty for drought
  const pEffect = p >= 0 ? precip * p * 0.45 : precip * p
  // heat above normal hurts; cooler-than-normal is treated as roughly neutral
  const tEffect = temp * Math.max(0, tempAnom)
  const dev = clamp(pEffect + tEffect, -18, 12)
  const half = 1.5 + Math.abs(p) * 0.06 + Math.abs(tempAnom) * 0.6
  return { dev, lo: dev - half, hi: dev + half }
}

/** Monthly log returns of a price series. */
export function logReturns(s: Series, months = 120) {
  const d = s.data.slice(-months - 1)
  const r: number[] = []
  for (let i = 1; i < d.length; i++) r.push(Math.log(d[i][1] / d[i - 1][1]))
  return r
}

export function std(xs: number[]) {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1))
}

/**
 * Expected monthly P&L of a directional strategy that trades the sign of a
 * forecast with correlation rho to next month's return:
 *   E[sign(f) * r] = sqrt(2/pi) * sigma * rho   (bivariate normal)
 * Returned per $1m notional.
 */
export function expectedPnl(rho: number, sigmaMonthly: number, notional = 1_000_000) {
  return Math.sqrt(2 / Math.PI) * sigmaMonthly * rho * notional
}

/**
 * Cost of over-trusting a signal: size with believed skill rhoB (mean-variance
 * optimal size ~ rho), true skill rhoT. Relative to optimal, the expected
 * utility loss is proportional to (rhoB - rhoT)^2.
 */
export function overconfidenceLoss(rhoBelieved: number, rhoTrue: number, sigmaMonthly: number, notional = 1_000_000) {
  return 0.5 * (rhoBelieved - rhoTrue) ** 2 * sigmaMonthly * notional
}

export function fmt(n: number, digits = 0) {
  return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export function signed(n: number, digits = 1, unit = '') {
  const s = n > 0 ? '+' : n < 0 ? '−' : '±'
  return `${s}${fmt(Math.abs(n), digits)}${unit}`
}
