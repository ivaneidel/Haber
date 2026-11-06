import clsx from 'clsx'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { dateLabel } from '../lib/dates'
import { formatMoney, formatRate, type Lens, type ViewMode } from '../lib/money'
import { savePrefs } from '../lib/prefs'
import type { Currency } from '../lib/types'
import type { Model } from '../hooks/useData'
import { Segmented } from './ui'

export function Amt({ value, cur, sign, tone, decimals, className }: { value: number; cur: Currency; sign?: boolean; tone?: boolean; decimals?: boolean; className?: string }) {
  const { i18n } = useTranslation()
  return (
    <span
      className={clsx(
        'tnum whitespace-nowrap',
        tone && value > 0.004 && 'text-pos',
        tone && value < -0.004 && 'text-neg',
        className,
      )}
    >
      {formatMoney(value, cur, i18n.language, { sign, decimals })}
    </span>
  )
}

/**
 * One value per lens: two stacked lines (ARS / USD) in split view, one when consolidated.
 * In split view a zero USD line is hidden unless it's the only one.
 */
export function Multi({
  lenses,
  get,
  tone,
  sign,
  className,
  size = 'md',
}: {
  lenses: Lens[]
  get: (l: Lens) => number
  tone?: boolean
  sign?: boolean
  className?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const vals = lenses.map((l) => ({ cur: l.target, v: get(l) }))
  const shown = vals.length > 1 ? vals.filter((x, i) => i === 0 || Math.abs(x.v) > 0.004) : vals
  return (
    <span className={clsx('inline-flex flex-col', className)}>
      {shown.map((x, i) => (
        <Amt
          key={x.cur}
          value={x.v}
          cur={x.cur}
          tone={tone}
          sign={sign}
          className={clsx(
            size === 'lg' && (i === 0 ? 'text-2xl font-semibold' : 'text-base font-semibold'),
            size === 'md' && (i === 0 ? 'font-semibold' : 'text-sm font-medium'),
            size === 'sm' && 'text-sm',
          )}
        />
      ))}
    </span>
  )
}

export function Kpi({
  label,
  icon,
  lenses,
  get,
  tone,
  sub,
  to,
  color,
}: {
  label: ReactNode
  icon?: ReactNode
  lenses: Lens[]
  get: (l: Lens) => number
  tone?: boolean
  sub?: ReactNode
  to?: string
  color?: string
}) {
  const body = (
    <>
      <div className="flex items-center gap-1.5 text-xs font-medium text-ink-500 dark:text-ink-400">
        {color && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />}
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <Multi lenses={lenses} get={get} tone={tone} size="lg" className="mt-1" />
      {sub && <div className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">{sub}</div>}
    </>
  )
  const cls = 'block rounded-2xl border border-ink-200/80 bg-white p-4 dark:border-ink-800 dark:bg-ink-900'
  return to ? (
    <Link to={to} className={clsx(cls, 'transition-colors hover:border-brand-400 dark:hover:border-brand-600')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}

/** States how amounts in two currencies are being combined (spec §13: always explicit). */
export function FxCaption({ model, mode, className }: { model: Model; mode?: ViewMode; className?: string }) {
  const { t, i18n } = useTranslation()
  const view = mode ?? model.prefs.view
  const { book, prefs } = model
  if (view === 'split') return <p className={clsx('text-xs text-ink-500 dark:text-ink-400', className)}>{t('fx.splitCaption')}</p>
  if (!book.latest)
    return (
      <p className={clsx('text-xs text-amber-700 dark:text-amber-300', className)}>
        {t('fx.noRates', { series: prefs.fx.series })} <Link to="/ajustes#tc" className="underline">{t('fx.addRate')}</Link>
      </p>
    )
  return (
    <p className={clsx('text-xs text-ink-500 dark:text-ink-400', className)}>
      {prefs.fx.criterion === 'historical'
        ? t('fx.historicalCaption', { cur: view, series: book.series })
        : t('fx.latestCaption', { cur: view, series: book.series, rate: formatRate(book.latest.value, i18n.language), date: dateLabel(book.latest.date, i18n.language) })}{' '}
      <Link to="/ajustes#tc" className="underline">{t('fx.change')}</Link>
    </p>
  )
}

export function ViewSwitch({ model }: { model: Model }) {
  const { t } = useTranslation()
  return (
    <Segmented<ViewMode>
      label={t('fx.view')}
      value={model.prefs.view}
      onChange={(v) => void savePrefs({ view: v })}
      options={[
        { value: 'split', label: t('fx.split') },
        { value: 'ARS', label: t('fx.inARS') },
        { value: 'USD', label: t('fx.inUSD') },
      ]}
    />
  )
}

export function CurBadge({ cur }: { cur: Currency }) {
  return (
    <span
      className={clsx(
        'rounded px-1 py-px text-[10px] font-semibold tracking-wide',
        cur === 'USD' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200' : 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200',
      )}
    >
      {cur}
    </span>
  )
}
