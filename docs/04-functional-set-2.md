# Functional set 2 — plan and decisions

Source: `03-requirements-2-es.md` (her second spec, 2026-11-09, after using v1 in depth).
Where this file and `01-decisions.md` disagree, this one wins.

## Name

**Visible name: "Nuestros ingresos"** (her call). **Project/code name stays "Haber"**: repo, folder,
package name, IndexedDB name `haber-ingresos`, localStorage keys `haber:*`, `HaberDB` class.
Renaming the DB would orphan her real data, and the repo name is the GitHub Pages path.
The visible name lives in `index.html` `<title>`, the PWA manifest (`vite.config.ts`, `short_name`
"Ingresos" because launchers truncate at ~12 chars), `App.tsx` `Brand`, i18n `settings.aboutText`.

## What already covered the spec (no work, or wording only)

§1 summary, §5B installments, §8 investments (capital vs yield, recovered, status, accumulated yield per
investment), §9 patrimony (sales as extraordinary capital, available/placed/recovered, property values),
§10 pensions + scenarios (today / May 2027 / husband). §12 points 4–10 were already design rules.

## Data model (all additive — her data is real)

Dexie `version(2)` adds two tables; nothing existing changes shape. Old backups restore fine (missing
tables load empty).

| Change | Why |
|---|---|
| `Property` + `cadastre`, `parcel`, `postalCode` | §2 nomenclatura catastral, partida inmobiliaria, full address. |
| `Recurring` (fixed cost template) is now the **service/tax account**: + `provider`, `account`, `dueDay`, `channel` (email/whatsapp/paper/portal/other), `channelEmail`, `portalUrl`, `billUrl`. `amount` may be 0 = "varía". | §2/§3: "each service has its own record linked to a property", loaded once and reused. The template already was that; making a second "account" table would duplicate it. |
| New table **`bills`**: one row per received invoice/period: `recurringId`, `propertyId`, `period`, `amount`, `currency`, `receivedDate`, `dueDate`, `notes`. | §3: invoice amount, received date, due date per period, "received?" flag. A bill row exists ⇔ the invoice was received. |
| Payment is still an `Expense` (`recurringId` + `period`). Bill status is **derived**: paid if that expense exists. | §3 "status updates automatically when the payment date is entered" — no status field to keep in sync. |
| `Expense` + `workDate`, `materials`, `labor`, `otherCosts`, `managedBy`, `paidBy` (me/agency/tenant/other), `deducted` (bool), `incomeId` (rent liquidation it was deducted from). | §5 works, mixed breakdown, paid by agency and deducted. |
| `Income` (rent) + `fee` (honorarios de administración). | §7 needs fees as their own line; the Excel had them. |
| New table **`statusLog`**: `propertyId`, `status` (rented/vacant/repair/preparing/forSale), `from` date. | §6: status history gives vacancy periods, months rented/vacant and vacancy cost. |
| Prefs: `PagoMisCuentas` added to payment methods (one-time migration that adds it to her existing list; if she deletes it, it stays deleted). | §3. |

## Money rules (no double counting — §5, §12.5)

- A rent's `amount` stays **what reached her** (net, cash basis, unchanged meaning for her v1 data).
- **Gross rent** = net + `fee` + work costs deducted in that liquidation. Flows emit the fee and the
  deductions as rent (gross) and as expenses, so `rent − expenses` is still exactly the cash she got.
- Work `paidBy`:
  - `me` → own expense, as before.
  - `agency`/`tenant`/`other` **with `deducted`** → expense of the property, paid out of a rent. Linked to
    that rent (`incomeId`) it raises that rent's gross. Until it's linked it shows as "pendiente de
    descontar" and the rent loader offers it pre-checked (she confirms).
  - `agency`/`tenant`/`other` **without `deducted`** → kept in the property history, **never** counted.
- Work amounts: `amount` is always the total. If she types a total, parts are just detail (must not exceed
  it; the gap shows as "sin discriminar"). If she leaves total empty, total = sum of parts. Never total + parts.

## Bills, due dates and reminders (§3)

- **Vencimientos** list (Gastos tab + Tablero card): every due service this month and earlier unpaid ones,
  as virtual rows from the templates merged with received bills. Status: *pendiente de recepción*,
  *recibida*, *vence en N días* (≤3), *vence hoy*, *vencida*, *pagada*.
- Due date of a period: the bill's `dueDate` if received, else the template's `dueDay` in that month (shown
  as "estimado").
- Actions per row: **Recibí la factura** (bill form prefilled from the template + last bill: account,
  channel, email/portal/link, due date suggested, last amount as a tap-to-use reference — not prefilled),
  **Pagar** (expense loader prefilled with bill amount or last one, usual method, period).
- **Reminders = a banner at the top of the Tablero** (Iván, 2026-11-09: no push notifications; the
  first page must clearly show what is about to fall due). Red for overdue / due today, amber for due in
  ≤3 days, plus a quieter line for bills not received yet. Same counts as a badge on "Gastos" in the nav.
  No service-worker/push/background sync: a local-only app has no server, and he didn't want it.
  If ever wanted: an .ics calendar export (free, works with the app closed) or real push after a Firebase move.

## Fast loading (§4)

- **Carga del mes** (sheet from Tablero and loader): every expected rent (last collection per property as
  suggestion: amount, method, tenant, next period) and every received-but-unpaid bill. Rows start
  **unchecked**; she ticks, adjusts amounts, and confirms. Nothing is saved without that.
- **Repetir el último** button in the loader per type/property.
- Duplicate / autofill / recent chips from v1 stay.

## Vacancy (§6) and Rentabilidad (§7)

- Current status = last `statusLog` row; with none, *alquilada* if it has a tenant or reference rent.
  Changing status in the property form asks "desde" and adds a row (history kept, editable on the
  property page).
- Vacancy period = any status other than *alquilada*. Per period: from/to, days, own expenses paid in it
  ("costo de tenerla vacía").
- Rentabilidad table per property/year: gross rent, fixed, installments, eventual, fees, net, months
  rented/vacant (days/30.44, one decimal), vacancy cost, value, %. Plus one plain sentence per property:
  "En 2026 dejó US$ X después de pagar sus gastos: N % de lo que vale."

## Plain language (§11)

KPIs get a one-line "qué significa" under the number; the Tablero adds **Resultado neto** (all income −
property expenses) and **Gastos por categoría**.
