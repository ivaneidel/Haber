# Architecture

```
src/
  lib/
    types.ts         every record type (all keyed by string id, stamped created/updated)
    store/types.ts   Store interface + table list (backend contract)
    store/dexie.ts   IndexedDB implementation (the only Dexie import in the app)
    repo.ts          picks the store; save/putOp/delOp/apply + multi-record domain ops
    calc.ts          pure: flows, totals, fixed/installment logic, capital ledger, rentabilidad, patrimonio
    money.ts         formatting, RateBook (rate lookup), Lens (currency view)
    projection.ts    pure: pension months (aguinaldo), scenarios, yearly projection
    prefs.ts         one settings row: lists, fx config, view mode, projection assumptions
    fx.ts            optional public quote fetchers
    seed.ts          first-run pensions; demo data
    backup.ts        JSON backup/restore via the Store
    export.ts        Excel workbook (records + monthly summary + yearly yield)
    dates.ts         YYYY-MM-DD / YYYY-MM helpers
  hooks/useData.ts   one shared store subscription → useSnapshot/useData/usePrefs/useModel
  components/        ui kit, money display, charts, the single EntryForm, entity forms
  pages/             one per nav item
  i18n/              es.ts (source of truth), en.ts typed against it
```

## Data flow

1. `store.subscribe` pushes the whole snapshot on any change (Dexie `liveQuery`).
2. `useModel()` derives `Data`, `Prefs`, `flows` (normalized cash movements), the `RateBook` and the view's lenses.
3. Pages call pure functions from `calc.ts` / `projection.ts` with a **lens**.
4. Writes go through `repo` (`save`, `apply([...ops])`), never directly to a backend.

### Lenses

A `Lens` is `(amount, currency, date) → number` in one target currency. Unconsolidated lenses return 0 for the
other currency, so a "Separado" view is just the same aggregation run once per currency (two lenses); a
consolidated view is one lens that converts. Every total/chart function takes a lens, so currency handling lives
in one place.

### Flows

`toFlows(data)` turns incomes, expenses, occasional sales (net) and yields into `Flow { kind, date, month,
period?, propertyId?, amount, currency }`. Capital movements are deliberately *not* flows. `totals()` buckets
them into rent/yield/sale/pension/other/fixed/installment/eventual + `realEstateNet = rent − expenses`.

## Swapping the backend (e.g. Firestore)

Implement `Store` (`all`, `get`, `apply` with `writeBatch`, `replaceAll`, `subscribe` merging one `onSnapshot`
per collection into a `Snapshot`) and call `setStore()` / change the default in `repo.ts`. Migration: Ajustes →
Descargar respaldo on the old build, Restaurar on the new one (`replaceAll`). The tests in `store.test.ts` are the
contract to run against the new implementation.

## Tests

`npm test` — `logic.test.ts` (cash vs period, currency lenses, fixed/installments, capital vs income,
rentabilidad, pensions/projection, amount parsing), `store.test.ts` (backend contract), `export.test.ts`
(demo seed → every Excel sheet; backup round-trip). fake-indexeddb under jsdom.
