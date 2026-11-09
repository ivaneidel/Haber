import type {
  Bill,
  StatusChange,
  CapitalMove,
  Expense,
  Income,
  Investment,
  Pension,
  Plan,
  Property,
  PropertySale,
  Rate,
  Recurring,
  Sale,
  Setting,
  Valuation,
  Yield,
} from '../types'

/**
 * Storage is behind this interface so the backend can change (IndexedDB today, maybe
 * Firestore later) without touching the UI or the calculations. Rules for any backend:
 *  - every table is a flat collection of JSON rows keyed by a string `id`;
 *  - writes go through `apply`, an atomic batch of puts/deletes (IndexedDB transaction,
 *    Firestore writeBatch). Code that needs to read before writing reads the current
 *    snapshot first, so no backend needs read-inside-transaction support;
 *  - `subscribe` pushes the whole snapshot on every change. Personal-scale data
 *    (hundreds of rows a year) makes that cheap and keeps the UI trivially consistent.
 */
export interface Tables {
  properties: Property
  valuations: Valuation
  incomes: Income
  expenses: Expense
  recurring: Recurring
  plans: Plan
  sales: Sale
  investments: Investment
  yields: Yield
  propertySales: PropertySale
  capital: CapitalMove
  pensions: Pension
  rates: Rate
  settings: Setting
  bills: Bill
  statusLog: StatusChange
}

export type TableName = keyof Tables

/** Every table, in export/backup order. */
export const TABLES: TableName[] = [
  'properties',
  'valuations',
  'incomes',
  'expenses',
  'recurring',
  'plans',
  'sales',
  'investments',
  'yields',
  'propertySales',
  'capital',
  'pensions',
  'rates',
  'settings',
  'bills',
  'statusLog',
]

export type Snapshot = { [T in TableName]: Tables[T][] }

export type Op = { [T in TableName]: { op: 'put'; table: T; row: Tables[T] } | { op: 'delete'; table: T; id: string } }[TableName]

export interface Store {
  readonly kind: string
  all<T extends TableName>(table: T): Promise<Tables[T][]>
  get<T extends TableName>(table: T, id: string): Promise<Tables[T] | undefined>
  /** Atomic batch of writes. */
  apply(ops: Op[]): Promise<void>
  /** Wipe every table and load `snap` (backup restore). Atomic. */
  replaceAll(snap: Partial<Snapshot>): Promise<void>
  /** Called with the full snapshot now and after every change. Returns an unsubscribe. */
  subscribe(cb: (snap: Snapshot) => void, onError?: (e: unknown) => void): () => void
}
