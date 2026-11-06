import { addMonths, monthDiff, monthOf, monthRange, yearOf } from './dates'
import { capitalSummary, filterFlows, totals, type Data, type Flow } from './calc'
import { convert, type RateBook } from './money'
import type { Currency, Pension } from './types'

/**
 * Family-income projection (spec §11). Always an ESTIMATE in today's money: no inflation,
 * no rent updates, one exchange rate (the latest) for everything. Never mixed with real records.
 */
export interface ProjectionSettings {
  years: number
  /** 'last12': average real rent − expenses of the last 12 months; 'contracts': reference rents − average expenses. */
  rentBasis: 'last12' | 'contracts'
  /** 'rate': assumed annual % on capital (available + invested); 'last12': average real yields. */
  yieldBasis: 'rate' | 'last12'
  capitalRate: number
  includeSales: boolean
  includePlannedSales: boolean
  /** Currency the projection is shown in (its own choice, independent of the dashboard view). */
  currency: Currency
}

export const defaultProjection: ProjectionSettings = {
  years: 10,
  rentBasis: 'last12',
  yieldBasis: 'rate',
  capitalRate: 4,
  includeSales: true,
  includePlannedSales: true,
  currency: 'ARS',
}

export interface ProjMonth {
  month: string
  rent: number
  yield: number
  sale: number
  pension: number
  byPension: Record<string, number>
  total: number
}

export interface Scenario {
  key: 'now' | string
  month: string
  label: string
  pension?: Pension
  rent: number
  yield: number
  sale: number
  pension_: number
  total: number
}

export interface Projection {
  target: Currency
  rate?: { value: number; date: string; series: string }
  /** Some amounts were in the other currency and there was no rate to convert them. */
  missingRate: boolean
  base: { rent: number; yield: number; sale: number; capital: number; monthsOfData: number }
  months: ProjMonth[]
  years: { year: number; rent: number; yield: number; sale: number; pension: number; total: number }[]
  scenarios: Scenario[]
  pensionsWithoutAmount: Pension[]
}

/** Monthly haber of a pension in `month`, aguinaldo (SAC) included in June and December. */
export function pensionInMonth(p: Pension, month: string): number {
  const amt = p.amount ?? 0
  if (!amt || month < p.startMonth) return 0
  let v = amt
  const m = Number(month.slice(5, 7))
  if (p.aguinaldo && (m === 6 || m === 12)) {
    // Half a haber per semester, prorated by the months collected in it.
    const semStart = `${month.slice(0, 4)}-${m === 6 ? '01' : '07'}`
    const from = p.startMonth > semStart ? p.startMonth : semStart
    const monthsIn = monthDiff(from, month) + 1
    v += (amt / 2) * (Math.min(6, monthsIn) / 6)
  }
  return v
}

/** Average monthly haber including aguinaldo: 13 haberes a year. */
export const pensionMonthlyAvg = (p: Pension) => ((p.amount ?? 0) * (p.aguinaldo ? 13 : 12)) / 12

export function project(d: Data, flows: Flow[], s: ProjectionSettings, target: Currency, book: RateBook, now: string): Projection {
  const rate = book.latest
  let missingRate = false
  const conv = (amount: number, cur: Currency) => {
    if (cur === target) return amount
    if (!rate) {
      if (amount) missingRate = true
      return 0
    }
    return convert(amount, cur, target, rate.value)
  }
  const lens = Object.assign((a: number, c: Currency) => conv(a, c), { target, consolidated: true })

  // Base window: the last 12 complete months, or fewer if the data is younger.
  const lastFull = addMonths(now, -1)
  const firstData = flows.length ? flows.map((f) => f.month).sort()[0] : now
  const from = [addMonths(lastFull, -11), firstData].sort()[1]
  const monthsOfData = Math.max(1, monthDiff(from, lastFull) + 1)
  const t = totals(filterFlows(flows, { from, to: lastFull }), lens)
  const avgExpenses = t.expense / monthsOfData

  let rent = t.realEstateNet / monthsOfData
  if (s.rentBasis === 'contracts') {
    const ref = d.properties
      .filter((p) => !p.archived && !p.soldAt)
      .reduce((acc, p) => acc + conv(p.refRent ?? 0, p.refRentCurrency), 0)
    rent = ref - avgExpenses
  }
  const sale = s.includeSales ? t.sale / monthsOfData : 0

  let capital = 0
  for (const cur of ['ARS', 'USD'] as Currency[]) {
    const c = capitalSummary(d, cur)
    capital += conv(c.available + c.placed, cur)
  }
  const realYield = t.yield / monthsOfData
  const planned = s.includePlannedSales ? d.propertySales.filter((x) => x.status === 'planned') : []

  const end = addMonths(now, s.years * 12 - 1)
  const months: ProjMonth[] = monthRange(now, end).map((m) => {
    let cap = capital
    for (const ps of planned) if (monthOf(ps.date) <= m) cap += conv(ps.net, ps.currency)
    const y = s.yieldBasis === 'rate' ? (cap * (s.capitalRate / 100)) / 12 : realYield
    const byPension: Record<string, number> = {}
    let pension = 0
    for (const p of d.pensions) {
      const v = conv(pensionInMonth(p, m), p.currency)
      byPension[p.id] = v
      pension += v
    }
    return { month: m, rent, yield: y, sale, pension, byPension, total: rent + y + sale + pension }
  })

  const yearMap = new Map<number, Projection['years'][number]>()
  for (const pm of months) {
    const yr = yearOf(pm.month)
    const row = yearMap.get(yr) ?? { year: yr, rent: 0, yield: 0, sale: 0, pension: 0, total: 0 }
    row.rent += pm.rent
    row.yield += pm.yield
    row.sale += pm.sale
    row.pension += pm.pension
    row.total += pm.total
    yearMap.set(yr, row)
  }

  // Scenarios: today, then each time a pension starts (monthly average incl. aguinaldo).
  const scenarioAt = (month: string): Omit<Scenario, 'key' | 'label' | 'pension'> => {
    let cap = capital
    for (const ps of planned) if (monthOf(ps.date) <= month) cap += conv(ps.net, ps.currency)
    const y = s.yieldBasis === 'rate' ? (cap * (s.capitalRate / 100)) / 12 : realYield
    const pension_ = d.pensions.filter((p) => p.startMonth <= month).reduce((acc, p) => acc + conv(pensionMonthlyAvg(p), p.currency), 0)
    return { month, rent, yield: y, sale, pension_, total: rent + y + sale + pension_ }
  }
  const scenarios: Scenario[] = [{ key: 'now', label: 'now', ...scenarioAt(now) }]
  for (const p of [...d.pensions].sort((a, b) => a.startMonth.localeCompare(b.startMonth))) {
    if (p.startMonth <= now) continue
    scenarios.push({ key: p.id, label: p.name, pension: p, ...scenarioAt(p.startMonth) })
  }

  return {
    target,
    rate: rate && { value: rate.value, date: rate.date, series: rate.series },
    missingRate,
    base: { rent, yield: s.yieldBasis === 'rate' ? (capital * s.capitalRate) / 1200 : realYield, sale, capital, monthsOfData },
    months,
    years: [...yearMap.values()],
    scenarios,
    pensionsWithoutAmount: d.pensions.filter((p) => !p.amount),
  }
}
