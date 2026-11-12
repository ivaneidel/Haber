# STATUS

_Last updated: 2026-11-12_

Cold start: read `00-requirements-es.md` (scope), `01-decisions.md` (interpretations — overrides the spec where
they differ), `02-architecture.md`, then `03-requirements-2-es.md` + `04-functional-set-2.md` (second spec and
its decisions — override the earlier ones).

Visible name: **Nuestros ingresos**. Code/repo/DB name: **Haber** (never rename the DB).

## Done — all three spec stages

| Stage | What | Where |
|---|---|---|
| 1 | Properties (contract, reference rent, market-value history, archive), rents with cash date + period, fixed expenses (templates + pending + one-click pay), installment plans (cuotas, overdue, commitments), one-off expenses, result per property (month/year, cash vs period, year comparison), dashboard (KPIs, breakdowns, 5 charts, filters by year/month/property, "to record this month") | Propiedades, Gastos, Tablero, Cargar movimiento |
| 2 | Occasional sales (gross/fees/net), investments (capital vs yield, close/redeem/renew, maturities), capital disponible ledger, property sales (done/planned, destination, archive) | Movimientos, Inversiones, Patrimonio |
| 3 | Annual rentabilidad per property + portfolio, valorización apart, comparison + evolution charts; patrimony now + 24-month evolution; pensions (current/future, aguinaldo); projections with scenarios at each pension start | Rentabilidad, Patrimonio, Jubilaciones, Proyecciones |
| Cross-cutting | ARS/USD never mixed implicitly; consolidation with explicit series + criterion; FX typed/fetched/imported; Excel export (15 sheets); JSON backup/restore; demo data; ES/EN; light/dark; PWA | Ajustes |

- 31 tests pass, `tsc -b` clean, `oxlint` warnings only (fast-refresh/export style), production build OK.
- Checked in a real browser (Easy Browser): every page with demo data, loader autofill + save + duplicate warning,
  investment close + renew, live FX import (2 502 MEP quotes), light mode, phone width (390px: header, drawer,
  bottom-sheet loader). No console errors.

## Done — functional set 2 (2026-11-09)

| Spec 2 § | What | Where |
|---|---|---|
| 2 | Property sheet: cadastre, parcel, postal code, status | Property form + page "Ficha" |
| 3 | Services/taxes = templates with provider, account no., due day, payment method, bill channel + email/portal/link. Received bills (`bills` table) per period. Status derived: awaiting / received / due in N days / today / overdue / paid. PagoMisCuentas added (one-time prefs migration). | Gastos → Vencimientos, BillForm, AccountCard |
| 3 reminders | **Banner at the top of the Tablero** (overdue/today red, ≤3 days amber) + red badge on Gastos. No push (Iván's call). | `components/Due.tsx` |
| 4 | "Carga del mes" (rows proposed, unchecked, confirm), "Repetir el último" in the loader, rent amount suggested from usual net minus pending deductions, last bill amount as tap-to-use reference | Tablero, loader |
| 5 | Works: work date, materials/labor/other (mixed, never double), managed by, paid by, deducted from a rent liquidation; rent fee (honorarios); pending deductions card | Loader, Gastos, Movimientos |
| 6 | Status history (`statusLog`), vacancy periods with days and cost | Property page |
| 7 | Rentabilidad: fixed/cuotas/eventual/fees, months rented/vacant, vacancy cost, plain-language card per property | Rentabilidad |
| 11 | KPIs with one-line plain explanations, Resultado neto, rents KPI, fees in breakdown | Tablero |

- 42 tests (11 new in `set2.test.ts`: no double counting, due urgency, vacancy months, **v1→v2 DB upgrade keeps rows**).
- Browser-checked with demo data (Easy Browser): banner, Gastos/Vencimientos, rent with fee + deduction linking,
  works breakdown validation, Carga del mes save, Local Centro vacancy, Rentabilidad. No console errors.
  Phone width only checked empty (390px layout OK).

## Done — feedback 2026-11-12 (see `05-fees-and-monthly-net.md`)
- Honorarios: rent fee box always visible + separate "Honorarios" expense kind (`'fee'`), new Gastos tab.
- "Resultado de las propiedades mes a mes" table (Tablero + property page) and Excel sheet "Inmuebles mes a mes".
- 45 tests (3 new in `fees.test.ts`). Browser-checked on demo data: table, fee entry saved and summed with
  withheld fees in November, rent form fee box. She is testing it; wait for her feedback.

## Not done / next
- Not deployed yet. `.github/workflows/deploy.yml` deploys to GitHub Pages on push to `main` (tests → build →
  `deploy-pages`). One-time: repo Settings → Pages → Source: GitHub Actions. Works under any sub-path.
- Not tried on a real phone or in Safari/Firefox desktop (month pickers are plain selects for that reason).
- Main JS chunk ~315 KB gzipped (Recharts + app). Fine for a local app; lazy-load pages if it matters.
- Ideas if she asks: rent increase reminders by contract index, CSV import, attachments (receipts), Firestore backend.
- Reminders with the app closed: not built (no push wanted). Free option if ever needed: .ics calendar export of due days.
- Link to the separate expenses app (spec 2 §1): not integrated; property costs live here.

## Known traps
- Data is real and personal once she starts: schema changes must be ADDITIVE (new Dexie `version(n)`), and
  `Prefs` fields need defaults in `mergePrefs`.
- All GitHub Pages repos of one user share an origin: keep the DB name (`haber-ingresos`) and localStorage
  keys (`haber:*`) unique.
- `vite preview` + service worker: after a rebuild the first load serves the old bundle; reload twice. A stale SW
  from another project on the same localhost port can serve the wrong app — unregister it.
- Field components default to `w-full`; pass a `w-*`/`flex-1` class to override (`ui.tsx` `fc()`).
- Bar charts with negative series need `stackOffset="sign"` (already set in `Charts.tsx`).
