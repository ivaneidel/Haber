import { useMemo, useSyncExternalStore } from 'react'
import { store } from '../lib/repo'
import type { Snapshot } from '../lib/store/types'
import { toFlows, type Data, type Flow } from '../lib/calc'
import { lensesFor, makeLens, makeRateBook, type Lens, type RateBook } from '../lib/money'
import { mergePrefs, type Prefs } from '../lib/prefs'
import type { Currency } from '../lib/types'

/**
 * One shared subscription to the store, exposed to React as an external store.
 * Every component sees the same snapshot; any write re-renders the readers.
 */
let current: Snapshot | undefined
let unsub: (() => void) | undefined
const listeners = new Set<() => void>()

function subscribe(l: () => void) {
  listeners.add(l)
  if (!unsub)
    unsub = store.subscribe(
      (snap) => {
        current = snap
        listeners.forEach((fn) => fn())
      },
      (e) => console.error('store subscription failed', e),
    )
  return () => {
    listeners.delete(l)
  }
}

export function useSnapshot(): Snapshot | undefined {
  return useSyncExternalStore(subscribe, () => current)
}

/** Everything the calculations need, properties sorted (active first, by name). */
export function useData(): Data | undefined {
  const snap = useSnapshot()
  return useMemo(() => {
    if (!snap) return undefined
    const { settings: _settings, ...rest } = snap
    void _settings
    const properties = [...rest.properties].sort((a, b) => Number(!!a.archived) - Number(!!b.archived) || a.name.localeCompare(b.name))
    return { ...rest, properties }
  }, [snap])
}

export function usePrefs(): Prefs | undefined {
  const snap = useSnapshot()
  return useMemo(() => (snap ? mergePrefs(snap.settings.find((s) => s.id === 'prefs')?.value as Partial<Prefs> | undefined) : undefined), [snap])
}

export function useSetting<T>(key: string, fallback: T): T {
  const snap = useSnapshot()
  const row = snap?.settings.find((s) => s.id === key)
  return row ? (row.value as T) : fallback
}

export interface Model {
  data: Data
  prefs: Prefs
  flows: Flow[]
  book: RateBook
  /** Lenses for the current view: [ARS, USD] when split, one when consolidated. */
  lenses: Lens[]
  /** A consolidating lens into a given currency (rentabilidad, patrimonio). */
  lensInto: (c: Currency) => Lens
}

/** Data + prefs + derived helpers, or undefined while loading. */
export function useModel(): Model | undefined {
  const data = useData()
  const prefs = usePrefs()
  return useMemo(() => {
    if (!data || !prefs) return undefined
    const book = makeRateBook(data.rates, prefs.fx.series)
    return {
      data,
      prefs,
      flows: toFlows(data),
      book,
      lenses: lensesFor(prefs.view, book, prefs.fx),
      lensInto: (c: Currency) => makeLens(c, !!book.latest, book, prefs.fx),
    }
  }, [data, prefs])
}
