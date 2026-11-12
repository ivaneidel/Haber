/**
 * Every economic movement is stored as its own record; totals and charts are always
 * derived from them (spec §15). Dates are local `YYYY-MM-DD`, months are `YYYY-MM`.
 */
export type Currency = 'ARS' | 'USD'
export const CURRENCIES: Currency[] = ['ARS', 'USD']

/** Common to every record the user owns. */
interface Base {
  id: string
  createdAt: string
  updatedAt: string
}

export interface Property extends Base {
  name: string
  address?: string
  postalCode?: string
  city?: string
  /** Nomenclatura catastral. */
  cadastre?: string
  /** Número de partida inmobiliaria. */
  parcel?: string
  province?: string
  tenant?: string
  contractStart?: string
  contractEnd?: string
  contractNotes?: string
  /** Reference monthly rent — a hint for the loader, never counted as income. */
  refRent?: number | null
  refRentCurrency: Currency
  /** "Dada de baja": hidden from pickers, history untouched. */
  archived?: boolean
  archivedAt?: string
  /** Set when a property sale is registered for it. */
  soldAt?: string
  notes?: string
}

/** Market value snapshots. Updating the value adds a row, never overwrites (spec §14). */
export interface Valuation extends Base {
  propertyId: string
  date: string
  value: number
  currency: Currency
  notes?: string
}

export type IncomeSource = 'rent' | 'pension' | 'other'

/** Money actually received. Rents, pensions and any other income. */
export interface Income extends Base {
  source: IncomeSource
  /** Date the money arrived (cash basis). */
  date: string
  /** Rent: month the rent belongs to. Pension: month of the haber. */
  period?: string
  propertyId?: string
  /** Snapshot of the tenant/payer at the time, so a tenant change doesn't rewrite history. */
  payer?: string
  pensionId?: string
  description?: string
  /** What actually reached her (net of the agency's fee and deductions). Cash basis. */
  amount: number
  currency: Currency
  /** Rent: honorarios de administración withheld by the agency (same currency). Gross = amount + fee + deductions. */
  fee?: number | null
  method?: string
  notes?: string
}

/** `fee` = honorarios de administración paid on their own (not withheld from a rent). */
export type ExpenseKind = 'fixed' | 'installment' | 'eventual' | 'fee'
export const EXPENSE_KINDS: ExpenseKind[] = ['fixed', 'installment', 'eventual', 'fee']

/** Money actually paid for a property. */
export interface Expense extends Base {
  kind: ExpenseKind
  date: string
  propertyId: string
  concept: string
  category?: string
  amount: number
  currency: Currency
  method?: string
  notes?: string
  /** fixed: the template it was paid from, and the month it covers. */
  recurringId?: string
  period?: string
  /** installment: the plan and which cuota (1-based). */
  planId?: string
  installmentNo?: number
  /** eventual (works): when the job was done; `date` is when it was paid. */
  workDate?: string
  /** Optional breakdown of `amount` (always the total). Parts never add on top of it. */
  materials?: number | null
  labor?: number | null
  otherCosts?: number | null
  managedBy?: string
  /** Who paid it. Default (undefined) = me. */
  paidBy?: PaidBy
  /** Paid by someone else but taken out of a rent liquidation: it IS her cost. */
  deducted?: boolean
  /** The rent (Income) whose liquidation it was deducted from. */
  incomeId?: string
}

export type PaidBy = 'me' | 'agency' | 'tenant' | 'other'
export const PAID_BY: PaidBy[] = ['me', 'agency', 'tenant', 'other']

/** True when the expense costs her money (she paid, or it was deducted from her rent). */
export function isOwnExpense(e: Pick<Expense, 'paidBy' | 'deducted'>): boolean {
  return !e.paidBy || e.paidBy === 'me' || !!e.deducted
}

export type BillChannel = 'email' | 'whatsapp' | 'paper' | 'portal' | 'other'
export const BILL_CHANNELS: BillChannel[] = ['email', 'whatsapp', 'paper', 'portal', 'other']

/**
 * A fixed, recurring cost (Rentas, tasas, servicios…) — also the service/tax *account* of a
 * property: provider, client number, how the bill arrives. Payments are Expense rows.
 */
export interface Recurring extends Base {
  propertyId: string
  concept: string
  category?: string
  provider?: string
  /** Número de cliente / cuenta / partida. */
  account?: string
  /** Usual due day of the month (1–31). */
  dueDay?: number | null
  channel?: BillChannel
  channelEmail?: string
  portalUrl?: string
  billUrl?: string
  /** Months between charges: 1 monthly, 2 bimonthly, … 12 yearly; 0 = irregular. */
  every: number
  /** First month it's due; with `every` it decides which months are due. */
  startMonth: string
  /** Usual amount; 0 = varies (only a reference, never assumed). */
  amount: number
  currency: Currency
  method?: string
  active: boolean
  notes?: string
}

/** A received invoice for one period of a Recurring. Paid ⇔ an Expense with the same recurringId+period exists. */
export interface Bill extends Base {
  recurringId: string
  propertyId: string
  period: string
  amount?: number | null
  currency: Currency
  receivedDate?: string
  dueDate?: string
  notes?: string
}

export type PropertyStatus = 'rented' | 'vacant' | 'repair' | 'preparing' | 'forSale'
export const PROPERTY_STATUSES: PropertyStatus[] = ['rented', 'vacant', 'repair', 'preparing', 'forSale']

/** Status history of a property: each row is in effect from `from` until the next one. */
export interface StatusChange extends Base {
  propertyId: string
  status: PropertyStatus
  from: string
  notes?: string
}

/** A purchase paid in cuotas. Each paid cuota is an Expense row. */
export interface Plan extends Base {
  propertyId: string
  concept: string
  category?: string
  total: number
  count: number
  installment: number
  currency: Currency
  /** Month of cuota 1. */
  startMonth: string
  method?: string
  notes?: string
  cancelled?: boolean
}

/** Mercado Libre, Marketplace, private sales… */
export interface Sale extends Base {
  opDate: string
  /** Date the money arrived — this is what counts for cash flow. */
  date: string
  description: string
  channel: string
  gross: number
  fees: number
  net: number
  currency: Currency
  method?: string
  notes?: string
}

export type InvestmentStatus = 'active' | 'matured' | 'redeemed'

export interface Investment extends Base {
  name: string
  type: string
  institution?: string
  currency: Currency
  capital: number
  startDate: string
  maturityDate?: string
  /** Expected annual rate (TNA %) — informative, used for estimates only. */
  rate?: number | null
  status: InvestmentStatus
  /** Capital came out of "capital disponible" (true) or is new money (false). */
  fromAvailable: boolean
  closeDate?: string
  /** Capital that came back. Never income; it returns to capital disponible. */
  recovered?: number | null
  notes?: string
}

/** Interest, dividends, coupons. The only part of an investment that is income. */
export interface Yield extends Base {
  investmentId: string
  date: string
  amount: number
  currency: Currency
  /** Left invested / added to capital disponible instead of being spent. */
  toCapital?: boolean
  notes?: string
}

/** Extraordinary capital: a property sale. Never regular income (spec §7). */
export interface PropertySale extends Base {
  status: 'done' | 'planned'
  propertyId?: string
  propertyName: string
  date: string
  price: number
  costs: number
  net: number
  currency: Currency
  destination?: string
  notes?: string
}

/** Manual capital movements: initial balance, savings put aside, money taken out. */
export interface CapitalMove extends Base {
  date: string
  kind: 'in' | 'out'
  amount: number
  currency: Currency
  concept: string
  notes?: string
}

export interface Pension extends Base {
  name: string
  holder?: string
  /** Expected (or actual) first month. */
  startMonth: string
  /** Estimated monthly haber; null until known. */
  amount?: number | null
  currency: Currency
  /** The amount is the real haber, not an estimate. */
  confirmed: boolean
  /** Argentine SAC: half a haber extra in June and December. */
  aguinaldo: boolean
  notes?: string
}

/** ARS per 1 USD on a date, for a named series (MEP, oficial, blue…). */
export interface Rate {
  id: string
  date: string
  series: string
  value: number
  source?: string
}

/** Key/value preferences. `id` is the key, so every table is keyed by `id`. */
export interface Setting {
  id: string
  value: unknown
}

export type Money = Record<Currency, number>
