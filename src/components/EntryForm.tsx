import { Banknote, Building2, Gift, History, Landmark, PiggyBank, ShoppingBag, Wrench } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { isDate, isMonth, monthOf, thisMonth, today } from '../lib/dates'
import { pendingDeductions, planStatus, suggestedRentPeriod, type Data } from '../lib/calc'
import { formatMoney, round2 } from '../lib/money'
import { rememberInList, type Prefs } from '../lib/prefs'
import { apply, putOp, save } from '../lib/repo'
import type { Op } from '../lib/store/types'
import { PAID_BY, isOwnExpense } from '../lib/types'
import type { Currency, Expense, ExpenseKind, Income, PaidBy, Sale, Yield } from '../lib/types'
import { dateLabel } from '../lib/dates'
import { useModel } from '../hooks/useData'
import { onOpenEntry, type EntryRecord, type EntryRequest, type EntryType } from './entryStore'
import { toast } from './toast'
import { Button, Chips, Field, Input, MonthInput, Note, NumInput, Select, Sheet, TextArea, Toggle } from './ui'

/** Flat form state shared by every movement type; each type uses a subset. */
interface Draft {
  type: EntryType
  id?: string
  createdAt?: string
  date: string
  period: string
  propertyId: string
  payer: string
  amount: number | null
  currency: Currency
  method: string
  notes: string
  kind: ExpenseKind
  recurringId: string
  planId: string
  installmentNo: number | null
  concept: string
  category: string
  opDate: string
  description: string
  channel: string
  gross: number | null
  fees: number | null
  investmentId: string
  toCapital: boolean
  pensionId: string
  updateUsual: boolean
  /** rent: agency fee and the works deducted from this liquidation. */
  fee: number | null
  deductionIds: string[]
  /** eventual works */
  workDate: string
  materials: number | null
  labor: number | null
  otherCosts: number | null
  managedBy: string
  paidBy: PaidBy
  deducted: boolean
  incomeId: string
}

const blank = (type: EntryType): Draft => ({
  type,
  date: today(),
  period: thisMonth(),
  propertyId: '',
  payer: '',
  amount: null,
  currency: 'ARS',
  method: '',
  notes: '',
  kind: 'eventual',
  recurringId: '',
  planId: '',
  installmentNo: null,
  concept: '',
  category: '',
  opDate: today(),
  description: '',
  channel: '',
  gross: null,
  fees: null,
  investmentId: '',
  toCapital: false,
  pensionId: '',
  updateUsual: false,
  fee: null,
  deductionIds: [],
  workDate: '',
  materials: null,
  labor: null,
  otherCosts: null,
  managedBy: '',
  paidBy: 'me',
  deducted: false,
  incomeId: '',
})

function fromRecord(r: EntryRecord, d?: Data): Draft {
  const base = { id: r.row.id, createdAt: r.row.createdAt, notes: r.row.notes ?? '' }
  switch (r.table) {
    case 'incomes': {
      const i = r.row
      return {
        ...blank(i.source === 'rent' ? 'rent' : i.source === 'pension' ? 'pension' : 'other'),
        ...base,
        date: i.date,
        period: i.period ?? monthOf(i.date),
        propertyId: i.propertyId ?? '',
        payer: i.payer ?? '',
        pensionId: i.pensionId ?? '',
        description: i.description ?? '',
        amount: i.amount,
        currency: i.currency,
        method: i.method ?? '',
        fee: i.fee ?? null,
        deductionIds: d ? d.expenses.filter((e) => e.incomeId === i.id).map((e) => e.id) : [],
      }
    }
    case 'expenses': {
      const e = r.row
      return {
        ...blank('expense'),
        ...base,
        kind: e.kind,
        date: e.date,
        period: e.period ?? monthOf(e.date),
        propertyId: e.propertyId,
        concept: e.concept,
        category: e.category ?? '',
        amount: e.amount,
        currency: e.currency,
        method: e.method ?? '',
        recurringId: e.recurringId ?? '',
        planId: e.planId ?? '',
        installmentNo: e.installmentNo ?? null,
        workDate: e.workDate ?? '',
        materials: e.materials ?? null,
        labor: e.labor ?? null,
        otherCosts: e.otherCosts ?? null,
        managedBy: e.managedBy ?? '',
        paidBy: e.paidBy ?? 'me',
        deducted: !!e.deducted,
        incomeId: e.incomeId ?? '',
      }
    }
    case 'sales': {
      const s = r.row
      return {
        ...blank('sale'),
        ...base,
        date: s.date,
        opDate: s.opDate,
        description: s.description,
        channel: s.channel,
        gross: s.gross,
        fees: s.fees,
        amount: s.net,
        currency: s.currency,
        method: s.method ?? '',
      }
    }
    case 'yields': {
      const y = r.row
      return { ...blank('yield'), ...base, date: y.date, investmentId: y.investmentId, amount: y.amount, currency: y.currency, toCapital: !!y.toCapital }
    }
  }
}

/** The most recent value of a field among similar records — "autocompletado de información habitual". */
function lastOf<T extends { date: string }>(rows: T[], pick: (r: T) => string | undefined): string {
  const sorted = [...rows].sort((a, b) => b.date.localeCompare(a.date))
  for (const r of sorted) {
    const v = pick(r)
    if (v) return v
  }
  return ''
}

/** Fill sensible defaults for the chosen type/property from her history. */
function smartDefaults(d: Data, prefs: Prefs, f: Draft): Draft {
  const out = { ...f }
  if (f.type === 'rent' && f.propertyId) {
    const p = d.properties.find((x) => x.id === f.propertyId)
    const past = d.incomes.filter((i) => i.source === 'rent' && i.propertyId === f.propertyId).sort((a, b) => b.date.localeCompare(a.date))
    out.payer = p?.tenant ?? past[0]?.payer ?? ''
    out.amount = past[0]?.amount ?? p?.refRent ?? null
    out.currency = past[0]?.currency ?? p?.refRentCurrency ?? 'ARS'
    out.method = past[0]?.method ?? out.method
    out.fee = past[0]?.fee ?? null
    out.period = suggestedRentPeriod(d, f.propertyId, thisMonth())
    // Works the agency paid and must take out of this liquidation: proposed, she confirms.
    const pending = pendingDeductions(d, f.propertyId)
    out.deductionIds = pending.map((e) => e.id)
    // Suggested net = the usual one (last net without last month's one-off deductions) − this month's.
    if (past[0]) {
      const sameCur = (xs: Expense[]) => xs.filter((e) => e.currency === past[0].currency).reduce((s, e) => s + e.amount, 0)
      const usual = past[0].amount + sameCur(d.expenses.filter((e) => e.incomeId === past[0].id && e.deducted))
      out.amount = round2(Math.max(0, usual - sameCur(pending)))
    }
  }
  if (!out.method) {
    const pool =
      f.type === 'expense'
        ? lastOf(d.expenses, (e) => e.method)
        : f.type === 'sale'
          ? lastOf(d.sales, (s) => s.method)
          : lastOf(
              d.incomes.filter((i) => i.source === (f.type === 'rent' ? 'rent' : f.type === 'pension' ? 'pension' : 'other')),
              (i) => i.method,
            )
    out.method = pool || prefs.methods[0] || ''
  }
  return out
}

export default function EntryHost() {
  const [req, setReq] = useState<EntryRequest | null>(null)
  useEffect(() => onOpenEntry((r) => setReq({ ...r })), [])
  if (!req) return null
  return <EntryForm req={req} onClose={() => setReq(null)} />
}

function EntryForm({ req, onClose }: { req: EntryRequest; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const model = useModel()
  const [f, setF] = useState<Draft | null>(null)
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)

  // Build the initial draft once the data is available.
  useEffect(() => {
    if (!model || f) return
    const { data, prefs } = model
    let d: Draft
    if (req.edit) d = fromRecord(req.edit, data)
    else if (req.duplicate) {
      d = repeatFrom(data, req.duplicate)
    } else {
      d = { ...blank(req.type ?? 'rent'), ...(req.preset as Partial<Draft>) }
      const active = data.properties.filter((p) => !p.archived)
      if ((d.type === 'rent' || d.type === 'expense') && !d.propertyId && active.length === 1) d.propertyId = active[0].id
      d = smartDefaults(data, prefs, d)
      if (d.type === 'expense') d = applyKindPreset(data, d)
    }
    setF(d)
  }, [model, f, req])

  if (!model || !f) return null
  const { data, prefs } = model
  const isEdit = !!f.id
  const set = (patch: Partial<Draft>) => setF((cur) => (cur ? { ...cur, ...patch } : cur))
  const props = data.properties.filter((p) => !p.archived || p.id === f.propertyId)

  const switchType = (type: EntryType) => {
    if (isEdit) return
    let d: Draft = { ...blank(type), date: f.date, propertyId: type === 'rent' || type === 'expense' ? f.propertyId : '' }
    d = smartDefaults(data, prefs, d)
    if (type === 'expense') d = applyKindPreset(data, d)
    setF(d)
    setTried(false)
  }

  // Validation
  const errors: Partial<Record<keyof Draft, string>> = {}
  const req_ = t('form.required')
  if (!isDate(f.date)) errors.date = req_
  const partsSum = round2((f.materials ?? 0) + (f.labor ?? 0) + (f.otherCosts ?? 0))
  const isWork = f.type === 'expense' && f.kind === 'eventual'
  if (f.type !== 'sale' && !(f.amount && f.amount > 0) && !(isWork && f.amount === null && partsSum > 0)) errors.amount = t('form.amountPositive')
  if (isWork && f.amount && partsSum > f.amount + 0.004) errors.amount = t('work.partsExceed', { parts: formatMoney(partsSum, f.currency, i18n.language) })
  if (f.type === 'rent' && (f.fee ?? 0) < 0) errors.fee = t('form.amountPositive')
  if ((f.type === 'rent' || f.type === 'expense') && !f.propertyId) errors.propertyId = req_
  if ((f.type === 'rent' || f.type === 'pension') && !isMonth(f.period)) errors.period = req_
  if (f.type === 'expense' && !f.concept.trim()) errors.concept = req_
  if (f.type === 'expense' && f.kind === 'installment' && !f.planId) errors.planId = req_
  if (f.type === 'sale') {
    if (!f.description.trim()) errors.description = req_
    if (!(f.gross && f.gross > 0)) errors.gross = t('form.amountPositive')
    if ((f.fees ?? 0) < 0 || (f.fees ?? 0) > (f.gross ?? 0)) errors.fees = t('form.feesRange')
    if (!isDate(f.opDate)) errors.opDate = req_
  }
  if (f.type === 'yield' && !f.investmentId) errors.investmentId = req_
  if (f.type === 'pension' && !f.pensionId) errors.pensionId = req_
  if (f.type === 'other' && !f.description.trim()) errors.description = req_
  const valid = Object.keys(errors).length === 0
  const err = (k: keyof Draft) => (tried ? errors[k] : undefined)

  // Soft warnings — never block.
  const warnings: string[] = []
  if (f.date > today()) warnings.push(t('form.futureDate'))
  if (f.type === 'rent' && f.propertyId && isMonth(f.period)) {
    const dup = data.incomes.find((i) => i.source === 'rent' && i.propertyId === f.propertyId && i.period === f.period && i.id !== f.id)
    if (dup) warnings.push(t('form.rentDup', { amount: formatMoney(dup.amount, dup.currency, i18n.language) }))
  }
  if (f.type === 'expense' && f.kind === 'fixed' && f.recurringId) {
    const dup = data.expenses.find((e) => e.recurringId === f.recurringId && (e.period ?? monthOf(e.date)) === f.period && e.id !== f.id)
    if (dup) warnings.push(t('form.fixedDup'))
  }

  const net = round2((f.gross ?? 0) - (f.fees ?? 0))

  const submit = async () => {
    setTried(true)
    if (!valid || busy) return
    setBusy(true)
    try {
      await persist(f, data)
      await rememberInList('methods', f.method)
      if (isWork) await rememberInList('managers', f.managedBy)
      if (f.type === 'sale') await rememberInList('channels', f.channel)
      toast(isEdit ? t('form.updated') : t('form.saved'))
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const typeOptions: { value: EntryType; label: string; icon: React.ReactNode }[] = [
    { value: 'rent', label: t('entry.rent'), icon: <Building2 size={15} /> },
    { value: 'expense', label: t('entry.expense'), icon: <Wrench size={15} /> },
    { value: 'sale', label: t('entry.sale'), icon: <ShoppingBag size={15} /> },
    { value: 'yield', label: t('entry.yield'), icon: <PiggyBank size={15} /> },
    { value: 'pension', label: t('entry.pension'), icon: <Landmark size={15} /> },
    { value: 'other', label: t('entry.other'), icon: <Gift size={15} /> },
  ]

  const last = !isEdit ? lastRecordOf(data, f) : undefined

  const methodField = (
    <Field label={f.type === 'expense' ? t('form.payMethod') : t('form.method')} optional>
      <Select value={f.method} onChange={(e) => set({ method: e.target.value })}>
        <option value="">—</option>
        {uniq([...prefs.methods, f.method]).map((m) => (
          <option key={m}>{m}</option>
        ))}
      </Select>
    </Field>
  )

  const amountField = (label = t('form.amount')) => (
    <Field label={label} error={err('amount')}>
      <div className="flex gap-2">
        <NumInput value={f.amount} onValue={(n) => set({ amount: n })} className="flex-1" placeholder="0" autoFocus={!!f.propertyId || f.type === 'other'} />
        <CurrencySelect value={f.currency} onChange={(c) => set({ currency: c })} disabled={f.type === 'yield' && !!f.investmentId} />
      </div>
    </Field>
  )

  const propertyField = (
    <Field label={t('form.property')} error={err('propertyId')}>
      <Select
        value={f.propertyId}
        onChange={(e) => {
          let d = { ...f, propertyId: e.target.value }
          if (f.type === 'rent') d = smartDefaults(data, prefs, { ...d, amount: null, payer: '' })
          if (f.type === 'expense') d = applyKindPreset(data, { ...d, recurringId: '', planId: '' })
          setF(d)
        }}
      >
        <option value="">{t('form.choose')}</option>
        {props.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </Select>
    </Field>
  )

  return (
    <Sheet
      open
      onClose={onClose}
      title={isEdit ? t('entry.editTitle') : t('entry.newTitle')}
      footer={
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-ink-500">{t('form.enterHint')}</span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={submit} disabled={busy}>
              <Banknote size={16} />
              {isEdit ? t('common.saveChanges') : t('common.save')}
            </Button>
          </div>
        </div>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submit()
        }}
      >
        {!isEdit && <Chips options={typeOptions} value={f.type} onChange={switchType} label={t('entry.type')} />}
        {last && (
          <button
            type="button"
            onClick={() => setF(repeatFrom(data, last))}
            className="flex w-full cursor-pointer items-center gap-2 rounded-xl border border-dashed border-ink-300 px-3 py-2 text-left text-sm text-ink-700 hover:bg-ink-100 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800"
          >
            <History size={16} className="shrink-0 text-brand-600 dark:text-brand-400" />
            <span className="min-w-0 flex-1">
              <span className="font-medium">{t('entry.repeatLast')}</span>
              <span className="block truncate text-xs text-ink-500">{describeRecord(data, last, i18n.language)}</span>
            </span>
          </button>
        )}

        {f.type === 'rent' && (
          <>
            {props.length === 0 && <Note tone="warn">{t('entry.noProperties')}</Note>}
            {propertyField}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('form.dateReceived')} error={err('date')}>
                <Input type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} />
              </Field>
              <Field label={t('form.period')} error={err('period')} hint={t('form.periodHint')}>
                <MonthInput value={f.period} onChange={(m) => set({ period: m })} />
              </Field>
            </div>
            {amountField(t('form.amountReceived'))}
            <RentLiquidation f={f} set={set} data={data} err={err('fee')} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('form.tenant')} optional>
                <Input value={f.payer} onChange={(e) => set({ payer: e.target.value })} />
              </Field>
              {methodField}
            </div>
          </>
        )}

        {f.type === 'expense' && (
          <>
            <Chips<ExpenseKind>
              size="sm"
              value={f.kind}
              onChange={(k) => setF(applyKindPreset(data, { ...f, kind: k, recurringId: '', planId: '', concept: '', category: '' }))}
              options={[
                { value: 'fixed', label: t('kind.fixed') },
                { value: 'installment', label: t('kind.installment') },
                { value: 'eventual', label: t('kind.eventual') },
              ]}
            />
            {propertyField}
            {f.kind === 'fixed' && <FixedFields f={f} setF={setF} data={data} />}
            {f.kind === 'installment' && <InstallmentFields f={f} setF={setF} data={data} err={err('planId')} />}
            {f.kind === 'eventual' && <EventualFields f={f} set={set} data={data} prefs={prefs} />}
            {f.kind !== 'installment' && (
              <Field label={f.kind === 'eventual' ? t('work.description') : t('form.concept')} error={err('concept')}>
                <Input value={f.concept} onChange={(e) => set({ concept: e.target.value })} />
              </Field>
            )}
            {f.kind === 'eventual' ? (
              <WorkFields f={f} set={set} data={data} prefs={prefs} err={err('amount')} partsSum={partsSum} />
            ) : (
              <>
                <Field label={t('form.datePaid')} error={err('date')}>
                  <Input type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} />
                </Field>
                {amountField(t('form.amountPaid'))}
              </>
            )}
            {f.kind === 'fixed' && f.recurringId && (() => {
              const r = data.recurring.find((x) => x.id === f.recurringId)
              return r && f.amount && (f.amount !== r.amount || f.currency !== r.currency) ? (
                <Toggle checked={f.updateUsual} onChange={(v) => set({ updateUsual: v })} label={t('form.updateUsual', { amount: formatMoney(r.amount, r.currency, i18n.language) })} />
              ) : null
            })()}
            {f.kind !== 'eventual' && methodField}
          </>
        )}

        {f.type === 'sale' && (
          <>
            <Field label={t('form.item')} error={err('description')}>
              <Input value={f.description} onChange={(e) => set({ description: e.target.value })} autoFocus />
            </Field>
            <Field label={t('form.channel')}>
              <Chips size="sm" value={f.channel} onChange={(v) => set({ channel: v })} options={uniq([...prefs.channels, f.channel]).map((c) => ({ value: c, label: c }))} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('form.opDate')} error={err('opDate')}>
                <Input type="date" value={f.opDate} onChange={(e) => set({ opDate: e.target.value })} />
              </Field>
              <Field label={t('form.dateReceived')} error={err('date')}>
                <Input type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={t('form.gross')} error={err('gross')}>
                <NumInput value={f.gross} onValue={(n) => set({ gross: n })} placeholder="0" />
              </Field>
              <Field label={t('form.fees')} error={err('fees')} optional>
                <NumInput value={f.fees} onValue={(n) => set({ fees: n })} placeholder="0" />
              </Field>
              <Field label={t('form.currency')}>
                <CurrencySelect value={f.currency} onChange={(c) => set({ currency: c })} />
              </Field>
            </div>
            <div className="rounded-xl bg-ink-100 px-3 py-2 text-sm dark:bg-ink-800">
              {t('form.netReceived')}: <strong className="tnum">{formatMoney(net, f.currency, i18n.language)}</strong>
            </div>
            {methodField}
          </>
        )}

        {f.type === 'yield' && (
          <>
            {data.investments.length === 0 && <Note tone="warn">{t('entry.noInvestments')}</Note>}
            <Field label={t('form.investment')} error={err('investmentId')}>
              <Select
                value={f.investmentId}
                onChange={(e) => {
                  const inv = data.investments.find((x) => x.id === e.target.value)
                  set({ investmentId: e.target.value, currency: inv?.currency ?? f.currency })
                }}
              >
                <option value="">{t('form.choose')}</option>
                {data.investments
                  .filter((i) => i.status === 'active' || i.id === f.investmentId || (i.closeDate ?? '') >= monthOf(today()))
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} · {i.currency}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label={t('form.dateReceived')} error={err('date')}>
              <Input type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} />
            </Field>
            {amountField(t('form.yieldAmount'))}
            <Note>{t('entry.yieldNote')}</Note>
            <Toggle checked={f.toCapital} onChange={(v) => set({ toCapital: v })} label={t('form.toCapital')} hint={t('form.toCapitalHint')} />
          </>
        )}

        {f.type === 'pension' && (
          <>
            <Field label={t('form.pension')} error={err('pensionId')}>
              <Select
                value={f.pensionId}
                onChange={(e) => {
                  const p = data.pensions.find((x) => x.id === e.target.value)
                  const last = data.incomes.filter((i) => i.pensionId === p?.id).sort((a, b) => b.date.localeCompare(a.date))[0]
                  set({ pensionId: e.target.value, amount: last?.amount ?? p?.amount ?? f.amount, currency: last?.currency ?? p?.currency ?? f.currency })
                }}
              >
                <option value="">{t('form.choose')}</option>
                {data.pensions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('form.dateReceived')} error={err('date')}>
                <Input type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} />
              </Field>
              <Field label={t('form.pensionPeriod')} error={err('period')}>
                <MonthInput value={f.period} onChange={(m) => set({ period: m })} />
              </Field>
            </div>
            {amountField(t('form.amountReceived'))}
            {methodField}
          </>
        )}

        {f.type === 'other' && (
          <>
            <Field label={t('form.description')} error={err('description')}>
              <Input value={f.description} onChange={(e) => set({ description: e.target.value })} autoFocus />
            </Field>
            <RecentChips
              items={uniq(
                [...data.incomes]
                  .filter((i) => i.source === 'other' && i.description)
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((i) => i.description!),
              ).slice(0, 6)}
              onPick={(v) => {
                const last = data.incomes.filter((i) => i.source === 'other' && i.description === v).sort((a, b) => b.date.localeCompare(a.date))[0]
                set({ description: v, amount: last?.amount ?? f.amount, currency: last?.currency ?? f.currency, method: last?.method ?? f.method })
              }}
            />
            <Field label={t('form.dateReceived')} error={err('date')}>
              <Input type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} />
            </Field>
            {amountField(t('form.amountReceived'))}
            {methodField}
          </>
        )}

        <Field label={t('form.notes')} optional>
          <TextArea value={f.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>

        {warnings.map((w) => (
          <Note key={w} tone="warn">
            {w}
          </Note>
        ))}
        {tried && !valid && <Note tone="warn">{t('form.fixErrors')}</Note>}
        <button type="submit" hidden />
      </form>
    </Sheet>
  )
}

/** When switching to a kind, prefill from what's pending for that property. */
function applyKindPreset(d: Data, f: Draft): Draft {
  if (!f.propertyId) return f
  if (f.kind === 'installment') {
    const plans = d.plans.filter((p) => p.propertyId === f.propertyId && !p.cancelled && !planStatus(p, d.expenses).done)
    if (plans.length === 1) return withPlan(d, f, plans[0].id)
  }
  return f
}

function withPlan(d: Data, f: Draft, planId: string): Draft {
  const p = d.plans.find((x) => x.id === planId)
  if (!p) return { ...f, planId: '' }
  const st = planStatus(p, d.expenses)
  return {
    ...f,
    planId,
    concept: p.concept,
    category: p.category ?? '',
    amount: st.next?.amount ?? p.installment,
    currency: p.currency,
    method: p.method ?? f.method,
    installmentNo: st.next?.no ?? null,
    period: st.next?.month ?? f.period,
  }
}

function FixedFields({ f, setF, data }: { f: Draft; setF: (d: Draft) => void; data: Data }) {
  const { t, i18n } = useTranslation()
  const recs = data.recurring.filter((r) => r.propertyId === f.propertyId && (r.active || r.id === f.recurringId))
  if (!f.propertyId) return null
  return (
    <>
      <Field label={t('form.fixedItem')} hint={recs.length === 0 ? t('form.noFixed') : undefined}>
        <Select
          value={f.recurringId}
          onChange={(e) => {
            const r = data.recurring.find((x) => x.id === e.target.value)
            setF(r ? { ...f, recurringId: r.id, concept: r.concept, category: r.category ?? '', amount: r.amount, currency: r.currency, method: r.method ?? f.method } : { ...f, recurringId: '' })
          }}
        >
          <option value="">{t('form.fixedOther')}</option>
          {recs.map((r) => (
            <option key={r.id} value={r.id}>
              {r.concept} · {formatMoney(r.amount, r.currency, i18n.language)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t('form.periodCovered')}>
        <MonthInput value={f.period} onChange={(m) => setF({ ...f, period: m })} />
      </Field>
    </>
  )
}

function InstallmentFields({ f, setF, data, err }: { f: Draft; setF: (d: Draft) => void; data: Data; err?: string }) {
  const { t, i18n } = useTranslation()
  if (!f.propertyId) return null
  const plans = data.plans.filter((p) => p.propertyId === f.propertyId && ((!p.cancelled && !planStatus(p, data.expenses).done) || p.id === f.planId))
  const plan = data.plans.find((p) => p.id === f.planId)
  return (
    <>
      <Field label={t('form.plan')} error={err} hint={plans.length === 0 ? t('form.noPlans') : undefined}>
        <Select value={f.planId} onChange={(e) => setF(withPlan(data, f, e.target.value))}>
          <option value="">{t('form.choose')}</option>
          {plans.map((p) => {
            const st = planStatus(p, data.expenses)
            return (
              <option key={p.id} value={p.id}>
                {p.concept} · {t('plan.progress', { paid: st.paidCount, count: p.count })} · {formatMoney(p.installment, p.currency, i18n.language)}
              </option>
            )
          })}
        </Select>
      </Field>
      {plan && (
        <Field label={t('form.cuotaNo')}>
          <Select value={f.installmentNo ?? ''} onChange={(e) => setF({ ...f, installmentNo: Number(e.target.value) || null })}>
            {planStatus(plan, data.expenses)
              .schedule.filter((c) => !c.paid || c.paid.id === f.id)
              .map((c) => (
                <option key={c.no} value={c.no}>
                  {t('plan.cuotaOf', { no: c.no, count: plan.count })}
                </option>
              ))}
          </Select>
        </Field>
      )}
    </>
  )
}

function EventualFields({ f, set, data, prefs }: { f: Draft; set: (p: Partial<Draft>) => void; data: Data; prefs: Prefs }) {
  const { t } = useTranslation()
  const recent = uniq(
    data.expenses
      .filter((e) => e.kind === 'eventual' && e.propertyId === f.propertyId)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((e) => e.concept),
  ).slice(0, 6)
  return (
    <>
      <Field label={t('form.category')}>
        <Chips size="sm" value={f.category} onChange={(v) => set({ category: v })} options={uniq([...prefs.eventualCategories, f.category]).map((c) => ({ value: c, label: c }))} />
      </Field>
      <RecentChips
        items={recent}
        onPick={(v) => {
          const last = data.expenses.filter((e) => e.kind === 'eventual' && e.concept === v).sort((a, b) => b.date.localeCompare(a.date))[0]
          set({ concept: v, category: last?.category ?? f.category, method: last?.method ?? f.method })
        }}
      />
    </>
  )
}

function RecentChips({ items, onPick }: { items: string[]; onPick: (v: string) => void }) {
  const { t } = useTranslation()
  if (!items.length) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-ink-500">{t('form.recent')}:</span>
      {items.map((v) => (
        <button key={v} type="button" onClick={() => onPick(v)} className="cursor-pointer rounded-full bg-ink-100 px-2.5 py-1 text-ink-700 hover:bg-ink-200 dark:bg-ink-800 dark:text-ink-200 dark:hover:bg-ink-700">
          {v}
        </button>
      ))}
    </div>
  )
}

export function CurrencySelect({ value, onChange, disabled }: { value: Currency; onChange: (c: Currency) => void; disabled?: boolean }) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value as Currency)} className="w-24" disabled={disabled} aria-label="Moneda">
      <option value="ARS">ARS $</option>
      <option value="USD">USD</option>
    </Select>
  )
}

const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))]

async function persist(f: Draft, d: Data): Promise<void> {
  const notes = f.notes.trim() || undefined
  const stamp = { id: f.id, createdAt: f.createdAt }
  const amount = round2(f.amount ?? 0)
  switch (f.type) {
    case 'rent':
    case 'pension':
    case 'other': {
      const p = d.properties.find((x) => x.id === f.propertyId)
      const row: Omit<Income, 'id' | 'createdAt' | 'updatedAt'> = {
        source: f.type,
        date: f.date,
        period: f.type === 'other' ? undefined : f.period,
        propertyId: f.type === 'rent' ? f.propertyId : undefined,
        payer: f.type === 'rent' ? f.payer.trim() || p?.tenant || undefined : undefined,
        pensionId: f.type === 'pension' ? f.pensionId : undefined,
        description: f.type === 'other' ? f.description.trim() : undefined,
        amount,
        currency: f.currency,
        method: f.method || undefined,
        fee: f.type === 'rent' && f.fee ? round2(f.fee) : undefined,
        notes,
      }
      const op = putOp('incomes', { ...stamp, ...row })
      const ops: Op[] = [op]
      if (f.type === 'rent') {
        // Link the works deducted in this liquidation; unlink the ones she unticked.
        const want = new Set(f.deductionIds)
        for (const e of d.expenses) {
          if (want.has(e.id) && e.incomeId !== op.row.id) ops.push(putOp('expenses', { ...e, incomeId: op.row.id, deducted: true }))
          else if (!want.has(e.id) && e.incomeId === op.row.id) ops.push(putOp('expenses', { ...e, incomeId: undefined }))
        }
      }
      await apply(ops)
      return
    }
    case 'expense': {
      const row: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'> = {
        kind: f.kind,
        date: f.date,
        propertyId: f.propertyId,
        concept: f.concept.trim(),
        category: f.category || undefined,
        amount,
        currency: f.currency,
        method: f.method || undefined,
        notes,
        recurringId: f.kind === 'fixed' ? f.recurringId || undefined : undefined,
        period: f.kind === 'fixed' ? f.period : f.kind === 'installment' ? f.period : undefined,
        planId: f.kind === 'installment' ? f.planId : undefined,
        installmentNo: f.kind === 'installment' ? (f.installmentNo ?? undefined) : undefined,
      }
      if (f.kind === 'eventual') {
        const parts = (f.materials ?? 0) + (f.labor ?? 0) + (f.otherCosts ?? 0)
        // Total wins; with no total, the parts are the total. Never both.
        row.amount = round2(f.amount ?? parts)
        Object.assign(row, {
          workDate: f.workDate || undefined,
          materials: f.materials ?? undefined,
          labor: f.labor ?? undefined,
          otherCosts: f.otherCosts ?? undefined,
          managedBy: f.managedBy.trim() || undefined,
          paidBy: f.paidBy === 'me' ? undefined : f.paidBy,
          deducted: f.paidBy !== 'me' && f.deducted ? true : undefined,
          incomeId: f.paidBy !== 'me' && f.deducted && f.incomeId ? f.incomeId : undefined,
        })
      }
      const ops: Op[] = [putOp('expenses', { ...stamp, ...row })]
      const r = f.kind === 'fixed' && f.updateUsual ? d.recurring.find((x) => x.id === f.recurringId) : undefined
      if (r) ops.push(putOp('recurring', { ...r, amount, currency: f.currency }))
      await apply(ops)
      return
    }
    case 'sale': {
      const row: Omit<Sale, 'id' | 'createdAt' | 'updatedAt'> = {
        opDate: f.opDate,
        date: f.date,
        description: f.description.trim(),
        channel: f.channel || 'Otro',
        gross: round2(f.gross ?? 0),
        fees: round2(f.fees ?? 0),
        net: round2((f.gross ?? 0) - (f.fees ?? 0)),
        currency: f.currency,
        method: f.method || undefined,
        notes,
      }
      await save('sales', { ...stamp, ...row })
      return
    }
    case 'yield': {
      const row: Omit<Yield, 'id' | 'createdAt' | 'updatedAt'> = {
        investmentId: f.investmentId,
        date: f.date,
        amount,
        currency: f.currency,
        toCapital: f.toCapital || undefined,
        notes,
      }
      await save('yields', { ...stamp, ...row })
    }
  }
}

/** Movement summary for lists and the duplicate menu. */
export function useEntryTypes() {
  const { t } = useTranslation()
  return useMemo(
    () => ({ rent: t('entry.rent'), expense: t('entry.expense'), sale: t('entry.sale'), yield: t('entry.yield'), pension: t('entry.pension'), other: t('entry.other') }),
    [t],
  )
}

/** A new draft that copies a previous record: today's date, next period/cuota. */
function repeatFrom(d: Data, rec: EntryRecord): Draft {
  const src = fromRecord(rec)
  const out: Draft = { ...src, id: undefined, createdAt: undefined, date: today(), opDate: today(), installmentNo: null, deductionIds: [], incomeId: '' }
  if (out.type === 'rent' && out.propertyId) {
    out.period = suggestedRentPeriod(d, out.propertyId, thisMonth())
    out.deductionIds = pendingDeductions(d, out.propertyId).map((e) => e.id)
  } else out.period = thisMonth()
  if (out.type === 'expense' && out.kind === 'installment' && out.planId) {
    const plan = d.plans.find((p) => p.id === out.planId)
    const st = plan ? planStatus(plan, d.expenses) : undefined
    out.installmentNo = st?.next?.no ?? null
    out.period = st?.next?.month ?? out.period
  }
  return out
}

/** The most recent record "like" the current draft (same type; same property/kind when chosen). */
function lastRecordOf(d: Data, f: Draft): EntryRecord | undefined {
  const newest = <T extends { date: string; createdAt: string }>(xs: T[]) => [...xs].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))[0]
  switch (f.type) {
    case 'rent':
    case 'pension':
    case 'other': {
      const row = newest(d.incomes.filter((i) => i.source === f.type && (f.type !== 'rent' || !f.propertyId || i.propertyId === f.propertyId)))
      return row && { table: 'incomes', row }
    }
    case 'expense': {
      const row = newest(d.expenses.filter((e) => e.kind === f.kind && (!f.propertyId || e.propertyId === f.propertyId) && (!f.recurringId || e.recurringId === f.recurringId)))
      return row && { table: 'expenses', row }
    }
    case 'sale': {
      const row = newest(d.sales)
      return row && { table: 'sales', row }
    }
    case 'yield': {
      const row = newest(d.yields.filter((y) => !f.investmentId || y.investmentId === f.investmentId))
      return row && { table: 'yields', row }
    }
  }
}

function describeRecord(d: Data, r: EntryRecord, lang: string): string {
  const prop = (id?: string) => d.properties.find((p) => p.id === id)?.name
  const row = r.row
  const amount = 'net' in row ? row.net : row.amount
  const what =
    r.table === 'incomes'
      ? (prop(r.row.propertyId) ?? r.row.description ?? d.pensions.find((p) => p.id === (r.row as Income).pensionId)?.name)
      : r.table === 'expenses'
        ? `${r.row.concept} · ${prop(r.row.propertyId) ?? ''}`
        : r.table === 'sales'
          ? r.row.description
          : d.investments.find((i) => i.id === (r.row as Yield).investmentId)?.name
  return [what, formatMoney(amount, row.currency, lang), dateLabel(row.date, lang)].filter(Boolean).join(' · ')
}

/** Agency liquidation of a rent: fee withheld + works deducted. Gross is shown, never typed. */
function RentLiquidation({ f, set, data, err }: { f: Draft; set: (p: Partial<Draft>) => void; data: Data; err?: string }) {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  if (!f.propertyId) return null
  // Pending ones for this property + whatever is already linked to this rent.
  const candidates = data.expenses.filter((e) => (pendingDeductions(data, f.propertyId).includes(e) || (f.id && e.incomeId === f.id)))
  const picked = candidates.filter((e) => f.deductionIds.includes(e.id))
  const dedSum = picked.filter((e) => e.currency === f.currency).reduce((s, e) => s + e.amount, 0)
  const gross = (f.amount ?? 0) + (f.fee ?? 0) + dedSum
  const show = open || !!f.fee || candidates.length > 0
  const fmt = (n: number, c: Currency = f.currency) => formatMoney(n, c, i18n.language)
  if (!show)
    return (
      <button type="button" onClick={() => setOpen(true)} className="-mt-2 cursor-pointer text-sm text-brand-700 hover:underline dark:text-brand-300">
        + {t('rent.addLiquidation')}
      </button>
    )
  return (
    <div className="space-y-3 rounded-xl border border-ink-200 p-3 dark:border-ink-700">
      <div className="text-sm font-semibold text-ink-700 dark:text-ink-200">{t('rent.liquidation')}</div>
      <Field label={t('rent.fee')} error={err} hint={t('rent.feeHint')} optional>
        <NumInput value={f.fee} onValue={(n) => set({ fee: n })} className="w-48" placeholder="0" />
      </Field>
      {candidates.length > 0 && (
        <div>
          <div className="mb-1 text-sm font-medium text-ink-700 dark:text-ink-300">{t('rent.deductions')}</div>
          <ul className="space-y-1">
            {candidates.map((e) => (
              <li key={e.id}>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand-600"
                    checked={f.deductionIds.includes(e.id)}
                    onChange={(ev) => set({ deductionIds: ev.target.checked ? [...f.deductionIds, e.id] : f.deductionIds.filter((x) => x !== e.id) })}
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {e.concept} <span className="text-ink-500">· {dateLabel(e.workDate || e.date, i18n.language)}</span>
                  </span>
                  <span className="tnum">{fmt(e.amount, e.currency)}</span>
                </label>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-ink-500">{t('rent.deductionsHint')}</p>
        </div>
      )}
      <div className="rounded-lg bg-ink-100 px-3 py-2 text-sm dark:bg-ink-800">
        {t('rent.grossLine', { gross: fmt(gross), net: fmt(f.amount ?? 0), fee: fmt(f.fee ?? 0), ded: fmt(dedSum) })}
      </div>
    </div>
  )
}

/** Works: date, mixed breakdown, who managed/paid it, deducted from a rent or not. */
function WorkFields({ f, set, data, prefs, err, partsSum }: { f: Draft; set: (p: Partial<Draft>) => void; data: Data; prefs: Prefs; err?: string; partsSum: number }) {
  const { t, i18n } = useTranslation()
  const fmt = (n: number) => formatMoney(n, f.currency, i18n.language)
  const gap = f.amount !== null && partsSum > 0 ? round2(f.amount - partsSum) : 0
  const rents = data.incomes
    .filter((i) => i.source === 'rent' && i.propertyId === f.propertyId)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 12)
  const own = isOwnExpense({ paidBy: f.paidBy, deducted: f.deducted })
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('work.date')} optional>
          <Input type="date" value={f.workDate} onChange={(e) => set({ workDate: e.target.value })} />
        </Field>
        <Field label={t('form.datePaid')}>
          <Input type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t('work.materials')} optional>
          <NumInput value={f.materials} onValue={(n) => set({ materials: n })} placeholder="—" />
        </Field>
        <Field label={t('work.labor')} optional>
          <NumInput value={f.labor} onValue={(n) => set({ labor: n })} placeholder="—" />
        </Field>
        <Field label={t('work.other')} optional>
          <NumInput value={f.otherCosts} onValue={(n) => set({ otherCosts: n })} placeholder="—" />
        </Field>
      </div>
      <Field label={t('work.total')} error={err} hint={f.amount === null && partsSum > 0 ? t('work.totalFromParts', { total: fmt(partsSum) }) : gap > 0.004 ? t('work.unitemized', { amount: fmt(gap) }) : t('work.totalHint')}>
        <div className="flex gap-2">
          <NumInput value={f.amount} onValue={(n) => set({ amount: n })} className="flex-1" placeholder={partsSum > 0 ? fmt(partsSum) : '0'} />
          <CurrencySelect value={f.currency} onChange={(c) => set({ currency: c })} />
        </div>
      </Field>
      <Field label={t('work.managedBy')} optional>
        <Input value={f.managedBy} onChange={(e) => set({ managedBy: e.target.value })} />
      </Field>
      {prefs.managers.length > 0 && (
        <div className="-mt-2 flex flex-wrap gap-1.5">
          {prefs.managers.map((m) => (
            <button key={m} type="button" onClick={() => set({ managedBy: m })} className="cursor-pointer rounded-full bg-ink-100 px-2.5 py-1 text-xs hover:bg-ink-200 dark:bg-ink-800 dark:hover:bg-ink-700">
              {m}
            </button>
          ))}
        </div>
      )}
      <Field label={t('work.paidBy')}>
        <Chips<PaidBy> size="sm" value={f.paidBy} onChange={(v) => set({ paidBy: v, deducted: v === 'agency' ? true : v === 'me' ? false : f.deducted })} options={PAID_BY.map((x) => ({ value: x, label: t(`work.by_${x}`) }))} />
      </Field>
      {f.paidBy !== 'me' && (
        <>
          <Toggle checked={f.deducted} onChange={(v) => set({ deducted: v })} label={t('work.deducted')} hint={t('work.deductedHint')} />
          {f.deducted && rents.length > 0 && (
            <Field label={t('work.fromRent')} hint={t('work.fromRentHint')} optional>
              <Select value={f.incomeId} onChange={(e) => set({ incomeId: e.target.value })}>
                <option value="">{t('work.notYet')}</option>
                {rents.map((r) => (
                  <option key={r.id} value={r.id}>
                    {dateLabel(r.date, i18n.language)} · {formatMoney(r.amount, r.currency, i18n.language)}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {!own && <Note>{t('work.notOwn')}</Note>}
        </>
      )}
      {own && (
        <Field label={t('form.payMethod')} optional>
          <Select value={f.method} onChange={(e) => set({ method: e.target.value })}>
            <option value="">—</option>
            {uniq([...prefs.methods, f.method]).map((m) => (
              <option key={m}>{m}</option>
            ))}
          </Select>
        </Field>
      )}
    </>
  )
}
