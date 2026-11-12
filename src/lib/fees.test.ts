import { describe, expect, it } from 'vitest'
import { emptyData, monthlyRealEstate, propertyYield, toFlows, totals, type Data } from './calc'
import { makeLens, makeRateBook, type FxConfig } from './money'
import type { Expense, Income, Property } from './types'

const st = { createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }
const data = (patch: Partial<Data>): Data => ({ ...emptyData(), ...patch })
const fx: FxConfig = { series: 'MEP', criterion: 'historical' }
const ars = makeLens('ARS', false, makeRateBook([], 'MEP'), fx)
const prop = (id: string): Property => ({ id, name: id, refRentCurrency: 'ARS', ...st })
const rent = (id: string, date: string, amount: number, extra: Partial<Income> = {}): Income => ({ id, source: 'rent', date, period: date.slice(0, 7), propertyId: 'p1', amount, currency: 'ARS', ...st, ...extra })
const exp = (id: string, kind: Expense['kind'], date: string, amount: number, extra: Partial<Expense> = {}): Expense => ({ id, kind, date, propertyId: 'p1', concept: 'c', amount, currency: 'ARS', ...st, ...extra })

describe('honorarios paid on their own', () => {
  it('land in the same fee bucket as withheld ones, counted once', () => {
    const d = data({
      properties: [prop('p1')],
      incomes: [rent('r1', '2026-03-05', 900_000, { fee: 50_000 })],
      expenses: [exp('f1', 'fee', '2026-04-10', 70_000)],
    })
    const t = totals(toFlows(d), ars)
    expect(t.fee).toBe(120_000)
    expect(t.expense).toBe(120_000)
    expect(t.eventual).toBe(0)
    expect(t.rent).toBe(950_000) // only the withheld fee is added back to gross
    expect(t.realEstateNet).toBe(830_000) // 900k received − 70k paid apart
    expect(propertyYield(d, toFlows(d), d.properties[0], 2026, () => ars, '2026-12-31').fee).toBe(120_000)
  })
})

describe('properties month by month', () => {
  const d = data({
    properties: [prop('p1'), prop('p2')],
    incomes: [
      rent('r1', '2026-01-05', 500_000, { fee: 25_000 }),
      rent('r2', '2026-02-05', 500_000),
      rent('r3', '2026-02-07', 300_000, { propertyId: 'p2' }),
      { id: 'pen', source: 'pension', date: '2026-01-10', amount: 999_999, currency: 'ARS', ...st },
    ],
    expenses: [exp('g1', 'fixed', '2026-01-20', 40_000), exp('f1', 'fee', '2026-02-15', 30_000), exp('e1', 'eventual', '2026-03-01', 100_000, { propertyId: 'p2' })],
  })

  it('rows add up to the year total, with a running cumulative; pensions stay out', () => {
    const { rows, total } = monthlyRealEstate(toFlows(d), ars, 2026, false, '2026-11')
    expect(rows).toHaveLength(12)
    expect(rows[0]).toMatchObject({ rent: 525_000, fixed: 40_000, fee: 25_000, realEstateNet: 460_000, cumulative: 460_000 })
    expect(rows[1]).toMatchObject({ rent: 800_000, fee: 30_000, realEstateNet: 770_000, cumulative: 1_230_000 })
    expect(rows[2]).toMatchObject({ realEstateNet: -100_000, cumulative: 1_130_000 })
    expect(rows.reduce((s, r) => s + r.realEstateNet, 0)).toBe(total.realEstateNet)
    expect(total.realEstateNet).toBe(1_130_000)
    expect(total.pension).toBe(0)
    expect(rows[10].future).toBe(false)
    expect(rows[11].future).toBe(true)
  })

  it('scoped to one property', () => {
    const { total } = monthlyRealEstate(toFlows(d).filter((f) => f.propertyId === 'p2'), ars, 2026)
    expect(total.realEstateNet).toBe(200_000)
  })
})
