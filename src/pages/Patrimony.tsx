import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Bars, C, ChartCard, type Row, type SeriesDef } from '../components/Charts'
import { CapitalForm, PropertySaleForm } from '../components/forms'
import { Amt, CurBadge, FxCaption } from '../components/money'
import { Badge, Button, Card, Empty, IconButton, Note, PageHeader, SectionTitle, Segmented, Table, confirmAction, td, tdNum, th, thNum } from '../components/ui'
import { useModel, type Model } from '../hooks/useData'
import { capitalEvents, capitalSummary, currentValuation, type Data } from '../lib/calc'
import { addMonths, dateLabel, monthLabel, monthRange, thisMonth, today } from '../lib/dates'
import { formatMoney, type Lens } from '../lib/money'
import { remove } from '../lib/repo'
import type { CapitalMove, Currency, PropertySale } from '../lib/types'

/** Value of the property at a date: last valuation on/before it, else the earliest one. */
function propertyValueAt(d: Data, propertyId: string, date: string) {
  const vs = d.valuations.filter((v) => v.propertyId === propertyId).sort((a, b) => a.date.localeCompare(b.date))
  const before = vs.filter((v) => v.date <= date)
  return before[before.length - 1] ?? vs[0]
}

function patrimonyAt(model: Model, lens: Lens, date: string) {
  const d = model.data
  let props = 0
  for (const p of d.properties) {
    if (p.soldAt && p.soldAt <= date) continue
    // Inherited properties existed before their first valuation: the earliest value stands in.
    const v = propertyValueAt(d, p.id, date)
    if (v) props += lens(v.value, v.currency, date)
  }
  let placed = 0
  let available = 0
  for (const cur of ['ARS', 'USD'] as Currency[]) {
    const s = capitalSummary(d, cur, date)
    placed += lens(s.placed, cur, date)
    available += lens(s.available, cur, date)
  }
  return { props, placed, available }
}

export default function Patrimony() {
  const { t, i18n } = useTranslation()
  const model = useModel()
  const [target, setTarget] = useState<Currency>('USD')
  const [move, setMove] = useState<CapitalMove | 'new' | null>(null)
  const [psale, setPsale] = useState<PropertySale | 'new' | null>(null)
  if (!model) return null
  const { data } = model
  const lens = model.lensInto(target)
  const canConsolidate = !!model.book.latest
  const now = patrimonyAt(model, lens, today())
  const total = now.props + now.placed + now.available
  const missing = data.properties.filter((p) => !p.archived && !p.soldAt && !currentValuation(data, p.id))

  const months = monthRange(addMonths(thisMonth(), -23), thisMonth())
  const evoRows: Row[] = months.map((m) => {
    const end = m === thisMonth() ? today() : `${m}-31`
    const x = patrimonyAt(model, lens, end)
    return { label: monthLabel(m, i18n.language, 'short'), props: x.props, placed: x.placed, available: x.available }
  })
  const evoSeries: SeriesDef[] = [
    { key: 'props', label: t('pat.properties'), color: C.rent },
    { key: 'placed', label: t('pat.invested'), color: C.yield },
    { key: 'available', label: t('pat.available'), color: C.pension },
  ]
  const fmt = (n: number) => formatMoney(n, target, i18n.language)
  const events = capitalEvents(data)

  return (
    <>
      <PageHeader
        title={t('nav.patrimony')}
        subtitle={t('pat.subtitle')}
        actions={
          <Segmented<Currency>
            value={target}
            onChange={setTarget}
            label={t('pat.totalIn')}
            options={[
              { value: 'USD', label: t('fx.inUSD') },
              { value: 'ARS', label: t('fx.inARS') },
            ]}
          />
        }
      />
      <FxCaption model={model} mode={target} className="-mt-3 mb-4" />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label={t('pat.properties')} value={now.props} cur={target} color={C.rent} />
        <Tile label={t('pat.invested')} value={now.placed} cur={target} color={C.yield} />
        <Tile label={t('pat.available')} value={now.available} cur={target} color={C.pension} />
        <Tile label={t('pat.total')} value={total} cur={target} strong />
      </div>
      {!canConsolidate && <Note tone="warn" className="mt-3">{t('pat.needRate')}</Note>}
      {missing.length > 0 && <Note tone="warn" className="mt-3">{t('pat.missingValues', { names: missing.map((p) => p.name).join(', ') })}</Note>}

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <SectionTitle>{t('pat.byCurrency')}</SectionTitle>
          <Table
            head={
              <tr>
                <th className={th} />
                <th className={thNum}>ARS</th>
                <th className={thNum}>USD</th>
              </tr>
            }
          >
            {(['props', 'placed', 'available'] as const).map((k) => {
              const val = (cur: Currency) => {
                if (k === 'props')
                  return data.properties
                    .filter((p) => !p.archived && !p.soldAt)
                    .reduce((s, p) => {
                      const v = currentValuation(data, p.id)
                      return s + (v && v.currency === cur ? v.value : 0)
                    }, 0)
                const s = capitalSummary(data, cur)
                return k === 'placed' ? s.placed : s.available
              }
              return (
                <tr key={k}>
                  <td className={td}>{t(`pat.${k === 'props' ? 'properties' : k === 'placed' ? 'invested' : 'available'}`)}</td>
                  <td className={tdNum}>
                    <Amt value={val('ARS')} cur="ARS" />
                  </td>
                  <td className={tdNum}>
                    <Amt value={val('USD')} cur="USD" />
                  </td>
                </tr>
              )
            })}
          </Table>
          <p className="mt-2 text-xs text-ink-500">{t('pat.byCurrencyNote')}</p>
        </Card>
        <Card>
          <SectionTitle>{t('pat.propertyValues')}</SectionTitle>
          {data.properties.filter((p) => !p.archived).length === 0 ? (
            <Empty>{t('property.none')}</Empty>
          ) : (
            <Table
              head={
                <tr>
                  <th className={th}>{t('form.property')}</th>
                  <th className={thNum}>{t('property.value')}</th>
                  <th className={th}>{t('pat.valuedOn')}</th>
                </tr>
              }
            >
              {data.properties
                .filter((p) => !p.archived)
                .map((p) => {
                  const v = currentValuation(data, p.id)
                  return (
                    <tr key={p.id}>
                      <td className={td}>
                        <Link to={`/propiedades/${p.id}`} className="hover:underline">
                          {p.name}
                        </Link>
                      </td>
                      <td className={tdNum}>{v ? <Amt value={v.value} cur={v.currency} /> : '—'}</td>
                      <td className={td + ' text-ink-500'}>{v ? dateLabel(v.date, i18n.language) : ''}</td>
                    </tr>
                  )
                })}
            </Table>
          )}
        </Card>
      </div>

      {canConsolidate && (
        <ChartCard title={t('pat.evolution')} subtitle={t('pat.evolutionSub')} rows={evoRows} series={evoSeries} fmt={fmt} className="mt-4">
          <Bars rows={evoRows} series={evoSeries} cur={target} totalLabel={t('pat.total')} />
        </ChartCard>
      )}

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <Card>
          <SectionTitle
            action={
              <Button size="sm" onClick={() => setPsale('new')}>
                <Plus size={14} />
                {t('psale.new')}
              </Button>
            }
          >
            {t('psale.title')}
          </SectionTitle>
          <p className="mb-2 text-sm text-ink-500">{t('psale.explain')}</p>
          {data.propertySales.length === 0 ? (
            <Empty>{t('psale.none')}</Empty>
          ) : (
            <ul className="divide-y divide-ink-100 text-sm dark:divide-ink-800">
              {[...data.propertySales]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((s) => (
                  <li key={s.id} className="flex items-start justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 font-medium">
                        {s.propertyName} {s.status === 'planned' ? <Badge tone="est">{t('psale.planned')}</Badge> : <Badge tone="good">{t('psale.done')}</Badge>}
                      </div>
                      <div className="text-xs text-ink-500">
                        {dateLabel(s.date, i18n.language)} · {t('psale.price')} <Amt value={s.price} cur={s.currency} /> · {t('psale.costs')} <Amt value={s.costs} cur={s.currency} />
                      </div>
                      {s.destination && <div className="mt-0.5 text-xs text-ink-600 dark:text-ink-300">{t('psale.destination')}: {s.destination}</div>}
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="text-right">
                        <div className="text-xs text-ink-500">{t('psale.net')}</div>
                        <Amt value={s.net} cur={s.currency} className="font-semibold" />
                      </div>
                      <IconButton label={t('common.edit')} onClick={() => setPsale(s)}>
                        <Pencil size={14} />
                      </IconButton>
                      <IconButton label={t('common.delete')} onClick={() => confirmAction(t('common.deleteConfirm')) && void remove('propertySales', s.id)}>
                        <Trash2 size={14} />
                      </IconButton>
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </Card>

        <Card>
          <SectionTitle
            action={
              <Button size="sm" onClick={() => setMove('new')}>
                <Plus size={14} />
                {t('capital.move')}
              </Button>
            }
          >
            {t('capital.ledger')}
          </SectionTitle>
          <p className="mb-2 text-sm text-ink-500">{t('capital.explain')}</p>
          {events.length === 0 ? (
            <Empty>{t('capital.none')}</Empty>
          ) : (
            <Ledger events={events} onEdit={(id) => setMove(data.capital.find((c) => c.id === id) ?? null)} />
          )}
        </Card>
      </div>

      {move && <CapitalForm move={move === 'new' ? undefined : move} onClose={() => setMove(null)} />}
      {psale && <PropertySaleForm data={data} sale={psale === 'new' ? undefined : psale} onClose={() => setPsale(null)} />}
    </>
  )
}

function Ledger({ events, onEdit }: { events: ReturnType<typeof capitalEvents>; onEdit: (id: string) => void }) {
  const { t, i18n } = useTranslation()
  const [cur, setCur] = useState<Currency>(events.some((e) => e.currency === 'USD') ? 'USD' : 'ARS')
  let bal = 0
  const rows = events
    .filter((e) => e.currency === cur)
    .map((e) => {
      bal += e.amount
      return { ...e, bal }
    })
    .reverse()
  return (
    <>
      <div className="mb-2">
        <Segmented<Currency> value={cur} onChange={setCur} options={[{ value: 'USD', label: 'USD' }, { value: 'ARS', label: 'ARS' }]} />
      </div>
      <Table
        head={
          <tr>
            <th className={th}>{t('form.date')}</th>
            <th className={th}>{t('form.concept')}</th>
            <th className={thNum}>{t('form.amount')}</th>
            <th className={thNum}>{t('capital.balance')}</th>
            <th />
          </tr>
        }
      >
        {rows.map((e) => (
          <tr key={`${e.kind}-${e.ref}-${e.date}`}>
            <td className={td + ' whitespace-nowrap'}>{dateLabel(e.date, i18n.language)}</td>
            <td className={td}>
              <div>{e.label}</div>
              <div className="text-xs text-ink-500">{t(`capital.ev_${e.kind}`)}</div>
            </td>
            <td className={tdNum}>
              <Amt value={e.amount} cur={e.currency} tone sign />
            </td>
            <td className={tdNum}>
              <Amt value={e.bal} cur={e.currency} className="font-medium" />
            </td>
            <td className="text-right">
              {(e.kind === 'in' || e.kind === 'out') && (
                <>
                  <IconButton label={t('common.edit')} className="h-7 w-7" onClick={() => onEdit(e.ref)}>
                    <Pencil size={12} />
                  </IconButton>
                  <IconButton label={t('common.delete')} className="h-7 w-7" onClick={() => confirmAction(t('common.deleteConfirm')) && void remove('capital', e.ref)}>
                    <Trash2 size={12} />
                  </IconButton>
                </>
              )}
            </td>
          </tr>
        ))}
      </Table>
    </>
  )
}

function Tile({ label, value, cur, color, strong }: { label: string; value: number; cur: Currency; color?: string; strong?: boolean }) {
  return (
    <Card className={strong ? 'border-brand-300 dark:border-brand-700' : undefined}>
      <div className="flex items-center gap-1.5 text-xs font-medium text-ink-500">
        {color && <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />}
        {label}
        <CurBadge cur={cur} />
      </div>
      <Amt value={value} cur={cur} className={strong ? 'mt-1 block text-2xl font-bold' : 'mt-1 block text-2xl font-semibold'} />
    </Card>
  )
}

