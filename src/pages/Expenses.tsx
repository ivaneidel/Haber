import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bars, C, ChartCard, type Row, type SeriesDef } from '../components/Charts'
import { openEntry } from '../components/entryStore'
import { PlanForm, RecurringForm } from '../components/forms'
import { Amt, FxCaption, Kpi, ViewSwitch } from '../components/money'
import { Button, Card, Empty, PageHeader, SectionTitle, Segmented, Select, Toggle } from '../components/ui'
import { useModel } from '../hooks/useData'
import { commitments, filterFlows, pendingCuotas, pendingRecurring, recurringMonthly, totals } from '../lib/calc'
import { monthLabel, thisMonth, today } from '../lib/dates'
import { formatMoney, makeLens, type Lens } from '../lib/money'
import type { Currency, Plan, Recurring } from '../lib/types'
import { MovementList, movementRows } from './Movements'
import { PlanList, RecurringList } from './PropertyDetail'

type Tab = 'fixed' | 'installment' | 'eventual'

export default function Expenses() {
  const { t, i18n } = useTranslation()
  const model = useModel()
  const [tab, setTab] = useState<Tab>('fixed')
  const [rec, setRec] = useState<Recurring | 'new' | null>(null)
  const [plan, setPlan] = useState<Plan | 'new' | null>(null)
  const [includeFixed, setIncludeFixed] = useState(true)
  const [splitCur, setSplitCur] = useState<Currency>('ARS')
  const [propertyId, setPropertyId] = useState('')
  if (!model) return null
  const { data, flows, lenses, prefs } = model
  const year = today().slice(0, 4)
  const m = thisMonth()
  const yf = filterFlows(flows, { from: `${year}-01`, to: `${year}-12`, propertyId: propertyId || undefined })
  const prop = (id: string) => data.properties.find((p) => p.id === id)?.name ?? ''
  const byProp = <T extends { propertyId: string }>(xs: T[]) => (propertyId ? xs.filter((x) => x.propertyId === propertyId) : xs)

  const fixedDue = byProp(pendingRecurring(data, m))
  const cuotasDue = pendingCuotas(data, m).filter((c) => !propertyId || c.plan.propertyId === propertyId)

  // Future obligations (next 12 months).
  const chartLens: Lens = lenses.length === 1 ? lenses[0] : makeLens(splitCur, false, model.book, prefs.fx)
  const scopedData = propertyId ? { ...data, plans: byProp(data.plans), recurring: byProp(data.recurring) } : data
  const com = commitments(scopedData, m, 12, chartLens, includeFixed)
  const comRows: Row[] = com.map((c) => ({ label: monthLabel(c.month, i18n.language, 'short'), installment: c.installment, fixed: c.fixed }))
  const comSeries: SeriesDef[] = [{ key: 'installment', label: t('kind.installment'), color: C.installment }, ...(includeFixed ? [{ key: 'fixed', label: t('kind.fixed'), color: C.fixed }] : [])]
  const fmt = (n: number) => formatMoney(n, chartLens.target, i18n.language)
  const comTotal = com.reduce((s, c) => s + c.installment + c.fixed, 0)
  const monthlyFixed = (l: Lens) => byProp(data.recurring).filter((r) => r.active).reduce((s, r) => s + l(recurringMonthly(r), r.currency, today()), 0)

  return (
    <>
      <PageHeader
        title={t('nav.expenses')}
        subtitle={t('exp.subtitle')}
        actions={
          <>
            <ViewSwitch model={model} />
            <Button variant="primary" onClick={() => openEntry({ type: 'expense', preset: propertyId ? { propertyId } : undefined })}>
              <Plus size={16} />
              {t('exp.record')}
            </Button>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} className="w-56" aria-label={t('form.property')}>
          <option value="">{t('dash.allProperties')}</option>
          {data.properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <FxCaption model={model} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label={t('exp.fixedYear', { year })} color={C.fixed} lenses={lenses} get={(l) => totals(yf, l).fixed} />
        <Kpi label={t('exp.installmentYear', { year })} color={C.installment} lenses={lenses} get={(l) => totals(yf, l).installment} />
        <Kpi label={t('exp.eventualYear', { year })} color={C.eventual} lenses={lenses} get={(l) => totals(yf, l).eventual} />
        <Kpi label={t('exp.fixedMonthly')} lenses={lenses} get={monthlyFixed} sub={t('exp.fixedMonthlySub')} />
      </div>

      <Card className="mt-4">
        <SectionTitle>{t('exp.dueNow', { month: monthLabel(m, i18n.language) })}</SectionTitle>
        {fixedDue.length + cuotasDue.length === 0 ? (
          <Empty>{t('exp.nothingDue')}</Empty>
        ) : (
          <ul className="divide-y divide-ink-100 text-sm dark:divide-ink-800">
            {fixedDue.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <strong className="font-medium">{r.concept}</strong> · <span className="text-ink-500">{prop(r.propertyId)}</span> · <Amt value={r.amount} cur={r.currency} />
                </span>
                <Button
                  size="sm"
                  onClick={() =>
                    openEntry({ type: 'expense', preset: { kind: 'fixed', propertyId: r.propertyId, recurringId: r.id, concept: r.concept, category: r.category ?? '', amount: r.amount, currency: r.currency, method: r.method ?? '', period: m } })
                  }
                >
                  {t('todo.pay')}
                </Button>
              </li>
            ))}
            {cuotasDue.map(({ plan: p, cuota }) => (
              <li key={`${p.id}-${cuota.no}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <strong className="font-medium">{p.concept}</strong> · {t('plan.cuotaOf', { no: cuota.no, count: p.count })} · <span className="text-ink-500">{prop(p.propertyId)}</span> ·{' '}
                  <Amt value={cuota.amount} cur={p.currency} />
                  {cuota.month < m && <span className="ml-2 text-xs text-amber-700 dark:text-amber-300">{t('todo.overdue', { month: monthLabel(cuota.month, i18n.language, 'short') })}</span>}
                </span>
                <Button
                  size="sm"
                  onClick={() =>
                    openEntry({
                      type: 'expense',
                      preset: { kind: 'installment', propertyId: p.propertyId, planId: p.id, installmentNo: cuota.no, concept: p.concept, category: p.category ?? '', amount: cuota.amount, currency: p.currency, method: p.method ?? '', period: cuota.month },
                    })
                  }
                >
                  {t('todo.payCuota')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="mt-6 mb-3">
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'fixed', label: t('kind.fixed') },
            { value: 'installment', label: t('kind.installment') },
            { value: 'eventual', label: t('kind.eventual') },
          ]}
        />
      </div>

      {tab === 'fixed' && (
        <Card>
          <SectionTitle
            action={
              <Button size="sm" onClick={() => setRec('new')} disabled={!data.properties.length}>
                <Plus size={14} />
                {t('fixed.new')}
              </Button>
            }
          >
            {t('exp.fixedTitle')}
          </SectionTitle>
          <p className="mb-2 text-sm text-ink-500">{t('exp.fixedExplain')}</p>
          <RecurringList recs={byProp(data.recurring)} onEdit={setRec} showProperty />
        </Card>
      )}

      {tab === 'installment' && (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <SectionTitle
              action={
                <Button size="sm" onClick={() => setPlan('new')} disabled={!data.properties.length}>
                  <Plus size={14} />
                  {t('plan.new')}
                </Button>
              }
            >
              {t('exp.plansTitle')}
            </SectionTitle>
            <PlanList plans={byProp(data.plans)} onEdit={setPlan} showProperty />
          </Card>
          <ChartCard
            title={t('exp.commitments')}
            subtitle={t('exp.commitmentsSub', { total: fmt(comTotal) })}
            rows={comRows}
            series={comSeries}
            fmt={fmt}
            action={
              lenses.length > 1 ? <Segmented<Currency> value={splitCur} onChange={setSplitCur} options={[{ value: 'ARS', label: 'ARS' }, { value: 'USD', label: 'USD' }]} /> : undefined
            }
          >
            <Bars rows={comRows} series={comSeries} cur={chartLens.target} totalLabel={t('common.total')} />
            <div className="mt-3">
              <Toggle checked={includeFixed} onChange={setIncludeFixed} label={t('exp.includeFixed')} hint={t('exp.includeFixedHint')} />
            </div>
          </ChartCard>
        </div>
      )}

      {tab === 'eventual' && (
        <Card>
          <SectionTitle
            action={
              <Button size="sm" onClick={() => openEntry({ type: 'expense', preset: { kind: 'eventual', ...(propertyId ? { propertyId } : {}) } })}>
                <Plus size={14} />
                {t('exp.newEventual')}
              </Button>
            }
          >
            {t('exp.eventualTitle')}
          </SectionTitle>
          <MovementList
            rows={movementRows(data, t).filter((r) => r.rec.table === 'expenses' && r.rec.row.kind === 'eventual' && (!propertyId || r.propertyId === propertyId))}
          />
        </Card>
      )}

      {rec && <RecurringForm data={data} prefs={prefs} rec={rec === 'new' ? undefined : rec} propertyId={propertyId || undefined} onClose={() => setRec(null)} />}
      {plan && <PlanForm data={data} prefs={prefs} plan={plan === 'new' ? undefined : plan} propertyId={propertyId || undefined} onClose={() => setPlan(null)} />}
    </>
  )
}
