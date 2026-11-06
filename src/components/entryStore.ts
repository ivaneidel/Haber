import type { Expense, Income, Sale, Yield } from '../lib/types'

/** What the single loader can register (spec §12: "pantalla única de carga"). */
export type EntryType = 'rent' | 'expense' | 'sale' | 'yield' | 'pension' | 'other'
export const ENTRY_TYPES: EntryType[] = ['rent', 'expense', 'sale', 'yield', 'pension', 'other']

export type EntryRecord = { table: 'incomes'; row: Income } | { table: 'expenses'; row: Expense } | { table: 'sales'; row: Sale } | { table: 'yields'; row: Yield }

export interface EntryRequest {
  type?: EntryType
  /** Edit this record… */
  edit?: EntryRecord
  /** …or start a new one from a copy of it. */
  duplicate?: EntryRecord
  /** Prefill fields for a new one. */
  preset?: Partial<Record<string, unknown>>
}

type Listener = (r: EntryRequest) => void
const listeners = new Set<Listener>()

/** Open the movement loader from anywhere. */
export function openEntry(r: EntryRequest = {}) {
  listeners.forEach((l) => l(r))
}

export function onOpenEntry(l: Listener): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}
