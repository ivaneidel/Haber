import { addDays, addMonths, daysBetween, daysInMonth, monthDiff, monthOf, monthRange, today as todayStr, yearOf } from './dates'
import type { Lens } from './money'
import { isOwnExpense } from './types'
import type {
  Bill,
  CapitalMove,
  Currency,
  Expense,
  ExpenseKind,
  Income,
  Investment,
  Pension,
  Plan,
  Property,
  PropertySale,
  Rate,
  Recurring,
  Sale,
  StatusChange,
  PropertyStatus,
  Valuation,
  Yield,
} from './types'

/** Everything the calculations need. Personal-scale data, so it's loaded whole. */
export interface Data {
  properties: Property[]
  valuations: Valuation[]
  incomes: Income[]
  expenses: Expense[]
  recurring: Recurring[]
  plans: Plan[]
  sales: Sale[]
  investments: Investment[]
  yields: Yield[]
  propertySales: PropertySale[]
  capital: CapitalMove[]
  pensions: Pension[]
  rates: Rate[]
  bills: Bill[]
  statusLog: StatusChange[]
}

export const emptyData = (): Data => ({
  properties: [],
  valuations: [],
  incomes: [],
  expenses: [],
  recurring: [],
  plans: [],
  sales: [],
  investments: [],
  yields: [],
  propertySales: [],
  capital: [],
  pensions: [],
  rates: [],
  bills: [],
  statusLog: [],
})

// ---------------------------------------------------------------------------
// Flows: every cash movement that is income or a property expense, normalized.
// Capital (investment principal, property sales) is deliberately NOT a flow.
// ---------------------------------------------------------------------------

export type FlowKind = 'rent' | 'pension' | 'other' | 'sale' | 'yield' | 'expense'
export const INCOME_KINDS = ['rent', 'yield', 'sale', 'pension', 'other'] as const
export type IncomeKind = (typeof INCOME_KINDS)[number]

/** `fee` = honorarios de administración withheld from a rent. */
export type CostKind = ExpenseKind | 'fee'

export interface Flow {
  kind: FlowKind
  expenseKind?: CostKind
  /** Cash date. */
  date: string
  month: string
  /** Rent period, when it differs from the cash month. */
  period?: string
  propertyId?: string
  amount: number
  currency: Currency
}

/**
 * Rents keep `amount` = what reached her. The agency's fee and any work cost deducted from that
 * liquidation are added back as rent (gross) AND counted as expenses, so rent − expenses is still
 * exactly the cash she received — nothing is counted twice. Works paid by someone else and not
 * deducted from her money are not flows at all.
 */
export function toFlows(d: Data): Flow[] {
  const out: Flow[] = []
  const incomeById = new Map(d.incomes.map((i) => [i.id, i]))
  for (const i of d.incomes) {
    const base = { date: i.date, month: monthOf(i.date), period: i.period, propertyId: i.propertyId, currency: i.currency }
    out.push({ kind: i.source, amount: i.amount, ...base })
    if (i.source === 'rent' && i.fee && i.fee > 0) {
      out.push({ kind: 'rent', amount: i.fee, ...base })
      out.push({ kind: 'expense', expenseKind: 'fee', amount: i.fee, ...base, period: undefined })
    }
  }
  for (const e of d.expenses) {
    if (!isOwnExpense(e)) continue
    const rent = e.deducted && e.incomeId ? incomeById.get(e.incomeId) : undefined
    // Deducted from a liquidation: the money left her on the rent's date.
    const date = rent ? rent.date : e.date
    out.push({ kind: 'expense', expenseKind: e.kind, date, month: monthOf(date), propertyId: e.propertyId, amount: e.amount, currency: e.currency })
    if (rent) out.push({ kind: 'rent', date: rent.date, month: monthOf(rent.date), period: rent.period, propertyId: rent.propertyId, amount: e.amount, currency: e.currency })
  }
  for (const s of d.sales) out.push({ kind: 'sale', date: s.date, month: monthOf(s.date), amount: s.net, currency: s.currency })
  for (const y of d.yields) out.push({ kind: 'yield', date: y.date, month: monthOf(y.date), amount: y.amount, currency: y.currency })
  return out
}

/** Gross rent of one liquidation: net received + fee + work costs deducted from it (same-currency parts). */
export function rentBreakdown(d: Data, incomeId: string): { net: number; fee: number; deductions: Expense[]; gross: number } | undefined {
  const i = d.incomes.find((x) => x.id === incomeId)
  if (!i) return undefined
  const deductions = d.expenses.filter((e) => e.incomeId === i.id && e.deducted)
  const fee = i.fee ?? 0
  const gross = i.amount + fee + deductions.filter((e) => e.currency === i.currency).reduce((s, e) => s + e.amount, 0)
  return { net: i.amount, fee, deductions, gross }
}

/** Works paid by the agency/tenant that must come out of a rent and aren't linked to one yet. */
export function pendingDeductions(d: Data, propertyId?: string): Expense[] {
  const ids = new Set(d.incomes.map((i) => i.id))
  return d.expenses.filter((e) => e.deducted && e.paidBy && e.paidBy !== 'me' && (!e.incomeId || !ids.has(e.incomeId)) && (!propertyId || e.propertyId === propertyId))
}

export interface FlowFilter {
  from?: string // month, inclusive
  to?: string // month, inclusive
  propertyId?: string
  /** Rents by the period they belong to instead of the date they were collected. */
  byPeriod?: boolean
}

const flowMonth = (f: Flow, byPeriod?: boolean) => (byPeriod && f.kind === 'rent' && f.period ? f.period : f.month)

export function filterFlows(flows: Flow[], q: FlowFilter): Flow[] {
  return flows.filter((f) => {
    const m = flowMonth(f, q.byPeriod)
    if (q.from && m < q.from) return false
    if (q.to && m > q.to) return false
    if (q.propertyId) {
      // A property filter keeps only what belongs to properties.
      if (f.propertyId !== q.propertyId) return false
    }
    return true
  })
}

export interface Totals {
  rent: number
  yield: number
  sale: number
  pension: number
  other: number
  income: number
  fixed: number
  installment: number
  eventual: number
  /** Honorarios de administración. */
  fee: number
  expense: number
  /** Rent − property expenses: "resultado neto inmobiliario". */
  realEstateNet: number
}

export const zeroTotals = (): Totals => ({
  rent: 0,
  yield: 0,
  sale: 0,
  pension: 0,
  other: 0,
  income: 0,
  fixed: 0,
  installment: 0,
  eventual: 0,
  fee: 0,
  expense: 0,
  realEstateNet: 0,
})

export function totals(flows: Flow[], lens: Lens): Totals {
  const t = zeroTotals()
  for (const f of flows) {
    const v = lens(f.amount, f.currency, f.date)
    if (!v) continue
    if (f.kind === 'expense') {
      t[f.expenseKind ?? 'eventual'] += v
      t.expense += v
    } else {
      t[f.kind] += v
      t.income += v
    }
  }
  t.realEstateNet = t.rent - t.expense
  return t
}

export function monthlyTotals(flows: Flow[], lens: Lens, months: string[], byPeriod = false): (Totals & { month: string })[] {
  const buckets = new Map<string, Flow[]>(months.map((m) => [m, []]))
  for (const f of flows) buckets.get(flowMonth(f, byPeriod))?.push(f)
  return months.map((m) => ({ month: m, ...totals(buckets.get(m) ?? [], lens) }))
}

export function yearlyTotals(flows: Flow[], lens: Lens, years: number[], byPeriod = false): (Totals & { year: number })[] {
  const buckets = new Map<number, Flow[]>(years.map((y) => [y, []]))
  for (const f of flows) buckets.get(yearOf(flowMonth(f, byPeriod)))?.push(f)
  return years.map((y) => ({ year: y, ...totals(buckets.get(y) ?? [], lens) }))
}

/** Years that have any recorded movement, plus the current one. */
export function dataYears(d: Data, current: number): number[] {
  const ys = new Set<number>([current])
  for (const f of toFlows(d)) ys.add(yearOf(f.date))
  for (const s of d.propertySales) if (s.status === 'done') ys.add(yearOf(s.date))
  for (const i of d.investments) ys.add(yearOf(i.startDate))
  return [...ys].sort((a, b) => a - b)
}

// ---------------------------------------------------------------------------
// Fixed (recurring) expenses
// ---------------------------------------------------------------------------

export function isDue(r: Recurring, month: string): boolean {
  if (!r.active || month < r.startMonth) return false
  if (!r.every) return false // irregular: never "due", paid when it comes
  return monthDiff(r.startMonth, month) % r.every === 0
}

export function recurringPaid(r: Recurring, month: string, expenses: Expense[]): Expense | undefined {
  return expenses.find((e) => e.recurringId === r.id && (e.period ?? monthOf(e.date)) === month)
}

/** Fixed costs due in `month` and not yet paid. */
export function pendingRecurring(d: Data, month: string): Recurring[] {
  return d.recurring.filter((r) => isDue(r, month) && !recurringPaid(r, month, d.expenses) && !isArchived(d, r.propertyId))
}

/** Usual amount spread per month (bimonthly $100 → $50/month). */
export function recurringMonthly(r: Recurring): number {
  return r.every ? r.amount / r.every : 0
}

// ---------------------------------------------------------------------------
// Bills and due dates (spec 2 §3)
// ---------------------------------------------------------------------------

export type Urgency = 'overdue' | 'today' | 'soon' | 'later' | 'paid'
/** Days before the due date when a bill counts as "about to fall due". */
export const SOON_DAYS = 3

export interface DueItem {
  key: string
  rec: Recurring
  period: string
  bill?: Bill
  paid?: Expense
  /** Bill's due date, or the usual due day in that month. */
  dueDate?: string
  /** dueDate comes from the usual day, not from a received bill. */
  estimated: boolean
  received: boolean
  urgency: Urgency
  /** Days until due (negative = overdue). */
  days?: number
  /** Amount to show: the bill's, else the last paid one, else the usual. Reference only. */
  refAmount?: number
}

/** The usual due date of a template in a month (day clamped to the month's length). */
export function usualDueDate(r: Recurring, period: string): string | undefined {
  if (!r.dueDay) return undefined
  return `${period}-${String(Math.min(r.dueDay, daysInMonth(period))).padStart(2, '0')}`
}

export function billFor(d: Data, recurringId: string, period: string): Bill | undefined {
  return d.bills.find((b) => b.recurringId === recurringId && b.period === period)
}

/** Most recent payment of a template, for "último importe" references. */
export function lastPayment(d: Data, recurringId: string): Expense | undefined {
  return d.expenses.filter((e) => e.recurringId === recurringId).sort((a, b) => b.date.localeCompare(a.date))[0]
}

export function lastBill(d: Data, recurringId: string): Bill | undefined {
  return d.bills.filter((b) => b.recurringId === recurringId).sort((a, b) => b.period.localeCompare(a.period))[0]
}

function dueItem(d: Data, r: Recurring, period: string, now: string): DueItem {
  const bill = billFor(d, r.id, period)
  const paid = recurringPaid(r, period, d.expenses)
  const dueDate = bill?.dueDate || usualDueDate(r, period)
  const estimated = !bill?.dueDate && !!dueDate
  const days = dueDate ? daysBetween(now, dueDate) : undefined
  let urgency: Urgency
  if (paid) urgency = 'paid'
  else if (days !== undefined) urgency = days < 0 ? 'overdue' : days === 0 ? 'today' : days <= SOON_DAYS ? 'soon' : 'later'
  else urgency = period < monthOf(now) ? 'overdue' : 'later'
  const refAmount = bill?.amount || lastPayment(d, r.id)?.amount || r.amount || undefined
  return { key: `${r.id}:${period}`, rec: r, period, bill, paid, dueDate, estimated, received: !!bill, urgency, days, refAmount }
}

/**
 * What's due around `now`: every active service due this month or in the previous `lookback`
 * months (only from the month the template was created, so old history doesn't flood the list),
 * next month's ones already within the warning window, plus any received bill still unpaid.
 * Sorted most urgent first.
 */
export function dueItems(d: Data, now = todayStr(), lookback = 2): DueItem[] {
  const cur = monthOf(now)
  const out = new Map<string, DueItem>()
  for (const r of d.recurring) {
    if (!r.active || isArchived(d, r.propertyId)) continue
    const created = r.createdAt ? r.createdAt.slice(0, 7) : r.startMonth
    for (let m = addMonths(cur, -lookback); m <= addMonths(cur, 1); m = addMonths(m, 1)) {
      if (!isDue(r, m) || (m < cur && m < created)) continue
      const it = dueItem(d, r, m, now)
      if (m > cur && !(it.urgency === 'soon' || it.urgency === 'today' || it.received)) continue
      out.set(it.key, it)
    }
  }
  for (const b of d.bills) {
    const r = d.recurring.find((x) => x.id === b.recurringId)
    if (!r || out.has(`${r.id}:${b.period}`)) continue
    const it = dueItem(d, r, b.period, now)
    if (it.urgency !== 'paid') out.set(it.key, it)
  }
  const rank: Record<Urgency, number> = { overdue: 0, today: 1, soon: 2, later: 3, paid: 4 }
  return [...out.values()].sort((a, b) => rank[a.urgency] - rank[b.urgency] || (a.dueDate ?? `${a.period}-99`).localeCompare(b.dueDate ?? `${b.period}-99`))
}

/** Items that need attention now: overdue, due today, due within SOON_DAYS. */
export function urgentItems(items: DueItem[]): DueItem[] {
  return items.filter((i) => i.urgency === 'overdue' || i.urgency === 'today' || i.urgency === 'soon')
}

// ---------------------------------------------------------------------------
// Installment plans
// ---------------------------------------------------------------------------

export interface CuotaRow {
  no: number
  month: string
  amount: number
  paid?: Expense
}

export interface PlanStatus {
  paidCount: number
  paidAmount: number
  remainingCount: number
  remainingAmount: number
  next?: CuotaRow
  schedule: CuotaRow[]
  done: boolean
}

export function planStatus(p: Plan, expenses: Expense[]): PlanStatus {
  const paid = expenses.filter((e) => e.planId === p.id)
  const byNo = new Map(paid.map((e) => [e.installmentNo ?? 0, e]))
  const schedule: CuotaRow[] = []
  for (let no = 1; no <= p.count; no++) schedule.push({ no, month: addMonths(p.startMonth, no - 1), amount: p.installment, paid: byNo.get(no) })
  const paidAmount = paid.reduce((s, e) => s + e.amount, 0)
  const unpaid = schedule.filter((c) => !c.paid)
  const remainingCount = p.cancelled ? 0 : unpaid.length
  return {
    paidCount: paid.length,
    paidAmount,
    remainingCount,
    remainingAmount: p.cancelled ? 0 : unpaid.reduce((s, c) => s + c.amount, 0),
    next: p.cancelled ? undefined : unpaid[0],
    schedule,
    done: remainingCount === 0,
  }
}

/** Cuotas due up to `month` and still unpaid (overdue ones included). */
export function pendingCuotas(d: Data, month: string): { plan: Plan; cuota: CuotaRow }[] {
  const out: { plan: Plan; cuota: CuotaRow }[] = []
  for (const p of d.plans) {
    if (p.cancelled) continue
    const st = planStatus(p, d.expenses)
    for (const c of st.schedule) if (!c.paid && c.month <= month) out.push({ plan: p, cuota: c })
  }
  return out
}

/**
 * Future obligations by month, from `from` for `months` months: unpaid cuotas
 * (overdue ones land on the first month) and, optionally, fixed costs at their usual amount.
 */
export function commitments(
  d: Data,
  from: string,
  months: number,
  lens: Lens,
  includeFixed: boolean,
): { month: string; installment: number; fixed: number }[] {
  const range = monthRange(from, addMonths(from, months - 1))
  const rows = range.map((m) => ({ month: m, installment: 0, fixed: 0 }))
  const idx = new Map(range.map((m, i) => [m, i]))
  const dateOf = (m: string) => `${m}-01`
  for (const p of d.plans) {
    if (p.cancelled) continue
    for (const c of planStatus(p, d.expenses).schedule) {
      if (c.paid) continue
      const i = c.month < from ? 0 : idx.get(c.month)
      if (i !== undefined) rows[i].installment += lens(c.amount, p.currency, dateOf(range[i]))
    }
  }
  if (includeFixed)
    for (const r of d.recurring) {
      if (isArchived(d, r.propertyId)) continue
      for (const row of rows) if (isDue(r, row.month) && !recurringPaid(r, row.month, d.expenses)) row.fixed += lens(r.amount, r.currency, dateOf(row.month))
    }
  return rows
}

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

export function isArchived(d: Data, propertyId?: string): boolean {
  const p = d.properties.find((x) => x.id === propertyId)
  return !!p?.archived
}

export function valuationsOf(d: Data, propertyId: string): Valuation[] {
  return d.valuations.filter((v) => v.propertyId === propertyId).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
}

export function currentValuation(d: Data, propertyId: string): Valuation | undefined {
  const vs = valuationsOf(d, propertyId)
  return vs[vs.length - 1]
}

/**
 * Value used for a year's yield: the last valuation on or before Dec 31; if the first
 * valuation is later than that, the earliest one (the inherited properties have no
 * purchase price, so the current estimate stands in — spec §10). `approx` flags that.
 */
export function valuationForYear(d: Data, propertyId: string, year: number): { v: Valuation; approx: boolean } | undefined {
  const vs = valuationsOf(d, propertyId)
  if (!vs.length) return undefined
  const end = `${year}-12-31`
  const before = vs.filter((v) => v.date <= end)
  return before.length ? { v: before[before.length - 1], approx: false } : { v: vs[0], approx: true }
}

/** The month the next rent for this property most likely belongs to. */
export function suggestedRentPeriod(d: Data, propertyId: string, current: string): string {
  const periods = d.incomes
    .filter((i) => i.source === 'rent' && i.propertyId === propertyId && i.period)
    .map((i) => i.period!)
    .sort()
  const last = periods[periods.length - 1]
  if (!last) return current
  const next = addMonths(last, 1)
  // Paid ahead, or a gap far in the past: fall back to the current month.
  return next > current || monthDiff(next, current) > 3 ? current : next
}

/** Active properties with no rent recorded for `month`'s period. */
export function rentsWithoutRecord(d: Data, month: string): Property[] {
  return d.properties.filter(
    (p) =>
      !p.archived &&
      !p.soldAt &&
      (p.refRent ?? 0) > 0 &&
      (!p.contractStart || p.contractStart.slice(0, 7) <= month) &&
      !d.incomes.some((i) => i.source === 'rent' && i.propertyId === p.id && i.period === month),
  )
}

// ---------------------------------------------------------------------------
// Status and vacancy (spec 2 §6)
// ---------------------------------------------------------------------------

export function statusHistory(d: Data, propertyId: string): StatusChange[] {
  return d.statusLog.filter((x) => x.propertyId === propertyId).sort((a, b) => a.from.localeCompare(b.from) || a.createdAt.localeCompare(b.createdAt))
}

/** With no history, a property with a tenant or reference rent is taken as rented; otherwise unknown. */
function implicitStatus(p: Property): PropertyStatus | undefined {
  return p.tenant || (p.refRent ?? 0) > 0 ? 'rented' : undefined
}

export function currentStatus(d: Data, p: Property, on = todayStr()): PropertyStatus | undefined {
  const h = statusHistory(d, p.id).filter((x) => x.from <= on)
  return h.length ? h[h.length - 1].status : implicitStatus(p)
}

export interface StatusSpan {
  status: PropertyStatus
  from: string
  /** Exclusive end; undefined = still in this status. */
  to?: string
  id?: string
}

/** History as contiguous spans. Before the first recorded change, the implicit status (if any) applies. */
export function statusSpans(d: Data, p: Property): StatusSpan[] {
  const h = statusHistory(d, p.id)
  const spans: StatusSpan[] = h.map((x, i) => ({ status: x.status, from: x.from, to: h[i + 1]?.from, id: x.id }))
  const imp = implicitStatus(p)
  if (imp && (!h.length || imp !== h[0].status)) spans.unshift({ status: imp, from: '1900-01-01', to: h[0]?.from })
  return spans
}

const overlapDays = (s: StatusSpan, from: string, toExcl: string) => {
  const a = s.from > from ? s.from : from
  const b = s.to && s.to < toExcl ? s.to : toExcl
  return Math.max(0, daysBetween(a, b))
}

export interface VacancyPeriod {
  status: PropertyStatus
  from: string
  to?: string
  days: number
  /** Own property expenses paid while it wasn't rented. */
  cost: number
}

/** Every period not rented, with its length (until today if ongoing) and what it cost. */
export function vacancyPeriods(d: Data, flows: Flow[], p: Property, lens: Lens, now = todayStr()): VacancyPeriod[] {
  const exp = flows.filter((f) => f.kind === 'expense' && f.propertyId === p.id)
  return statusSpans(d, p)
    .filter((s) => s.status !== 'rented' && s.from > '1900-01-01')
    .map((s) => {
      const end = s.to ?? addDays(now, 1)
      const cost = exp.filter((f) => f.date >= s.from && f.date < end).reduce((t, f) => t + lens(f.amount, f.currency, f.date), 0)
      return { status: s.status, from: s.from, to: s.to, days: Math.max(0, daysBetween(s.from, end)), cost }
    })
}

export const DAYS_PER_MONTH = 30.44

// ---------------------------------------------------------------------------
// Rentabilidad (spec §10, spec 2 §7)
// ---------------------------------------------------------------------------

export interface YieldRow {
  property: Property
  year: number
  /** Currency of the valuation; incomes and expenses are converted into it. */
  currency: Currency
  gross: number
  fixed: number
  installment: number
  eventual: number
  fee: number
  expenses: number
  net: number
  value?: number
  approx: boolean
  pct: number | null
  /** Months rented / not rented in the year (up to today); null when the status is unknown. */
  monthsRented: number | null
  monthsVacant: number | null
  /** Expenses paid in the year while it was not rented. */
  vacancyCost: number
  /** Change of market value during the year — appreciation, kept apart from rent yield. */
  appreciation: number | null
  appreciationPct: number | null
}

export function propertyYield(d: Data, flows: Flow[], p: Property, year: number, lensFor: (c: Currency) => Lens, now = todayStr()): YieldRow {
  const val = valuationForYear(d, p.id, year)
  const currency = val?.v.currency ?? 'USD'
  const lens = lensFor(currency)
  const mine = flows.filter((f) => f.propertyId === p.id && yearOf(f.date) === year)
  const t = totals(mine, lens)
  const value = val?.v.value
  const pct = value ? (t.realEstateNet / value) * 100 : null
  const prev = valuationForYear(d, p.id, year - 1)
  let appreciation: number | null = null
  let appreciationPct: number | null = null
  if (val && prev && !prev.approx && prev.v.id !== val.v.id && prev.v.currency === currency) {
    appreciation = val.v.value - prev.v.value
    appreciationPct = prev.v.value ? (appreciation / prev.v.value) * 100 : null
  }
  // Months rented/vacant within the year, up to today.
  const yFrom = `${year}-01-01`
  const yTo = `${year + 1}-01-01` < addDays(now, 1) ? `${year + 1}-01-01` : addDays(now, 1)
  const spans = yFrom < yTo ? statusSpans(d, p) : []
  let rentedDays = 0
  let vacantDays = 0
  let vacancyCost = 0
  for (const s of spans) {
    const days = overlapDays(s, yFrom, yTo)
    if (!days) continue
    if (s.status === 'rented') rentedDays += days
    else {
      vacantDays += days
      const a = s.from > yFrom ? s.from : yFrom
      const b = s.to && s.to < yTo ? s.to : yTo
      vacancyCost += mine.filter((f) => f.kind === 'expense' && f.date >= a && f.date < b).reduce((x, f) => x + lens(f.amount, f.currency, f.date), 0)
    }
  }
  const known = spans.length > 0
  const r1 = (n: number) => Math.round((n / DAYS_PER_MONTH) * 10) / 10
  return {
    property: p,
    year,
    currency,
    gross: t.rent,
    fixed: t.fixed,
    installment: t.installment,
    eventual: t.eventual,
    fee: t.fee,
    expenses: t.expense,
    net: t.realEstateNet,
    value,
    approx: !!val?.approx,
    pct,
    monthsRented: known ? r1(rentedDays) : null,
    monthsVacant: known ? r1(vacantDays) : null,
    vacancyCost,
    appreciation,
    appreciationPct,
  }
}

// ---------------------------------------------------------------------------
// Investments & capital (spec §6, §7)
// ---------------------------------------------------------------------------

export function yieldsOf(d: Data, investmentId: string): Yield[] {
  return d.yields.filter((y) => y.investmentId === investmentId).sort((a, b) => a.date.localeCompare(b.date))
}

export interface CapitalEvent {
  date: string
  currency: Currency
  amount: number
  kind: 'sale' | 'in' | 'out' | 'invest' | 'recover' | 'reinvest'
  label: string
  ref: string
}

/**
 * Capital disponible = property sales (net) + manual deposits − withdrawals
 * − money placed in investments (when taken from available capital)
 * + capital recovered + yields left as capital.
 * Yields are income; principal moving in and out is not.
 */
export function capitalEvents(d: Data): CapitalEvent[] {
  const ev: CapitalEvent[] = []
  for (const s of d.propertySales)
    if (s.status === 'done') ev.push({ date: s.date, currency: s.currency, amount: s.net, kind: 'sale', label: s.propertyName, ref: s.id })
  for (const c of d.capital)
    ev.push({ date: c.date, currency: c.currency, amount: c.kind === 'in' ? c.amount : -c.amount, kind: c.kind, label: c.concept, ref: c.id })
  for (const i of d.investments) {
    if (i.fromAvailable) ev.push({ date: i.startDate, currency: i.currency, amount: -i.capital, kind: 'invest', label: i.name, ref: i.id })
    if (i.status !== 'active' && i.recovered)
      ev.push({ date: i.closeDate ?? i.maturityDate ?? i.startDate, currency: i.currency, amount: i.recovered, kind: 'recover', label: i.name, ref: i.id })
  }
  for (const y of d.yields)
    if (y.toCapital) {
      const inv = d.investments.find((i) => i.id === y.investmentId)
      ev.push({ date: y.date, currency: y.currency, amount: y.amount, kind: 'reinvest', label: inv?.name ?? '', ref: y.id })
    }
  return ev.sort((a, b) => a.date.localeCompare(b.date))
}

export interface CapitalSummary {
  available: number
  /** Principal currently placed in active investments. */
  placed: number
  /** All principal ever invested. */
  investedTotal: number
  /** Yields received (income). */
  yields: number
  /** Recovered − invested on closed investments: capital gain/loss, not income. */
  capitalResult: number
}

export function capitalSummary(d: Data, cur: Currency, upTo?: string): CapitalSummary {
  const inRange = (date: string) => !upTo || date <= upTo
  const available = capitalEvents(d)
    .filter((e) => e.currency === cur && inRange(e.date))
    .reduce((s, e) => s + e.amount, 0)
  let placed = 0
  let investedTotal = 0
  let capitalResult = 0
  for (const i of d.investments) {
    if (i.currency !== cur || !inRange(i.startDate)) continue
    investedTotal += i.capital
    const closed = i.status !== 'active' && (!upTo || (i.closeDate ?? i.startDate) <= upTo)
    if (!closed) placed += i.capital
    else capitalResult += (i.recovered ?? 0) - i.capital
  }
  const yields = d.yields.filter((y) => y.currency === cur && inRange(y.date)).reduce((s, y) => s + y.amount, 0)
  return { available, placed, investedTotal, yields, capitalResult }
}

/** Active investments with a maturity date, soonest first (already-due ones lead, still unclosed). */
export function upcomingMaturities(d: Data): Investment[] {
  return d.investments
    .filter((i) => i.status === 'active' && i.maturityDate)
    .sort((a, b) => a.maturityDate!.localeCompare(b.maturityDate!))
}

/** Expected interest of an active fixed-rate placement over its term (simple interest). */
export function expectedInterest(i: Investment): number | null {
  if (!i.rate || !i.maturityDate) return null
  const days = (Date.parse(i.maturityDate) - Date.parse(i.startDate)) / 86_400_000
  if (!(days > 0)) return null
  return (i.capital * (i.rate / 100) * days) / 365
}

// ---------------------------------------------------------------------------
// Patrimonio
// ---------------------------------------------------------------------------

export interface Patrimony {
  properties: number
  placed: number
  available: number
  total: number
  missingValues: number
}

export function patrimony(d: Data, lens: Lens, date: string): Patrimony {
  let properties = 0
  let missingValues = 0
  for (const p of d.properties) {
    if (p.soldAt || p.archived) continue
    const v = currentValuation(d, p.id)
    if (!v) {
      missingValues++
      continue
    }
    properties += lens(v.value, v.currency, date)
  }
  let placed = 0
  let available = 0
  for (const cur of ['ARS', 'USD'] as Currency[]) {
    const s = capitalSummary(d, cur)
    placed += lens(s.placed, cur, date)
    available += lens(s.available, cur, date)
  }
  return { properties, placed, available, total: properties + placed + available, missingValues }
}

export function pensionStatus(p: Pension, month: string): 'current' | 'future' {
  return p.startMonth <= month ? 'current' : 'future'
}
