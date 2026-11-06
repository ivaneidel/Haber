import { FlaskConical } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Bars, C, ChartCard, type Row, type SeriesDef } from '../components/Charts'
import { Amt } from '../components/money'
import { Card, Field, Note, NumInput, PageHeader, Segmented, Select, Table, Toggle, td, tdNum, th, thNum } from '../components/ui'
import { useModel } from '../hooks/useData'
import { dateLabel, monthLabel, thisMonth } from '../lib/dates'
import { formatMoney, formatPct, formatRate } from '../lib/money'
import { savePrefs } from '../lib/prefs'
import { project, type ProjectionSettings } from '../lib/projection'
import type { Currency } from '../lib/types'

export default function Projections() {
  const { t, i18n } = useTranslation()
  const model = useModel()
  if (!model) return null
  const { data, flows, prefs, book } = model
  const s = prefs.projection
  const target: Currency = s.currency
  const set = (patch: Partial<ProjectionSettings>) => void savePrefs({ projection: { ...s, ...patch } })
  const pr = project(data, flows, s, target, book, thisMonth())
  const fmt = (n: number) => formatMoney(n, target, i18n.language)

  const series: SeriesDef[] = [
    { key: 'rent', label: t('proj.rentNet'), color: C.rent },
    { key: 'sale', label: t('src.sale'), color: C.sale },
    { key: 'yield', label: t('src.yield'), color: C.yield },
    { key: 'pension', label: t('src.pension'), color: C.pension },
  ]
  const yearRows: Row[] = pr.years.map((y) => ({ label: String(y.year), rent: Math.round(y.rent), sale: Math.round(y.sale), yield: Math.round(y.yield), pension: Math.round(y.pension) }))

  return (
    <>
      <PageHeader
        title={t('nav.projections')}
        subtitle={t('proj.subtitle')}
        actions={
          <Segmented<Currency>
            value={target}
            onChange={(v) => set({ currency: v })}
            options={[
              { value: 'ARS', label: t('fx.inARS') },
              { value: 'USD', label: t('fx.inUSD') },
            ]}
          />
        }
      />
      <Note tone="est" className="mb-4 flex items-start gap-2">
        <FlaskConical size={16} className="mt-0.5 shrink-0" />
        <span>
          {t('proj.disclaimer')}{' '}
          {pr.rate
            ? t('proj.rateUsed', { series: pr.rate.series, rate: formatRate(pr.rate.value, i18n.language), date: dateLabel(pr.rate.date, i18n.language) })
            : t('proj.noRate')}
        </span>
      </Note>
      {pr.missingRate && (
        <Note tone="warn" className="mb-4">
          {t('proj.missingRate')} <Link to="/ajustes#tc" className="underline">{t('fx.addRate')}</Link>
        </Note>
      )}
      {pr.pensionsWithoutAmount.length > 0 && (
        <Note tone="warn" className="mb-4">
          {t('proj.pensionsNoAmount', { names: pr.pensionsWithoutAmount.map((p) => p.name).join(', ') })}{' '}
          <Link to="/jubilaciones" className="underline">{t('proj.loadAmount')}</Link>
        </Note>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {pr.scenarios.map((sc) => {
          const parts = [
            { k: 'rent', v: sc.rent, label: t('proj.rentNet'), color: C.rent },
            { k: 'sale', v: sc.sale, label: t('src.sale'), color: C.sale },
            { k: 'yield', v: sc.yield, label: t('src.yield'), color: C.yield },
            { k: 'pension', v: sc.pension_, label: t('src.pension'), color: C.pension },
          ]
          const nonPension = sc.rent + sc.sale + sc.yield
          return (
            <Card key={sc.key} className="border-dashed">
              <div className="text-xs font-medium tracking-wide text-violet-700 uppercase dark:text-violet-300">{t('proj.estimate')}</div>
              <h3 className="mt-0.5 font-semibold">{sc.key === 'now' ? t('proj.scenarioNow') : t('proj.scenarioFrom', { name: sc.label, month: monthLabel(sc.month, i18n.language) })}</h3>
              <div className="mt-2 text-xs text-ink-500">{t('proj.monthlyIncome')}</div>
              <Amt value={sc.total} cur={target} className="text-2xl font-bold" />
              <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
                {parts.map((p) => (sc.total > 0 && p.v > 0 ? <div key={p.k} style={{ width: `${(p.v / sc.total) * 100}%`, background: p.color }} /> : null))}
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {parts.map((p) => (
                  <li key={p.k} className="flex justify-between gap-2">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                      {p.label}
                    </span>
                    <span className="flex gap-2">
                      <Amt value={p.v} cur={target} />
                      <span className="w-12 text-right text-ink-500 tnum">{sc.total > 0 ? formatPct((p.v / sc.total) * 100, i18n.language, 0) : '—'}</span>
                    </span>
                  </li>
                ))}
              </ul>
              {sc.pension_ > 0 && (
                <p className="mt-2 text-xs text-ink-500">
                  {t('proj.complement', { pct: formatPct((nonPension / sc.total) * 100, i18n.language, 0) })}
                </p>
              )}
            </Card>
          )
        })}
      </div>

      <ChartCard title={t('proj.yearly')} subtitle={t('proj.yearlySub')} rows={yearRows} series={series} fmt={fmt} className="mt-4 border-dashed">
        <Bars rows={yearRows} series={series} cur={target} totalLabel={t('common.total')} height={300} />
      </ChartCard>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <h3 className="mb-3 font-semibold">{t('proj.assumptions')}</h3>
          <div className="space-y-4">
            <Field label={t('proj.horizon')}>
              <Select value={s.years} onChange={(e) => set({ years: Number(e.target.value) })} className="w-40">
                {[5, 10, 15, 20].map((n) => (
                  <option key={n} value={n}>
                    {t('proj.years', { count: n })}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('proj.rentBasis')} hint={s.rentBasis === 'last12' ? t('proj.rentLast12Hint', { months: pr.base.monthsOfData }) : t('proj.rentContractsHint')}>
              <Segmented
                value={s.rentBasis}
                onChange={(v) => set({ rentBasis: v })}
                options={[
                  { value: 'last12', label: t('proj.rentLast12') },
                  { value: 'contracts', label: t('proj.rentContracts') },
                ]}
              />
            </Field>
            <Field label={t('proj.yieldBasis')} hint={s.yieldBasis === 'rate' ? t('proj.yieldRateHint', { capital: fmt(pr.base.capital) }) : t('proj.yieldLast12Hint')}>
              <Segmented
                value={s.yieldBasis}
                onChange={(v) => set({ yieldBasis: v })}
                options={[
                  { value: 'rate', label: t('proj.yieldRate') },
                  { value: 'last12', label: t('proj.yieldLast12') },
                ]}
              />
            </Field>
            {s.yieldBasis === 'rate' && (
              <Field label={t('proj.capitalRate')} hint={t('proj.capitalRateHint')}>
                <NumInput value={s.capitalRate} onValue={(n) => set({ capitalRate: n ?? 0 })} className="w-28" />
              </Field>
            )}
            <Toggle checked={s.includeSales} onChange={(v) => set({ includeSales: v })} label={t('proj.includeSales')} />
            <Toggle checked={s.includePlannedSales} onChange={(v) => set({ includePlannedSales: v })} label={t('proj.includePlanned')} hint={t('proj.includePlannedHint')} />
          </div>
        </Card>
        <Card>
          <h3 className="mb-3 font-semibold">{t('proj.table')}</h3>
          <Table
            head={
              <tr>
                <th className={th}>{t('common.year')}</th>
                <th className={thNum}>{t('proj.rentNet')}</th>
                <th className={thNum}>{t('src.yield')}</th>
                <th className={thNum}>{t('src.pension')}</th>
                <th className={thNum}>{t('proj.perMonth')}</th>
              </tr>
            }
          >
            {pr.years.map((y) => {
              const months = pr.months.filter((m) => m.month.startsWith(String(y.year))).length
              return (
                <tr key={y.year}>
                  <td className={td}>
                    {y.year}
                    {months < 12 && <span className="text-xs text-ink-400"> ({t('proj.monthsN', { count: months })})</span>}
                  </td>
                  <td className={tdNum}>
                    <Amt value={y.rent} cur={target} />
                  </td>
                  <td className={tdNum}>
                    <Amt value={y.yield} cur={target} />
                  </td>
                  <td className={tdNum}>
                    <Amt value={y.pension} cur={target} />
                  </td>
                  <td className={tdNum + ' font-medium'}>
                    <Amt value={y.total / months} cur={target} />
                  </td>
                </tr>
              )
            })}
          </Table>
        </Card>
      </div>
    </>
  )
}
