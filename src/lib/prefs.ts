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
  fx: FxConfig
  view: ViewMode
  projection: ProjectionSettings
}

export const DEFAULT_PREFS: Prefs = {
  methods: ['Transferencia', 'Efectivo', 'Mercado Pago', 'Depósito', 'Cheque', 'Débito automático', 'Tarjeta de crédito', 'Tarjeta de débito'],
  fixedCategories: ['Rentas Río Negro', 'Impuesto inmobiliario', 'Tasas municipales', 'Expensas', 'Agua', 'Luz', 'Gas', 'Seguro', 'Otros'],
  installmentCategories: ['Electrodomésticos', 'Equipamiento', 'Mejoras', 'Muebles', 'Otros'],
  eventualCategories: ['Mano de obra', 'Materiales', 'Reparaciones', 'Mantenimiento', 'Extraordinario', 'Otros'],
  channels: ['Mercado Libre', 'Marketplace', 'Venta particular', 'Otro'],
  investmentTypes: ['Plazo fijo', 'Fondo común de inversión', 'Bonos', 'Acciones', 'CEDEARs', 'Obligaciones negociables', 'Caución', 'Dólares en caja de ahorro', 'Otro'],
  institutions: [],
  rateSeries: ['MEP', 'Oficial', 'Blue'],
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
export async function rememberInList(key: 'methods' | 'channels' | 'institutions' | 'investmentTypes' | 'rateSeries', value?: string): Promise<void> {
  const v = value?.trim()
  if (!v) return
  const cur = await loadPrefs()
  if (cur[key].some((x) => x.toLowerCase() === v.toLowerCase())) return
  await savePrefs({ [key]: [...cur[key], v] } as Partial<Prefs>)
}
