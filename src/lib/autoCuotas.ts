import { putOp } from './repo'
import type { Op } from './store/types'
import { chargeDate, cuotasDueBy, isAuto, type Data } from './calc'
import type { Plan } from './types'

/** Deterministic id: two tabs (or two runs) posting the same cuota write the same row. */
export const autoCuotaId = (planId: string, no: number) => `auto-${planId}-${no}`

/**
 * Ops that record every auto cuota whose charge day has arrived and wasn't handled yet,
 * then remember how far it got. Cuotas already entered by hand are skipped; a cuota
 * deleted after being posted is not posted again (it's at or below `autoPostedThrough`).
 */
export function autoCuotaOps(d: Data, today: string): Op[] {
  const ops: Op[] = []
  for (const p of d.plans) {
    if (!isAuto(p) || p.cancelled) continue
    const done = p.autoPostedThrough ?? 0
    const due = cuotasDueBy(p, today)
    if (due <= done) continue
    const have = new Set(d.expenses.filter((e) => e.planId === p.id).map((e) => e.installmentNo))
    for (let no = done + 1; no <= due; no++) {
      if (have.has(no)) continue
      const date = chargeDate(p, no)
      ops.push(
        putOp('expenses', {
          id: autoCuotaId(p.id, no),
          kind: 'installment',
          date,
          period: date.slice(0, 7),
          propertyId: p.propertyId,
          concept: p.concept,
          category: p.category,
          amount: p.installment,
          currency: p.currency,
          method: p.method,
          planId: p.id,
          installmentNo: no,
        }),
      )
    }
    ops.push(putOp('plans', { ...p, autoPostedThrough: due }))
  }
  return ops
}

/**
 * After a plan's schedule is edited: keep the "already handled" mark only for cuotas that
 * are still due under the new schedule, so moving the start later doesn't skip cuotas.
 */
export function rebaseAutoMark(p: Plan, today: string): number | undefined {
  if (p.autoPostedThrough === undefined) return undefined
  return Math.min(p.autoPostedThrough, cuotasDueBy(p, today))
}

