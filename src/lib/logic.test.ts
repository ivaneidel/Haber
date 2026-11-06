import { describe, expect, it } from 'vitest'
import {
  capitalSummary,
  commitments,
  emptyData,
  filterFlows,
  isDue,
  pendingCuotas,
  pendingRecurring,
  planStatus,
  propertyYield,
  suggestedRentPeriod,
  toFlows,
  totals,
  type Data,
} from './calc'
import { addMonths, monthDiff, monthRange } from './dates'
import { lensesFor, makeLens, makeRateBook, type FxConfig } from './money'
import { pensionInMonth, pensionMonthlyAvg, project, defaultProjection } from './projection'
import { parseAmount } from '../components/ui'
import type { Expense, Income, Investment, Pension, Plan, Property, Recurring, Valuation, Yield } from './types'

const st = { createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }
const prop = (id: string, extra: Partial<Property> = {}): Property => ({ id, name: id, refRentCurrency: 'ARS', ...st, ...extra })
const rent = (id: string, date: string, period: string, amount: number, propertyId = 'p1', currency: 'ARS' | 'USD' = 'ARS'): Income => ({
  id,
  source: 'rent',
  date,
  period,
  propertyId,
  amount,
  currency,
  ...st,
})
const exp = (id: string, date: string, amount: number, kind: Expense['kind'] = 'eventual', extra: Partial<Expense> = {}): Expense => ({
  id,
  kind,
  date,
  propertyId: 'p1',
  concept: 'x',
  amount,
  currency: 'ARS',
  ...st,
  ...extra,
})
const fx: FxConfig = { series: 'MEP', criterion: 'historical' }
const data = (patch: Partial<Data>): Data => ({ ...emptyData(), ...patch })

describe('dates', () => {
  it('adds months across years', () => {
    expect(addMonths('2026-11', 3)).toBe('2027-02')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
    expect(monthDiff('2025-10', '2026-02')).toBe(4)
    expect(monthRange('2026-11', '2027-01')).toEqual(['2026-11', '2026-12', '2027-01'])
  })
})

describe('parseAmount', () => {
  it('reads Argentine and plain formats', () => {
    expect(parseAmount('1.234.567,50', 'es')).toBe(1234567.5)
    expect(parseAmount('650.000', 'es')).toBe(650000)
    expect(parseAmount('1,5', 'es')).toBe(1.5)
    expect(parseAmount('1.5', 'es')).toBe(1.5)
    expect(parseAmount('1,234.5', 'en')).toBe(1234.5)
    expect(parseAmount('$ 20.000', 'es')).toBe(20000)
    expect(parseAmount('', 'es')).toBeNull()
  })
})

describe('cash date vs period (spec §3)', () => {
  const d = data({ properties: [prop('p1')], incomes: [rent('r1', '2026-11-03', '2026-10', 500)] })
  const flows = toFlows(d)
  const ars = makeLens('ARS', false, makeRateBook([], 'MEP'), fx)
  it('counts October rent collected in November as November cash', () => {
    expect(totals(filterFlows(flows, { from: '2026-11', to: '2026-11' }), ars).rent).toBe(500)
    expect(totals(filterFlows(flows, { from: '2026-10', to: '2026-10' }), ars).rent).toBe(0)
  })
  it('and as October when viewed by period', () => {
    expect(totals(filterFlows(flows, { from: '2026-10', to: '2026-10', byPeriod: true }), ars).rent).toBe(500)
  })
  it('suggests the next period after the last one recorded', () => {
    expect(suggestedRentPeriod(d, 'p1', '2026-11')).toBe('2026-11')
    const d2 = data({ incomes: [rent('r1', '2026-10-03', '2026-09', 500)] })
    expect(suggestedRentPeriod(d2, 'p1', '2026-11')).toBe('2026-10')
  })
})

describe('currencies are never mixed implicitly (spec §13)', () => {
  const d = data({ incomes: [rent('a', '2026-01-05', '2026-01', 1000), rent('b', '2026-01-06', '2026-01', 10, 'p1', 'USD')] })
  const flows = toFlows(d)
  it('split view: each lens sees only its currency', () => {
    const [ars, usd] = lensesFor('split', makeRateBook([], 'MEP'), fx)
    expect(totals(flows, ars).rent).toBe(1000)
    expect(totals(flows, usd).rent).toBe(10)
  })
  it('consolidated with the historical rate of each date', () => {
    const book = makeRateBook(
      [
        { id: '1', date: '2025-12-31', series: 'MEP', value: 1000 },
        { id: '2', date: '2026-01-06', series: 'MEP', value: 1200 },
        { id: '3', date: '2026-01-06', series: 'Blue', value: 5 },
      ],
      'MEP',
    )
    const [ars] = lensesFor('ARS', book, fx)
    expect(totals(flows, ars).rent).toBe(1000 + 10 * 1200)
    const [usd] = lensesFor('USD', book, fx)
    expect(totals(flows, usd).rent).toBeCloseTo(1000 / 1000 + 10)
    const [latest] = lensesFor('USD', book, { ...fx, criterion: 'latest' })
    expect(totals(flows, latest).rent).toBeCloseTo(1000 / 1200 + 10)
  })
  it('falls back to split when there are no rates', () => {
    expect(lensesFor('USD', makeRateBook([], 'MEP'), fx)).toHaveLength(2)
  })
})

describe('fixed expenses', () => {
  const r: Recurring = { id: 'f', propertyId: 'p1', concept: 'Tasa', every: 2, startMonth: '2026-01', amount: 100, currency: 'ARS', active: true, ...st }
  it('is due every N months from its start', () => {
    expect(isDue(r, '2026-01')).toBe(true)
    expect(isDue(r, '2026-02')).toBe(false)
    expect(isDue(r, '2026-03')).toBe(true)
    expect(isDue(r, '2025-11')).toBe(false)
    expect(isDue({ ...r, every: 0 }, '2026-01')).toBe(false)
  })
  it('stops being pending once paid for that period', () => {
    const d = data({ properties: [prop('p1')], recurring: [r] })
    expect(pendingRecurring(d, '2026-03')).toHaveLength(1)
    d.expenses = [exp('e', '2026-04-02', 100, 'fixed', { recurringId: 'f', period: '2026-03' })]
    expect(pendingRecurring(d, '2026-03')).toHaveLength(0)
  })
  it('archived properties have nothing pending', () => {
    const d = data({ properties: [prop('p1', { archived: true })], recurring: [r] })
    expect(pendingRecurring(d, '2026-03')).toHaveLength(0)
  })
})

describe('installments', () => {
  const plan: Plan = { id: 'pl', propertyId: 'p1', concept: 'Heladera', total: 1200, count: 12, installment: 100, currency: 'ARS', startMonth: '2026-08', ...st }
  const paid = [1, 2].map((no) => exp(`c${no}`, `${addMonths('2026-08', no - 1)}-10`, 100, 'installment', { planId: 'pl', installmentNo: no }))
  it('tracks paid and pending cuotas', () => {
    const s = planStatus(plan, paid)
    expect(s.paidCount).toBe(2)
    expect(s.remainingCount).toBe(10)
    expect(s.remainingAmount).toBe(1000)
    expect(s.next).toMatchObject({ no: 3, month: '2026-10' })
  })
  it('lists overdue and current cuotas as pending', () => {
    const d = data({ plans: [plan], expenses: paid })
    expect(pendingCuotas(d, '2026-11').map((c) => c.cuota.no)).toEqual([3, 4])
  })
  it('projects future commitments; overdue lands on the first month', () => {
    const d = data({ plans: [plan], expenses: paid })
    const lens = makeLens('ARS', false, makeRateBook([], 'MEP'), fx)
    const c = commitments(d, '2026-12', 3, lens, false)
    expect(c.map((x) => x.installment)).toEqual([300, 100, 100])
  })
  it('cuotas count as cash in the month they are paid', () => {
    const lens = makeLens('ARS', false, makeRateBook([], 'MEP'), fx)
    const t = totals(filterFlows(toFlows(data({ expenses: paid })), { from: '2026-09', to: '2026-09' }), lens)
    expect(t.installment).toBe(100)
  })
})

describe('capital is not income (spec §6, §7)', () => {
  const inv: Investment = { id: 'i', name: 'PF', type: 'Plazo fijo', currency: 'USD', capital: 10_000, startDate: '2026-03-01', status: 'active', fromAvailable: true, ...st }
  const base = data({
    propertySales: [{ id: 's', status: 'done', propertyName: 'X', date: '2026-02-01', price: 21_000, costs: 1000, net: 20_000, currency: 'USD', ...st }],
    investments: [inv],
  })
  it('a sale adds capital, an investment takes it out', () => {
    const s = capitalSummary(base, 'USD')
    expect(s.available).toBe(10_000)
    expect(s.placed).toBe(10_000)
  })
  it('a planned sale does not count', () => {
    const d = { ...base, propertySales: [...base.propertySales, { ...base.propertySales[0], id: 's2', status: 'planned' as const, net: 130_000 }] }
    expect(capitalSummary(d, 'USD').available).toBe(10_000)
  })
  it('recovering capital returns it; only the yield is income', () => {
    const y: Yield = { id: 'y', investmentId: 'i', date: '2026-09-01', amount: 300, currency: 'USD', ...st }
    const d = { ...base, investments: [{ ...inv, status: 'matured' as const, closeDate: '2026-09-01', recovered: 10_000 }], yields: [y] }
    const s = capitalSummary(d, 'USD')
    expect(s.available).toBe(20_000)
    expect(s.placed).toBe(0)
    expect(s.yields).toBe(300)
    const usd = makeLens('USD', false, makeRateBook([], 'MEP'), fx)
    const t = totals(toFlows(d), usd)
    expect(t.income).toBe(300) // not 10_300, not 20_300
    expect(capitalSummary({ ...d, yields: [{ ...y, toCapital: true }] }, 'USD').available).toBe(20_300)
  })
  it('new money does not drain available capital', () => {
    const d = { ...base, investments: [{ ...inv, fromAvailable: false }] }
    expect(capitalSummary(d, 'USD').available).toBe(20_000)
  })
})

describe('rentabilidad (spec §10)', () => {
  const vals: Valuation[] = [
    { id: 'v1', propertyId: 'p1', date: '2025-06-01', value: 100_000, currency: 'USD', ...st },
    { id: 'v2', propertyId: 'p1', date: '2026-06-01', value: 110_000, currency: 'USD', ...st },
  ]
  const d = data({
    properties: [prop('p1')],
    valuations: vals,
    incomes: [rent('a', '2026-03-01', '2026-03', 6000, 'p1', 'USD')],
    expenses: [exp('e', '2026-04-01', 500, 'eventual', { currency: 'USD' })],
  })
  const lensFor = (c: 'ARS' | 'USD') => makeLens(c, false, makeRateBook([], 'MEP'), fx)
  it('net / value of that year, appreciation apart', () => {
    const r = propertyYield(d, toFlows(d), d.properties[0], 2026, lensFor)
    expect(r.net).toBe(5500)
    expect(r.value).toBe(110_000)
    expect(r.pct).toBeCloseTo(5)
    expect(r.appreciation).toBe(10_000)
  })
  it('a later valuation does not rewrite a past year', () => {
    const r = propertyYield(d, toFlows(d), d.properties[0], 2025, lensFor)
    expect(r.value).toBe(100_000)
    expect(r.approx).toBe(false)
  })
  it('years before any valuation use the earliest one, flagged approx', () => {
    const r = propertyYield(d, toFlows(d), d.properties[0], 2024, lensFor)
    expect(r.value).toBe(100_000)
    expect(r.approx).toBe(true)
  })
})

describe('pensions & projection (spec §8, §11)', () => {
  const p: Pension = { id: 'j', name: 'J', startMonth: '2027-05', amount: 1000, currency: 'ARS', confirmed: false, aguinaldo: true, ...st }
  it('pays nothing before it starts', () => {
    expect(pensionInMonth(p, '2027-04')).toBe(0)
    expect(pensionInMonth(p, '2027-05')).toBe(1000)
  })
  it('adds a prorated aguinaldo in June and a full half in December', () => {
    expect(pensionInMonth(p, '2027-06')).toBeCloseTo(1000 + 500 * (2 / 6))
    expect(pensionInMonth(p, '2027-12')).toBe(1500)
    expect(pensionMonthlyAvg(p)).toBeCloseTo(13000 / 12)
  })
  it('future pensions are never income', () => {
    const d = data({ pensions: [p] })
    const lens = makeLens('ARS', false, makeRateBook([], 'MEP'), fx)
    expect(totals(toFlows(d), lens).income).toBe(0)
  })
  it('builds scenarios at each pension start', () => {
    const d = data({ pensions: [p, { ...p, id: 'k', name: 'K', startMonth: '2031-05', amount: 800 }], incomes: [rent('a', '2026-10-05', '2026-10', 1200)] })
    const pr = project(d, toFlows(d), { ...defaultProjection, yieldBasis: 'last12', includeSales: false }, 'ARS', makeRateBook([], 'MEP'), '2026-11')
    expect(pr.scenarios.map((s) => s.month)).toEqual(['2026-11', '2027-05', '2031-05'])
    expect(pr.scenarios[0].pension_).toBe(0)
    expect(pr.scenarios[1].pension_).toBeCloseTo(13000 / 12)
    expect(pr.scenarios[2].pension_).toBeCloseTo(13000 / 12 + (800 * 13) / 12)
    expect(pr.months).toHaveLength(120)
  })
})
