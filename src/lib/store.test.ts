import { describe, expect, it } from 'vitest'
import { createDexieStore } from './store/dexie'
import type { Snapshot } from './store/types'

describe('dexie store (contract any backend must meet)', () => {
  it('applies batches atomically and notifies subscribers', async () => {
    const s = createDexieStore('test-' + Math.random())
    const snaps: Snapshot[] = []
    const unsub = s.subscribe((x) => snaps.push(x))
    await s.apply([
      { op: 'put', table: 'settings', row: { id: 'a', value: 1 } },
      { op: 'put', table: 'rates', row: { id: 'MEP|2026-01-01', date: '2026-01-01', series: 'MEP', value: 1000 } },
    ])
    expect(await s.get('settings', 'a')).toEqual({ id: 'a', value: 1 })
    await s.apply([{ op: 'delete', table: 'settings', id: 'a' }])
    expect(await s.get('settings', 'a')).toBeUndefined()
    await new Promise((r) => setTimeout(r, 50))
    expect(snaps.length).toBeGreaterThan(0)
    expect(snaps[snaps.length - 1].rates).toHaveLength(1)
    unsub()
  })

  it('a failing batch writes nothing', async () => {
    const s = createDexieStore('test-' + Math.random())
    await expect(
      s.apply([
        { op: 'put', table: 'settings', row: { id: 'ok', value: 1 } },
        // @ts-expect-error unknown table makes the transaction fail
        { op: 'put', table: 'nope', row: { id: 'x' } },
      ]),
    ).rejects.toBeTruthy()
    expect(await s.get('settings', 'ok')).toBeUndefined()
  })

  it('replaceAll wipes and loads', async () => {
    const s = createDexieStore('test-' + Math.random())
    await s.apply([{ op: 'put', table: 'settings', row: { id: 'old', value: 1 } }])
    await s.replaceAll({ settings: [{ id: 'new', value: 2 }] })
    expect(await s.all('settings')).toEqual([{ id: 'new', value: 2 }])
  })
})
