import type { TFunction } from 'i18next'
import { capitalEvents, currentStatus, dataYears, monthlyRealEstate, monthlyTotals, planStatus, propertyYield, rentBreakdown, toFlows, type Data } from './calc'
import { monthRange, thisMonth, today } from './dates'
import { makeLens, makeRateBook, type FxConfig } from './money'
import { download } from './backup'
import { isOwnExpense, type Currency } from './types'

type Cell = string | number | boolean | null | undefined
export type Sheet = { name: string; rows: Record<string, Cell>[] }

/**
 * Excel export (spec §14): every record table plus monthly and yearly summaries, one sheet each.
 * Amounts stay in their own currency; consolidated sheets say which rate was used.
 */
export function buildSheets(d: Data, fx: FxConfig, t: TFunction): Sheet[] {
  const h = (k: string) => t(`xl.${k}`)
  const prop = (id?: string) => d.properties.find((p) => p.id === id)?.name ?? ''
  const inv = (id?: string) => d.investments.find((i) => i.id === id)?.name ?? ''
  const pen = (id?: string) => d.pensions.find((p) => p.id === id)?.name ?? ''
  const byDate = <T extends { date: string }>(xs: T[]) => [...xs].sort((a, b) => a.date.localeCompare(b.date))

  const movements: Sheet['rows'] = [
    ...d.incomes.map((i) => ({
      [h('date')]: i.date,
      [h('type')]: t(`entry.${i.source}`),
      [h('period')]: i.period,
      [h('property')]: prop(i.propertyId),
      [h('concept')]: i.description ?? (i.pensionId ? pen(i.pensionId) : i.payer),
      [h('amount')]: i.amount,
      [h('currency')]: i.currency,
      [h('method')]: i.method,
      [h('notes')]: i.notes,
    })),
    ...d.expenses.map((e) => ({
      [h('date')]: e.date,
      [h('type')]: `${t('entry.expense')} · ${t(`kind.${e.kind}`)}`,
      [h('period')]: e.period,
      [h('property')]: prop(e.propertyId),
      [h('concept')]: e.installmentNo ? `${e.concept} (${e.installmentNo})` : e.concept,
      [h('amount')]: -e.amount,
      [h('currency')]: e.currency,
      [h('method')]: e.method,
      [h('notes')]: e.notes,
    })),
    ...d.sales.map((s) => ({
      [h('date')]: s.date,
      [h('type')]: t('entry.sale'),
      [h('concept')]: `${s.description} (${s.channel})`,
      [h('amount')]: s.net,
      [h('currency')]: s.currency,
      [h('method')]: s.method,
      [h('notes')]: s.notes,
    })),
    ...d.yields.map((y) => ({
      [h('date')]: y.date,
      [h('type')]: t('entry.yield'),
      [h('concept')]: inv(y.investmentId),
      [h('amount')]: y.amount,
      [h('currency')]: y.currency,
      [h('notes')]: y.notes,
    })),
  ].sort((a, b) => String(a[h('date')]).localeCompare(String(b[h('date')])))

  const sheets: Sheet[] = [{ name: h('sheetMovements'), rows: movements }]

  sheets.push({
    name: h('sheetRents'),
    rows: byDate(d.incomes.filter((i) => i.source === 'rent')).map((i) => ({
      [h('dateReceived')]: i.date,
      [h('period')]: i.period,
      [h('property')]: prop(i.propertyId),
      [h('tenant')]: i.payer,
      [h('amount')]: i.amount,
      [h('fee')]: i.fee ?? '',
      [h('gross')]: rentBreakdown(d, i.id)?.gross ?? i.amount,
      [h('currency')]: i.currency,
      [h('method')]: i.method,
      [h('notes')]: i.notes,
    })),
  })
  sheets.push({
    name: h('sheetExpenses'),
    rows: byDate(d.expenses).map((e) => ({
      [h('date')]: e.date,
      [h('kind')]: t(`kind.${e.kind}`),
      [h('property')]: prop(e.propertyId),
      [h('concept')]: e.concept,
      [h('category')]: e.category,
      [h('period')]: e.period,
      [h('cuota')]: e.installmentNo,
      [h('amount')]: e.amount,
      [h('currency')]: e.currency,
      [h('method')]: e.method,
      [h('workDate')]: e.workDate ?? '',
      [h('materials')]: e.materials ?? '',
      [h('labor')]: e.labor ?? '',
      [h('otherCosts')]: e.otherCosts ?? '',
      [h('managedBy')]: e.managedBy ?? '',
      [h('paidBy')]: t(`work.by_${e.paidBy ?? 'me'}`),
      [h('countsAsMine')]: isOwnExpense(e) ? t('common.yes') : t('common.no'),
      [h('notes')]: e.notes,
    })),
  })
  sheets.push({
    name: h('sheetFixed'),
    rows: d.recurring.map((r) => ({
      [h('property')]: prop(r.propertyId),
      [h('concept')]: r.concept,
      [h('category')]: r.category,
      [h('provider')]: r.provider ?? '',
      [h('account')]: r.account ?? '',
      [h('dueDay')]: r.dueDay ?? '',
      [h('method')]: r.method ?? '',
      [h('channel')]: r.channel ? t(`svc.ch_${r.channel}`) : '',
      [h('every')]: t(`fixed.every_${r.every}`),
      [h('since')]: r.startMonth,
      [h('usual')]: r.amount,
      [h('currency')]: r.currency,
      [h('active')]: r.active ? t('common.yes') : t('common.no'),
    })),
  })
  sheets.push({
    name: h('sheetBills'),
    rows: [...d.bills]
      .sort((a, b) => a.period.localeCompare(b.period))
      .map((b) => {
        const r = d.recurring.find((x) => x.id === b.recurringId)
        const paid = d.expenses.find((e) => e.recurringId === b.recurringId && (e.period ?? e.date.slice(0, 7)) === b.period)
        return {
          [h('property')]: prop(b.propertyId),
          [h('concept')]: r?.concept ?? '',
          [h('account')]: r?.account ?? '',
          [h('period')]: b.period,
          [h('received')]: b.receivedDate ?? '',
          [h('due')]: b.dueDate ?? '',
          [h('amount')]: b.amount ?? '',
          [h('currency')]: b.currency,
          [h('paidOn')]: paid?.date ?? '',
          [h('notes')]: b.notes ?? '',
        }
      }),
  })
  sheets.push({
    name: h('sheetStatus'),
    rows: [...d.statusLog].sort((a, b) => a.from.localeCompare(b.from)).map((x) => ({ [h('property')]: prop(x.propertyId), [h('from')]: x.from, [h('status')]: t(`status.${x.status}`), [h('notes')]: x.notes ?? '' })),
  })
  sheets.push({
    name: h('sheetPlans'),
    rows: d.plans.map((p) => {
      const st = planStatus(p, d.expenses)
      return {
        [h('property')]: prop(p.propertyId),
        [h('concept')]: p.concept,
        [h('total')]: p.total,
        [h('count')]: p.count,
        [h('installment')]: p.installment,
        [h('currency')]: p.currency,
        [h('since')]: p.startMonth,
        [h('paid')]: st.paidCount,
        [h('pending')]: st.remainingCount,
        [h('pendingAmount')]: st.remainingAmount,
        [h('nextMonth')]: st.next?.month,
      }
    }),
  })
  sheets.push({
    name: h('sheetSales'),
    rows: byDate(d.sales).map((s) => ({
      [h('opDate')]: s.opDate,
      [h('dateReceived')]: s.date,
      [h('item')]: s.description,
      [h('channel')]: s.channel,
      [h('gross')]: s.gross,
      [h('fees')]: s.fees,
      [h('net')]: s.net,
      [h('currency')]: s.currency,
      [h('method')]: s.method,
      [h('notes')]: s.notes,
    })),
  })
  sheets.push({
    name: h('sheetInvestments'),
    rows: d.investments.map((i) => ({
      [h('name')]: i.name,
      [h('instrument')]: i.type,
      [h('institution')]: i.institution,
      [h('currency')]: i.currency,
      [h('capital')]: i.capital,
      [h('start')]: i.startDate,
      [h('maturity')]: i.maturityDate,
      [h('rate')]: i.rate,
      [h('status')]: t(`inv.status_${i.status}`),
      [h('closeDate')]: i.closeDate,
      [h('recovered')]: i.recovered,
      [h('yields')]: d.yields.filter((y) => y.investmentId === i.id).reduce((s, y) => s + y.amount, 0),
    })),
  })
  sheets.push({
    name: h('sheetYields'),
    rows: byDate(d.yields).map((y) => ({ [h('date')]: y.date, [h('investment')]: inv(y.investmentId), [h('amount')]: y.amount, [h('currency')]: y.currency, [h('toCapital')]: y.toCapital ? t('common.yes') : '' })),
  })
  sheets.push({
    name: h('sheetProperties'),
    rows: d.properties.map((p) => ({
      [h('name')]: p.name,
      [h('address')]: p.address,
      [h('city')]: p.city,
      [h('province')]: p.province,
      [h('postalCode')]: p.postalCode ?? '',
      [h('cadastre')]: p.cadastre ?? '',
      [h('parcel')]: p.parcel ?? '',
      [h('currentStatus')]: (() => {
        const st = currentStatus(d, p)
        return st ? t(`status.${st}`) : ''
      })(),
      [h('tenant')]: p.tenant,
      [h('contractStart')]: p.contractStart,
      [h('contractEnd')]: p.contractEnd,
      [h('refRent')]: p.refRent,
      [h('currency')]: p.refRentCurrency,
      [h('status')]: p.soldAt ? t('property.sold') : p.archived ? t('property.archived') : t('property.active'),
    })),
  })
  sheets.push({
    name: h('sheetValuations'),
    rows: byDate(d.valuations).map((v) => ({ [h('date')]: v.date, [h('property')]: prop(v.propertyId), [h('value')]: v.value, [h('currency')]: v.currency, [h('notes')]: v.notes })),
  })
  sheets.push({
    name: h('sheetPropertySales'),
    rows: byDate(d.propertySales).map((s) => ({
      [h('status')]: t(`psale.${s.status}`),
      [h('property')]: s.propertyName,
      [h('date')]: s.date,
      [h('price')]: s.price,
      [h('costs')]: s.costs,
      [h('net')]: s.net,
      [h('currency')]: s.currency,
      [h('destination')]: s.destination,
    })),
  })
  sheets.push({
    name: h('sheetCapital'),
    rows: capitalEvents(d).map((e) => ({ [h('date')]: e.date, [h('type')]: t(`capital.ev_${e.kind}`), [h('concept')]: e.label, [h('amount')]: e.amount, [h('currency')]: e.currency })),
  })
  sheets.push({
    name: h('sheetPensions'),
    rows: d.pensions.map((p) => ({
      [h('name')]: p.name,
      [h('holder')]: p.holder,
      [h('since')]: p.startMonth,
      [h('amount')]: p.amount,
      [h('currency')]: p.currency,
      [h('confirmed')]: p.confirmed ? t('common.yes') : t('pension.estimated'),
      [h('aguinaldo')]: p.aguinaldo ? t('common.yes') : t('common.no'),
    })),
  })

  // Monthly summary, per currency (never mixed).
  const flows = toFlows(d)
  const book = makeRateBook(d.rates, fx.series)
  const months = flows.length ? monthRange(flows.map((f) => f.month).sort()[0], thisMonth()) : []
  const summary: Sheet['rows'] = []
  for (const cur of ['ARS', 'USD'] as Currency[]) {
    const lens = makeLens(cur, false, book, fx)
    for (const m of monthlyTotals(flows, lens, months)) {
      if (!m.income && !m.expense) continue
      summary.push({
        [h('month')]: m.month,
        [h('currency')]: cur,
        [h('rents')]: m.rent,
        [h('yields')]: m.yield,
        [h('sales')]: m.sale,
        [h('pensions')]: m.pension,
        [h('other')]: m.other,
        [h('incomeTotal')]: m.income,
        [h('fixed')]: m.fixed,
        [h('installments')]: m.installment,
        [h('eventual')]: m.eventual,
        [h('feeTotal')]: m.fee,
        [h('expenseTotal')]: m.expense,
        [h('realEstateNet')]: m.realEstateNet,
      })
    }
  }
  // Properties month by month (all together, then each one), running total reset every January.
  const reRows: Sheet['rows'] = []
  const scopes: { name: string; flows: typeof flows }[] = [
    { name: h('allProperties'), flows },
    ...d.properties.map((p) => ({ name: p.name, flows: flows.filter((f) => f.propertyId === p.id) })),
  ]
  const years = [...new Set(months.map((m) => Number(m.slice(0, 4))))]
  for (const sc of scopes)
    for (const cur of ['ARS', 'USD'] as Currency[]) {
      const lens = makeLens(cur, false, book, fx)
      for (const y of years)
        for (const m of monthlyRealEstate(sc.flows, lens, y).rows) {
          if (m.future || (!m.rent && !m.expense)) continue
          reRows.push({
            [h('month')]: m.month,
            [h('property')]: sc.name,
            [h('currency')]: cur,
            [h('rents')]: m.rent,
            [h('fixed')]: m.fixed,
            [h('installments')]: m.installment,
            [h('eventual')]: m.eventual,
            [h('feeTotal')]: m.fee,
            [h('expenseTotal')]: m.expense,
            [h('realEstateNet')]: m.realEstateNet,
            [h('cumulative')]: m.cumulative,
          })
        }
    }
  sheets.push({ name: h('sheetMonthly'), rows: summary.sort((a, b) => String(a[h('month')]).localeCompare(String(b[h('month')]))) })

  // Yearly yield per property, consolidated into the valuation's currency.
  const lensFor = (c: Currency) => makeLens(c, !!book.latest, book, fx)
  const yRows: Sheet['rows'] = []
  for (const y of dataYears(d, Number(today().slice(0, 4))))
    for (const p of d.properties) {
      const r = propertyYield(d, flows, p, y, lensFor)
      if (!r.gross && !r.expenses) continue
      yRows.push({
        [h('year')]: y,
        [h('property')]: p.name,
        [h('currency')]: r.currency,
        [h('grossRent')]: Math.round(r.gross),
        [h('fixedTotal')]: Math.round(r.fixed),
        [h('installmentTotal')]: Math.round(r.installment),
        [h('eventualTotal')]: Math.round(r.eventual),
        [h('feeTotal')]: Math.round(r.fee),
        [h('expenseTotal')]: Math.round(r.expenses),
        [h('netRent')]: Math.round(r.net),
        [h('monthsRented')]: r.monthsRented,
        [h('monthsVacant')]: r.monthsVacant,
        [h('vacancyCost')]: Math.round(r.vacancyCost),
        [h('value')]: r.value,
        [h('yieldPct')]: r.pct === null ? null : Math.round(r.pct * 100) / 100,
        [h('appreciation')]: r.appreciation,
        [h('fxNote')]: book.latest ? `${book.series} · ${t(`fx.criterion_${fx.criterion}`)}` : t('fx.noRatesShort'),
      })
    }
  sheets.push({ name: h('sheetYield'), rows: yRows })
  sheets.push({ name: h('sheetRealEstateMonthly'), rows: reRows })
  return sheets
}

export async function exportXLSX(d: Data, fx: FxConfig, t: TFunction): Promise<void> {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  for (const s of buildSheets(d, fx, t)) {
    const ws = XLSX.utils.json_to_sheet(s.rows.length ? s.rows : [{ '': t('xl.empty') }])
    // Reasonable column widths.
    const cols = Object.keys(s.rows[0] ?? { '': '' })
    ws['!cols'] = cols.map((c) => ({ wch: Math.min(40, Math.max(10, c.length + 2, ...s.rows.slice(0, 200).map((r) => String(r[c] ?? '').length + 1))) }))
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31))
  }
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  download(`haber-${today()}.xlsx`, out, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
}
