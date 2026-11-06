import Dexie, { liveQuery } from 'dexie'
import { TABLES, type Op, type Snapshot, type Store } from './types'

/**
 * IndexedDB backend. Everything lives in this browser — nothing is sent anywhere.
 * Schema changes must be ADDITIVE: add a new `version(n).stores()` block, never edit an
 * old one, so existing data upgrades in place.
 *
 * On GitHub Pages every repo of a user shares one origin (`<user>.github.io`), so the
 * database name must be unique to this app.
 */
class HaberDB extends Dexie {
  constructor(name: string) {
    super(name)
    this.version(1).stores({
      properties: 'id',
      valuations: 'id, propertyId',
      incomes: 'id, date',
      expenses: 'id, date, planId',
      recurring: 'id',
      plans: 'id',
      sales: 'id, date',
      investments: 'id',
      yields: 'id, investmentId',
      propertySales: 'id',
      capital: 'id',
      pensions: 'id',
      rates: 'id, date',
      settings: 'id',
    })
  }
}

export function createDexieStore(name = 'haber-ingresos'): Store {
  const db = new HaberDB(name)
  const readAll = async (): Promise<Snapshot> => {
    const rows = await Promise.all(TABLES.map((t) => db.table(t).toArray()))
    return Object.fromEntries(TABLES.map((t, i) => [t, rows[i]])) as Snapshot
  }

  return {
    kind: 'indexeddb',
    // Rows are plain JSON; the Store interface carries the types.
    all: (t) => db.table(t).toArray() as unknown as Promise<never>,
    get: (t, id) => db.table(t).get(id) as unknown as Promise<never>,
    async apply(ops: Op[]) {
      if (!ops.length) return
      const names: string[] = [...new Set(ops.map((o) => o.table as string))]
      // Typed loosely on purpose: Dexie's overloads blow up the compiler on dynamic table lists.
      const tx = db as unknown as { transaction(mode: 'rw', tables: string[], fn: () => Promise<void>): Promise<void> }
      await tx.transaction('rw', names, async () => {
        for (const o of ops as { op: string; table: string; row?: object; id?: string }[]) {
          if (o.op === 'put') await db.table(o.table).put(o.row)
          else await db.table(o.table).delete(o.id!)
        }
      })
    },
    async replaceAll(snap) {
      const tx = db as unknown as { transaction(mode: 'rw', tables: string[], fn: () => Promise<void>): Promise<void> }
      await tx.transaction('rw', [...TABLES], async () => {
        for (const t of TABLES) {
          await db.table(t).clear()
          const rows = snap[t] ?? []
          if (rows.length) await db.table(t).bulkPut(rows)
        }
      })
    },
    subscribe(cb, onError) {
      const sub = liveQuery(readAll).subscribe({ next: cb, error: (e) => onError?.(e) })
      return () => sub.unsubscribe()
    },
  }
}
