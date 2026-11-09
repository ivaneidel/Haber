import { getSetting, setSetting } from './repo'
import type { FxConfig, ViewMode } from './money'
import { defaultProjection, type ProjectionSettings } from './projection'

/**
 * User-editable lists and view preferences, one settings row. The lists are plain strings
 * (her words, in her language); the defaults are seeded in Spanish because she writes in Spanish.
 */
export interface Prefs {
  methods: string[]
  fixedCategories: string[]
  installmentCategories: string[]
  eventualCategories: string[]
  channels: string[]
  investmentTypes: string[]
  institutions: string[]
  rateSeries: string[]
  /** Agencies / people who manage works ("quién gestionó"). Learned as she types. */
  managers: string[]
  /** One-time list migrations already applied (so a value she deletes stays deleted). */
  migrations: string[]
  fx: FxConfig
  view: ViewMode
  projection: ProjectionSettings
}

export const DEFAULT_PREFS: Prefs = {
  methods: ['Transferencia', 'Efectivo', 'Débito automático', 'PagoMisCuentas', 'Mercado Pago', 'Tarjeta de crédito', 'Tarjeta de débito', 'Depósito', 'Cheque', 'Otro'],
  fixedCategories: ['Rentas Río Negro', 'Impuesto inmobiliario', 'Tasas municipales', 'Expensas', 'Agua', 'Luz', 'Gas', 'Fibra / Internet', 'Seguro', 'Otros'],
  installmentCategories: ['Electrodomésticos', 'Equipamiento', 'Mejoras', 'Muebles', 'Otros'],
  eventualCategories: ['Mano de obra', 'Materiales', 'Reparaciones', 'Mantenimiento', 'Extraordinario', 'Otros'],
  channels: ['Mercado Libre', 'Marketplace', 'Venta particular', 'Otro'],
  investmentTypes: ['Plazo fijo', 'Fondo común de inversión', 'Bonos', 'Acciones', 'CEDEARs', 'Obligaciones negociables', 'Caución', 'Dólares en caja de ahorro', 'Otro'],
  institutions: [],
  rateSeries: ['MEP', 'Oficial', 'Blue'],
  managers: [],
  migrations: ['pmc', 'fibra'],
  fx: { series: 'MEP', criterion: 'historical' },
  view: 'split',
  projection: defaultProjection,
}

export function mergePrefs(stored: Partial<Prefs> | undefined): Prefs {
  const s = stored ?? {}
  return {
    ...DEFAULT_PREFS,
    ...s,
    fx: { ...DEFAULT_PREFS.fx, ...(s.fx ?? {}) },
    projection: { ...DEFAULT_PREFS.projection, ...(s.projection ?? {}) },
  }
}

export async function loadPrefs(): Promise<Prefs> {
  return mergePrefs(await getSetting<Partial<Prefs> | undefined>('prefs', undefined))
}

export async function savePrefs(patch: Partial<Prefs>): Promise<void> {
  const cur = await loadPrefs()
  await setSetting('prefs', { ...cur, ...patch })
}

/** Add a value to a list pref if it's new (autocomplete learns from what she types). */
export async function rememberInList(key: 'methods' | 'channels' | 'institutions' | 'investmentTypes' | 'rateSeries' | 'managers', value?: string): Promise<void> {
  const v = value?.trim()
  if (!v) return
  const cur = await loadPrefs()
  if (cur[key].some((x) => x.toLowerCase() === v.toLowerCase())) return
  await savePrefs({ [key]: [...cur[key], v] } as Partial<Prefs>)
}

/**
 * Additions to her saved lists that a new version brings. Each runs once; stored prefs that
 * predate it get the value inserted, and the id is recorded so deleting it later sticks.
 */
const LIST_MIGRATIONS: { id: string; key: 'methods' | 'fixedCategories'; value: string; after?: string }[] = [
  { id: 'pmc', key: 'methods', value: 'PagoMisCuentas', after: 'Débito automático' },
  { id: 'fibra', key: 'fixedCategories', value: 'Fibra / Internet', after: 'Gas' },
]

export async function migratePrefs(): Promise<void> {
  const stored = await getSetting<Partial<Prefs> | undefined>('prefs', undefined)
  if (!stored) return // fresh install: defaults already include everything
  const cur = mergePrefs(stored)
  const done = new Set(stored.migrations ?? [])
  const patch: Partial<Prefs> = {}
  for (const m of LIST_MIGRATIONS) {
    if (done.has(m.id)) continue
    done.add(m.id)
    const list = [...((patch[m.key] as string[] | undefined) ?? cur[m.key])]
    if (list.some((x) => x.toLowerCase() === m.value.toLowerCase())) continue
    const at = m.after ? list.indexOf(m.after) : -1
    list.splice(at >= 0 ? at + 1 : list.length, 0, m.value)
    patch[m.key] = list
  }
  if (done.size !== (stored.migrations ?? []).length) await setSetting('prefs', { ...cur, ...patch, migrations: [...done] })
}
