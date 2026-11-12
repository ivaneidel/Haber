import clsx from 'clsx'
import { useTranslation } from 'react-i18next'
import { monthlyRealEstate, type Flow, type Totals } from '../lib/calc'
import { monthLabel } from '../lib/dates'
import type { Lens } from '../lib/money'
import { Multi } from './money'
import { Card, Table, td, tdNum, th, thNum } from './ui'

/**
 * "Resultado de las propiedades mes a mes": one row per month with rents, each cost kind,
 * the month's net and the running total, plus the year's total. `flows` may be pre-scoped to
 * one property. Split view shows ARS and USD stacked in each cell, like the KPIs.
 */
export function MonthlyNetTable({ flows, lenses, year, byPeriod = false, className }: { flows: Flow[]; lenses: Lens[]; year: number; byPeriod?: boolean; className?: string }) {
  const { t, i18n } = useTranslation()
  const per = new Map(lenses.map((l) => [l.target, monthlyRealEstate(flows, l, year, byPeriod)]))
  const main = per.get(lenses[0].target)!
  const cols: { key: keyof Totals; label: string }[] = [
    { key: 'rent', label: t('netTable.rents') },
    { key: 'fixed', label: t('kind.fixed') },
    { key: 'installment', label: t('kind.installment') },
    { key: 'eventual', label: t('kind.eventual') },
    { key: 'fee', label: t('kind.feeShort') },
  ]
  const cell = (get: (l: Lens) => number, opts: { tone?: boolean; bold?: boolean } = {}) => (
    <Multi lenses={lenses} get={get} tone={opts.tone} size="sm" className={clsx('items-end', opts.bold && 'font-semibold')} />
  )
  // Costs shown negative so a row reads rent − costs = net (0 − v avoids a "-0").
  const signed = (k: keyof Totals, v: number) => (k === 'rent' ? v : 0 - v)
  const row = (l: Lens, i: number) => per.get(l.target)!.rows[i]
  const tot = (l: Lens) => per.get(l.target)!.total

  return (
    <Card className={className}>
      <h3 className="font-semibold">{t('netTable.title', { year })}</h3>
      <p className="mb-2 text-xs text-ink-500">{t('netTable.sub')}</p>
      <Table
        head={
          <tr>
            <th className={th}>{t('netTable.month')}</th>
            {cols.map((c) => (
              <th key={c.key} className={thNum}>
                {c.label}
              </th>
            ))}
            <th className={thNum}>{t('netTable.net')}</th>
            <th className={thNum}>{t('netTable.cumulative')}</th>
          </tr>
        }
      >
        {main.rows.map((m, i) => (
          <tr key={m.month}>
            <td className={clsx(td, 'whitespace-nowrap capitalize')}>{monthLabel(m.month, i18n.language, 'long', false)}</td>
            {m.future ? (
              <td colSpan={cols.length + 2} className={clsx(tdNum, 'text-ink-400')}>
                —
              </td>
            ) : (
              <>
                {cols.map((c) => (
                  <td key={c.key} className={tdNum}>
                    {cell((l) => signed(c.key, row(l, i)[c.key]))}
                  </td>
                ))}
                <td className={tdNum}>{cell((l) => row(l, i).realEstateNet, { tone: true, bold: true })}</td>
                <td className={tdNum}>{cell((l) => row(l, i).cumulative, { tone: true })}</td>
              </>
            )}
          </tr>
        ))}
        <tr className="border-t-2! border-ink-300! font-semibold dark:border-ink-600!">
          <td className={td}>{t('netTable.total')}</td>
          {cols.map((c) => (
            <td key={c.key} className={tdNum}>
              {cell((l) => signed(c.key, tot(l)[c.key]), { bold: true })}
            </td>
          ))}
          <td className={tdNum}>{cell((l) => tot(l).realEstateNet, { tone: true, bold: true })}</td>
          <td className={tdNum} />
        </tr>
      </Table>
    </Card>
  )
}
