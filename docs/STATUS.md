# STATUS

_Last updated: 2026-11-06_

Cold start: read `00-requirements-es.md` (scope), `01-decisions.md` (interpretations — overrides the spec where
they differ), `02-architecture.md`.

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

## Not done / next
- Not deployed yet. `.github/workflows/deploy.yml` deploys to GitHub Pages on push to `main` (tests → build →
  `deploy-pages`). One-time: repo Settings → Pages → Source: GitHub Actions. Works under any sub-path.
- Not tried on a real phone or in Safari/Firefox desktop (month pickers are plain selects for that reason).
- Main JS chunk ~315 KB gzipped (Recharts + app). Fine for a local app; lazy-load pages if it matters.
- Ideas if she asks: rent increase reminders by contract index, CSV import, attachments (receipts), Firestore backend.

## Known traps
- Data is real and personal once she starts: schema changes must be ADDITIVE (new Dexie `version(n)`), and
  `Prefs` fields need defaults in `mergePrefs`.
- All GitHub Pages repos of one user share an origin: keep the DB name (`haber-ingresos`) and localStorage
  keys (`haber:*`) unique.
- `vite preview` + service worker: after a rebuild the first load serves the old bundle; reload twice. A stale SW
  from another project on the same localhost port can serve the wrong app — unregister it.
- Field components default to `w-full`; pass a `w-*`/`flex-1` class to override (`ui.tsx` `fc()`).
- Bar charts with negative series need `stackOffset="sign"` (already set in `Charts.tsx`).
