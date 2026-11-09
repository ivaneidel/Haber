import { apply, getSetting, store } from './repo'
import type { Op, TableName, Tables } from './store/types'
import { addMonths, monthRange, thisMonth, today, uid } from './dates'
import { rateId } from './fx'
import type { Bill, Currency, Expense, Income, Investment, Pension, Plan, Property, Rate, Recurring, Sale, StatusChange, Valuation, Yield } from './types'

const puts = <T extends TableName>(table: T, rows: Tables[T][]): Op[] => rows.map((row) => ({ op: 'put', table, row }) as Op)

const stamp = () => {
  const t = new Date().toISOString()
  return { createdAt: t, updatedAt: t }
}

/**
 * First run: the two pensions the spec already knows about, with no amount yet
 * ("los importes deberán poder cargarse cuando se conozcan").
 */
export async function seedFirstRun(): Promise<void> {
  if (await getSetting('seeded', false)) return
  const ops: Op[] = [{ op: 'put', table: 'settings', row: { id: 'seeded', value: true } }]
  if ((await store.all('pensions')).length === 0) {
    const base = { currency: 'ARS' as Currency, amount: null, confirmed: false, aguinaldo: true, ...stamp() }
    ops.push(
      ...puts('pensions', [
        { id: uid(), name: 'Primera jubilación', startMonth: '2027-05', notes: 'Fecha prevista.', ...base },
        { id: uid(), name: 'Jubilación del marido', startMonth: '2031-05', notes: 'Fecha aproximada (unos cuatro años después).', ...base },
      ]),
    )
  }
  await apply(ops)
}

/**
 * Example data so she can look around before entering her own. Only offered on an empty
 * database, and flagged so the app can show a "these are examples" banner.
 */
export async function loadDemo(): Promise<void> {
  const s = stamp()
  const now = thisMonth()
  const start = addMonths(now, -22)
  const months = monthRange(start, addMonths(now, -1))
  const day = (m: string, d: number) => `${m}-${String(d).padStart(2, '0')}`

  const props: Property[] = [
    { id: uid(), name: 'Depto. Mitre', address: 'Mitre 455, 3° B', city: 'Bariloche', province: 'Río Negro', postalCode: '8400', cadastre: '19-1-D-332-08', parcel: '19-123456', tenant: 'Laura Gómez', contractStart: `${start}-01`, contractEnd: `${addMonths(start, 36)}-01`, refRent: 650_000, refRentCurrency: 'ARS', ...s },
    { id: uid(), name: 'Casa Las Victorias', address: 'Los Coihues 120', city: 'Bariloche', province: 'Río Negro', tenant: 'Martín Ríos', contractStart: `${addMonths(start, 4)}-01`, contractEnd: `${addMonths(start, 40)}-01`, refRent: 900_000, refRentCurrency: 'ARS', ...s },
    { id: uid(), name: 'Local Centro', address: 'Moreno 80', city: 'Viedma', province: 'Río Negro', tenant: 'Ferretería Sur', refRent: 800, refRentCurrency: 'USD', ...s },
  ]
  const valuations: Valuation[] = [
    { id: uid(), propertyId: props[0].id, date: `${start}-01`, value: 85_000, currency: 'USD', ...s },
    { id: uid(), propertyId: props[0].id, date: today(), value: 92_000, currency: 'USD', ...s },
    { id: uid(), propertyId: props[1].id, date: `${start}-01`, value: 160_000, currency: 'USD', ...s },
    { id: uid(), propertyId: props[2].id, date: `${start}-01`, value: 120_000, currency: 'USD', ...s },
  ]

  // Rents: ARS ones go up 4 % a quarter; some are collected the next month.
  const incomes: Income[] = []
  months.forEach((m, i) => {
    const step = Math.pow(1.04, Math.floor(i / 3))
    const late = i % 5 === 2
    incomes.push({ id: uid(), source: 'rent', date: day(late ? addMonths(m, 1) : m, late ? 3 : 8), period: m, propertyId: props[0].id, payer: props[0].tenant, amount: Math.round((480_000 * step) / 1000) * 1000, currency: 'ARS', method: 'Transferencia', ...s })
    if (i >= 4)
      incomes.push({ id: uid(), source: 'rent', date: day(m, 10), period: m, propertyId: props[1].id, payer: props[1].tenant, amount: Math.round((700_000 * step) / 1000) * 1000, currency: 'ARS', method: 'Transferencia', ...s })
    // Local Centro was empty for three months (see statusLog below).
    if (i < months.length - 5 || i >= months.length - 2)
      incomes.push({ id: uid(), source: 'rent', date: day(m, 5), period: m, propertyId: props[2].id, payer: props[2].tenant, amount: 800, currency: 'USD', method: 'Efectivo', ...s })
  })
  // Depto. Mitre is collected by an agency for the last 6 months: 6 % fee withheld.
  for (const i of incomes.filter((x) => x.propertyId === props[0].id && x.period! >= addMonths(now, -6))) i.fee = Math.round((i.amount * 0.06) / 0.94 / 100) * 100
  const statusLog: StatusChange[] = [
    { id: uid(), propertyId: props[2].id, status: 'vacant', from: day(addMonths(now, -5), 1), notes: 'Se fue Ferretería Sur', ...s },
    { id: uid(), propertyId: props[2].id, status: 'repair', from: day(addMonths(now, -4), 10), notes: 'Pintura y baño', ...s },
    { id: uid(), propertyId: props[2].id, status: 'rented', from: day(addMonths(now, -2), 1), notes: 'Nuevo contrato', ...s },
  ]

  const recurring: Recurring[] = [
    { id: uid(), propertyId: props[0].id, concept: 'Rentas Río Negro', category: 'Rentas Río Negro', provider: 'Agencia de Recaudación Tributaria', account: '19-123456', dueDay: Math.min(28, Number(today().slice(8)) + 1), every: 1, startMonth: start, amount: 38_000, currency: 'ARS', method: 'PagoMisCuentas', channel: 'portal', portalUrl: 'https://www.agenciarentas.rionegro.gov.ar', active: true, ...s },
    { id: uid(), propertyId: props[0].id, concept: 'Tasa municipal', category: 'Tasas municipales', provider: 'Municipalidad de Bariloche', account: 'T-88213', dueDay: 5, every: 1, startMonth: start, amount: 22_000, currency: 'ARS', method: 'Transferencia', channel: 'paper', active: true, ...s },
    { id: uid(), propertyId: props[0].id, concept: 'Gas', category: 'Gas', provider: 'Camuzzi', account: '9100234556', dueDay: 20, every: 1, startMonth: start, amount: 0, currency: 'ARS', method: 'Débito automático', channel: 'email', channelEmail: 'familia@example.com', active: true, ...s },
    { id: uid(), propertyId: props[1].id, concept: 'Rentas Río Negro', category: 'Rentas Río Negro', every: 1, startMonth: start, amount: 52_000, currency: 'ARS', method: 'Débito automático', active: true, ...s },
    { id: uid(), propertyId: props[2].id, concept: 'Seguro integral', category: 'Seguro', every: 12, startMonth: addMonths(start, 2), amount: 410_000, currency: 'ARS', method: 'Transferencia', active: true, ...s },
  ]
  const expenses: Expense[] = []
  for (const r of recurring)
    months.forEach((m, i) => {
      if ((i - months.indexOf(r.startMonth)) % r.every !== 0 || m < r.startMonth) return
      const step = Math.pow(1.04, Math.floor(i / 3))
      // Gas has no usual amount: it varies with the season.
      const amount = r.amount ? r.amount * step : 25_000 + (i % 6) * 9_000
      expenses.push({ id: uid(), kind: 'fixed', date: day(m, 15), period: m, recurringId: r.id, propertyId: r.propertyId, concept: r.concept, category: r.category, amount: Math.round(amount / 100) * 100, currency: r.currency, method: r.method, ...s })
    })

  const planStart = addMonths(now, -4)
  const plans: Plan[] = [
    { id: uid(), propertyId: props[1].id, concept: 'Heladera no frost', category: 'Electrodomésticos', total: 1_440_000, count: 12, installment: 120_000, currency: 'ARS', startMonth: planStart, method: 'Tarjeta de crédito', ...s },
  ]
  for (let n = 1; n <= 4; n++)
    expenses.push({ id: uid(), kind: 'installment', date: day(addMonths(planStart, n - 1), 12), planId: plans[0].id, installmentNo: n, propertyId: props[1].id, concept: plans[0].concept, category: plans[0].category, amount: 120_000, currency: 'ARS', method: 'Tarjeta de crédito', ...s })

  const eventual: [number, number, string, string, number][] = [
    [0, 3, 'Plomero: pérdida baño', 'Mano de obra', 85_000],
    [1, 9, 'Pintura frente', 'Mano de obra', 420_000],
    [1, 9, 'Pintura y rodillos', 'Materiales', 190_000],
    [2, 14, 'Cambio de cerradura', 'Reparaciones', 60_000],
    [0, 19, 'Limpieza de tanque', 'Mantenimiento', 45_000],
  ]
  for (const [pi, mi, concept, category, amount] of eventual)
    expenses.push({ id: uid(), kind: 'eventual', date: day(months[mi], 20), propertyId: props[pi].id, concept, category, amount, currency: 'ARS', method: 'Efectivo', ...s })
  // Works during Local Centro's vacancy, and works the Mitre agency paid out of the rent.
  const lastMitre = incomes.filter((x) => x.propertyId === props[0].id).sort((a, b) => b.date.localeCompare(a.date))[0]
  expenses.push(
    { id: uid(), kind: 'eventual', date: day(addMonths(now, -4), 18), workDate: day(addMonths(now, -4), 12), propertyId: props[2].id, concept: 'Pintura completa del local', category: 'Mano de obra', materials: 380_000, labor: 650_000, amount: 1_030_000, currency: 'ARS', method: 'Transferencia', managedBy: 'Yo', ...s },
    { id: uid(), kind: 'eventual', date: day(addMonths(now, -3), 7), propertyId: props[2].id, concept: 'Arreglo baño (presupuesto cerrado)', category: 'Reparaciones', amount: 540_000, currency: 'ARS', method: 'Efectivo', ...s },
    { id: uid(), kind: 'eventual', date: day(addMonths(now, -1), 22), workDate: day(addMonths(now, -1), 20), propertyId: props[0].id, concept: 'Cambio de calefón', category: 'Reparaciones', materials: 310_000, amount: 395_000, currency: 'ARS', managedBy: 'Inmobiliaria Andes', paidBy: 'agency', deducted: true, incomeId: lastMitre.id, ...s },
    { id: uid(), kind: 'eventual', date: day(now, 2), workDate: day(now, 2), propertyId: props[0].id, concept: 'Destapación cocina', category: 'Mano de obra', labor: 45_000, amount: 45_000, currency: 'ARS', managedBy: 'Inmobiliaria Andes', paidBy: 'agency', deducted: true, ...s },
    { id: uid(), kind: 'eventual', date: day(addMonths(now, -2), 9), propertyId: props[1].id, concept: 'Cortina de enrollar', category: 'Reparaciones', amount: 120_000, currency: 'ARS', paidBy: 'tenant', notes: 'La pagó el inquilino, no se descontó', ...s },
  )
  // The Mitre statement that deducted the calefón came in lower.
  lastMitre.amount -= 395_000
  const bills: Bill[] = [
    { id: uid(), recurringId: recurring[0].id, propertyId: props[0].id, period: now, amount: 41_300, currency: 'ARS', receivedDate: day(now, 2), dueDate: recurring[0].dueDay ? day(now, Math.min(28, recurring[0].dueDay)) : undefined, ...s },
    { id: uid(), recurringId: recurring[2].id, propertyId: props[0].id, period: now, amount: 61_800, currency: 'ARS', receivedDate: day(now, 1), dueDate: day(now, 20), ...s },
  ]

  const sales: Sale[] = [
    { id: uid(), opDate: day(months[16], 2), date: day(months[16], 4), description: 'Bicicleta rodado 29', channel: 'Mercado Libre', gross: 350_000, fees: 45_500, net: 304_500, currency: 'ARS', method: 'Mercado Pago', ...s },
    { id: uid(), opDate: day(months[19], 11), date: day(months[19], 11), description: 'Sillón 3 cuerpos', channel: 'Marketplace', gross: 220_000, fees: 0, net: 220_000, currency: 'ARS', method: 'Efectivo', ...s },
  ]

  const pfStart = day(addMonths(now, -1), 3)
  const investments: Investment[] = [
    { id: uid(), name: 'Plazo fijo Banco Patagonia', type: 'Plazo fijo', institution: 'Banco Patagonia', currency: 'ARS', capital: 3_000_000, startDate: day(addMonths(now, -2), 3), maturityDate: pfStart, rate: 32, status: 'redeemed', fromAvailable: false, closeDate: pfStart, recovered: 3_000_000, ...s },
    { id: uid(), name: 'Plazo fijo renovado', type: 'Plazo fijo', institution: 'Banco Patagonia', currency: 'ARS', capital: 3_000_000, startDate: pfStart, maturityDate: day(now, 3), rate: 30, status: 'active', fromAvailable: true, ...s },
    { id: uid(), name: 'Bonos AL30', type: 'Bonos', institution: 'Broker', currency: 'USD', capital: 10_000, startDate: day(months[14], 1), status: 'active', fromAvailable: true, ...s },
  ]
  const yields: Yield[] = [
    { id: uid(), investmentId: investments[0].id, date: pfStart, amount: 79_000, currency: 'ARS', ...s },
    { id: uid(), investmentId: investments[2].id, date: day(months[17], 9), amount: 410, currency: 'USD', ...s },
  ]

  const pensions = await store.all('pensions')
  const pensionPatch: Pension[] = pensions.map((p, i) => ({ ...p, amount: i === 0 ? 420_000 : 380_000 }))

  // Synthetic MEP monthly rate, ~2 % a month.
  const rates: Rate[] = monthRange(addMonths(start, -1), now).map((m, i) => ({
    id: rateId('MEP', `${m}-01`),
    date: `${m}-01`,
    series: 'MEP',
    value: Math.round(1000 * Math.pow(1.02, i)),
    source: 'demo',
  }))

  await apply([
    ...puts('properties', props),
    ...puts('valuations', valuations),
    ...puts('incomes', incomes),
    ...puts('recurring', recurring),
    ...puts('expenses', expenses),
    ...puts('bills', bills),
    ...puts('statusLog', statusLog),
    ...puts('plans', plans),
    ...puts('sales', sales),
    ...puts('investments', investments),
    ...puts('yields', yields),
    ...puts('propertySales', [
      { id: uid(), status: 'done', propertyName: 'Departamento Viedma (vendido)', date: day(months[12], 20), price: 62_000, costs: 2_000, net: 60_000, currency: 'USD', destination: 'USD 30.000 a ayuda familiar, USD 10.000 a bonos, resto disponible', ...s },
      { id: uid(), status: 'planned', propertyName: 'Terreno Dina Huapi', date: day(addMonths(now, 8), 1), price: 135_000, costs: 5_000, net: 130_000, currency: 'USD', ...s },
    ]),
    ...puts('capital', [{ id: uid(), date: day(months[12], 28), kind: 'out', amount: 30_000, currency: 'USD', concept: 'Ayuda familiar', ...s }]),
    ...puts('pensions', pensionPatch),
    ...puts('rates', rates),
    { op: 'put', table: 'settings', row: { id: 'demo', value: true } },
  ])
}
