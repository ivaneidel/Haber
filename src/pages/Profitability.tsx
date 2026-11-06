import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ChartCard, Lines, SLOTS, pctFmt, type Row, type SeriesDef } from '../components/Charts'
import { Amt, FxCaption } from '../components/money'
import { Badge, Card, Empty, Note, PageHeader, Select, Table, td, tdNum, th, thNum } from '../components/ui'
import { useModel, type Model } from '../hooks/useData'
import { dataYears, propertyYield, valuationForYear, type YieldRow } from '../lib/calc'
import { today } from '../lib/dates'
import { formatPct } from '../lib/money'

/** Whole portfolio in USD: net rent over total value, both converted. */
function portfolio(model: Model, year: number, rows: YieldRow[]) {
  const usd = model.lensInto('USD')
  const end = `${year}-12-31` < today() ? `${year}-12-31` : today()
  let net = 0
  let value = 0
  let gross = 0
  let expenses = 0
  for (const r of rows) {
    const v = valuationForYear(model.data, r.property.id, year)
    if (!v) continue
    const y = propertyYield(model.data, model.flows, r.property, year, () => usd)
    net += y.net
    gross += y.gross
    expenses += y.expenses
    value += usd(v.v.value, v.v.currency, end)
  }
  return { net, value, gross, expenses, pct: value ? (net / value) * 100 : null }
}

export default function Profitability() {
  const { t, i18n } = useTranslation()
  const model = useModel()
  const nowYear = Number(today().slice(0, 4))
  const [year, setYear] = useState(nowYear)
  if (!model) return null
  const { data, flows } = model
  const years = dataYears(data, nowYear)
  const props = data.properties.filter((p) => !p.soldAt || p.soldAt.slice(0, 4) >= String(year))
  const rows = props.map((p) => propertyYield(data, flows, p, year, model.lensInto))
  const active = rows.filter((r) => r.gross || r.expenses || r.value)
  const port = portfolio(model, year, active)
  const pf = pctFmt(i18n.language)

  const cmpRows: Row[] = active.filter((r) => r.pct !== null).map((r) => ({ label: r.property.name, pct: Math.round((r.pct ?? 0) * 100) / 100 }))
  const evoProps = props.slice(0, 8)
  const evoSeries: SeriesDef[] = evoProps.map((p, i) => ({ key: p.id, label: p.name, color: SLOTS[i] }))
  const evoRows: Row[] = years.map((y) => {
    const row: Row = { label: String(y) }
    for (const p of evoProps) {
      const r = propertyYield(data, flows, p, y, model.lensInto)
      row[p.id] = r.pct !== null && (r.gross || r.expenses) ? Math.round(r.pct * 100) / 100 : null
    }
    return row
  })
  const partial = year === nowYear

  return (
    <>
      <PageHeader
        title={t('nav.profitability')}
        subtitle={t('profit.subtitle')}
        actions={
          <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-28" aria-label={t('common.year')}>
            {years.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </Select>
        }
      />
      <Note className="mb-3">{t('profit.formula')}</Note>
      <FxCaption model={model} mode="USD" className="mb-4" />
      {partial && <Note tone="warn" className="mb-4">{t('profit.partialYear')}</Note>}

      {active.length === 0 ? (
        <Card>
          <Empty>{t('profit.none')}</Empty>
        </Card>
      ) : (
        <>
          <Card>
            <Table
              head={
                <tr>
                  <th className={th}>{t('form.property')}</th>
                  <th className={thNum}>{t('profit.gross')}</th>
                  <th className={thNum}>{t('profit.expenses')}</th>
                  <th className={thNum}>{t('profit.net')}</th>
                  <th className={thNum}>{t('profit.value')}</th>
                  <th className={thNum}>{t('profit.pct')}</th>
                  <th className={thNum + ' border-l border-ink-100 dark:border-ink-800'}>{t('profit.appreciation')}</th>
                </tr>
              }
            >
              {active.map((r) => (
                <tr key={r.property.id}>
                  <td className={td}>
                    <Link to={`/propiedades/${r.property.id}`} className="font-medium hover:underline">
                      {r.property.name}
                    </Link>
                    {r.property.soldAt && <Badge>{t('property.sold')}</Badge>}
                  </td>
                  <td className={tdNum}>
                    <Amt value={r.gross} cur={r.currency} />
                  </td>
                  <td className={tdNum}>
                    <Amt value={r.expenses} cur={r.currency} />
                  </td>
                  <td className={tdNum}>
                    <Amt value={r.net} cur={r.currency} tone className="font-medium" />
                  </td>
                  <td className={tdNum}>
                    {r.value ? <Amt value={r.value} cur={r.currency} /> : <Link to={`/propiedades/${r.property.id}`} className="text-amber-700 underline dark:text-amber-300">{t('profit.addValue')}</Link>}
                    {r.approx && <div className="text-[11px] text-ink-400">{t('profit.approx')}</div>}
                  </td>
                  <td className={tdNum + ' font-semibold'}>{formatPct(r.pct, i18n.language, 2)}</td>
                  <td className={tdNum + ' border-l border-ink-100 dark:border-ink-800'}>
                    {r.appreciation !== null ? (
                      <>
                        <Amt value={r.appreciation} cur={r.currency} tone sign />
                        <div className="text-xs text-ink-500">{formatPct(r.appreciationPct, i18n.language)}</div>
                      </>
                    ) : (
                      <span className="text-ink-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className={td}>{t('profit.portfolio')} (USD)</td>
                <td className={tdNum}>
                  <Amt value={port.gross} cur="USD" />
                </td>
                <td className={tdNum}>
                  <Amt value={port.expenses} cur="USD" />
                </td>
                <td className={tdNum}>
                  <Amt value={port.net} cur="USD" tone />
                </td>
                <td className={tdNum}>
                  <Amt value={port.value} cur="USD" />
                </td>
                <td className={tdNum}>{formatPct(port.pct, i18n.language, 2)}</td>
                <td className="border-l border-ink-100 dark:border-ink-800" />
              </tr>
            </Table>
            <p className="mt-3 text-xs text-ink-500">{t('profit.appreciationNote')}</p>
          </Card>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <ChartCard title={t('profit.compare', { year })} rows={cmpRows} series={[{ key: 'pct', label: t('profit.pct'), color: 'var(--color-s-rent)' }]} fmt={pf}>
              <PctBars rows={cmpRows} />
            </ChartCard>
            <ChartCard title={t('profit.evolution')} subtitle={t('profit.evolutionSub')} rows={evoRows} series={evoSeries} fmt={pf}>
              <Lines rows={evoRows} series={evoSeries} fmt={pf} fmtAxis={(n) => `${n}%`} />
            </ChartCard>
          </div>
        </>
      )}
    </>
  )
}

/** Horizontal percent bars, one per property, labelled with the exact value. */
function PctBars({ rows }: { rows: Row[] }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(Number(r.pct) || 0)))
  const { i18n } = useTranslation()
  if (!rows.length) return <Empty>—</Empty>
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => {
        const v = Number(r.pct) || 0
        return (
          <li key={r.label} className="text-sm">
            <div className="flex justify-between gap-2">
              <span className="truncate">{r.label}</span>
              <span className="font-semibold tnum">{formatPct(v, i18n.language, 2)}</span>
            </div>
            <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
              <div className="h-full rounded-full" style={{ width: `${(Math.abs(v) / max) * 100}%`, background: v >= 0 ? 'var(--color-s-rent)' : 'var(--color-neg)' }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

