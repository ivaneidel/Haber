import { createDexieStore } from './store/dexie'
import type { Op, Store, TableName, Tables } from './store/types'
import { today, uid } from './dates'
import { round2 } from './money'
import { currentValuation, type Data } from './calc'
import type { Currency, Property } from './types'

/**
 * The only module that knows which Store is in use. UI and logic call the functions
 * below; swapping IndexedDB for another backend means changing this one line.
 */
export let store: Store = createDexieStore()

/** Tests (and a future backend switch) can install another store. */
export function setStore(s: Store): void {
  store = s
}

type Stamped = { id: string; createdAt: string; updatedAt: string }
type StampedTable = { [T in TableName]: Tables[T] extends Stamped ? T : never }[TableName]
export type Draft<T extends Stamped> = Omit<T, keyof Stamped> & Partial<Stamped>

const nowISO = () => new Date().toISOString()

/** Build a put op with id + created/updated stamps. */
export function putOp<T extends StampedTable>(table: T, rec: Draft<Tables[T]>): Op & { row: Tables[T] } {
  const t = nowISO()
  const row = { ...rec, id: rec.id ?? uid(), createdAt: rec.createdAt ?? t, updatedAt: t } as Tables[T]
  return { op: 'put', table, row } as Op & { row: Tables[T] }
}

export function delOp(table: TableName, id: string): Op {
  return { op: 'delete', table, id } as Op
}

/** Insert or update one record. Returns its id. */
export async function save<T extends StampedTable>(table: T, rec: Draft<Tables[T]>): Promise<string> {
  const op = putOp(table, rec)
  await store.apply([op])
  return op.row.id
}

/** Write a raw row (no stamps): rates, settings. */
export async function putRaw<T extends TableName>(table: T, row: Tables[T]): Promise<void> {
  await store.apply([{ op: 'put', table, row } as Op])
}

export async function remove(table: TableName, id: string): Promise<void> {
  await store.apply([delOp(table, id)])
}

export const apply = (ops: Op[]) => store.apply(ops)

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const s = await store.get('settings', key)
  return s ? (s.value as T) : fallback
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await putRaw('settings', { id: key, value })
}

// ---------------------------------------------------------------------------
// Domain operations that touch more than one record
// ---------------------------------------------------------------------------

/**
 * Save a property. If the market value changed, a NEW valuation row is added (dated
 * today) so past years keep the value they had (spec §14).
 */
export async function saveProperty(p: Draft<Property>, value: { amount: number | null; currency: Currency } | undefined, data: Data): Promise<string> {
  const op = putOp('properties', p)
  const ops: Op[] = [op]
  if (value?.amount && value.amount > 0) {
    const cur = p.id ? currentValuation(data, p.id) : undefined
    if (!cur || cur.value !== value.amount || cur.currency !== value.currency)
      ops.push(putOp('valuations', { propertyId: op.row.id, date: today(), value: round2(value.amount), currency: value.currency }))
  }
  await store.apply(ops)
  return op.row.id
}

/** How many records point at a property; a property with history can only be archived. */
export function propertyRefs(d: Data, id: string): number {
  return (
    d.incomes.filter((x) => x.propertyId === id).length +
    d.expenses.filter((x) => x.propertyId === id).length +
    d.recurring.filter((x) => x.propertyId === id).length +
    d.plans.filter((x) => x.propertyId === id).length +
    d.propertySales.filter((x) => x.propertyId === id).length
  )
}

export async function deletePropertyHard(d: Data, id: string): Promise<void> {
  await store.apply([...d.valuations.filter((v) => v.propertyId === id).map((v) => delOp('valuations', v.id)), delOp('properties', id)])
}

/** Delete a plan and its paid cuotas (they're its own records). */
export async function deletePlan(d: Data, id: string): Promise<void> {
  await store.apply([...d.expenses.filter((e) => e.planId === id).map((e) => delOp('expenses', e.id)), delOp('plans', id)])
}

export async function deleteInvestment(d: Data, id: string): Promise<void> {
  await store.apply([...d.yields.filter((y) => y.investmentId === id).map((y) => delOp('yields', y.id)), delOp('investments', id)])
}

export async function wipeAll(): Promise<void> {
  await store.replaceAll({})
}

export async function isEmpty(): Promise<boolean> {
  const counts = await Promise.all((['properties', 'incomes', 'expenses', 'investments', 'sales'] as const).map((t) => store.all(t)))
  return counts.every((c) => c.length === 0)
}

/** Ask the browser not to evict our data under storage pressure. Best-effort. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}
