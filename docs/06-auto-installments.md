# 06 — Cuotas que se debitan solas (feedback 2026-11-13)

## Problem
A plan stored "N cuotas from month X", but each paid cuota only existed once she entered it by hand
("Pagar cuota N" or the loader). Card installments are charged automatically, so entering each one
every month defeated the purpose.

## Decision
Model it after SplitWizard's auto-installments, adapted to Haber's cash basis (an Expense counts in the
month of its date, so future-dated rows would wrongly read as already paid):

- `Plan.auto` (undefined = **on**, so existing plans are on too), `Plan.chargeDay` (1–31, default 1, clamped
  to the month), `Plan.autoPostedThrough` (highest cuota number already handled).
- **Catch-up, not up-front:** every cuota whose charge date (`month-chargeDay`) has arrived and is above
  `autoPostedThrough` becomes an Expense (`kind: 'installment'`, plan's amount/method/category), then the
  mark moves up. Future cuotas stay commitments, so "Falta pagar", projections and the chart keep working.
- Runs in `App.tsx` whenever the store snapshot changes (new plan, restore, demo) and when the app becomes
  visible again (open across midnight). Toast: "Se registraron N cuotas debitadas".
- **Idempotent:** fixed ids `auto-<planId>-<no>`; two tabs write the same row.
- **Manual still works:** a cuota already entered by hand is skipped. A posted cuota she deletes stays deleted
  (it's at or below the mark) and shows as pending to pay by hand.
- `pendingCuotas` ("to record this month", Carga del mes) leaves out auto cuotas whose charge day hasn't come.
- Editing the schedule: `rebaseAutoMark` lowers the mark to what's due under the new schedule, so moving the
  start later doesn't skip cuotas. Turning auto off → nothing posts; back on → missed past cuotas post.
- Form: "Se debita sola" toggle (on by default) + "Día de débito". "Cuotas ya pagadas" only appears when auto
  is off (with auto on, past cuotas post themselves in their months).
- List: auto plans show "Se debita el N" instead of the "Pagar cuota" button, unless a cuota is overdue.

Additive only: no Dexie version bump (no new index), old plans read as auto on / day 1.

Code: `src/lib/autoCuotas.ts` (ops), `src/lib/calc.ts` (`isAuto`, `chargeDate`, `cuotasDueBy`),
tests in `src/lib/autoCuotas.test.ts`.
