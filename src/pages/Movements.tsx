import clsx from 'clsx'
import { Copy, Download, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { openEntry, type EntryRecord, type EntryType } from '../components/entryStore'
import { Amt, CurBadge } from '../components/money'
import { toast } from '../components/toast'
import { Badge, Button, Card, Empty, IconButton, Input, PageHeader, Select, confirmAction } from '../components/ui'
import { useModel } from '../hooks/useData'
import { dateLabel, monthLabel, monthOf, today, yearMonths } from '../lib/dates'
import { remove } from '../lib/repo'
import { exportXLSX } from '../lib/export'
import { formatMoney } from '../lib/money'
import i18next from 'i18next'
import { rentBreakdown, type Data } from '../lib/calc'
import { isOwnExpense } from '../lib/types'
import type { Currency } from '../lib/types'

export interface MoveRow {
  key: string
  rec: EntryRecord
  type: EntryType
  date: string
  period?: string
  propertyId?: string
  title: string
  sub: string
  amount: number
  currency: Currency
  method?: string
  notes?: string
}

export function movementRows(d: Data, t: (k: string, o?: Record<string, unknown>) => string): MoveRow[] {
  const prop = (id?: string) => d.properties.find((p) => p.id === id)?.name ?? ''
  const out: MoveRow[] = []
  for (const i of d.incomes) {
    const type: EntryType = i.source === 'rent' ? 'rent' : i.source === 'pension' ? 'pension' : 'other'
    out.push({
      key: `i-${i.id}`,
      rec: { table: 'incomes', row: i },
      type,
      date: i.date,
      period: i.period,
      propertyId: i.propertyId,
      title: type === 'rent' ? prop(i.propertyId) : type === 'pension' ? (d.pensions.find((p) => p.id === i.pensionId)?.name ?? t('entry.pension')) : (i.description ?? ''),
      sub:
        type === 'rent'
          ? [
              i.payer,
              (() => {
                const b = rentBreakdown(d, i.id)
                return b && b.gross !== b.net ? t('mov.rentGross', { gross: formatMoney(b.gross, i.currency, i18next.language), fee: formatMoney(b.fee, i.currency, i18next.language), count: b.deductions.length }) : ''
              })(),
            ]
              .filter(Boolean)
              .join(' · ')
          : '',
      amount: i.amount,
      currency: i.currency,
      method: i.method,
      notes: i.notes,
    })
  }
  for (const e of d.expenses)
    out.push({
      key: `e-${e.id}`,
      rec: { table: 'expenses', row: e },
      type: 'expense',
      date: e.date,
      period: e.kind === 'fixed' ? e.period : undefined,
      propertyId: e.propertyId,
      title: e.kind === 'installment' && e.installmentNo ? `${e.concept} · ${t('plan.cuotaN', { no: e.installmentNo })}` : e.concept,
      sub: [
        prop(e.propertyId),
        t(`kind.${e.kind}`),
        e.category && e.category !== e.concept ? e.category : '',
        e.materials ? `${t('work.materials')} ${formatMoney(e.materials, e.currency, i18next.language)}` : '',
        e.labor ? `${t('work.labor')} ${formatMoney(e.labor, e.currency, i18next.language)}` : '',
        e.otherCosts ? `${t('work.other')} ${formatMoney(e.otherCosts, e.currency, i18next.language)}` : '',
        e.managedBy ? t('work.managedShort', { who: e.managedBy }) : '',
        e.paidBy && e.paidBy !== 'me' ? `${t('work.paidShort', { who: t(`work.by_${e.paidBy}`) })} · ${e.deducted ? (e.incomeId ? t('work.deductedDone') : t('work.deductedPending')) : t('work.notOwnShort')}` : '',
      ]
        .filter(Boolean)
        .join(' · '),
      amount: isOwnExpense(e) ? -e.amount : 0,
      currency: e.currency,
      method: e.method,
      notes: e.notes,
    })
  for (const s of d.sales)
    out.push({
      key: `s-${s.id}`,
      rec: { table: 'sales', row: s },
      type: 'sale',
      date: s.date,
      title: s.description,
      sub: `${s.channel}${s.fees ? ` · ${t('mov.grossFees', { gross: formatMoney(s.gross, s.currency, i18next.language), fees: formatMoney(s.fees, s.currency, i18next.language) })}` : ''}`,
      amount: s.net,
      currency: s.currency,
      method: s.method,
      notes: s.notes,
    })
  for (const y of d.yields)
    out.push({
      key: `y-${y.id}`,
      rec: { table: 'yields', row: y },
      type: 'yield',
      date: y.date,
      title: d.investments.find((i) => i.id === y.investmentId)?.name ?? '',
      sub: y.toCapital ? t('mov.reinvested') : '',
      amount: y.amount,
      currency: y.currency,
      notes: y.notes,
    })
  return out.sort((a, b) => b.date.localeCompare(a.date) || b.rec.row.createdAt.localeCompare(a.rec.row.createdAt))
}

const TYPE_TONE: Record<EntryType, 'info' | 'bad' | 'warn' | 'good' | 'neutral' | 'est'> = {
  rent: 'info',
  expense: 'bad',
  sale: 'warn',
  yield: 'good',
  pension: 'neutral',
  other: 'neutral',
}

export async function deleteMovement(r: MoveRow, msg: string, done: string) {
  if (!confirmAction(msg)) return
  await remove(r.rec.table, r.rec.row.id)
  toast(done)
}

export function MovementList({ rows, showProperty = true }: { rows: MoveRow[]; showProperty?: boolean }) {
  const { t, i18n } = useTranslation()
  const actions = (r: MoveRow) => (
    <div className="flex justify-end">
      <IconButton label={t('common.edit')} onClick={() => openEntry({ edit: r.rec })}>
        <Pencil size={16} />
      </IconButton>
      <IconButton label={t('mov.duplicate')} onClick={() => openEntry({ duplicate: r.rec })}>
        <Copy size={16} />
      </IconButton>
      <IconButton label={t('common.delete')} onClick={() => void deleteMovement(r, t('mov.deleteConfirm'), t('common.deleted'))}>
        <Trash2 size={16} />
      </IconButton>
    </div>
  )
  if (!rows.length) return <Empty>{t('mov.none')}</Empty>
  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block">
        <table className="w-full border-collapse text-sm">
          <thead className="text-left text-xs text-ink-500 dark:text-ink-400">
            <tr>
              <th className="py-2 pr-2 font-medium">{t('mov.date')}</th>
              <th className="px-2 py-2 font-medium">{t('mov.type')}</th>
              <th className="px-2 py-2 font-medium">{t('mov.detail')}</th>
              <th className="px-2 py-2 font-medium">{t('mov.period')}</th>
              <th className="px-2 py-2 text-right font-medium">{t('form.amount')}</th>
              <th className="px-2 py-2 font-medium">{t('xl.method')}</th>
              <th className="w-28" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="group border-t border-ink-100 hover:bg-ink-50 dark:border-ink-800 dark:hover:bg-ink-800/40">
                <td className="py-1.5 pr-2 whitespace-nowrap tnum">{dateLabel(r.date, i18n.language)}</td>
                <td className="px-2 py-1.5">
                  <Badge tone={TYPE_TONE[r.type]}>{t(`entry.${r.type}`)}</Badge>
                </td>
                <td className="max-w-80 px-2 py-1.5">
                  <div className="truncate font-medium">{r.title}</div>
                  {(r.sub || r.notes) && (
                    <div className="truncate text-xs text-ink-500 dark:text-ink-400">
                      {showProperty || r.type !== 'rent' ? r.sub : ''}
                      {r.notes && <span className="italic">{r.sub ? ' · ' : ''}{r.notes}</span>}
                    </div>
                  )}
                </td>
                <td className="px-2 py-1.5 whitespace-nowrap text-ink-600 dark:text-ink-300">
                  {r.period && r.period !== monthOf(r.date) ? (
                    <span className="font-medium text-amber-700 dark:text-amber-300">{monthLabel(r.period, i18n.language, 'short')}</span>
                  ) : r.period ? (
                    monthLabel(r.period, i18n.language, 'short')
                  ) : (
                    ''
                  )}
                </td>
                <td className="px-2 py-1.5 text-right">
                  <span className="inline-flex items-center gap-1.5">
                    <Amt value={r.amount} cur={r.currency} tone sign={r.amount < 0} className="font-medium" />
                    <CurBadge cur={r.currency} />
                  </span>
                </td>
                <td className="px-2 py-1.5 text-ink-600 dark:text-ink-300">{r.method}</td>
                <td className="py-0.5 opacity-60 group-hover:opacity-100">{actions(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Phone list */}
      <ul className="divide-y divide-ink-100 md:hidden dark:divide-ink-800">
        {rows.map((r) => (
          <li key={r.key} className="py-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs text-ink-500">
                  <Badge tone={TYPE_TONE[r.type]}>{t(`entry.${r.type}`)}</Badge>
                  {dateLabel(r.date, i18n.language)}
                  {r.period && r.period !== monthOf(r.date) && <span className="text-amber-700 dark:text-amber-300">→ {monthLabel(r.period, i18n.language, 'short')}</span>}
                </div>
                <div className="mt-0.5 truncate font-medium">{r.title}</div>
                {r.sub && <div className="truncate text-xs text-ink-500">{r.sub}</div>}
              </div>
              <Amt value={r.amount} cur={r.currency} tone sign={r.amount < 0} className="font-semibold" />
            </div>
            <div className="-mr-2 mt-1">{actions(r)}</div>
          </li>
        ))}
      </ul>
    </>
  )
}

export default function Movements() {
  const { t, i18n } = useTranslation()
  const model = useModel()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const type = (params.get('tipo') ?? '') as EntryType | ''
  const propertyId = params.get('propiedad') ?? ''
  const year = params.get('anio') ?? ''
  const month = params.get('mes') ?? ''
  const cur = (params.get('moneda') ?? '') as Currency | ''
  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    if (k === 'anio' && !v) next.delete('mes')
    setParams(next, { replace: true })
  }

  const all = useMemo(() => (model ? movementRows(model.data, t) : []), [model, t])
  if (!model) return null
  const years = [...new Set(all.map((r) => r.date.slice(0, 4)))].sort().reverse()
  const needle = q.trim().toLowerCase()
  const rows = all.filter((r) => {
    if (type && r.type !== type) return false
    if (propertyId && r.propertyId !== propertyId) return false
    if (year && !r.date.startsWith(year)) return false
    if (month && r.date.slice(5, 7) !== month) return false
    if (cur && r.currency !== cur) return false
    if (needle) {
      const hay = `${r.title} ${r.sub} ${r.notes ?? ''} ${r.method ?? ''} ${r.amount}`.toLowerCase()
      if (!hay.includes(needle)) return false
    }
    return true
  })
  const sums = (['ARS', 'USD'] as Currency[]).map((c) => ({
    c,
    inc: rows.filter((r) => r.currency === c && r.amount > 0).reduce((s, r) => s + r.amount, 0),
    exp: rows.filter((r) => r.currency === c && r.amount < 0).reduce((s, r) => s + r.amount, 0),
  }))
  const filtered = !!(type || propertyId || year || month || cur || needle)

  return (
    <>
      <PageHeader
        title={t('nav.movements')}
        subtitle={t('mov.subtitle')}
        actions={
          <>
            <Button onClick={() => void exportXLSX(model.data, model.prefs.fx, t)}>
              <Download size={16} />
              {t('settings.exportExcel')}
            </Button>
            <Button variant="primary" onClick={() => openEntry({ type: type || undefined, preset: propertyId ? { propertyId } : undefined })}>
              <Plus size={16} />
              {t('entry.newTitle')}
            </Button>
          </>
        }
      />
      <Card>
        <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
          <div className="relative sm:col-span-2">
            <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('mov.search')} className="pl-9" />
          </div>
          <Select value={type} onChange={(e) => setParam('tipo', e.target.value)} aria-label={t('mov.type')}>
            <option value="">{t('mov.allTypes')}</option>
            {(['rent', 'expense', 'sale', 'yield', 'pension', 'other'] as EntryType[]).map((x) => (
              <option key={x} value={x}>
                {t(`entry.${x}`)}
              </option>
            ))}
          </Select>
          <Select value={propertyId} onChange={(e) => setParam('propiedad', e.target.value)} aria-label={t('form.property')}>
            <option value="">{t('dash.allProperties')}</option>
            {model.data.properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <div className="flex gap-2 lg:col-span-2">
            <Select value={year} onChange={(e) => setParam('anio', e.target.value)} aria-label={t('common.year')}>
              <option value="">{t('mov.allYears')}</option>
              {years.map((y) => (
                <option key={y}>{y}</option>
              ))}
            </Select>
            <Select value={month} onChange={(e) => setParam('mes', e.target.value)} disabled={!year} aria-label={t('common.month')}>
              <option value="">{t('mov.allMonths')}</option>
              {yearMonths(Number(year || today().slice(0, 4))).map((m) => (
                <option key={m} value={m.slice(5)}>
                  {monthLabel(m, i18n.language, 'short', false)}
                </option>
              ))}
            </Select>
          </div>
          <Select value={cur} onChange={(e) => setParam('moneda', e.target.value)} aria-label={t('form.currency')}>
            <option value="">{t('mov.allCurrencies')}</option>
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
          </Select>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl bg-ink-50 px-3 py-2 text-sm dark:bg-ink-800/50">
          <span className="text-ink-500">{t('mov.count', { count: rows.length })}</span>
          {sums
            .filter((s) => s.inc || s.exp)
            .map((s) => (
              <span key={s.c} className="flex flex-wrap gap-x-3">
                <span>
                  {t('mov.in')}: <Amt value={s.inc} cur={s.c} className="font-medium text-pos" />
                </span>
                <span>
                  {t('mov.out')}: <Amt value={-s.exp} cur={s.c} className="font-medium text-neg" />
                </span>
              </span>
            ))}
          {filtered && (
            <button
              className={clsx('ml-auto cursor-pointer text-sm text-brand-700 hover:underline dark:text-brand-300')}
              onClick={() => {
                setQ('')
                setParams(new URLSearchParams(), { replace: true })
              }}
            >
              {t('mov.clearFilters')}
            </button>
          )}
        </div>
        <MovementList rows={rows} />
      </Card>
    </>
  )
}
