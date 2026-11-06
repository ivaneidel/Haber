import clsx from 'clsx'
import { X } from 'lucide-react'
import { useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { monthLabel } from '../lib/dates'

export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx('rounded-2xl border border-ink-200/80 bg-white p-4 dark:border-ink-800 dark:bg-ink-900', className)} {...rest}>
      {children}
    </div>
  )
}

export function SectionTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={clsx('mb-2 flex min-h-8 items-center justify-between gap-2', className)}>
      <h2 className="text-sm font-semibold tracking-wide text-ink-600 uppercase dark:text-ink-300">{children}</h2>
      {action}
    </div>
  )
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <button
      type="button"
      className={clsx(
        'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl font-medium whitespace-nowrap transition-colors active:scale-[0.98] disabled:cursor-default disabled:opacity-40',
        size === 'sm' && 'px-2.5 py-1.5 text-sm',
        size === 'md' && 'px-3.5 py-2 text-sm',
        size === 'lg' && 'w-full px-4 py-3 text-base',
        variant === 'primary' && 'bg-brand-600 text-white hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600',
        variant === 'secondary' && 'bg-ink-100 text-ink-800 hover:bg-ink-200 dark:bg-ink-800 dark:text-ink-100 dark:hover:bg-ink-700',
        variant === 'ghost' && 'text-ink-700 hover:bg-ink-100 dark:text-ink-200 dark:hover:bg-ink-800',
        variant === 'danger' && 'bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950',
        className,
      )}
      {...rest}
    />
  )
}

export function IconButton({ label, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={clsx(
        'inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-600 hover:bg-ink-100 active:scale-95 dark:text-ink-300 dark:hover:bg-ink-800',
        className,
      )}
      {...rest}
    />
  )
}

/** Field base classes; a caller-supplied width (`w-24`, `flex-1`) replaces the default full width. */
const fc = (className?: string) => clsx(/(^|\s)(w-|flex-1)/.test(className ?? '') ? '' : 'w-full', fieldCls, className)
const fieldCls =
  'rounded-xl border border-ink-200 bg-white px-3 py-2 text-ink-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60 dark:border-ink-700 dark:bg-ink-950 dark:text-ink-100'

export function Field({
  label,
  hint,
  error,
  children,
  className,
  optional,
}: {
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  children: ReactNode
  className?: string
  optional?: boolean
}) {
  const { t } = useTranslation()
  return (
    <label className={clsx('block min-w-0', className)}>
      <span className="mb-1 block text-sm font-medium text-ink-700 dark:text-ink-300">
        {label}
        {optional && <span className="ml-1 font-normal text-ink-400">({t('common.optional')})</span>}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-red-600 dark:text-red-400">{error}</span>
      ) : (
        hint && <span className="mt-1 block text-xs text-ink-500 dark:text-ink-400">{hint}</span>
      )}
    </label>
  )
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={fc(className)} {...rest} />
}

/**
 * Amount input. Accepts Argentine style ("1.234.567,50") and plain ("1234567.5"), keeps the
 * partial text while typing, and shows thousands separators once the field loses focus.
 */
export function NumInput({
  value,
  onValue,
  className,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & { value: number | null | undefined; onValue: (n: number | null) => void }) {
  const { i18n } = useTranslation()
  const fmt = (n: number | null | undefined) =>
    n === null || n === undefined || Number.isNaN(n) ? '' : n.toLocaleString(i18n.language.startsWith('en') ? 'en-US' : 'es-AR', { maximumFractionDigits: 2 })
  const [text, setText] = useState(fmt(value))
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (!focused) setText(fmt(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, focused, i18n.language])
  return (
    <input
      inputMode="decimal"
      className={fc(clsx('tnum', className))}
      value={text}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        setText(e.target.value)
        onValue(parseAmount(e.target.value, i18n.language))
      }}
      {...rest}
    />
  )
}

/** "1.234,5" → 1234.5 (es); "1,234.5" → 1234.5 (en). A lone separator with 3 digits after is thousands. */
export function parseAmount(raw: string, lang = 'es'): number | null {
  let s = raw.replace(/[^\d.,-]/g, '')
  if (!s) return null
  const en = lang.startsWith('en')
  const dec = en ? '.' : ','
  const thou = en ? ',' : '.'
  if (s.includes(dec)) {
    s = s.split(thou).join('').replace(dec, '.')
  } else if (s.includes(thou)) {
    const parts = s.split(thou)
    // "1.5" in es is ambiguous: treat as decimal unless every group after the first has 3 digits.
    s = parts.slice(1).every((p) => p.length === 3) ? parts.join('') : parts.join('.')
  }
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export function Select({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={fc(clsx('cursor-pointer appearance-auto', className))} {...rest} />
}

export function TextArea({ className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={fc(clsx('min-h-16', className))} rows={2} {...rest} />
}

/** Month picker made of two selects: `<input type="month">` doesn't exist in Safari/Firefox desktop. */
export function MonthInput({
  value,
  onChange,
  fromYear = 2015,
  toYear = new Date().getFullYear() + 15,
  className,
}: {
  value: string
  onChange: (m: string) => void
  fromYear?: number
  toYear?: number
  className?: string
}) {
  const { i18n } = useTranslation()
  const [y, m] = value.split('-')
  const years: number[] = []
  for (let i = Math.min(fromYear, Number(y)); i <= Math.max(toYear, Number(y)); i++) years.push(i)
  return (
    <div className={clsx('flex gap-2', className)}>
      <Select value={m} onChange={(e) => onChange(`${y}-${e.target.value}`)} className="flex-1">
        {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((mm) => (
          <option key={mm} value={mm}>
            {monthLabel(`2000-${mm}`, i18n.language, 'long', false)}
          </option>
        ))}
      </Select>
      <Select value={y} onChange={(e) => onChange(`${e.target.value}-${m}`)} className="w-24">
        {years.map((yy) => (
          <option key={yy} value={yy}>
            {yy}
          </option>
        ))}
      </Select>
    </div>
  )
}

/** Tappable chips for short option lists. */
export function Chips<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
  size = 'md',
}: {
  options: { value: T; label: ReactNode; icon?: ReactNode }[]
  value: T | null | undefined
  onChange: (v: T) => void
  label?: string
  className?: string
  size?: 'sm' | 'md'
}) {
  return (
    <div role="radiogroup" aria-label={label} className={clsx('flex flex-wrap gap-1.5', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            'inline-flex cursor-pointer items-center gap-1.5 rounded-full border transition-colors',
            size === 'md' ? 'px-3 py-1.5 text-sm' : 'px-2.5 py-1 text-xs',
            value === o.value
              ? 'border-brand-600 bg-brand-600 text-white dark:border-brand-500 dark:bg-brand-500'
              : 'border-ink-200 bg-white text-ink-700 hover:bg-ink-100 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200 dark:hover:bg-ink-800',
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Compact segmented control (view toggles). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: ReactNode }[]
  value: T
  onChange: (v: T) => void
  label?: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl bg-ink-100 p-0.5 dark:bg-ink-800">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            'cursor-pointer rounded-[10px] px-2.5 py-1 text-sm whitespace-nowrap transition-colors',
            value === o.value
              ? 'bg-white font-medium text-ink-900 shadow-sm dark:bg-ink-600 dark:text-white'
              : 'text-ink-600 hover:text-ink-900 dark:text-ink-300 dark:hover:text-white',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div>
        <div className="text-sm text-ink-800 dark:text-ink-200">{label}</div>
        {hint && <div className="text-xs text-ink-500 dark:text-ink-400">{hint}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={clsx('relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors', checked ? 'bg-brand-600 dark:bg-brand-500' : 'bg-ink-300 dark:bg-ink-700')}
      >
        <span className={clsx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
      </button>
    </div>
  )
}

/** Bottom sheet on phones, centered dialog on wider screens. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  const { t } = useTranslation()
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className={clsx(
          'sheet-in relative flex max-h-[94dvh] w-full flex-col rounded-t-3xl bg-ink-50 shadow-2xl sm:max-h-[90dvh] sm:rounded-2xl dark:bg-ink-900',
          wide ? 'sm:max-w-3xl' : 'sm:max-w-xl',
        )}
      >
        <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-2">
          <h3 className="text-lg font-semibold">{title}</h3>
          <IconButton label={t('common.close')} onClick={onClose}>
            <X size={20} />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {footer && <div className="border-t border-ink-200 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-ink-800">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'info' | 'est' }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        tone === 'neutral' && 'bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-300',
        tone === 'good' && 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
        tone === 'warn' && 'bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
        tone === 'bad' && 'bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-200',
        tone === 'info' && 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200',
        tone === 'est' && 'border border-dashed border-violet-400 bg-violet-50 text-violet-800 dark:border-violet-500 dark:bg-violet-950/40 dark:text-violet-200',
      )}
    >
      {children}
    </span>
  )
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center text-sm text-ink-500 dark:text-ink-400">
      <p className="max-w-md">{children}</p>
      {action}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Note({ children, tone = 'info', className }: { children: ReactNode; tone?: 'info' | 'warn' | 'est'; className?: string }) {
  return (
    <div
      className={clsx(
        'rounded-xl px-3 py-2 text-sm',
        tone === 'info' && 'bg-blue-50 text-blue-900 dark:bg-blue-950/40 dark:text-blue-100',
        tone === 'warn' && 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100',
        tone === 'est' && 'border border-dashed border-violet-400 bg-violet-50 text-violet-900 dark:border-violet-600 dark:bg-violet-950/30 dark:text-violet-100',
        className,
      )}
    >
      {children}
    </div>
  )
}

/** Simple responsive table: horizontal scroll on phones. */
export function Table({ head, children, className }: { head: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={clsx('-mx-4 overflow-x-auto px-4', className)}>
      <table className="w-full border-collapse text-sm">
        <thead className="text-left text-xs text-ink-500 dark:text-ink-400">{head}</thead>
        <tbody className="tnum [&>tr]:border-t [&>tr]:border-ink-100 dark:[&>tr]:border-ink-800">{children}</tbody>
      </table>
    </div>
  )
}

export const th = 'px-2 py-2 font-medium first:pl-0 last:pr-0'
export const td = 'px-2 py-2 first:pl-0 last:pr-0'
export const tdNum = 'px-2 py-2 text-right whitespace-nowrap first:pl-0 last:pr-0'
export const thNum = 'px-2 py-2 text-right font-medium first:pl-0 last:pr-0'

export function confirmAction(msg: string): boolean {
  return typeof window !== 'undefined' ? window.confirm(msg) : true
}
