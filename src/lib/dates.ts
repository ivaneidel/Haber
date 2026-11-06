/** Local-calendar helpers. Dates are `YYYY-MM-DD`, months `YYYY-MM`. */

const pad = (n: number) => String(n).padStart(2, '0')

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function today(): string {
  return toISODate(new Date())
}

export function thisMonth(): string {
  return today().slice(0, 7)
}

export function monthOf(date: string): string {
  return date.slice(0, 7)
}

export function yearOf(dateOrMonth: string): number {
  return Number(dateOrMonth.slice(0, 4))
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number)
  const idx = y * 12 + (m - 1) + n
  return `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}`
}

/** Whole months from `a` to `b` (b − a). */
export function monthDiff(a: string, b: string): number {
  const [ya, ma] = a.split('-').map(Number)
  const [yb, mb] = b.split('-').map(Number)
  return (yb - ya) * 12 + (mb - ma)
}

/** Inclusive list of months. */
export function monthRange(from: string, to: string): string[] {
  const out: string[] = []
  for (let m = from; m <= to; m = addMonths(m, 1)) out.push(m)
  return out
}

export function yearMonths(year: number): string[] {
  return monthRange(`${year}-01`, `${year}-12`)
}

export function locale(lang: string): string {
  return lang.startsWith('en') ? 'en-US' : 'es-AR'
}

export function monthLabel(month: string, lang: string, style: 'long' | 'short' = 'long', withYear = true): string {
  const [y, m] = month.split('-').map(Number)
  const s = new Date(y, m - 1, 1).toLocaleDateString(locale(lang), {
    month: style,
    ...(withYear ? { year: 'numeric' } : {}),
  })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function dateLabel(date: string | undefined, lang: string): string {
  if (!date) return ''
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(locale(lang), { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function isDate(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
}

export function isMonth(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s)
}

export function uid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
