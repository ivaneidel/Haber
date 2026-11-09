import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { dueItems, emptyData, pendingDeductions, propertyYield, rentBreakdown, toFlows, totals, urgentItems, vacancyPeriods, currentStatus, type Data } from './calc'
import { makeLens, makeRateBook, type FxConfig } from './money'
import { createDexieStore } from './store/dexie'
import type { Bill, Expense, Income, Property, Recurring, StatusChange } from './types'

const st = { createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }
const data = (patch: Partial<Data>): Data => ({ ...emptyData(), ...patch })
const fx: FxConfig = { series: 'MEP', criterion: 'historical' }
const ars = makeLens('ARS', false, makeRateBook([], 'MEP'), fx)
const prop = (id: string, extra: Partial<Property> = {}): Property => ({ id, name: id, refRentCurrency: 'ARS', ...st, ...extra })
const rent = (id: string, date: string, amount: number, extra: Partial<Income> = {}): Income => ({ id, source: 'rent', date, period: date.slice(0, 7), propertyId: 'p1', amount, currency: 'ARS', ...st, ...extra })
const work = (id: string, date: string, amount: number, extra: Partial<Expense> = {}): Expense => ({ id, kind: 'eventual', date, propertyId: 'p1', concept: 'w', amount, currency: 'ARS', ...st, ...extra })

describe('agency liquidation: no double counting (spec 2 §5)', () => {
  it('fee and deducted works raise gross rent and count as expenses; net = cash received', () => {
    const d = data({
      incomes: [rent('r1', '2026-03-05', 800_000, { fee: 60_000 })],
      expenses: [work('w1', '2026-02-20', 140_000, { paidBy: 'agency', deducted: true, incomeId: 'r1', materials: 100_000 })],
    })
    const t = totals(toFlows(d), ars)
    expect(t.rent).toBe(1_000_000) // gross = 800k + 60k + 140k
    expect(t.fee).toBe(60_000)
    expect(t.eventual).toBe(140_000)
    expect(t.realEstateNet).toBe(800_000) // exactly what reached her
    expect(rentBreakdown(d, 'r1')).toMatchObject({ gross: 1_000_000, net: 800_000, fee: 60_000 })
    // Linked works are booked on the liquidation date.
    const marchOnly = totals(toFlows(d).filter((f) => f.month === '2026-03'), ars)
    expect(marchOnly.realEstateNet).toBe(800_000)
  })

  it('works paid by others and not deducted are never her expense', () => {
    const d = data({ expenses: [work('w1', '2026-02-20', 50_000, { paidBy: 'tenant' }), work('w2', '2026-02-21', 30_000, { paidBy: 'other', deducted: false })] })
    expect(totals(toFlows(d), ars).expense).toBe(0)
  })

  it('deducted but not linked yet is pending and still counted', () => {
    const d = data({ incomes: [rent('r1', '2026-03-05', 800_000)], expenses: [work('w1', '2026-03-20', 40_000, { paidBy: 'agency', deducted: true })] })
    expect(pendingDeductions(d, 'p1').map((e) => e.id)).toEqual(['w1'])
    expect(totals(toFlows(d), ars).eventual).toBe(40_000)
  })
})

describe('due dates and reminders (spec 2 §3)', () => {
  const rec = (extra: Partial<Recurring> = {}): Recurring => ({ id: 'g', propertyId: 'p1', concept: 'Gas', every: 1, startMonth: '2026-01', amount: 0, currency: 'ARS', active: true, dueDay: 12, ...st, ...extra })
  const bill = (extra: Partial<Bill> = {}): Bill => ({ id: 'b', recurringId: 'g', propertyId: 'p1', period: '2026-11', currency: 'ARS', amount: 61_000, ...st, ...extra })

  it('classifies by days to due date and receipt', () => {
    const d = data({ properties: [prop('p1')], recurring: [rec()] })
    const at = (now: string) => dueItems(d, now).find((i) => i.period === '2026-11')!
    expect(at('2026-11-05')).toMatchObject({ urgency: 'later', received: false, estimated: true, dueDate: '2026-11-12' })
    expect(at('2026-11-09').urgency).toBe('soon')
    expect(at('2026-11-12').urgency).toBe('today')
    expect(at('2026-11-14')).toMatchObject({ urgency: 'overdue', days: -2 })
  })

  it("uses the bill's own due date, and becomes paid when the payment is entered", () => {
    const d = data({ properties: [prop('p1')], recurring: [rec()], bills: [bill({ dueDate: '2026-11-20' })] })
    const it = dueItems(d, '2026-11-18').find((i) => i.period === '2026-11')!
    expect(it).toMatchObject({ urgency: 'soon', received: true, estimated: false, refAmount: 61_000 })
    d.expenses = [work('e', '2026-11-18', 61_000, { kind: 'fixed', recurringId: 'g', period: '2026-11' })]
    expect(dueItems(d, '2026-11-18').find((i) => i.period === '2026-11')!.urgency).toBe('paid')
    expect(urgentItems(dueItems(d, '2026-11-18')).filter((i) => i.period === '2026-11')).toHaveLength(0)
  })

  it("doesn't flood with months before the service was created", () => {
    const d = data({ properties: [prop('p1')], recurring: [rec({ createdAt: '2026-11-01T00:00:00Z' })] })
    expect(dueItems(d, '2026-11-05').map((i) => i.period)).toEqual(['2026-11'])
  })

  it('warns about next month when it falls due within 3 days', () => {
    const d = data({ properties: [prop('p1')], recurring: [rec({ dueDay: 1, createdAt: '2026-11-01T00:00:00Z' })] })
    const items = dueItems(d, '2026-11-29')
    expect(items.find((i) => i.period === '2026-12')?.urgency).toBe('soon')
  })
})

describe('vacancy (spec 2 §6, §7)', () => {
  const log: StatusChange[] = [
    { id: 's1', propertyId: 'p1', status: 'vacant', from: '2026-03-01', ...st },
    { id: 's2', propertyId: 'p1', status: 'rented', from: '2026-06-01', ...st },
  ]
  const d = data({
    properties: [prop('p1', { tenant: 'X' })],
    statusLog: log,
    incomes: [rent('r1', '2026-01-05', 500_000), rent('r2', '2026-07-05', 500_000)],
    expenses: [work('w1', '2026-04-10', 200_000), work('w2', '2026-08-10', 50_000)],
  })

  it('periods, days and cost of keeping it empty', () => {
    const v = vacancyPeriods(d, toFlows(d), d.properties[0], ars, '2026-11-09')
    expect(v).toEqual([{ status: 'vacant', from: '2026-03-01', to: '2026-06-01', days: 92, cost: 200_000 }])
    expect(currentStatus(d, d.properties[0], '2026-11-09')).toBe('rented')
    expect(currentStatus(d, d.properties[0], '2026-04-01')).toBe('vacant')
  })

  it('months rented / vacant and vacancy cost in the yearly yield', () => {
    const y = propertyYield(d, toFlows(d), d.properties[0], 2026, () => ars, '2026-12-31')
    expect(y.monthsVacant).toBe(3) // 92 days
    expect(y.monthsRented).toBe(9) // 273 days
    expect(y.vacancyCost).toBe(200_000)
    expect(y.eventual).toBe(250_000)
    expect(y.net).toBe(750_000)
  })

  it('unknown status gives no months', () => {
    const e = data({ properties: [prop('p2')] })
    expect(propertyYield(e, [], e.properties[0], 2026, () => ars).monthsRented).toBeNull()
  })
})

describe('schema upgrade keeps her data', () => {
  it('a v1 database opens in v2 with every row intact', async () => {
    const name = 'upgrade-' + Math.random()
    const v1 = new Dexie(name)
    v1.version(1).stores({ properties: 'id', valuations: 'id, propertyId', incomes: 'id, date', expenses: 'id, date, planId', recurring: 'id', plans: 'id', sales: 'id, date', investments: 'id', yields: 'id, investmentId', propertySales: 'id', capital: 'id', pensions: 'id', rates: 'id, date', settings: 'id' })
    await v1.table('properties').put(prop('p1'))
    await v1.table('incomes').put(rent('r1', '2026-01-05', 1))
    v1.close()
    const s = createDexieStore(name)
    expect(await s.all('properties')).toHaveLength(1)
    expect(await s.all('incomes')).toHaveLength(1)
    expect(await s.all('bills')).toEqual([])
    expect(await s.all('statusLog')).toEqual([])
  })
})
