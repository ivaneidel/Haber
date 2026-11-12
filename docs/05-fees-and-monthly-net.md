# 05 · Honorarios entry + properties month by month (feedback, 2026-11-12)

Her feedback (two items):
- "Agregar una carga de honorarios de administración inmobiliaria"
- "Total completo de ingresos, con egresos ya descontados mes a mes, de los propios inmuebles"

## 1. Honorarios
- **Withheld from a rent** (existed): the `fee` field on the rent. Its box ("Si la administra una inmobiliaria")
  is now always visible once a property is picked, prefilled from that property's last rent. It used to be
  behind a collapsed link, which is likely why she didn't find it.
- **Paid separately** (new): expense kind `'fee'` → loader chip "Honorarios". Concept defaults to
  "Honorarios de administración"; amount, currency and method repeat the property's last one. A note tells her
  to enter withheld fees with the rent instead, so nothing is counted twice.
- Both go into the same `fee` bucket (`Totals.fee`): Tablero breakdown and charts, Rentabilidad, property page,
  Excel. A separate fee is NOT added back to gross rent (only withheld ones are, because they never reached her).
- Gastos page has a 4th tab "Honorarios" listing both kinds.
- No schema change: `kind` is an existing string field; no Dexie version bump.

## 2. Monthly net of the properties
- `monthlyRealEstate(flows, lens, year, byPeriod)` in `calc.ts`: only property flows (rent + expense), one row
  per month with rent, fixed, cuotas, eventual, fees, net and running total; future months flagged.
- `components/MonthlyNet.tsx` table, on the Tablero (all properties, or the one picked in the filter) and on each
  property page (follows its cash/period toggle). Split ARS/USD view shows both per cell, like the KPIs.
- Excel: new sheet "Inmuebles mes a mes" (all properties together, then each one; running total resets per year).
  The "Resumen mensual" sheet gained a fees column.

## Open, waiting on her test
- Whether she wants one column per property instead of the property filter.
- Zero cells show "$ 0"; switch to a dash if it reads as noise.
