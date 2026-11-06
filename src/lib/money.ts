import { locale } from './dates'
import type { Currency, Rate } from './types'

export function formatMoney(n: number, cur: Currency, lang: string, opts: { decimals?: boolean; sign?: boolean } = {}): string {
  const s = Math.abs(n).toLocaleString(locale(lang), {
    minimumFractionDigits: opts.decimals ? 2 : 0,
    maximumFractionDigits: opts.decimals ? 2 : 0,
  })
  const symbol = cur === 'USD' ? 'US$' : '$'
  const neg = n < 0 && Math.round(Math.abs(n) * (opts.decimals ? 100 : 1)) !== 0
  return `${neg ? '−' : opts.sign && n > 0 ? '+' : ''}${symbol} ${s}`
}

/** Short form for chart axes: $ 1,2 M / US$ 15 k. */
export function formatCompact(n: number, cur: Currency, lang: string): string {
  const symbol = cur === 'USD' ? 'US$' : '$'
  const s = n.toLocaleString(locale(lang), { notation: 'compact', maximumFractionDigits: 1 })
  return `${symbol} ${s}`
}

export function formatPct(n: number | null | undefined, lang: string, decimals = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—'
  return `${n.toLocaleString(locale(lang), { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} %`
}

export function formatRate(n: number, lang: string): string {
  return n.toLocaleString(locale(lang), { maximumFractionDigits: 2 })
}

/** Round to cents to keep float noise out of stored amounts. */
export const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * How amounts in two currencies are shown:
 *  - 'split': each currency on its own, never mixed (the default, spec §13);
 *  - 'ARS' / 'USD': everything consolidated into one currency with an explicit rate.
 */
export type ViewMode = 'split' | Currency

export interface FxConfig {
  /** Which rate series to use (e.g. "MEP"). */
  series: string
  /** 'historical': each movement at the rate of its own date. 'latest': one rate for everything. */
  criterion: 'historical' | 'latest'
}

/**
 * A lens turns (amount, currency, date) into a number in `target`.
 * Without consolidation, amounts in the other currency count as 0 — so a split view is
 * simply the same aggregation run once per currency.
 */
export type Lens = ((amount: number, cur: Currency, date: string) => number) & {
  target: Currency
  consolidated: boolean
}

export interface RateBook {
  series: string
  rates: Rate[]
  latest?: Rate
  /** Rate in effect on `date` (last on/before it; the first one if the date is earlier). */
  at(date: string): Rate | undefined
}

export function makeRateBook(all: Rate[], series: string): RateBook {
  const rates = all.filter((r) => r.series === series && r.value > 0).sort((a, b) => a.date.localeCompare(b.date))
  const at = (date: string) => {
    if (!rates.length) return undefined
    let lo = 0
    let hi = rates.length - 1
    if (date < rates[0].date) return rates[0]
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (rates[mid].date <= date) lo = mid
      else hi = mid - 1
    }
    return rates[lo]
  }
  return { series, rates, latest: rates[rates.length - 1], at }
}

export function convert(amount: number, from: Currency, to: Currency, rate: number): number {
  if (from === to) return amount
  return from === 'USD' ? amount * rate : amount / rate
}

export function makeLens(target: Currency, consolidated: boolean, book: RateBook, fx: FxConfig): Lens {
  const fn = ((amount: number, cur: Currency, date: string) => {
    if (cur === target) return amount
    if (!consolidated) return 0
    const r = fx.criterion === 'latest' ? book.latest : book.at(date)
    return r ? convert(amount, cur, target, r.value) : 0
  }) as Lens
  fn.target = target
  fn.consolidated = consolidated
  return fn
}

/** The lenses a view needs: one per currency when split, a single one when consolidated. */
export function lensesFor(mode: ViewMode, book: RateBook, fx: FxConfig): Lens[] {
  if (mode === 'split' || !book.latest) return [makeLens('ARS', false, book, fx), makeLens('USD', false, book, fx)]
  return [makeLens(mode, true, book, fx)]
}
