import clsx from 'clsx'
import { AlertTriangle, BellRing, CalendarCheck, ExternalLink, Inbox, ListChecks } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { Model } from '../hooks/useData'
import { currentStatus, dueItems, pendingDeductions, suggestedRentPeriod, urgentItems, type Data, type DueItem } from '../lib/calc'
import { dateLabel, monthLabel, thisMonth, today } from '../lib/dates'
import { formatMoney, round2 } from '../lib/money'
import { apply, putOp } from '../lib/repo'
import type { Op } from '../lib/store/types'
import type { Currency, Recurring } from '../lib/types'
import { openEntry } from './entryStore'
import { BillForm } from './forms'
import { Amt } from './money'
import { toast } from './toast'
import { Badge, Button, Empty, NumInput, Sheet } from './ui'

export function useDue(model: Model | undefined): DueItem[] {
  return useMemo(() => (model ? dueItems(model.data) : []), [model])
}

/** Open the expense loader to pay one period of a service, with what's known proposed. */
export function payItem(it: DueItem) {
  const r = it.rec
  openEntry({
    type: 'expense',
    preset: {
      kind: 'fixed',
      propertyId: r.propertyId,
      recurringId: r.id,
      concept: r.concept,
      category: r.category ?? '',
      amount: it.bill?.amount ?? (r.amount || null),
      currency: it.bill?.currency ?? r.currency,
      method: r.method ?? '',
      period: it.period,
    },
  })
}

export function UrgencyBadge({ it }: { it: DueItem }) {
  const { t } = useTranslation()
  if (it.urgency === 'paid') return <Badge tone="good">{t('due.paid')}</Badge>
  if (it.urgency === 'overdue') return <Badge tone="bad">{it.days !== undefined ? t('due.overdueDays', { count: -it.days }) : t('due.overdue')}</Badge>
  if (it.urgency === 'today') return <Badge tone="bad">{t('due.today')}</Badge>
  if (it.urgency === 'soon') return <Badge tone="warn">{t('due.inDays', { count: it.days })}</Badge>
  return it.dueDate ? <Badge>{t('due.inDays', { count: it.days })}</Badge> : <Badge>{t('due.noDate')}</Badge>
}

function ReceivedBadge({ it }: { it: DueItem }) {
  const { t } = useTranslation()
  if (it.urgency === 'paid') return null
  return it.received ? <Badge tone="info">{t('due.received')}</Badge> : <Badge tone="neutral">{t('due.awaiting')}</Badge>
}

/** One row per service period: status, due date, amount, and the two actions. */
export function DueList({ items, data, showProperty = true, onBill }: { items: DueItem[]; data: Data; showProperty?: boolean; onBill: (it: DueItem) => void }) {
  const { t, i18n } = useTranslation()
  if (!items.length) return <Empty>{t('due.none')}</Empty>
  const prop = (id: string) => data.properties.find((p) => p.id === id)?.name ?? ''
  return (
    <ul className="divide-y divide-ink-100 text-sm dark:divide-ink-800">
      {items.map((it) => (
        <li key={it.key} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 py-2.5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <strong className="font-medium">{it.rec.concept}</strong>
              {showProperty && <span className="text-ink-500">· {prop(it.rec.propertyId)}</span>}
              <UrgencyBadge it={it} />
              <ReceivedBadge it={it} />
            </div>
            <div className="mt-0.5 text-xs text-ink-500">
              {monthLabel(it.period, i18n.language, 'short')}
              {it.dueDate && ` · ${t('due.dueOn', { date: dateLabel(it.dueDate, i18n.language) })}${it.estimated ? ` (${t('due.estimated')})` : ''}`}
              {it.rec.account && ` · ${t('svc.accountShort')} ${it.rec.account}`}
              {it.paid && ` · ${t('due.paidOn', { date: dateLabel(it.paid.date, i18n.language) })}`}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {it.paid ? (
              <Amt value={it.paid.amount} cur={it.paid.currency} className="font-medium" />
            ) : it.bill?.amount ? (
              <Amt value={it.bill.amount} cur={it.bill.currency} className="font-medium" />
            ) : it.refAmount ? (
              <span className="text-xs text-ink-500">
                {t('due.ref')} {formatMoney(it.refAmount, it.rec.currency, i18n.language)}
              </span>
            ) : null}
            {(it.rec.billUrl || it.rec.portalUrl) && !it.paid && (
              <a href={it.rec.billUrl || it.rec.portalUrl} target="_blank" rel="noreferrer" title={t('svc.openBill')} className="rounded-full p-1.5 text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800">
                <ExternalLink size={15} />
              </a>
            )}
            {!it.paid && (
              <Button size="sm" variant="ghost" onClick={() => onBill(it)}>
                {it.received ? t('due.editBill') : t('due.gotBill')}
              </Button>
            )}
            {!it.paid && (
              <Button size="sm" onClick={() => payItem(it)}>
                {t('todo.pay')}
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

/**
 * Top of the Tablero: what is overdue, due today or due within 3 days, impossible to miss.
 * (Reminders live here on purpose: no push notifications.)
 */
export function DueBanner({ model }: { model: Model }) {
  const { t, i18n } = useTranslation()
  const items = useDue(model)
  const [bill, setBill] = useState<DueItem | null>(null)
  const urgent = urgentItems(items)
  const awaiting = items.filter((i) => i.urgency !== 'paid' && !i.received && !urgent.includes(i))
  if (!model.data.recurring.length) return null
  const bad = urgent.some((i) => i.urgency === 'overdue' || i.urgency === 'today')
  const prop = (id: string) => model.data.properties.find((p) => p.id === id)?.name ?? ''
  if (!urgent.length)
    return (
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
        <CalendarCheck size={18} />
        <span className="font-medium">{t('due.bannerClear')}</span>
        {awaiting.length > 0 && (
          <Link to="/gastos" className="ml-auto underline">
            {t('due.awaitingCount', { count: awaiting.length })}
          </Link>
        )}
      </div>
    )
  return (
    <section
      aria-label={t('due.bannerTitle')}
      className={clsx(
        'mb-4 rounded-2xl border-2 px-4 py-3',
        bad ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40' : 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40',
      )}
    >
      <div className="mb-1 flex flex-wrap items-center gap-2">
        {bad ? <AlertTriangle size={20} className="text-red-600 dark:text-red-400" /> : <BellRing size={20} className="text-amber-600 dark:text-amber-400" />}
        <h2 className="text-base font-semibold">{t('due.bannerTitle')}</h2>
        <span className="text-sm text-ink-600 dark:text-ink-300">{t('due.bannerSub', { count: urgent.length })}</span>
      </div>
      <ul className="divide-y divide-black/5 text-sm dark:divide-white/10">
        {urgent.map((it) => (
          <li key={it.key} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 py-2">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <UrgencyBadge it={it} />
              <strong className="font-medium">{it.rec.concept}</strong>
              <span className="text-ink-600 dark:text-ink-300">· {prop(it.rec.propertyId)}</span>
              {it.dueDate && <span className="text-xs text-ink-500">· {dateLabel(it.dueDate, i18n.language)}</span>}
              {!it.received && <span className="text-xs text-ink-500">· {t('due.awaiting')}</span>}
            </div>
            <div className="flex items-center gap-2">
              {it.bill?.amount ? <Amt value={it.bill.amount} cur={it.bill.currency} className="font-semibold" /> : null}
              {!it.received && (
                <Button size="sm" variant="ghost" onClick={() => setBill(it)}>
                  {t('due.gotBill')}
                </Button>
              )}
              <Button size="sm" variant="primary" onClick={() => payItem(it)}>
                {t('todo.pay')}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {awaiting.length > 0 && (
        <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-600 dark:text-ink-300">
          <Inbox size={13} />
          <Link to="/gastos" className="underline">
            {t('due.awaitingCount', { count: awaiting.length })}
          </Link>
        </p>
      )}
      {bill && <BillForm data={model.data} rec={bill.rec} period={bill.period} bill={bill.bill} onClose={() => setBill(null)} />}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Carga del mes: last month's data proposed, nothing saved until she ticks and confirms.
// ---------------------------------------------------------------------------

interface QuickRow {
  key: string
  kind: 'rent' | 'service'
  label: string
  sub: string
  amount: number | null
  currency: Currency
  checked: boolean
  /** Rents with works to deduct need the full form. */
  blocked?: string
  propertyId: string
  period: string
  method?: string
  payer?: string
  fee?: number | null
  rec?: Recurring
}

function buildRows(model: Model, t: (k: string, o?: Record<string, unknown>) => string, lang: string): QuickRow[] {
  const { data } = model
  const m = thisMonth()
  const rows: QuickRow[] = []
  for (const p of data.properties) {
    if (p.archived || p.soldAt) continue
    const st = currentStatus(data, p)
    if (st && st !== 'rented') continue
    const past = data.incomes.filter((i) => i.source === 'rent' && i.propertyId === p.id).sort((a, b) => b.date.localeCompare(a.date))
    if (!past.length && !p.refRent) continue
    const period = suggestedRentPeriod(data, p.id, m)
    if (data.incomes.some((i) => i.source === 'rent' && i.propertyId === p.id && i.period === period)) continue
    const last = past[0]
    rows.push({
      key: `r-${p.id}`,
      kind: 'rent',
      label: p.name,
      sub: `${t('quick.rentFor', { month: monthLabel(period, lang) })}${last ? ` · ${t('quick.lastWas', { amount: formatMoney(last.amount, last.currency, lang), date: dateLabel(last.date, lang) })}` : ''}`,
      amount: last?.amount ?? p.refRent ?? null,
      currency: last?.currency ?? p.refRentCurrency,
      checked: false,
      blocked: pendingDeductions(data, p.id).length ? t('quick.hasDeductions') : undefined,
      propertyId: p.id,
      period,
      method: last?.method,
      payer: p.tenant ?? last?.payer,
      fee: last?.fee ?? null,
    })
  }
  for (const it of dueItems(data)) {
    if (it.urgency === 'paid' || it.period > m) continue
    const prop = data.properties.find((p) => p.id === it.rec.propertyId)?.name ?? ''
    rows.push({
      key: `s-${it.key}`,
      kind: 'service',
      label: `${it.rec.concept} · ${prop}`,
      sub: `${monthLabel(it.period, lang)}${it.received ? '' : ` · ${t('due.awaiting')}`}${it.rec.method ? ` · ${it.rec.method}` : ''}`,
      amount: it.bill?.amount ?? null,
      currency: it.bill?.currency ?? it.rec.currency,
      checked: false,
      propertyId: it.rec.propertyId,
      period: it.period,
      method: it.rec.method,
      rec: it.rec,
    })
  }
  return rows
}

export function QuickMonth({ model, onClose }: { model: Model; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const [rows, setRows] = useState<QuickRow[]>(() => buildRows(model, t, i18n.language))
  const [date, setDate] = useState(today())
  const [busy, setBusy] = useState(false)
  const set = (key: string, patch: Partial<QuickRow>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  const picked = rows.filter((r) => r.checked && !r.blocked && r.amount && r.amount > 0)
  const save = async () => {
    if (!picked.length || busy) return
    setBusy(true)
    try {
      const ops: Op[] = picked.map((r) =>
        r.kind === 'rent'
          ? putOp('incomes', { source: 'rent', date, period: r.period, propertyId: r.propertyId, payer: r.payer, amount: round2(r.amount!), currency: r.currency, method: r.method, fee: r.fee ?? undefined })
          : putOp('expenses', {
              kind: 'fixed',
              date,
              period: r.period,
              propertyId: r.propertyId,
              recurringId: r.rec!.id,
              concept: r.rec!.concept,
              category: r.rec!.category,
              amount: round2(r.amount!),
              currency: r.currency,
              method: r.method,
            }),
      )
      await apply(ops)
      toast(t('quick.saved', { count: ops.length }))
      onClose()
    } finally {
      setBusy(false)
    }
  }
  const group = (kind: QuickRow['kind']) => rows.filter((r) => r.kind === kind)
  return (
    <Sheet
      open
      wide
      onClose={onClose}
      title={t('quick.title')}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-sm">
            {t('quick.date')}
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-ink-200 bg-white px-2 py-1 dark:border-ink-700 dark:bg-ink-950" />
          </label>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={() => void save()} disabled={!picked.length || busy}>
              <ListChecks size={16} />
              {t('quick.confirm', { count: picked.length })}
            </Button>
          </div>
        </div>
      }
    >
      <p className="mb-3 text-sm text-ink-600 dark:text-ink-300">{t('quick.intro')}</p>
      {!rows.length && <Empty>{t('quick.nothing')}</Empty>}
      {(['rent', 'service'] as const).map((kind) =>
        group(kind).length ? (
          <div key={kind} className="mb-4">
            <div className="mb-1 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-ink-600 uppercase dark:text-ink-300">{t(kind === 'rent' ? 'quick.rents' : 'quick.services')}</h4>
              <button
                type="button"
                className="cursor-pointer text-xs text-brand-700 hover:underline dark:text-brand-300"
                onClick={() => setRows((rs) => rs.map((r) => (r.kind === kind && !r.blocked && r.amount ? { ...r, checked: true } : r)))}
              >
                {t('quick.checkAll')}
              </button>
            </div>
            <ul className="divide-y divide-ink-100 dark:divide-ink-800">
              {group(kind).map((r) => (
                <li key={r.key} className="flex flex-wrap items-center gap-3 py-2">
                  <input
                    type="checkbox"
                    aria-label={r.label}
                    className="h-5 w-5 accent-brand-600"
                    checked={r.checked}
                    disabled={!!r.blocked}
                    onChange={(e) => set(r.key, { checked: e.target.checked })}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{r.label}</div>
                    <div className="truncate text-xs text-ink-500">{r.blocked ?? r.sub}</div>
                  </div>
                  {r.blocked ? (
                    <Button size="sm" onClick={() => (onClose(), openEntry({ type: 'rent', preset: { propertyId: r.propertyId } }))}>
                      {t('quick.openFull')}
                    </Button>
                  ) : (
                    <div className="flex items-center gap-1">
                      <NumInput value={r.amount} onValue={(n) => set(r.key, { amount: n, checked: !!n })} className="w-36" placeholder={t('quick.amount')} />
                      <span className="w-9 text-xs text-ink-500">{r.currency}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null,
      )}
    </Sheet>
  )
}
