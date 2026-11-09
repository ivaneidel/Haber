# Decisions and interpretations

Where the spec (`00-requirements-es.md`) left room, this is what was decided and why.

## Platform

| Decision | Why |
|---|---|
| Vite + React 19 + TS, Tailwind v4, Lucide, Recharts, SheetJS, i18next (ES default, EN), PWA | Same stack as Plato; asked for explicitly. |
| **Desktop-first layout**, fully usable on a phone | She'll use it from a computer 99 % of the time. Sidebar ≥1024px; header + drawer + FAB + bottom sheets below. |
| **Spanish always by default** (not browser-detected) | She writes in Spanish; English is a switch in Ajustes. |
| Light/dark follows the system, manual override | House default. |
| **Local-first, IndexedDB only** (Dexie). No Firebase, no sync | Asked for explicitly. JSON backup/restore + Excel export cover safety and portability. |
| **Storage behind a `Store` interface** (`src/lib/store/types.ts`) | Asked mid-build: a move to Firestore must not touch UI or calculations. Only `repo.ts` picks the backend. Contract: flat collections keyed by `id`, atomic batches (`apply`), whole-snapshot `subscribe`, `replaceAll` for restore. Reads happen before writes, so no read-in-transaction is needed (Firestore `writeBatch` fits). |
| `HashRouter` + `base: './'` | GitHub Pages has no SPA fallback and serves under `/<repo>/`. Deep links and reloads work without a 404.html hack. |
| DB name `haber-ingresos` | All of a user's GitHub Pages repos share one origin; the name must be unique. |
| ~~Name **"Haber"**~~ → visible name **"Nuestros ingresos"** since 2026-11-09 (see `04-functional-set-2.md`); code name stays Haber | Short; in Spanish "haber" is both assets (debe/haber) and the pension *haber*. Rename freely: the name lives in `index.html`, `vite.config.ts` manifest, `App.tsx` brand, i18n `settings.aboutText`. |

## Money and currencies (spec §13)

- Every record stores its own `currency` (`ARS` | `USD`). Nothing is converted on save.
- Views have three modes: **Separado** (default — two lines, ARS and USD, never added), **En $**, **En US$**.
  Consolidated views always print the series and criterion used ("cada movimiento al dólar MEP de su fecha").
- Rates are a table of `(series, date, ARS per USD)`. Series default **MEP**; Oficial/Blue/CCL available.
- Criterion **historical** (default): each movement at the rate in effect on its own date (last on/before; the
  first known one if earlier). **latest**: one rate for everything. Historical is the default because comparing
  years in pesos is meaningless with Argentine inflation.
- Rates can be typed by hand, fetched for today (dolarapi.com) or imported as daily history (argentinadatos.com).
  Both APIs are keyless and CORS-open; only public quotes are requested, nothing of hers is sent. Manual rates are
  never overwritten by an import.
- If there are no rates, consolidated views fall back to Separado with a warning and a link.

## Income vs capital (spec §6, §7)

- **Income** = rents, pensions received, other income, occasional sales (net), investment yields.
- **Capital** is never income: property sales, money placed in or recovered from investments, manual deposits/withdrawals.
- *Capital disponible* per currency = done property sales (net) + deposits − withdrawals − capital placed
  (when taken from available) + capital recovered + yields marked "lo dejo invertido".
- An investment has `fromAvailable`: off means the money is new (savings) and doesn't drain available capital.
  Default is on only if there's enough available capital in that currency.
- Closing an investment asks separately for *capital recuperado* and *rendimiento final*; a difference shows as
  capital gain/loss, not income. "Renovar" opens a pre-filled new investment (plazo fijo rollover).
- Planned property sales (`status: planned`) never touch real capital; they only feed projections.

## Rents and expenses

- Rent has `date` (cash) and `period` (month it belongs to). Everything aggregates by cash date; the property
  page can switch to "por período".
- The loader suggests the next period after the last recorded one (or the current month), last amount paid,
  tenant, method. A duplicate rent for the same property+period warns (partial payments are legitimate) but
  doesn't block.
- Tenants and contracts live on the property (current tenant, dates, notes, reference rent). Each rent stores a
  **snapshot of the tenant name**, so changing tenant never rewrites history. A separate contracts table was not
  worth the extra loading screens for ~5 properties.
- Reference rent is only a hint for the loader; never counted.
- **Fixed expenses** are templates (`Recurring`: periodicity in months, first month, usual amount). Each month
  the due ones appear as pending on the Tablero and Gastos with one-click "Registrar pago". Paying a different
  amount offers to update the usual one. Periodicity 0 = irregular (never "due").
- **Installments** are `Plan`s; each paid cuota is an `Expense` with `planId` + `installmentNo`, counted in the
  month it's paid. Overdue cuotas show as pending. A plan created after it started can register the
  already-paid cuotas in their months. Future commitments = unpaid cuotas (+ optionally fixed costs at usual amount).
- Archiving a property hides it from pickers and pending lists; history stays. Hard delete only if nothing references it.

## Rentabilidad (spec §10)

- `(rent collected − expenses paid in year) / market value × 100`, per property and for the portfolio (in USD).
- Market value is a **history** (`Valuation` rows). Editing the value on the property form adds a new row
  dated today. A year uses the last valuation on/before Dec 31; years before the first valuation use the earliest
  one, flagged "aprox." (inherited properties have no purchase price).
- Incomes/expenses are converted into the valuation's currency with the configured criterion.
- **Valorización** (value change during the year) is shown in a separate column and never added to rent yield.
- The current year is labelled partial.

## Pensions and projections (spec §8, §11)

- Two pensions are seeded on first run ("Primera jubilación" 2027-05, "Jubilación del marido" 2031-05) with no
  amount. Amounts are entered when known; "confirmado" vs "estimado" is a flag.
- Aguinaldo (SAC): half a haber in June and December, prorated by months collected in the semester.
- Real pension payments are `Income` rows with `source: 'pension'`. Future pensions appear only in projections.
- Projections: constant money (no inflation, no rent updates), one rate (latest) for conversion, own currency
  choice. Bases: rent = real 12-month average (rent − expenses) or reference rents − average expenses; yields =
  assumed annual % on capital (default 4 %) or real 12-month average; occasional sales average; planned sales add
  capital from their date. Scenarios: today, and at each future pension start. Always styled as estimates
  (dashed borders, violet "Estimación").

## UX (spec §12)

- One loader for everything ("Cargar movimiento", key **N**, FAB on phones), type chips, today's date, dropdowns,
  autofill from history, recent-concept chips, validation on submit, soft warnings (future date, duplicates).
- Edit / duplicate (today's date, next period) / delete from every movement row.
- No datalist comboboxes (house rule): dropdowns and chips only.
- Lists (methods, categories, channels, investment types) are editable in Ajustes; seeded in Spanish.
- Demo data only offered on an empty DB; a violet banner offers a one-click wipe.
