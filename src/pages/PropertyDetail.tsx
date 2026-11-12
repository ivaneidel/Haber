import { Archive, ArchiveRestore, ArrowLeft, ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Bars, C, ChartCard, type Row, type SeriesDef } from '../components/Charts'
import { openEntry } from '../components/entryStore'
import { PlanForm, PropertyForm, RecurringForm, StatusForm, ValuationForm } from '../components/forms'
import { Amt, FxCaption, Kpi, Multi, ViewSwitch } from '../components/money'
import { toast } from '../components/toast'
import { Badge, Button, Card, Empty, IconButton, PageHeader, SectionTitle, Segmented, Select, Table, confirmAction, td, tdNum, th, thNum } from '../components/ui'
import { useModel } from '../hooks/useData'
import { currentStatus, dataYears, filterFlows, monthlyTotals, pendingDeductions, planStatus, propertyYield, statusHistory, totals, vacancyPeriods, valuationsOf, yearlyTotals, type Flow } from '../lib/calc'
import { dateLabel, monthLabel, today, yearMonths } from '../lib/dates'
import { formatMoney, formatPct, type Lens } from '../lib/money'
import { apply, deletePlan, deletePropertyHard, propertyRefs, putOp, remove } from '../lib/repo'
import type { Currency, Plan, Property, PropertyStatus, Recurring, StatusChange, Valuation } from '../lib/types'
import type { Model } from '../hooks/useData'
import { MonthlyNetTable } from '../components/MonthlyNet'
import { MovementList, movementRows } from './Movements'
import { contractBadge } from './Properties'

export default function PropertyDetail() {
  const { id } = useParams()
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const model = useModel()
  const nowYear = Number(today().slice(0, 4))
  const [year, setYear] = useState(nowYear)
  const [byPeriod, setByPeriod] = useState(false)
  const [edit, setEdit] = useState(false)
  const [val, setVal] = useState<Valuation | 'new' | null>(null)
  const [rec, setRec] = useState<Recurring | 'new' | null>(null)
  const [plan, setPlan] = useState<Plan | 'new' | null>(null)
  const [splitCur, setSplitCur] = useState<Currency>('ARS')
  const [statusEdit, setStatusEdit] = useState<StatusChange | 'new' | null>(null)
  if (!model) return null
  const { data, flows, lenses, prefs } = model
  const p = data.properties.find((x) => x.id === id)
  if (!p)
    return (
      <Card>
        <Empty action={<Link to="/propiedades">{t('common.back')}</Link>}>{t('property.notFound')}</Empty>
      </Card>
    )

  const mine = flows.filter((f) => f.propertyId === p.id)
  const years = dataYears(data, nowYear)
  const yf = filterFlows(mine, { from: `${year}-01`, to: `${year}-12`, byPeriod })
  const lensFor = model.lensInto
  const yr = propertyYield(data, flows, p, year, lensFor)
  const refs = propertyRefs(data, p.id)

  const chartLens = lenses.length === 1 ? lenses[0] : lenses.find((l) => l.target === splitCur)!
  const f = { full: (n: number) => formatMoney(n, chartLens.target, i18n.language) }
  const mt = monthlyTotals(mine, chartLens, yearMonths(year), byPeriod)
  const rows: Row[] = mt.map((m) => ({ label: monthLabel(m.month, i18n.language, 'short', false), rent: m.rent, fixed: -m.fixed, installment: -m.installment, eventual: -m.eventual, fee: -m.fee, net: m.realEstateNet }))
  const series: SeriesDef[] = [
    { key: 'rent', label: t('src.rent'), color: C.rent },
    { key: 'fixed', label: t('kind.fixed'), color: C.fixed },
    { key: 'installment', label: t('kind.installment'), color: C.installment },
    { key: 'eventual', label: t('kind.eventual'), color: C.eventual },
    { key: 'fee', label: t('kind.fee'), color: C.other },
  ]

  const archive = async () => {
    await apply([putOp('properties', { ...p, archived: !p.archived, archivedAt: p.archived ? undefined : today() })])
    toast(p.archived ? t('property.restored') : t('property.archivedToast'))
  }
  const del = async () => {
    if (!confirmAction(t('property.deleteConfirm', { name: p.name }))) return
    await deletePropertyHard(data, p.id)
    navigate('/propiedades')
  }

  return (
    <>
      <Link to="/propiedades" className="mb-2 inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800 dark:hover:text-ink-200">
        <ArrowLeft size={14} />
        {t('nav.properties')}
      </Link>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {p.name} <StatusBadge status={currentStatus(data, p)} /> {contractBadge(p, t)}
          </span>
        }
        subtitle={[p.address, p.city, p.province].filter(Boolean).join(', ')}
        actions={
          <>
            <Button onClick={() => openEntry({ type: 'rent', preset: { propertyId: p.id } })} disabled={!!p.archived}>
              <Plus size={16} />
              {t('todo.recordRent')}
            </Button>
            <Button onClick={() => openEntry({ type: 'expense', preset: { propertyId: p.id } })} disabled={!!p.archived}>
              <Plus size={16} />
              {t('entry.expense')}
            </Button>
            <IconButton label={t('common.edit')} onClick={() => setEdit(true)}>
              <Pencil size={18} />
            </IconButton>
            <IconButton label={p.archived ? t('property.restore') : t('property.archive')} onClick={() => void archive()}>
              {p.archived ? <ArchiveRestore size={18} /> : <Archive size={18} />}
            </IconButton>
            {refs === 0 && (
              <IconButton label={t('common.delete')} onClick={() => void del()}>
                <Trash2 size={18} />
              </IconButton>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <SectionTitle>{t('property.contract')}</SectionTitle>
          <dl className="space-y-1.5 text-sm">
            <Info label={t('property.tenant')} value={p.tenant} />
            <Info label={t('property.contractStart')} value={dateLabel(p.contractStart, i18n.language)} />
            <Info label={t('property.contractEnd')} value={dateLabel(p.contractEnd, i18n.language)} />
            <Info label={t('property.refRent')} value={p.refRent ? formatMoney(p.refRent, p.refRentCurrency, i18n.language) : ''} />
          </dl>
          <SectionTitle className="mt-4">{t('property.sheet')}</SectionTitle>
          <dl className="space-y-1.5 text-sm">
            <Info label={t('property.address')} value={[p.address, p.city, p.province, p.postalCode].filter(Boolean).join(', ')} />
            <Info label={t('property.cadastre')} value={p.cadastre} mono />
            <Info label={t('property.parcel')} value={p.parcel} mono />
          </dl>
          {p.contractNotes && <p className="mt-2 text-sm whitespace-pre-wrap text-ink-600 dark:text-ink-300">{p.contractNotes}</p>}
          {p.notes && <p className="mt-2 text-sm whitespace-pre-wrap text-ink-500">{p.notes}</p>}
          {p.archived && <p className="mt-3 text-xs text-ink-500">{t('property.archivedNote')}</p>}
        </Card>

        <Card className="lg:col-span-2">
          <SectionTitle action={<Button size="sm" onClick={() => setVal('new')}><Plus size={14} />{t('property.addValuation')}</Button>}>{t('property.valueHistory')}</SectionTitle>
          {valuationsOf(data, p.id).length === 0 ? (
            <Empty>{t('property.noValue')}</Empty>
          ) : (
            <Table
              head={
                <tr>
                  <th className={th}>{t('form.date')}</th>
                  <th className={thNum}>{t('property.value')}</th>
                  <th className={thNum}>{t('property.change')}</th>
                  <th className={th}>{t('form.notes')}</th>
                  <th />
                </tr>
              }
            >
              {valuationsOf(data, p.id)
                .map((v, i, arr) => ({ v, prev: arr[i - 1] }))
                .reverse()
                .map(({ v, prev }) => (
                  <tr key={v.id}>
                    <td className={td}>{dateLabel(v.date, i18n.language)}</td>
                    <td className={tdNum}>
                      <Amt value={v.value} cur={v.currency} />
                    </td>
                    <td className={tdNum}>{prev && prev.currency === v.currency ? formatPct(((v.value - prev.value) / prev.value) * 100, i18n.language) : ''}</td>
                    <td className={td + ' text-ink-500'}>{v.notes}</td>
                    <td className="text-right">
                      <IconButton label={t('common.edit')} onClick={() => setVal(v)}>
                        <Pencil size={14} />
                      </IconButton>
                      <IconButton label={t('common.delete')} onClick={() => confirmAction(t('common.deleteConfirm')) && void remove('valuations', v.id)}>
                        <Trash2 size={14} />
                      </IconButton>
                    </td>
                  </tr>
                ))}
            </Table>
          )}
          <p className="mt-2 text-xs text-ink-500">{t('property.valueHistoryNote')}</p>
        </Card>
      </div>

      <StatusCard model={model} property={p} onEdit={setStatusEdit} />

      {pendingDeductions(data, p.id).length > 0 && (
        <Card className="mt-4 border-amber-300 dark:border-amber-800">
          <p className="text-sm">{t('work.pendingOnProperty', { count: pendingDeductions(data, p.id).length })}</p>
        </Card>
      )}

      <div className="mt-6 mb-3 flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-lg font-semibold">{t('property.result')}</h2>
        <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-28" aria-label={t('common.year')}>
          {years.map((y) => (
            <option key={y}>{y}</option>
          ))}
        </Select>
        <Segmented
          value={byPeriod ? 'period' : 'cash'}
          onChange={(v) => setByPeriod(v === 'period')}
          options={[
            { value: 'cash', label: t('property.byCash') },
            { value: 'period', label: t('property.byPeriod') },
          ]}
        />
        <ViewSwitch model={model} />
      </div>
      <FxCaption model={model} className="-mt-2 mb-3" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label={t('property.collected')} color={C.rent} lenses={lenses} get={(l) => sum(yf, l).rent} />
        <Kpi label={t('dash.propExpenses')} lenses={lenses} get={(l) => sum(yf, l).expense} />
        <Kpi label={t('property.netAnnual')} lenses={lenses} get={(l) => sum(yf, l).realEstateNet} tone sub={t('property.netMonthlyAvg')} />
        <Card>
          <div className="text-xs font-medium text-ink-500">{t('profit.pct')}</div>
          <div className="mt-1 text-2xl font-semibold tnum">{formatPct(yr.pct, i18n.language, 2)}</div>
          <div className="mt-0.5 text-xs text-ink-500">
            {yr.value ? t('profit.onValue', { value: formatMoney(yr.value, yr.currency, i18n.language) }) : t('profit.noValue')}
            {yr.approx && ` · ${t('profit.approx')}`}
          </div>
        </Card>
      </div>
      <p className="mt-2 text-xs text-ink-500">
        {t('property.avgMonthly')}:{' '}
        <Multi lenses={lenses} get={(l) => sum(yf, l).realEstateNet / (year === nowYear ? Number(today().slice(5, 7)) : 12)} size="sm" className="inline-flex! flex-row! gap-2" />
      </p>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <ChartCard
          title={t('property.monthly', { year })}
          subtitle={byPeriod ? t('property.byPeriodSub') : t('property.byCashSub')}
          rows={rows}
          series={[...series, { key: 'net', label: t('dash.realEstateNet'), color: C.net }]}
          fmt={f.full}
          action={
            lenses.length > 1 ? (
              <Segmented<Currency> value={splitCur} onChange={setSplitCur} options={[{ value: 'ARS', label: 'ARS' }, { value: 'USD', label: 'USD' }]} />
            ) : undefined
          }
        >
          <Bars rows={rows} series={series} cur={chartLens.target} totalLabel={t('common.total')} />
        </ChartCard>
        <YearCompare model={model} propertyId={p.id} years={years} byPeriod={byPeriod} />
      </div>
      <MonthlyNetTable flows={mine} lenses={lenses} year={year} byPeriod={byPeriod} className="mt-4" />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle action={<Button size="sm" onClick={() => setRec('new')}><Plus size={14} />{t('fixed.new')}</Button>}>{t('exp.tabServices')}</SectionTitle>
          <RecurringList recs={data.recurring.filter((r) => r.propertyId === p.id)} onEdit={setRec} />
        </Card>
        <Card>
          <SectionTitle action={<Button size="sm" onClick={() => setPlan('new')}><Plus size={14} />{t('plan.new')}</Button>}>{t('kind.installment')}</SectionTitle>
          <PlanList plans={data.plans.filter((x) => x.propertyId === p.id)} onEdit={setPlan} />
        </Card>
      </div>

      <Card className="mt-6">
        <SectionTitle action={<Link to={`/movimientos?propiedad=${p.id}`} className="text-sm text-brand-700 hover:underline dark:text-brand-300">{t('property.allMovements')}</Link>}>
          {t('property.lastMovements')}
        </SectionTitle>
        <MovementList rows={movementRows(data, t).filter((r) => r.propertyId === p.id).slice(0, 15)} showProperty={false} />
      </Card>

      {statusEdit && <StatusForm propertyId={p.id} change={statusEdit === 'new' ? undefined : statusEdit} onClose={() => setStatusEdit(null)} />}
      {edit && <PropertyForm data={data} property={p} onClose={() => setEdit(false)} />}
      {val && <ValuationForm propertyId={p.id} valuation={val === 'new' ? undefined : val} onClose={() => setVal(null)} />}
      {rec && <RecurringForm data={data} prefs={prefs} rec={rec === 'new' ? undefined : rec} propertyId={p.id} onClose={() => setRec(null)} />}
      {plan && <PlanForm data={data} prefs={prefs} plan={plan === 'new' ? undefined : plan} propertyId={p.id} onClose={() => setPlan(null)} />}
    </>
  )
}

const sum = (fl: Flow[], l: Lens) => totals(fl, l)

function Info({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-ink-500">{label}</dt>
      <dd className={'min-w-0 text-right font-medium break-words' + (mono && value ? ' font-mono select-all' : '')}>{value || '—'}</dd>
    </div>
  )
}

function YearCompare({ model, propertyId, years, byPeriod }: { model: NonNullable<ReturnType<typeof useModel>>; propertyId: string; years: number[]; byPeriod: boolean }) {
  const { t, i18n } = useTranslation()
  const mine = model.flows.filter((f) => f.propertyId === propertyId)
  return (
    <Card>
      <h3 className="mb-3 font-semibold">{t('property.yearCompare')}</h3>
      <Table
        head={
          <tr>
            <th className={th}>{t('common.year')}</th>
            <th className={thNum}>{t('property.collected')}</th>
            <th className={thNum}>{t('dash.propExpenses')}</th>
            <th className={thNum}>{t('property.netAnnual')}</th>
            <th className={thNum}>{t('property.vsPrev')}</th>
          </tr>
        }
      >
        {model.lenses.flatMap((l) => {
          const yt = yearlyTotals(mine, l, years, byPeriod)
          return yt
            .map((y, i) => ({ y, prev: yt[i - 1] }))
            .filter(({ y }) => y.rent || y.expense)
            .reverse()
            .map(({ y, prev }) => (
              <tr key={`${l.target}-${y.year}`}>
                <td className={td}>
                  {y.year} {model.lenses.length > 1 && <Badge>{l.target}</Badge>}
                </td>
                <td className={tdNum}>
                  <Amt value={y.rent} cur={l.target} />
                </td>
                <td className={tdNum}>
                  <Amt value={y.expense} cur={l.target} />
                </td>
                <td className={tdNum}>
                  <Amt value={y.realEstateNet} cur={l.target} tone />
                </td>
                <td className={tdNum}>{prev && prev.realEstateNet ? formatPct(((y.realEstateNet - prev.realEstateNet) / Math.abs(prev.realEstateNet)) * 100, i18n.language) : '—'}</td>
              </tr>
            ))
        })}
      </Table>
      <p className="mt-2 text-xs text-ink-500">{t('property.inflationNote')}</p>
    </Card>
  )
}

export function RecurringList({ recs, onEdit, showProperty }: { recs: Recurring[]; onEdit: (r: Recurring) => void; showProperty?: boolean }) {
  const { t } = useTranslation()
  const model = useModel()
  if (!recs.length) return <Empty>{t('fixed.none')}</Empty>
  return (
    <ul className="divide-y divide-ink-100 text-sm dark:divide-ink-800">
      {recs.map((r) => (
        <li key={r.id} className="flex items-center justify-between gap-2 py-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-medium">
              <span className="truncate">{r.concept}</span>
              {!r.active && <Badge>{t('fixed.inactive')}</Badge>}
            </div>
            <div className="text-xs text-ink-500">
              {showProperty && `${model?.data.properties.find((p) => p.id === r.propertyId)?.name ?? ''} · `}
              {[
                r.provider,
                r.account && `${t('svc.accountShort')} ${r.account}`,
                t(`fixed.every_${r.every}`),
                r.dueDay && t('svc.dueDayShort', { day: r.dueDay }),
                r.method,
                r.channel && t(`svc.ch_${r.channel}`),
              ]
                .filter(Boolean)
                .join(' · ')}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {(r.billUrl || r.portalUrl) && (
              <a href={r.billUrl || r.portalUrl} target="_blank" rel="noreferrer" title={t('svc.openBill')} className="rounded-full p-2 text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800">
                <ExternalLink size={14} />
              </a>
            )}
            {r.amount ? <Amt value={r.amount} cur={r.currency} className="font-medium" /> : <span className="text-xs text-ink-500">{t('svc.varies')}</span>}
            <IconButton label={t('common.edit')} onClick={() => onEdit(r)}>
              <Pencil size={14} />
            </IconButton>
            {model && !model.data.expenses.some((e) => e.recurringId === r.id) && (
              <IconButton label={t('common.delete')} onClick={() => confirmAction(t('common.deleteConfirm')) && void remove('recurring', r.id)}>
                <Trash2 size={14} />
              </IconButton>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

export function PlanList({ plans, onEdit, showProperty }: { plans: Plan[]; onEdit: (p: Plan) => void; showProperty?: boolean }) {
  const { t, i18n } = useTranslation()
  const model = useModel()
  if (!model) return null
  if (!plans.length) return <Empty>{t('plan.none')}</Empty>
  return (
    <ul className="divide-y divide-ink-100 text-sm dark:divide-ink-800">
      {plans.map((p) => {
        const st = planStatus(p, model.data.expenses)
        const pct = (st.paidCount / p.count) * 100
        return (
          <li key={p.id} className="py-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-medium">
                  <span className="truncate">{p.concept}</span>
                  {p.cancelled ? <Badge>{t('plan.cancelledBadge')}</Badge> : st.done ? <Badge tone="good">{t('plan.done')}</Badge> : null}
                </div>
                <div className="text-xs text-ink-500">
                  {showProperty && `${model.data.properties.find((x) => x.id === p.propertyId)?.name ?? ''} · `}
                  {t('plan.progress', { paid: st.paidCount, count: p.count })} · {formatMoney(p.installment, p.currency, i18n.language)} {t('plan.each')}
                  {st.next && ` · ${t('plan.next', { month: monthLabel(st.next.month, i18n.language, 'short') })}`}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <div className="text-right">
                  <div className="text-xs text-ink-500">{t('plan.remaining')}</div>
                  <Amt value={st.remainingAmount} cur={p.currency} className="font-medium" />
                </div>
                <IconButton label={t('common.edit')} onClick={() => onEdit(p)}>
                  <Pencil size={14} />
                </IconButton>
                <IconButton
                  label={t('common.delete')}
                  onClick={() => confirmAction(st.paidCount ? t('plan.deleteConfirmPaid', { count: st.paidCount }) : t('common.deleteConfirm')) && void deletePlan(model.data, p.id)}
                >
                  <Trash2 size={14} />
                </IconButton>
              </div>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: C.installment }} />
            </div>
            {st.next && (
              <Button
                size="sm"
                className="mt-2"
                onClick={() =>
                  openEntry({
                    type: 'expense',
                    preset: { kind: 'installment', propertyId: p.propertyId, planId: p.id, installmentNo: st.next!.no, concept: p.concept, category: p.category ?? '', amount: st.next!.amount, currency: p.currency, method: p.method ?? '', period: st.next!.month },
                  })
                }
              >
                {t('plan.payNext', { no: st.next.no })}
              </Button>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export function StatusBadge({ status }: { status?: PropertyStatus }) {
  const { t } = useTranslation()
  if (!status) return null
  return <Badge tone={status === 'rented' ? 'good' : status === 'forSale' ? 'info' : 'warn'}>{t(`status.${status}`)}</Badge>
}

/** Current status, its history and every period without a tenant, with what it cost (spec 2 §6). */
function StatusCard({ model, property: p, onEdit }: { model: Model; property: Property; onEdit: (c: StatusChange | 'new') => void }) {
  const { t, i18n } = useTranslation()
  const { data, flows } = model
  const lenses = model.lenses
  const hist = statusHistory(data, p.id)
  const periods = lenses.map((l) => vacancyPeriods(data, flows, p, l))
  const cur = currentStatus(data, p)
  const ongoing = periods[0].find((v) => !v.to)
  return (
    <Card className="mt-4">
      <SectionTitle
        action={
          <Button size="sm" onClick={() => onEdit('new')}>
            <Plus size={14} />
            {t('status.change')}
          </Button>
        }
      >
        {t('status.title')}
      </SectionTitle>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <StatusBadge status={cur} />
        {!cur && <span className="text-ink-500">{t('status.unknown')}</span>}
        {ongoing && (
          <span>
            {t('status.ongoing', { date: dateLabel(ongoing.from, i18n.language), days: ongoing.days })}{' '}
            {periods.map((ps, i) => {
              const v = ps.find((x) => !x.to)
              return v && (i === 0 || v.cost) ? (
                <span key={i} className="font-medium">
                  · {t('status.costSoFar')} <Amt value={v.cost} cur={lenses[i].target} />{' '}
                </span>
              ) : null
            })}
          </span>
        )}
      </div>
      {periods[0].length > 0 && (
        <Table
          className="mt-3"
          head={
            <tr>
              <th className={th}>{t('status.period')}</th>
              <th className={th}>{t('status.status')}</th>
              <th className={thNum}>{t('status.days')}</th>
              <th className={thNum}>{t('status.cost')}</th>
            </tr>
          }
        >
          {periods[0].map((v, i) => (
            <tr key={v.from}>
              <td className={td}>
                {dateLabel(v.from, i18n.language)} → {v.to ? dateLabel(v.to, i18n.language) : t('status.today')}
              </td>
              <td className={td}>{t(`status.${v.status}`)}</td>
              <td className={tdNum}>{t('status.daysMonths', { days: v.days, months: (v.days / 30.44).toLocaleString(i18n.language, { maximumFractionDigits: 1 }) })}</td>
              <td className={tdNum}>
                {periods.map((ps, j) => (j === 0 || ps[i].cost ? <div key={j}><Amt value={ps[i].cost} cur={lenses[j].target} /></div> : null))}
              </td>
            </tr>
          ))}
        </Table>
      )}
      {hist.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-ink-500">{t('status.history', { count: hist.length })}</summary>
          <ul className="mt-1 divide-y divide-ink-100 dark:divide-ink-800">
            {[...hist].reverse().map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-2 py-1.5">
                <span>
                  {dateLabel(h.from, i18n.language)} · {t(`status.${h.status}`)}
                  {h.notes && <span className="text-ink-500"> · {h.notes}</span>}
                </span>
                <IconButton label={t('common.edit')} onClick={() => onEdit(h)}>
                  <Pencil size={14} />
                </IconButton>
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="mt-2 text-xs text-ink-500">{t('status.explain')}</p>
    </Card>
  )
}
