import { AlertCircle, Building2, CalendarClock, CheckCircle2, Landmark, PiggyBank, Receipt, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Bars, C, ChartCard, Lines, useMoneyFmt, type Row, type SeriesDef } from '../components/Charts'
import { openEntry } from '../components/entryStore'
import { Amt, FxCaption, Kpi, Multi, ViewSwitch } from '../components/money'
import { Button, Card, PageHeader, Segmented, Select } from '../components/ui'
import { useModel, type Model } from '../hooks/useData'
import {
  capitalSummary,
  dataYears,
  filterFlows,
  monthlyTotals,
  pendingCuotas,
  pendingRecurring,
  rentsWithoutRecord,
  totals,
  upcomingMaturities,
  yearlyTotals,
  type Totals,
} from '../lib/calc'
import { dateLabel, monthLabel, thisMonth, today, yearMonths } from '../lib/dates'
import type { Lens } from '../lib/money'
import type { Currency } from '../lib/types'

export default function Dashboard() {
  const model = useModel()
  if (!model) return null
  return <DashboardBody model={model} />
}

function DashboardBody({ model }: { model: Model }) {
  const { t, i18n } = useTranslation()
  const { data, flows, lenses } = model
  const nowYear = Number(today().slice(0, 4))
  const [year, setYear] = useState(nowYear)
  const [month, setMonth] = useState<string>(thisMonth().slice(5)) // '' = whole year
  const [propertyId, setPropertyId] = useState('')
  const years = dataYears(data, nowYear)
  const period = month ? `${year}-${month}` : null
  const from = period ?? `${year}-01`
  const to = period ?? `${year}-12`

  const scoped = useMemo(() => (propertyId ? flows.filter((f) => f.propertyId === propertyId) : flows), [flows, propertyId])
  const tot = (l: Lens, f: string, tt: string) => totals(filterFlows(scoped, { from: f, to: tt }), l)
  const per = (l: Lens) => tot(l, from, to)
  const ytd = (l: Lens) => tot(l, `${year}-01`, period ?? `${year}-12`)

  const empty = data.properties.length === 0 && flows.length === 0 && data.investments.length === 0

  return (
    <>
      <PageHeader
        title={t('nav.dashboard')}
        subtitle={period ? monthLabel(period, i18n.language) : t('dash.wholeYear', { year })}
        actions={<ViewSwitch model={model} />}
      />

      {empty && <Welcome />}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-28" aria-label={t('common.year')}>
          {years.map((y) => (
            <option key={y}>{y}</option>
          ))}
        </Select>
        <Select value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" aria-label={t('common.month')}>
          <option value="">{t('dash.allYear')}</option>
          {yearMonths(year).map((m) => (
            <option key={m} value={m.slice(5)}>
              {monthLabel(m, i18n.language, 'long', false)}
            </option>
          ))}
        </Select>
        <Select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} className="w-56" aria-label={t('form.property')}>
          <option value="">{t('dash.allProperties')}</option>
          {data.properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>
      <FxCaption model={model} className="-mt-2 mb-4" />

      {!propertyId && <Todo model={model} />}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label={period ? t('dash.incomeMonth') : t('dash.incomeYear')}
          icon={<Wallet size={14} />}
          lenses={lenses}
          get={(l) => per(l).income}
          to="/movimientos"
        />
        {period && <Kpi label={t('dash.incomeYtd', { year })} icon={<Wallet size={14} />} lenses={lenses} get={(l) => ytd(l).income} />}
        <Kpi label={t('dash.propExpenses')} icon={<Receipt size={14} />} lenses={lenses} get={(l) => per(l).expense} to="/gastos" />
        <Kpi label={t('dash.realEstateNet')} icon={<Building2 size={14} />} lenses={lenses} get={(l) => per(l).realEstateNet} tone sub={t('dash.realEstateNetSub')} />
        {!propertyId && (
          <>
            <Kpi label={t('dash.yields')} icon={<PiggyBank size={14} />} lenses={lenses} get={(l) => per(l).yield} to="/inversiones" />
            <Kpi label={t('dash.otherIncome')} lenses={lenses} get={(l) => per(l).sale + per(l).other} sub={t('dash.otherIncomeSub')} />
            <Kpi label={t('dash.capitalAvailable')} icon={<Landmark size={14} />} lenses={lenses} get={(l) => capitalNow(model, l, 'available')} sub={t('dash.today')} to="/patrimonio" />
            <Kpi label={t('dash.capitalInvested')} icon={<PiggyBank size={14} />} lenses={lenses} get={(l) => capitalNow(model, l, 'placed')} sub={t('dash.today')} to="/inversiones" />
          </>
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Breakdown
          title={t('dash.incomeBreakdown')}
          lenses={lenses}
          get={per}
          items={[
            { key: 'rent', label: t('src.rent'), color: C.rent },
            ...(!propertyId
              ? [
                  { key: 'yield' as const, label: t('src.yield'), color: C.yield },
                  { key: 'sale' as const, label: t('src.sale'), color: C.sale },
                  { key: 'pension' as const, label: t('src.pension'), color: C.pension },
                  { key: 'other' as const, label: t('src.other'), color: C.other },
                ]
              : []),
          ]}
          total="income"
        />
        <Breakdown
          title={t('dash.expenseBreakdown')}
          lenses={lenses}
          get={per}
          items={[
            { key: 'fixed', label: t('kind.fixed'), color: C.fixed },
            { key: 'installment', label: t('kind.installment'), color: C.installment },
            { key: 'eventual', label: t('kind.eventual'), color: C.eventual },
          ]}
          total="expense"
        />
      </div>

      <ChartsBlock model={model} year={year} flows={scoped} years={years} propertyScoped={!!propertyId} />
    </>
  )
}

function capitalNow(model: Model, l: Lens, k: 'available' | 'placed') {
  let s = 0
  for (const cur of ['ARS', 'USD'] as Currency[]) s += l(capitalSummary(model.data, cur)[k], cur, today())
  return s
}

function Breakdown({
  title,
  lenses,
  get,
  items,
  total,
}: {
  title: string
  lenses: Lens[]
  get: (l: Lens) => Totals
  items: { key: keyof Totals; label: string; color: string }[]
  total: keyof Totals
}) {
  const { t } = useTranslation()
  const main = lenses[0]
  const tm = get(main)
  return (
    <Card>
      <h3 className="mb-3 font-semibold">{title}</h3>
      <div className="space-y-2">
        {items.map((it) => {
          const share = tm[total] ? (tm[it.key] / tm[total]) * 100 : 0
          return (
            <div key={it.key}>
              <div className="flex items-start justify-between gap-3 text-sm">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: it.color }} />
                  {it.label}
                </span>
                <Multi lenses={lenses} get={(l) => get(l)[it.key]} size="sm" className="items-end" />
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
                <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, share))}%`, background: it.color }} />
              </div>
            </div>
          )
        })}
        <div className="flex items-start justify-between border-t border-ink-100 pt-2 text-sm font-semibold dark:border-ink-800">
          <span>{t('common.total')}</span>
          <Multi lenses={lenses} get={(l) => get(l)[total]} size="sm" className="items-end font-semibold" />
        </div>
      </div>
      {lenses.length > 1 && <p className="mt-2 text-xs text-ink-500">{t('dash.barsShareNote', { cur: main.target })}</p>}
    </Card>
  )
}

function ChartsBlock({ model, year, flows, years, propertyScoped }: { model: Model; year: number; flows: Model['flows']; years: number[]; propertyScoped: boolean }) {
  const { t, i18n } = useTranslation()
  const consolidated = model.lenses.length === 1
  const [splitCur, setSplitCur] = useState<Currency>('ARS')
  const lens = consolidated ? model.lenses[0] : model.lenses.find((l) => l.target === splitCur)!
  const cur = lens.target
  const f = useMoneyFmt(cur)
  const months = yearMonths(year)
  const mt = monthlyTotals(flows, lens, months)
  const prev = monthlyTotals(flows, lens, yearMonths(year - 1))
  const yt = yearlyTotals(flows, lens, years)
  const ml = (m: string) => monthLabel(m, i18n.language, 'short', false)

  const incomeSeries: SeriesDef[] = [
    { key: 'rent', label: t('src.rent'), color: C.rent },
    ...(!propertyScoped
      ? [
          { key: 'sale', label: t('src.sale'), color: C.sale },
          { key: 'yield', label: t('src.yield'), color: C.yield },
          { key: 'pension', label: t('src.pension'), color: C.pension },
          { key: 'other', label: t('src.other'), color: C.other },
        ]
      : []),
  ]
  const expenseSeries: SeriesDef[] = [
    { key: 'fixed', label: t('kind.fixed'), color: C.fixed },
    { key: 'installment', label: t('kind.installment'), color: C.installment },
    { key: 'eventual', label: t('kind.eventual'), color: C.eventual },
  ]
  const toRow = (x: Totals, label: string): Row => ({ label, ...(x as unknown as Record<string, number>) })
  // Months that haven't happened yet are blank, not zero.
  const incomeRows = mt.map((x) => (x.month > thisMonth() ? { label: ml(x.month) } : toRow(x, ml(x.month))))
  const yearRows = yt.map((x) => toRow(x, String(x.year)))
  const netSeries: SeriesDef[] = [
    { key: 'rent', label: t('src.rent'), color: C.rent },
    { key: 'expense', label: t('dash.propExpenses'), color: C.eventual, dashed: true },
    { key: 'realEstateNet', label: t('dash.realEstateNet'), color: C.net },
  ]
  const cmpKey = propertyScoped ? 'realEstateNet' : 'income'
  const cmpRows: Row[] = months.map((m, i) => ({ label: ml(m), cur: m > thisMonth() ? null : mt[i][cmpKey], prev: prev[i][cmpKey] }))
  const cmpSeries: SeriesDef[] = [
    { key: 'prev', label: String(year - 1), color: C.prev },
    { key: 'cur', label: String(year), color: C.rent },
  ]

  return (
    <section className="mt-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-wide text-ink-600 uppercase dark:text-ink-300">{t('dash.evolution')}</h2>
        {!consolidated && (
          <Segmented<Currency>
            value={splitCur}
            onChange={setSplitCur}
            label={t('dash.chartCurrency')}
            options={[
              { value: 'ARS', label: t('dash.onlyARS') },
              { value: 'USD', label: t('dash.onlyUSD') },
            ]}
          />
        )}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title={t('dash.monthlyIncome', { year })} subtitle={cur} rows={incomeRows} series={incomeSeries} fmt={f.full}>
          <Bars rows={incomeRows} series={incomeSeries} cur={cur} totalLabel={t('common.total')} />
        </ChartCard>
        <ChartCard title={t('dash.monthlyExpenses', { year })} subtitle={cur} rows={incomeRows} series={expenseSeries} fmt={f.full}>
          <Bars rows={incomeRows} series={expenseSeries} cur={cur} totalLabel={t('common.total')} />
        </ChartCard>
        <ChartCard title={t('dash.netChart', { year })} subtitle={t('dash.netChartSub')} rows={incomeRows} series={netSeries} fmt={f.full}>
          <Lines rows={incomeRows} series={netSeries} fmt={f.full} fmtAxis={f.compact} />
        </ChartCard>
        <ChartCard
          title={propertyScoped ? t('dash.compareNet') : t('dash.compareIncome')}
          subtitle={t('dash.compareSub', { a: year - 1, b: year })}
          rows={cmpRows}
          series={cmpSeries}
          fmt={f.full}
        >
          <Bars rows={cmpRows} series={cmpSeries} cur={cur} stacked={false} />
        </ChartCard>
        <ChartCard title={t('dash.yearlyIncome')} subtitle={cur} rows={yearRows} series={incomeSeries} fmt={f.full} className="xl:col-span-2">
          <Bars rows={yearRows} series={incomeSeries} cur={cur} totalLabel={t('common.total')} height={240} />
        </ChartCard>
      </div>
      {!consolidated && <p className="mt-2 text-xs text-ink-500">{t('dash.splitChartNote')}</p>}
    </section>
  )
}

/** What's due this month: the quickest way to load the few movements a month brings. */
function Todo({ model }: { model: Model }) {
  const { t, i18n } = useTranslation()
  const { data } = model
  const m = thisMonth()
  const fixed = pendingRecurring(data, m)
  const cuotas = pendingCuotas(data, m)
  const rents = rentsWithoutRecord(data, m)
  const soon = upcomingMaturities(data).filter((i) => i.maturityDate! <= addDays(today(), 15))
  const items = fixed.length + cuotas.length + rents.length + soon.length
  const prop = (id: string) => data.properties.find((p) => p.id === id)?.name ?? ''
  if (data.properties.length === 0) return null
  return (
    <Card className="mb-4">
      <div className="mb-2 flex items-center gap-2">
        <CalendarClock size={18} className="text-brand-600 dark:text-brand-400" />
        <h3 className="font-semibold">{t('todo.title', { month: monthLabel(m, i18n.language) })}</h3>
      </div>
      {items === 0 ? (
        <p className="flex items-center gap-2 text-sm text-ink-500">
          <CheckCircle2 size={16} className="text-pos" />
          {t('todo.allDone')}
        </p>
      ) : (
        <ul className="divide-y divide-ink-100 text-sm dark:divide-ink-800">
          {rents.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                {t('todo.rentNotRecorded', { name: p.name })}
                {p.refRent ? (
                  <span className="text-ink-500">
                    {' '}
                    · {t('todo.ref')} <Amt value={p.refRent} cur={p.refRentCurrency} />
                  </span>
                ) : null}
              </span>
              <Button size="sm" onClick={() => openEntry({ type: 'rent', preset: { propertyId: p.id } })}>
                {t('todo.recordRent')}
              </Button>
            </li>
          ))}
          {fixed.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                {r.concept} · <span className="text-ink-500">{prop(r.propertyId)}</span> · <Amt value={r.amount} cur={r.currency} />
              </span>
              <Button
                size="sm"
                onClick={() =>
                  openEntry({
                    type: 'expense',
                    preset: { kind: 'fixed', propertyId: r.propertyId, recurringId: r.id, concept: r.concept, category: r.category ?? '', amount: r.amount, currency: r.currency, method: r.method ?? '', period: m },
                  })
                }
              >
                {t('todo.pay')}
              </Button>
            </li>
          ))}
          {cuotas.map(({ plan, cuota }) => (
            <li key={`${plan.id}-${cuota.no}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                {plan.concept} · {t('plan.cuotaOf', { no: cuota.no, count: plan.count })} · <span className="text-ink-500">{prop(plan.propertyId)}</span> ·{' '}
                <Amt value={cuota.amount} cur={plan.currency} />
                {cuota.month < m && (
                  <span className="ml-2 inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
                    <AlertCircle size={12} />
                    {t('todo.overdue', { month: monthLabel(cuota.month, i18n.language, 'short') })}
                  </span>
                )}
              </span>
              <Button
                size="sm"
                onClick={() =>
                  openEntry({
                    type: 'expense',
                    preset: { kind: 'installment', propertyId: plan.propertyId, planId: plan.id, installmentNo: cuota.no, concept: plan.concept, category: plan.category ?? '', amount: cuota.amount, currency: plan.currency, method: plan.method ?? '', period: cuota.month },
                  })
                }
              >
                {t('todo.payCuota')}
              </Button>
            </li>
          ))}
          {soon.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                {t('todo.maturity', { name: i.name, date: dateLabel(i.maturityDate, i18n.language) })} · <Amt value={i.capital} cur={i.currency} />
              </span>
              <Link to="/inversiones" className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
                {t('todo.seeInvestment')}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function addDays(date: string, n: number): string {
  const d = new Date(date + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function Welcome() {
  const { t } = useTranslation()
  return (
    <Card className="mb-5 border-brand-300 bg-brand-50/60 dark:border-brand-700 dark:bg-brand-700/10">
      <h2 className="text-lg font-semibold">{t('welcome.title')}</h2>
      <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">{t('welcome.body')}</p>
      <ol className="mt-3 list-inside list-decimal space-y-1 text-sm">
        <li>
          <Link to="/propiedades" className="font-medium text-brand-700 underline dark:text-brand-300">
            {t('welcome.step1')}
          </Link>
        </li>
        <li>{t('welcome.step2')}</li>
        <li>
          <Link to="/gastos" className="font-medium text-brand-700 underline dark:text-brand-300">
            {t('welcome.step3')}
          </Link>
        </li>
        <li>
          <Link to="/ajustes#tc" className="font-medium text-brand-700 underline dark:text-brand-300">
            {t('welcome.step4')}
          </Link>
        </li>
      </ol>
      <p className="mt-3 text-sm text-ink-600 dark:text-ink-300">
        {t('welcome.demo')}{' '}
        <Link to="/ajustes#datos" className="font-medium text-brand-700 underline dark:text-brand-300">
          {t('welcome.demoLink')}
        </Link>
      </p>
    </Card>
  )
}

