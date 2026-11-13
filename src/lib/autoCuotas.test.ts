import { describe, expect, it } from 'vitest'
import { autoCuotaOps, rebaseAutoMark } from './autoCuotas'
import { chargeDate, emptyData, pendingCuotas, planStatus, type Data } from './calc'
import type { Op } from './store/types'
import type { Expense, Plan } from './types'

const st = { createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }
const plan = (extra: Partial<Plan> = {}): Plan => ({
  id: 'pl', propertyId: 'p1', concept: 'Mesa', total: 120_000, count: 12, installment: 10_000, currency: 'ARS', startMonth: '2026-08', method: 'Tarjeta de crédito', ...st, ...extra,
})
const cuota = (no: number, extra: Partial<Expense> = {}): Expense => ({
  id: `m${no}`, kind: 'installment', date: '2026-08-20', propertyId: 'p1', concept: 'Mesa', amount: 10_000, currency: 'ARS', planId: 'pl', installmentNo: no, ...st, ...extra,
})

/** Apply ops to an in-memory Data (puts + deletes on plans/expenses). */
function run(d: Data, today: string): Data {
  const ops = autoCuotaOps(d, today)
  const next = { ...d, plans: [...d.plans], expenses: [...d.expenses] }
  for (const o of ops as (Op & { row?: { id: string } })[]) {
    if (o.op !== 'put') continue
    const list = (o.table === 'plans' ? next.plans : next.expenses) as { id: string }[]
    const i = list.findIndex((x) => x.id === o.row!.id)
    if (i >= 0) list[i] = o.row! as never
    else list.push(o.row! as never)
  }
  return next
}
const data = (patch: Partial<Data>): Data => ({ ...emptyData(), ...patch })
const nos = (d: Data) => d.expenses.map((e) => e.installmentNo).sort((a, b) => a! - b!)

describe('auto cuotas', () => {
  it('posts every cuota whose charge day arrived, dated on that day, with the plan values', () => {
    const d = run(data({ plans: [plan({ chargeDay: 10 })] }), '2026-11-13')
    expect(nos(d)).toEqual([1, 2, 3, 4]) // Aug, Sep, Oct, Nov 10
    const nov = d.expenses.find((e) => e.installmentNo === 4)!
    expect(nov).toMatchObject({ date: '2026-11-10', period: '2026-11', amount: 10_000, method: 'Tarjeta de crédito', kind: 'installment', planId: 'pl' })
    expect(d.plans[0].autoPostedThrough).toBe(4)
    expect(planStatus(d.plans[0], d.expenses).remainingCount).toBe(8)
  })

  it("doesn't post a cuota before its charge day", () => {
    const d = run(data({ plans: [plan({ chargeDay: 20 })] }), '2026-11-13')
    expect(nos(d)).toEqual([1, 2, 3])
  })

  it('defaults to day 1 and clamps day 31 to short months', () => {
    expect(chargeDate(plan(), 1)).toBe('2026-08-01')
    expect(chargeDate(plan({ startMonth: '2027-02', chargeDay: 31 }), 1)).toBe('2027-02-28')
  })

  it('is idempotent and skips cuotas entered by hand', () => {
    const once = run(data({ plans: [plan()], expenses: [cuota(2)] }), '2026-11-13')
    expect(nos(once)).toEqual([1, 2, 3, 4])
    expect(once.expenses.find((e) => e.installmentNo === 2)!.id).toBe('m2')
    expect(autoCuotaOps(once, '2026-11-13')).toEqual([])
  })

  it('a deleted auto cuota is not posted again', () => {
    const d = run(data({ plans: [plan()] }), '2026-11-13')
    const without3 = { ...d, expenses: d.expenses.filter((e) => e.installmentNo !== 3) }
    expect(autoCuotaOps(without3, '2026-11-13')).toEqual([])
    // and it shows as pending to pay by hand
    expect(pendingCuotas(without3, '2026-11').map((c) => c.cuota.no)).toEqual([3])
  })

  it('catches up a month later; manual and cancelled plans are left alone', () => {
    const d = run(data({ plans: [plan(), plan({ id: 'off', auto: false }), plan({ id: 'x', cancelled: true })] }), '2026-11-13')
    expect(nos(d)).toEqual([1, 2, 3, 4])
    expect(nos(run(d, '2026-12-01'))).toEqual([1, 2, 3, 4, 5])
  })

  it('stops at the last cuota', () => {
    const d = run(data({ plans: [plan({ count: 3 })] }), '2027-06-01')
    expect(nos(d)).toEqual([1, 2, 3])
    expect(autoCuotaOps(d, '2027-07-01')).toEqual([])
  })

  it('this month\'s cuota before its charge day is not "to record": it will post itself', () => {
    const d = run(data({ plans: [plan({ chargeDay: 25 })] }), '2026-11-13')
    expect(pendingCuotas(d, '2026-11').filter((c) => c.cuota.month === '2026-11')).toEqual([])
  })

  it('moving the start later keeps the not-yet-due cuotas pending', () => {
    const d = run(data({ plans: [plan()] }), '2026-11-13')
    const moved = { ...d.plans[0], startMonth: '2026-10' }
    expect(rebaseAutoMark(moved, '2026-11-13')).toBe(2)
    expect(rebaseAutoMark(plan(), '2026-11-13')).toBeUndefined()
  })
})
