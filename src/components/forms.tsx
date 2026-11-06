import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { addMonths, isDate, isMonth, thisMonth, today } from '../lib/dates'
import { capitalSummary, currentValuation, type Data } from '../lib/calc'
import { formatMoney, round2 } from '../lib/money'
import { rememberInList, type Prefs } from '../lib/prefs'
import { apply, putOp, putRaw, save, saveProperty } from '../lib/repo'
import type { Op } from '../lib/store/types'
import { rateId } from '../lib/fx'
import type { CapitalMove, Currency, Investment, Pension, Plan, Property, PropertySale, Recurring, Valuation } from '../lib/types'
import { CurrencySelect } from './EntryForm'
import { toast } from './toast'
import { Button, Chips, Field, Input, MonthInput, Note, NumInput, Select, Sheet, TextArea, Toggle } from './ui'

type Errors = Record<string, string | undefined>

/** Shared shell: sheet + footer + validation-on-submit. */
function FormSheet({
  title,
  onClose,
  onSave,
  errors,
  children,
  extra,
}: {
  title: ReactNode
  onClose: () => void
  onSave: () => Promise<void>
  errors: Errors
  children: (err: (k: string) => string | undefined) => ReactNode
  extra?: ReactNode
}) {
  const { t } = useTranslation()
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const valid = Object.values(errors).every((e) => !e)
  const submit = async () => {
    setTried(true)
    if (!valid || busy) return
    setBusy(true)
    try {
      await onSave()
      toast(t('form.saved'))
      onClose()
    } finally {
      setBusy(false)
    }
  }
  return (
    <Sheet
      open
      onClose={onClose}
      title={title}
      footer={
        <div className="flex items-center justify-between gap-2">
          <div>{extra}</div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={submit} disabled={busy}>
              {t('common.save')}
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
      >
        {children((k) => (tried ? errors[k] : undefined))}
        {tried && !valid && <Note tone="warn">{t('form.fixErrors')}</Note>}
        <button type="submit" hidden />
      </form>
    </Sheet>
  )
}

const positive = (n: number | null | undefined) => typeof n === 'number' && n > 0

// ---------------------------------------------------------------------------

export function PropertyForm({ data, property, onClose }: { data: Data; property?: Property; onClose: () => void }) {
  const { t } = useTranslation()
  const cur = property ? currentValuation(data, property.id) : undefined
  const [p, setP] = useState({
    name: property?.name ?? '',
    address: property?.address ?? '',
    city: property?.city ?? '',
    province: property?.province ?? 'Río Negro',
    tenant: property?.tenant ?? '',
    contractStart: property?.contractStart ?? '',
    contractEnd: property?.contractEnd ?? '',
    contractNotes: property?.contractNotes ?? '',
    refRent: property?.refRent ?? null,
    refRentCurrency: property?.refRentCurrency ?? ('ARS' as Currency),
    notes: property?.notes ?? '',
  })
  const [value, setValue] = useState<number | null>(cur?.value ?? null)
  const [valueCur, setValueCur] = useState<Currency>(cur?.currency ?? 'USD')
  const set = (patch: Partial<typeof p>) => setP((x) => ({ ...x, ...patch }))
  const errors: Errors = {
    name: p.name.trim() ? undefined : t('form.required'),
    contractEnd: p.contractStart && p.contractEnd && p.contractEnd < p.contractStart ? t('form.endBeforeStart') : undefined,
  }
  const valueChanged = !!cur && value !== null && (value !== cur.value || valueCur !== cur.currency)
  return (
    <FormSheet
      title={property ? t('property.edit') : t('property.new')}
      onClose={onClose}
      errors={errors}
      onSave={async () => {
        await saveProperty(
          {
            ...(property ?? {}),
            ...p,
            name: p.name.trim(),
            refRent: p.refRent,
            contractStart: p.contractStart || undefined,
            contractEnd: p.contractEnd || undefined,
          },
          { amount: value, currency: valueCur },
          data,
        )
      }}
    >
      {(err) => (
        <>
          <Field label={t('property.name')} error={err('name')} hint={t('property.nameHint')}>
            <Input value={p.name} onChange={(e) => set({ name: e.target.value })} autoFocus />
          </Field>
          <Field label={t('property.address')} optional>
            <Input value={p.address} onChange={(e) => set({ address: e.target.value })} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('property.city')} optional>
              <Input value={p.city} onChange={(e) => set({ city: e.target.value })} />
            </Field>
            <Field label={t('property.province')} optional>
              <Input value={p.province} onChange={(e) => set({ province: e.target.value })} />
            </Field>
          </div>
          <h4 className="pt-2 text-sm font-semibold text-ink-600 dark:text-ink-300">{t('property.contract')}</h4>
          <Field label={t('property.tenant')} optional>
            <Input value={p.tenant} onChange={(e) => set({ tenant: e.target.value })} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('property.contractStart')} optional>
              <Input type="date" value={p.contractStart} onChange={(e) => set({ contractStart: e.target.value })} />
            </Field>
            <Field label={t('property.contractEnd')} error={err('contractEnd')} optional>
              <Input type="date" value={p.contractEnd} onChange={(e) => set({ contractEnd: e.target.value })} />
            </Field>
          </div>
          <Field label={t('property.refRent')} hint={t('property.refRentHint')} optional>
            <div className="flex gap-2">
              <NumInput value={p.refRent} onValue={(n) => set({ refRent: n })} className="flex-1" />
              <CurrencySelect value={p.refRentCurrency} onChange={(c) => set({ refRentCurrency: c })} />
            </div>
          </Field>
          <Field label={t('property.contractNotes')} hint={t('property.contractNotesHint')} optional>
            <TextArea value={p.contractNotes} onChange={(e) => set({ contractNotes: e.target.value })} />
          </Field>
          <h4 className="pt-2 text-sm font-semibold text-ink-600 dark:text-ink-300">{t('property.marketValue')}</h4>
          <Field label={t('property.value')} hint={valueChanged ? t('property.valueNewRow') : t('property.valueHint')} optional>
            <div className="flex gap-2">
              <NumInput value={value} onValue={setValue} className="flex-1" />
              <CurrencySelect value={valueCur} onChange={setValueCur} />
            </div>
          </Field>
          <Field label={t('form.notes')} optional>
            <TextArea value={p.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Field>
        </>
      )}
    </FormSheet>
  )
}

export function ValuationForm({ propertyId, valuation, onClose }: { propertyId: string; valuation?: Valuation; onClose: () => void }) {
  const { t } = useTranslation()
  const [date, setDate] = useState(valuation?.date ?? today())
  const [value, setValue] = useState<number | null>(valuation?.value ?? null)
  const [cur, setCur] = useState<Currency>(valuation?.currency ?? 'USD')
  const [notes, setNotes] = useState(valuation?.notes ?? '')
  return (
    <FormSheet
      title={t('property.valuation')}
      onClose={onClose}
      errors={{ date: isDate(date) ? undefined : t('form.required'), value: positive(value) ? undefined : t('form.amountPositive') }}
      onSave={async () => {
        await save('valuations', { ...(valuation ?? {}), propertyId, date, value: round2(value!), currency: cur, notes: notes.trim() || undefined })
      }}
    >
      {(err) => (
        <>
          <Field label={t('form.date')} error={err('date')}>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label={t('property.value')} error={err('value')}>
            <div className="flex gap-2">
              <NumInput value={value} onValue={setValue} className="flex-1" autoFocus />
              <CurrencySelect value={cur} onChange={setCur} />
            </div>
          </Field>
          <Field label={t('form.notes')} hint={t('property.valuationNotesHint')} optional>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </>
      )}
    </FormSheet>
  )
}

// ---------------------------------------------------------------------------

export function RecurringForm({ data, prefs, rec, propertyId, onClose }: { data: Data; prefs: Prefs; rec?: Recurring; propertyId?: string; onClose: () => void }) {
  const { t } = useTranslation()
  const [r, setR] = useState({
    propertyId: rec?.propertyId ?? propertyId ?? data.properties.find((p) => !p.archived)?.id ?? '',
    concept: rec?.concept ?? '',
    category: rec?.category ?? '',
    every: rec?.every ?? 1,
    startMonth: rec?.startMonth ?? thisMonth(),
    amount: rec?.amount ?? (null as number | null),
    currency: rec?.currency ?? ('ARS' as Currency),
    method: rec?.method ?? '',
    active: rec?.active ?? true,
    notes: rec?.notes ?? '',
  })
  const set = (patch: Partial<typeof r>) => setR((x) => ({ ...x, ...patch }))
  const errors: Errors = {
    propertyId: r.propertyId ? undefined : t('form.required'),
    concept: r.concept.trim() ? undefined : t('form.required'),
    amount: positive(r.amount) ? undefined : t('form.amountPositive'),
  }
  return (
    <FormSheet
      title={rec ? t('fixed.edit') : t('fixed.new')}
      onClose={onClose}
      errors={errors}
      onSave={async () => {
        await save('recurring', { ...(rec ?? {}), ...r, concept: r.concept.trim(), category: r.category || undefined, amount: round2(r.amount!), method: r.method || undefined, notes: r.notes.trim() || undefined })
      }}
    >
      {(err) => (
        <>
          <PropertySelect data={data} value={r.propertyId} onChange={(v) => set({ propertyId: v })} error={err('propertyId')} />
          <Field label={t('form.category')}>
            <Chips
              size="sm"
              value={r.category}
              onChange={(v) => set({ category: v, concept: r.concept || (v === 'Otros' ? '' : v) })}
              options={[...new Set([...prefs.fixedCategories, r.category].filter(Boolean))].map((c) => ({ value: c, label: c }))}
            />
          </Field>
          <Field label={t('form.concept')} error={err('concept')}>
            <Input value={r.concept} onChange={(e) => set({ concept: e.target.value })} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('fixed.every')}>
              <Select value={r.every} onChange={(e) => set({ every: Number(e.target.value) })}>
                {[1, 2, 3, 4, 6, 12, 0].map((n) => (
                  <option key={n} value={n}>
                    {t(`fixed.every_${n}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('fixed.startMonth')} hint={t('fixed.startMonthHint')}>
              <MonthInput value={r.startMonth} onChange={(m) => set({ startMonth: m })} />
            </Field>
          </div>
          <Field label={t('fixed.usual')} error={err('amount')} hint={t('fixed.usualHint')}>
            <div className="flex gap-2">
              <NumInput value={r.amount} onValue={(n) => set({ amount: n })} className="flex-1" />
              <CurrencySelect value={r.currency} onChange={(c) => set({ currency: c })} />
            </div>
          </Field>
          <MethodSelect prefs={prefs} value={r.method} onChange={(v) => set({ method: v })} />
          {rec && <Toggle checked={r.active} onChange={(v) => set({ active: v })} label={t('fixed.active')} hint={t('fixed.activeHint')} />}
          <Field label={t('form.notes')} optional>
            <TextArea value={r.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Field>
        </>
      )}
    </FormSheet>
  )
}

// ---------------------------------------------------------------------------

export function PlanForm({ data, prefs, plan, propertyId, onClose }: { data: Data; prefs: Prefs; plan?: Plan; propertyId?: string; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const [p, setP] = useState({
    propertyId: plan?.propertyId ?? propertyId ?? data.properties.find((x) => !x.archived)?.id ?? '',
    concept: plan?.concept ?? '',
    category: plan?.category ?? '',
    total: plan?.total ?? (null as number | null),
    count: plan?.count ?? (12 as number | null),
    installment: plan?.installment ?? (null as number | null),
    currency: plan?.currency ?? ('ARS' as Currency),
    startMonth: plan?.startMonth ?? thisMonth(),
    method: plan?.method ?? 'Tarjeta de crédito',
    notes: plan?.notes ?? '',
    cancelled: plan?.cancelled ?? false,
  })
  const [alreadyPaid, setAlreadyPaid] = useState<number | null>(null)
  const set = (patch: Partial<typeof p>) => setP((x) => ({ ...x, ...patch }))
  const paidCount = plan ? data.expenses.filter((e) => e.planId === plan.id).length : 0
  const errors: Errors = {
    propertyId: p.propertyId ? undefined : t('form.required'),
    concept: p.concept.trim() ? undefined : t('form.required'),
    count: p.count && p.count >= 1 && Number.isInteger(p.count) && p.count >= paidCount ? undefined : t('plan.countInvalid'),
    installment: positive(p.installment) ? undefined : t('form.amountPositive'),
    alreadyPaid: alreadyPaid && (alreadyPaid < 0 || alreadyPaid > (p.count ?? 0) || !Number.isInteger(alreadyPaid)) ? t('plan.countInvalid') : undefined,
  }
  const overdueHint =
    !plan && p.startMonth < thisMonth()
      ? t('plan.pastStartHint', { n: Math.min(p.count ?? 0, (Number(thisMonth().slice(0, 4)) - Number(p.startMonth.slice(0, 4))) * 12 + Number(thisMonth().slice(5)) - Number(p.startMonth.slice(5))) })
      : undefined
  return (
    <FormSheet
      title={plan ? t('plan.edit') : t('plan.new')}
      onClose={onClose}
      errors={errors}
      onSave={async () => {
        const total = round2(p.total ?? (p.installment ?? 0) * (p.count ?? 0))
        {
          const planOp = putOp('plans', {
            ...(plan ?? {}),
            ...p,
            concept: p.concept.trim(),
            category: p.category || undefined,
            total,
            count: p.count!,
            installment: round2(p.installment!),
            method: p.method || undefined,
            notes: p.notes.trim() || undefined,
          })
          const id = planOp.row.id
          const ops: Op[] = [planOp]
          // Cuotas paid before she started using the app: one expense per cuota, in its own month.
          if (!plan && alreadyPaid) {
            const day = Math.min(28, Number(today().slice(8)))
            for (let no = 1; no <= alreadyPaid; no++) {
              const m = addMonths(p.startMonth, no - 1)
              ops.push(putOp('expenses', {
                kind: 'installment',
                date: `${m}-${String(day).padStart(2, '0')}`,
                period: m,
                propertyId: p.propertyId,
                concept: p.concept.trim(),
                category: p.category || undefined,
                amount: round2(p.installment!),
                currency: p.currency,
                method: p.method || undefined,
                planId: id,
                installmentNo: no,
              }))
            }
          }
          await apply(ops)
        }
      }}
    >
      {(err) => (
        <>
          <PropertySelect data={data} value={p.propertyId} onChange={(v) => set({ propertyId: v })} error={err('propertyId')} />
          <Field label={t('form.concept')} error={err('concept')}>
            <Input value={p.concept} onChange={(e) => set({ concept: e.target.value })} autoFocus />
          </Field>
          <Field label={t('form.category')}>
            <Chips size="sm" value={p.category} onChange={(v) => set({ category: v })} options={prefs.installmentCategories.map((c) => ({ value: c, label: c }))} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t('plan.total')}>
              <NumInput
                value={p.total}
                onValue={(n) => set({ total: n, installment: n && p.count ? round2(n / p.count) : p.installment })}
              />
            </Field>
            <Field label={t('plan.count')} error={err('count')}>
              <NumInput
                value={p.count}
                onValue={(n) => set({ count: n, installment: p.total && n ? round2(p.total / n) : p.installment })}
              />
            </Field>
            <Field label={t('plan.installment')} error={err('installment')}>
              <NumInput value={p.installment} onValue={(n) => set({ installment: n, total: n && p.count ? round2(n * p.count) : p.total })} />
            </Field>
          </div>
          <p className="-mt-2 text-xs text-ink-500">{t('plan.calcHint')}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('form.currency')}>
              <CurrencySelect value={p.currency} onChange={(c) => set({ currency: c })} />
            </Field>
            <Field label={t('plan.startMonth')}>
              <MonthInput value={p.startMonth} onChange={(m) => set({ startMonth: m })} />
            </Field>
          </div>
          {!plan && (
            <Field label={t('plan.alreadyPaid')} error={err('alreadyPaid')} hint={overdueHint ?? t('plan.alreadyPaidHint')} optional>
              <NumInput value={alreadyPaid} onValue={setAlreadyPaid} className="w-28" placeholder="0" />
            </Field>
          )}
          <MethodSelect prefs={prefs} value={p.method} onChange={(v) => set({ method: v })} />
          {plan && <Toggle checked={p.cancelled} onChange={(v) => set({ cancelled: v })} label={t('plan.cancelled')} hint={t('plan.cancelledHint')} />}
          <Field label={t('form.notes')} optional>
            <TextArea value={p.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Field>
          {p.installment && p.count ? (
            <Note>
              {t('plan.summary', {
                count: p.count,
                amount: formatMoney(p.installment, p.currency, i18n.language),
                total: formatMoney(p.installment * p.count, p.currency, i18n.language),
              })}
            </Note>
          ) : null}
        </>
      )}
    </FormSheet>
  )
}

// ---------------------------------------------------------------------------

export function InvestmentForm({ data, prefs, inv, preset, onClose }: { data: Data; prefs: Prefs; inv?: Investment; preset?: Partial<Investment>; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const base = inv ?? preset
  const [v, setV] = useState({
    name: base?.name ?? '',
    type: base?.type ?? prefs.investmentTypes[0] ?? '',
    institution: base?.institution ?? '',
    currency: base?.currency ?? ('ARS' as Currency),
    capital: base?.capital ?? (null as number | null),
    startDate: base?.startDate ?? today(),
    maturityDate: base?.maturityDate ?? '',
    rate: base?.rate ?? (null as number | null),
    notes: base?.notes ?? '',
    fromAvailable: base?.fromAvailable,
  })
  const set = (patch: Partial<typeof v>) => setV((x) => ({ ...x, ...patch }))
  const avail = capitalSummary(data, v.currency).available + (inv?.fromAvailable ? inv.capital : 0)
  const fromAvailable = v.fromAvailable ?? (avail > 0 && (v.capital ?? 0) <= avail)
  const errors: Errors = {
    name: v.name.trim() ? undefined : t('form.required'),
    capital: positive(v.capital) ? undefined : t('form.amountPositive'),
    startDate: isDate(v.startDate) ? undefined : t('form.required'),
    maturityDate: v.maturityDate && v.maturityDate < v.startDate ? t('form.endBeforeStart') : undefined,
  }
  return (
    <FormSheet
      title={inv ? t('inv.edit') : t('inv.new')}
      onClose={onClose}
      errors={errors}
      onSave={async () => {
        await save('investments', {
          ...(inv ?? {}),
          status: inv?.status ?? 'active',
          name: v.name.trim(),
          type: v.type,
          institution: v.institution.trim() || undefined,
          currency: v.currency,
          capital: round2(v.capital!),
          startDate: v.startDate,
          maturityDate: v.maturityDate || undefined,
          rate: v.rate,
          notes: v.notes.trim() || undefined,
          fromAvailable,
        })
        await rememberInList('institutions', v.institution)
      }}
    >
      {(err) => (
        <>
          <Field label={t('inv.name')} error={err('name')} hint={t('inv.nameHint')}>
            <Input value={v.name} onChange={(e) => set({ name: e.target.value })} autoFocus />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('inv.type')}>
              <Select value={v.type} onChange={(e) => set({ type: e.target.value })}>
                {[...new Set([...prefs.investmentTypes, v.type])].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </Select>
            </Field>
            <Field label={t('inv.institution')} optional>
              <Input value={v.institution} onChange={(e) => set({ institution: e.target.value })} />
            </Field>
          </div>
          {prefs.institutions.length > 0 && (
            <div className="-mt-2 flex flex-wrap gap-1.5">
              {prefs.institutions.map((x) => (
                <button key={x} type="button" onClick={() => set({ institution: x })} className="cursor-pointer rounded-full bg-ink-100 px-2.5 py-1 text-xs hover:bg-ink-200 dark:bg-ink-800 dark:hover:bg-ink-700">
                  {x}
                </button>
              ))}
            </div>
          )}
          <Field label={t('inv.capital')} error={err('capital')}>
            <div className="flex gap-2">
              <NumInput value={v.capital} onValue={(n) => set({ capital: n })} className="flex-1" />
              <CurrencySelect value={v.currency} onChange={(c) => set({ currency: c })} />
            </div>
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t('inv.startDate')} error={err('startDate')}>
              <Input type="date" value={v.startDate} onChange={(e) => set({ startDate: e.target.value })} />
            </Field>
            <Field label={t('inv.maturity')} error={err('maturityDate')} optional>
              <Input type="date" value={v.maturityDate} onChange={(e) => set({ maturityDate: e.target.value })} />
            </Field>
            <Field label={t('inv.rate')} hint={t('inv.rateHint')} optional>
              <NumInput value={v.rate} onValue={(n) => set({ rate: n })} placeholder="%" />
            </Field>
          </div>
          <Toggle
            checked={fromAvailable}
            onChange={(x) => set({ fromAvailable: x })}
            label={t('inv.fromAvailable')}
            hint={t('inv.fromAvailableHint', { amount: formatMoney(avail, v.currency, i18n.language) })}
          />
          <Field label={t('form.notes')} optional>
            <TextArea value={v.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Field>
        </>
      )}
    </FormSheet>
  )
}

/** Close an investment: capital comes back (not income), the final yield is income. Optionally renew. */
export function CloseInvestmentForm({ inv, onClose, onRenew }: { inv: Investment; onClose: () => void; onRenew: (preset: Partial<Investment>) => void }) {
  const { t, i18n } = useTranslation()
  const [status, setStatus] = useState<'matured' | 'redeemed'>(inv.maturityDate ? 'matured' : 'redeemed')
  const [date, setDate] = useState(inv.maturityDate && inv.maturityDate <= today() ? inv.maturityDate : today())
  const [recovered, setRecovered] = useState<number | null>(inv.capital)
  const [interest, setInterest] = useState<number | null>(null)
  const [renew, setRenew] = useState(false)
  const [reinvestInterest, setReinvestInterest] = useState(false)
  const diff = (recovered ?? 0) - inv.capital
  return (
    <FormSheet
      title={t('inv.closeTitle', { name: inv.name })}
      onClose={onClose}
      errors={{ date: isDate(date) ? undefined : t('form.required'), recovered: recovered !== null && recovered >= 0 ? undefined : t('form.required') }}
      onSave={async () => {
        const ops: Op[] = [putOp('investments', { ...inv, status, closeDate: date, recovered: round2(recovered ?? 0) })]
        if (interest && interest > 0)
          ops.push(putOp('yields', { investmentId: inv.id, date, amount: round2(interest), currency: inv.currency, toCapital: renew && reinvestInterest ? true : undefined }))
        await apply(ops)
        if (renew)
          onRenew({
            name: inv.name,
            type: inv.type,
            institution: inv.institution,
            currency: inv.currency,
            capital: round2((recovered ?? 0) + (renew && reinvestInterest ? (interest ?? 0) : 0)),
            startDate: date,
            rate: inv.rate,
            fromAvailable: true,
          })
      }}
    >
      {(err) => (
        <>
          <Chips
            value={status}
            onChange={setStatus}
            options={[
              { value: 'matured', label: t('inv.status_matured') },
              { value: 'redeemed', label: t('inv.status_redeemed') },
            ]}
          />
          <Field label={t('form.date')} error={err('date')}>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label={t('inv.recovered')} error={err('recovered')} hint={t('inv.recoveredHint')}>
            <NumInput value={recovered} onValue={setRecovered} />
          </Field>
          {Math.abs(diff) > 0.004 && <Note tone="warn">{diff < 0 ? t('inv.capitalLoss', { amount: formatMoney(-diff, inv.currency, i18n.language) }) : t('inv.capitalGain', { amount: formatMoney(diff, inv.currency, i18n.language) })}</Note>}
          <Field label={t('inv.finalYield')} hint={t('inv.finalYieldHint')} optional>
            <NumInput value={interest} onValue={setInterest} placeholder="0" />
          </Field>
          <Toggle checked={renew} onChange={setRenew} label={t('inv.renew')} hint={t('inv.renewHint')} />
          {renew && (interest ?? 0) > 0 && <Toggle checked={reinvestInterest} onChange={setReinvestInterest} label={t('inv.reinvestInterest')} />}
        </>
      )}
    </FormSheet>
  )
}

// ---------------------------------------------------------------------------

export function PropertySaleForm({ data, sale, onClose }: { data: Data; sale?: PropertySale; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const [s, setS] = useState({
    status: sale?.status ?? ('done' as PropertySale['status']),
    propertyId: sale?.propertyId ?? '',
    propertyName: sale?.propertyName ?? '',
    date: sale?.date ?? today(),
    price: sale?.price ?? (null as number | null),
    costs: sale?.costs ?? (null as number | null),
    currency: sale?.currency ?? ('USD' as Currency),
    destination: sale?.destination ?? '',
    notes: sale?.notes ?? '',
  })
  const [archive, setArchive] = useState(true)
  const set = (patch: Partial<typeof s>) => setS((x) => ({ ...x, ...patch }))
  const name = s.propertyName.trim() || data.properties.find((p) => p.id === s.propertyId)?.name || ''
  const net = round2((s.price ?? 0) - (s.costs ?? 0))
  const errors: Errors = {
    name: name ? undefined : t('form.required'),
    date: isDate(s.date) ? undefined : t('form.required'),
    price: positive(s.price) ? undefined : t('form.amountPositive'),
    costs: (s.costs ?? 0) < 0 || (s.costs ?? 0) > (s.price ?? 0) ? t('form.feesRange') : undefined,
  }
  return (
    <FormSheet
      title={sale ? t('psale.edit') : t('psale.new')}
      onClose={onClose}
      errors={errors}
      onSave={async () => {
        {
          const ops: Op[] = [putOp('propertySales', {
            ...(sale ?? {}),
            status: s.status,
            propertyId: s.propertyId || undefined,
            propertyName: name,
            date: s.date,
            price: round2(s.price!),
            costs: round2(s.costs ?? 0),
            net,
            currency: s.currency,
            destination: s.destination.trim() || undefined,
            notes: s.notes.trim() || undefined,
          })]
          const p = s.status === 'done' && archive ? data.properties.find((x) => x.id === s.propertyId) : undefined
          if (p) ops.push(putOp('properties', { ...p, soldAt: s.date, archived: true, archivedAt: today() }))
          await apply(ops)
        }
      }}
    >
      {(err) => (
        <>
          <Note>{t('psale.note')}</Note>
          <Chips
            value={s.status}
            onChange={(v) => set({ status: v })}
            options={[
              { value: 'done', label: t('psale.done') },
              { value: 'planned', label: t('psale.planned') },
            ]}
          />
          <Field label={t('psale.property')} hint={t('psale.propertyHint')}>
            <Select value={s.propertyId} onChange={(e) => set({ propertyId: e.target.value, propertyName: '' })}>
              <option value="">{t('psale.notListed')}</option>
              {data.properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          {!s.propertyId && (
            <Field label={t('psale.propertyName')} error={err('name')}>
              <Input value={s.propertyName} onChange={(e) => set({ propertyName: e.target.value })} />
            </Field>
          )}
          <Field label={s.status === 'planned' ? t('psale.expectedDate') : t('psale.date')} error={err('date')}>
            <Input type="date" value={s.date} onChange={(e) => set({ date: e.target.value })} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t('psale.price')} error={err('price')}>
              <NumInput value={s.price} onValue={(n) => set({ price: n })} />
            </Field>
            <Field label={t('psale.costs')} error={err('costs')} hint={t('psale.costsHint')} optional>
              <NumInput value={s.costs} onValue={(n) => set({ costs: n })} placeholder="0" />
            </Field>
            <Field label={t('form.currency')}>
              <CurrencySelect value={s.currency} onChange={(c) => set({ currency: c })} />
            </Field>
          </div>
          <div className="rounded-xl bg-ink-100 px-3 py-2 text-sm dark:bg-ink-800">
            {t('psale.net')}: <strong className="tnum">{formatMoney(net, s.currency, i18n.language)}</strong>
          </div>
          <Field label={t('psale.destination')} hint={t('psale.destinationHint')} optional>
            <TextArea value={s.destination} onChange={(e) => set({ destination: e.target.value })} />
          </Field>
          {s.status === 'done' && s.propertyId && !sale && <Toggle checked={archive} onChange={setArchive} label={t('psale.archive')} />}
          <Field label={t('form.notes')} optional>
            <TextArea value={s.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Field>
        </>
      )}
    </FormSheet>
  )
}

export function CapitalForm({ move, onClose }: { move?: CapitalMove; onClose: () => void }) {
  const { t } = useTranslation()
  const [c, setC] = useState({
    kind: move?.kind ?? ('in' as 'in' | 'out'),
    date: move?.date ?? today(),
    amount: move?.amount ?? (null as number | null),
    currency: move?.currency ?? ('USD' as Currency),
    concept: move?.concept ?? '',
    notes: move?.notes ?? '',
  })
  const set = (patch: Partial<typeof c>) => setC((x) => ({ ...x, ...patch }))
  return (
    <FormSheet
      title={t('capital.moveTitle')}
      onClose={onClose}
      errors={{
        date: isDate(c.date) ? undefined : t('form.required'),
        amount: positive(c.amount) ? undefined : t('form.amountPositive'),
        concept: c.concept.trim() ? undefined : t('form.required'),
      }}
      onSave={async () => {
        await save('capital', { ...(move ?? {}), ...c, amount: round2(c.amount!), concept: c.concept.trim(), notes: c.notes.trim() || undefined })
      }}
    >
      {(err) => (
        <>
          <Chips
            value={c.kind}
            onChange={(v) => set({ kind: v })}
            options={[
              { value: 'in', label: t('capital.in') },
              { value: 'out', label: t('capital.out') },
            ]}
          />
          <p className="text-xs text-ink-500">{c.kind === 'in' ? t('capital.inHint') : t('capital.outHint')}</p>
          <Field label={t('form.concept')} error={err('concept')}>
            <Input value={c.concept} onChange={(e) => set({ concept: e.target.value })} autoFocus />
          </Field>
          <Field label={t('form.date')} error={err('date')}>
            <Input type="date" value={c.date} onChange={(e) => set({ date: e.target.value })} />
          </Field>
          <Field label={t('form.amount')} error={err('amount')}>
            <div className="flex gap-2">
              <NumInput value={c.amount} onValue={(n) => set({ amount: n })} className="flex-1" />
              <CurrencySelect value={c.currency} onChange={(x) => set({ currency: x })} />
            </div>
          </Field>
          <Field label={t('form.notes')} optional>
            <TextArea value={c.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Field>
        </>
      )}
    </FormSheet>
  )
}

// ---------------------------------------------------------------------------

export function PensionForm({ pension, onClose }: { pension?: Pension; onClose: () => void }) {
  const { t } = useTranslation()
  const [p, setP] = useState({
    name: pension?.name ?? '',
    holder: pension?.holder ?? '',
    startMonth: pension?.startMonth ?? thisMonth(),
    amount: pension?.amount ?? (null as number | null),
    currency: pension?.currency ?? ('ARS' as Currency),
    confirmed: pension?.confirmed ?? false,
    aguinaldo: pension?.aguinaldo ?? true,
    notes: pension?.notes ?? '',
  })
  const set = (patch: Partial<typeof p>) => setP((x) => ({ ...x, ...patch }))
  return (
    <FormSheet
      title={pension ? t('pension.edit') : t('pension.new')}
      onClose={onClose}
      errors={{ name: p.name.trim() ? undefined : t('form.required'), startMonth: isMonth(p.startMonth) ? undefined : t('form.required') }}
      onSave={async () => {
        await save('pensions', { ...(pension ?? {}), ...p, name: p.name.trim(), holder: p.holder.trim() || undefined, amount: p.amount ? round2(p.amount) : null, notes: p.notes.trim() || undefined })
      }}
    >
      {(err) => (
        <>
          <Field label={t('pension.name')} error={err('name')}>
            <Input value={p.name} onChange={(e) => set({ name: e.target.value })} autoFocus />
          </Field>
          <Field label={t('pension.holder')} optional>
            <Input value={p.holder} onChange={(e) => set({ holder: e.target.value })} />
          </Field>
          <Field label={t('pension.startMonth')} error={err('startMonth')}>
            <MonthInput value={p.startMonth} onChange={(m) => set({ startMonth: m })} />
          </Field>
          <Field label={t('pension.amount')} hint={t('pension.amountHint')} optional>
            <div className="flex gap-2">
              <NumInput value={p.amount} onValue={(n) => set({ amount: n })} className="flex-1" />
              <CurrencySelect value={p.currency} onChange={(c) => set({ currency: c })} />
            </div>
          </Field>
          <Toggle checked={p.confirmed} onChange={(v) => set({ confirmed: v })} label={t('pension.confirmed')} hint={t('pension.confirmedHint')} />
          <Toggle checked={p.aguinaldo} onChange={(v) => set({ aguinaldo: v })} label={t('pension.aguinaldo')} hint={t('pension.aguinaldoHint')} />
          <Field label={t('form.notes')} optional>
            <TextArea value={p.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Field>
        </>
      )}
    </FormSheet>
  )
}

export function RateForm({ prefs, onClose }: { prefs: Prefs; onClose: () => void }) {
  const { t } = useTranslation()
  const [date, setDate] = useState(today())
  const [series, setSeries] = useState(prefs.fx.series)
  const [value, setValue] = useState<number | null>(null)
  return (
    <FormSheet
      title={t('fx.newRate')}
      onClose={onClose}
      errors={{ date: isDate(date) ? undefined : t('form.required'), value: positive(value) ? undefined : t('form.amountPositive'), series: series.trim() ? undefined : t('form.required') }}
      onSave={async () => {
        await putRaw('rates', { id: rateId(series.trim(), date), date, series: series.trim(), value: value!, source: 'manual' })
        await rememberInList('rateSeries', series)
      }}
    >
      {(err) => (
        <>
          <Field label={t('fx.series')} error={err('series')}>
            <Chips size="sm" value={series} onChange={setSeries} options={prefs.rateSeries.map((s) => ({ value: s, label: s }))} />
          </Field>
          <Field label={t('form.date')} error={err('date')}>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label={t('fx.value')} error={err('value')} hint={t('fx.valueHint')}>
            <NumInput value={value} onValue={setValue} autoFocus />
          </Field>
        </>
      )}
    </FormSheet>
  )
}

// ---------------------------------------------------------------------------

export function PropertySelect({ data, value, onChange, error }: { data: Data; value: string; onChange: (v: string) => void; error?: string }) {
  const { t } = useTranslation()
  return (
    <Field label={t('form.property')} error={error}>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t('form.choose')}</option>
        {data.properties
          .filter((p) => !p.archived || p.id === value)
          .map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
      </Select>
    </Field>
  )
}

function MethodSelect({ prefs, value, onChange }: { prefs: Prefs; value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation()
  return (
    <Field label={t('form.payMethod')} optional>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {[...new Set([...prefs.methods, value].filter(Boolean))].map((m) => (
          <option key={m}>{m}</option>
        ))}
      </Select>
    </Field>
  )
}
