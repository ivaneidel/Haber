import { BarChart3, Table2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCompact, formatMoney, formatPct } from '../lib/money'
import type { Currency } from '../lib/types'
import { Card, IconButton, Table, td, th, tdNum, thNum } from './ui'

export interface SeriesDef {
  key: string
  label: string
  color: string
  dashed?: boolean
}

export type Row = Record<string, string | number | null | undefined> & { label: string }

const axis = { fontSize: 12, fill: 'var(--color-ink-500)' }

/** Card with a chart and its table view (every chart has one — accessibility + exact numbers). */
export function ChartCard({
  title,
  subtitle,
  action,
  rows,
  series,
  fmt,
  children,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  rows: Row[]
  series: SeriesDef[]
  fmt: (n: number) => string
  children: ReactNode
  className?: string
}) {
  const { t } = useTranslation()
  const [table, setTable] = useState(false)
  return (
    <Card className={className}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold">{title}</h3>
          {subtitle && <p className="text-xs text-ink-500 dark:text-ink-400">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-1">
          {action}
          <IconButton label={table ? t('chart.showChart') : t('chart.showTable')} onClick={() => setTable(!table)}>
            {table ? <BarChart3 size={18} /> : <Table2 size={18} />}
          </IconButton>
        </div>
      </div>
      {table ? (
        <Table
          head={
            <tr>
              <th className={th} />
              {series.map((s) => (
                <th key={s.key} className={thNum}>
                  {s.label}
                </th>
              ))}
            </tr>
          }
        >
          {rows.map((r) => (
            <tr key={r.label}>
              <td className={td}>{r.label}</td>
              {series.map((s) => (
                <td key={s.key} className={tdNum}>
                  {typeof r[s.key] === 'number' ? fmt(r[s.key] as number) : '—'}
                </td>
              ))}
            </tr>
          ))}
        </Table>
      ) : (
        children
      )}
    </Card>
  )
}

function TooltipBox({ active, payload, label, fmt, total }: { active?: boolean; payload?: { name: string; value: number; color: string; dataKey: string }[]; label?: string; fmt: (n: number) => string; total?: string }) {
  if (!active || !payload?.length) return null
  const sum = payload.reduce((s, p) => s + (Number(p.value) || 0), 0)
  return (
    <div className="rounded-xl border border-ink-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-ink-700 dark:bg-ink-900">
      <div className="mb-1 font-semibold text-ink-800 dark:text-ink-100">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-ink-600 dark:text-ink-300">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="tnum font-medium text-ink-900 dark:text-ink-100">{fmt(Number(p.value) || 0)}</span>
        </div>
      ))}
      {total && payload.length > 1 && (
        <div className="mt-1 flex justify-between gap-4 border-t border-ink-100 pt-1 dark:border-ink-800">
          <span className="text-ink-600 dark:text-ink-300">{total}</span>
          <span className="tnum font-semibold">{fmt(sum)}</span>
        </div>
      )}
    </div>
  )
}

function LegendRow({ series }: { series: SeriesDef[] }) {
  return (
    <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-ink-600 dark:text-ink-300">
      {series.map((s) => (
        <span key={s.key} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  )
}

export function useMoneyFmt(cur: Currency) {
  const { i18n } = useTranslation()
  return {
    full: (n: number) => formatMoney(n, cur, i18n.language),
    compact: (n: number) => formatCompact(n, cur, i18n.language),
  }
}

/** Stacked or grouped bars. */
export function Bars({
  rows,
  series,
  cur,
  stacked = true,
  height = 260,
  totalLabel,
}: {
  rows: Row[]
  series: SeriesDef[]
  cur: Currency
  stacked?: boolean
  height?: number
  totalLabel?: string
}) {
  const f = useMoneyFmt(cur)
  return (
    <>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: 4 }} stackOffset="sign" barGap={2} barCategoryGap={stacked ? '22%' : '18%'}>
          <CartesianGrid vertical={false} stroke="var(--color-grid)" />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={8} />
          <YAxis tick={axis} tickLine={false} axisLine={false} tickFormatter={f.compact} width={72} />
          <ReferenceLine y={0} stroke="var(--color-ink-300)" />
          <Tooltip cursor={{ fill: 'var(--color-grid)', opacity: 0.5 }} content={<TooltipBox fmt={f.full} total={stacked ? totalLabel : undefined} />} />
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stackId={stacked ? 'a' : undefined}
              fill={s.color}
              stroke="var(--color-surface)"
              strokeWidth={stacked ? 1 : 0}
              radius={stacked ? (i === series.length - 1 ? [4, 4, 0, 0] : 0) : [4, 4, 0, 0]}
              maxBarSize={36}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
      {series.length > 1 && <LegendRow series={series} />}
    </>
  )
}

export function Lines({ rows, series, fmt, fmtAxis, height = 240 }: { rows: Row[]; series: SeriesDef[]; fmt: (n: number) => string; fmtAxis: (n: number) => string; height?: number }) {
  return (
    <>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: 4 }}>
          <CartesianGrid vertical={false} stroke="var(--color-grid)" />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={8} />
          <YAxis tick={axis} tickLine={false} axisLine={false} tickFormatter={fmtAxis} width={72} />
          <ReferenceLine y={0} stroke="var(--color-ink-300)" />
          <Tooltip content={<TooltipBox fmt={fmt} />} />
          {series.map((s) => (
            <Line
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              strokeDasharray={s.dashed ? '5 4' : undefined}
              dot={{ r: 3, strokeWidth: 0, fill: s.color }}
              activeDot={{ r: 5, stroke: 'var(--color-surface)', strokeWidth: 2 }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
          <Legend content={() => null} />
        </LineChart>
      </ResponsiveContainer>
      {series.length > 1 && <LegendRow series={series} />}
    </>
  )
}

export const pctFmt = (lang: string) => (n: number) => formatPct(n, lang)

/** Fixed colours: they follow the entity, never its rank. */
export const C = {
  rent: 'var(--color-s-rent)',
  sale: 'var(--color-s-sale)',
  yield: 'var(--color-s-yield)',
  pension: 'var(--color-s-pension)',
  other: 'var(--color-s-other)',
  fixed: 'var(--color-s-fixed)',
  installment: 'var(--color-s-installment)',
  eventual: 'var(--color-s-eventual)',
  net: 'var(--color-s-net)',
  prev: 'var(--color-ink-300)',
}

/** Categorical slots for per-property series (dataviz reference order). */
export const SLOTS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948']
