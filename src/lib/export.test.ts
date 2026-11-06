import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import i18n from '../i18n'
import { buildSheets } from './export'
import { loadDemo, seedFirstRun } from './seed'
import { store } from './repo'
import { emptyData, type Data } from './calc'
import { DEFAULT_PREFS } from './prefs'
import { makeBackup } from './backup'

async function loadData(): Promise<Data> {
  const d = emptyData()
  for (const k of Object.keys(d) as (keyof Data)[]) (d as unknown as Record<string, unknown>)[k] = await store.all(k)
  return d
}

describe('demo seed → Excel export', () => {
  it('builds every sheet and writes a workbook', async () => {
    await seedFirstRun()
    await loadDemo()
    const d = await loadData()
    expect(d.properties).toHaveLength(3)
    expect(d.pensions).toHaveLength(2)
    const sheets = buildSheets(d, DEFAULT_PREFS.fx, i18n.t)
    expect(sheets.map((s) => s.name)).toContain('Resumen mensual')
    expect(sheets.find((s) => s.name === 'Alquileres')!.rows.length).toBeGreaterThan(40)
    const wb = XLSX.utils.book_new()
    for (const s of sheets) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(s.rows), s.name.slice(0, 31))
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
    expect(out.byteLength).toBeGreaterThan(10_000)
  })

  it('backup round-trips through replaceAll', async () => {
    const b = await makeBackup()
    const before = b.tables.incomes!.length
    await store.replaceAll({})
    expect(await store.all('incomes')).toHaveLength(0)
    await store.replaceAll(b.tables)
    expect(await store.all('incomes')).toHaveLength(before)
  })
})
