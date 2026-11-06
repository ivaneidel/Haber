import { apply, store } from './repo'
import type { Rate } from './types'

/**
 * Optional public quotes. The app works without them (rates can be typed by hand); these
 * only save typing. Both APIs are free, keyless and CORS-open. Nothing of hers is sent.
 */
export const API_SERIES: Record<string, string> = { MEP: 'bolsa', Oficial: 'oficial', Blue: 'blue', CCL: 'contadoconliqui' }

export const rateId = (series: string, date: string) => `${series}|${date}`

interface HistRow {
  casa: string
  compra: number
  venta: number
  fecha: string
}

/** Daily history (sell price) for a series, from `from` on. Returns how many rows were stored. */
export async function importHistory(series: string, from: string): Promise<number> {
  const casa = API_SERIES[series]
  if (!casa) throw new Error(`unknown series ${series}`)
  const res = await fetch(`https://api.argentinadatos.com/v1/cotizaciones/dolares/${casa}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const rows = (await res.json()) as HistRow[]
  const out: Rate[] = rows
    .filter((r) => r.fecha >= from && r.venta > 0)
    .map((r) => ({ id: rateId(series, r.fecha), date: r.fecha, series, value: r.venta, source: 'argentinadatos.com' }))
  // Never overwrite a rate she typed herself.
  const manual = new Set((await store.all('rates')).filter((r) => r.source === 'manual').map((r) => r.id))
  await apply(out.filter((r) => !manual.has(r.id)).map((row) => ({ op: 'put', table: 'rates', row })))
  return out.length
}

interface NowRow {
  casa: string
  venta: number
  fechaActualizacion: string
}

/** Today's quotes for every known series. */
export async function fetchToday(): Promise<Rate[]> {
  const res = await fetch('https://dolarapi.com/v1/dolares')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const rows = (await res.json()) as NowRow[]
  const out: Rate[] = []
  for (const [series, casa] of Object.entries(API_SERIES)) {
    const r = rows.find((x) => x.casa === casa)
    if (!r || !(r.venta > 0)) continue
    const d = new Date(r.fechaActualizacion)
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    out.push({ id: rateId(series, date), date, series, value: r.venta, source: 'dolarapi.com' })
  }
  await apply(out.map((row) => ({ op: 'put', table: 'rates', row })))
  return out
}
