# Stock Check & Reorder App — Technical Specification

**Version:** 0.1 (draft)
**Date:** 4 August 2026
**Status:** For review

---

## 1. Purpose and Scope

### 1.1 Problem

Weekly ordering currently relies on someone walking the stockroom and noting what looks low. This is error-prone, undocumented, and produces no history.

### 1.2 Goal

A tablet application that lets a staff member walk the stockroom, mark each item as OK, Low, or Out with a single tap, and produce a supplier-grouped order list for the coming week.

### 1.3 In scope (v1)

- Import and maintain the item catalogue from a CSV spreadsheet
- Tap-based stock walk with optional quantity entry
- Automatic order-quantity calculation from par levels
- Supplier-grouped order review with manual override
- CSV and PDF export of the order list
- Local history of completed stock checks

### 1.4 Out of scope (v1)

Barcode scanning, supplier email/EDI integration, purchase-order approval workflow, price and cost tracking, multi-site support, user accounts and roles, live inventory deduction from sales.

---

## 2. Users and Workflow

### 2.1 Users

Single role: **stock checker**. One shared tablet, one active list at a time. No authentication in v1 (see §6.5).

### 2.2 Primary workflow

1. Staff member opens the app and starts a new stock check.
2. Walks the stockroom. The item list is ordered by physical location so the walk follows the shelves.
3. For each item, taps **OK**, **Low**, or **Out**. Tapping is the only required action.
4. Optionally taps the quantity field on a Low or Out row to enter the actual count on the shelf, which refines the order quantity.
5. When finished, opens **Review order**. Lines are grouped by supplier with subtotals.
6. Adjusts or removes lines if needed, then exports as CSV or PDF and completes the session.

### 2.3 Secondary workflow — catalogue update

Manager edits the master spreadsheet (new items, changed par levels, supplier changes), exports CSV, and imports it into the app. The app previews the changes before committing.

---

## 3. Data Model

### 3.1 `suppliers`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `name` | text | Unique, matched from CSV |
| `contact_email` | text | Nullable, for future email export |
| `order_day` | text | Nullable, e.g. "Tuesday" |
| `notes` | text | Nullable |

### 3.2 `items`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `sku` | text | **Unique, stable key for CSV merge** |
| `name` | text | Display name |
| `supplier_id` | UUID | FK → suppliers |
| `category` | text | Nullable, for filtering |
| `location` | text | Shelf/aisle code, drives walk order |
| `sort_order` | int | Position within location |
| `unit` | text | e.g. "bottle", "kg", "box" |
| `par_level` | numeric | Normal stock level to hold |
| `pack_size` | numeric | Order multiple; default 1 |
| `order_qty_low` | numeric | Nullable override for Low status |
| `active` | boolean | Soft delete |
| `last_seen_in_import` | timestamp | Set on each import that contains the SKU |

### 3.3 `stock_checks` (sessions)

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `started_at` | timestamp | |
| `completed_at` | timestamp | Null while in progress |
| `status` | enum | `draft`, `completed`, `abandoned` |
| `checker_label` | text | Free-text name, optional |
| `note` | text | Optional session note |

### 3.4 `stock_check_lines`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `session_id` | UUID | FK → stock_checks |
| `item_id` | UUID | FK → items |
| `status` | enum | `unchecked`, `ok`, `low`, `out` |
| `counted_qty` | numeric | Nullable; entered manually |
| `order_qty` | numeric | Computed, then manually overridable |
| `is_adjusted` | boolean | True if a human typed a number |
| `excluded` | boolean | Line kept but removed from the order |
| `checked_at` | timestamp | |

Snapshot `par_level` and `pack_size` onto the line at check time so historical sessions stay accurate after the catalogue changes.

### 3.5 `csv_imports`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `filename` | text | |
| `imported_at` | timestamp | |
| `rows_added` | int | |
| `rows_updated` | int | |
| `rows_missing` | int | SKUs in DB but absent from this CSV |
| `rows_rejected` | int | Failed validation |

---

## 4. CSV Import and Merge Rules

### 4.1 Expected columns

`sku`, `name`, `supplier`, `category`, `location`, `sort_order`, `unit`, `par_level`, `pack_size`, `order_qty_low`, `active`

Required: `sku`, `name`, `supplier`, `par_level`. Others optional with defaults.

### 4.2 Merge behaviour

Matching is on `sku`.

| Case | Action |
|---|---|
| SKU not in database | Insert as new item |
| SKU exists | Update all provided fields; blank cells leave the existing value untouched |
| SKU in database, absent from CSV | **Flag, do not delete.** Shown in the import summary; user chooses to deactivate or keep |
| Supplier name not recognised | Create supplier automatically |
| Duplicate SKU within one CSV | Reject the file, report the line numbers |

### 4.3 Validation

Per-row validation before commit: SKU non-empty and unique, `par_level` numeric and ≥ 0, `pack_size` numeric and > 0, `active` parseable as boolean. Invalid rows are listed with row numbers and reasons, and are skipped; valid rows still import.

### 4.4 Preview step

Import is two-phase. The app parses, validates, and shows a summary — *X new, Y updated, Z missing, W rejected* — with an expandable list. Nothing is written until the user confirms.

---

## 5. Functional Requirements

### FR-1 — Stock walk screen

- Items listed in `location` then `sort_order` sequence.
- Each row shows: name, unit, supplier, and a three-state control (**OK / Low / Out**).
- Tap targets minimum 48×48 dp, visually distinct colours per state.
- Sticky header with: session progress (`142 / 380 checked`), search box, and filter by supplier/category/location.
- "Jump to unchecked" control to find skipped items.
- State persists on every tap. Closing the app mid-walk loses nothing.

### FR-2 — Order quantity calculation

Applied automatically on status tap:

| Status | Order quantity |
|---|---|
| OK | 0 |
| Low | `order_qty_low` if set, otherwise `ceil(par_level / 2)` |
| Out | `par_level` |
| Any, with `counted_qty` entered | `max(0, par_level − counted_qty)` |

All results are then rounded **up** to the nearest multiple of `pack_size`. Rounding direction is configurable in settings.

### FR-3 — Optional count entry

- After marking Low or Out, the row displays the suggested order quantity as a tappable field.
- Tapping opens a large numeric keypad. The user enters **the current count on the shelf**, not the order quantity.
- Entering a count recalculates `order_qty` and sets `is_adjusted = true`.
- Adjusted rows carry a visible badge distinguishing counted from estimated values.
- Count entry is never required to complete a session.

### FR-4 — Order review screen

- Lines with `order_qty > 0`, grouped by supplier, collapsible per group.
- Per-supplier subtotal of line count and total units.
- Each line editable: change quantity directly, or exclude it from the order.
- Visual distinction between estimated and counted lines.
- Warning banner if any items remain unchecked, with a link back to them.

### FR-5 — Export

- **CSV** — one file per supplier or one combined file with a supplier column. Columns: `sku`, `name`, `unit`, `order_qty`, `supplier`, `status`, `counted`.
- **PDF** — printable order sheet, one page section per supplier, with date, checker name, and space for a signature. Generated via a print stylesheet and the browser's print-to-PDF.
- Export does not close the session; sessions are completed explicitly.

### FR-6 — History

- List of past sessions with date, checker, item counts, and total order lines.
- Read-only detail view of any past session.
- Re-export of a past session's order list.

### FR-7 — Settings

Rounding direction, default Low multiplier, walk grouping (location vs supplier vs category), and CSV import screen access.

---

## 6. Non-Functional Requirements

### 6.1 Offline

The app has no server to sync with (ADR 0001) — it must work fully offline, permanently, not just tolerate temporary disconnection. The PWA shell and all assets are cached via Workbox on first load; the catalogue, sessions, and history all live in IndexedDB. No online/offline indicator or pending-sync count is needed, since there is nothing to sync.

### 6.2 Performance

- Target catalogue size: up to 2,000 items.
- List rendering virtualised; scrolling must stay at 60fps.
- Tap feedback under 100 ms — state updates optimistically, persistence happens asynchronously.
- Cold start to usable list under 2 seconds on a mid-range tablet.

### 6.3 Tablet ergonomics

- Landscape and portrait layouts.
- Minimum 48 dp touch targets, 16 px minimum body text.
- High-contrast palette suitable for dim or fluorescent-lit stockrooms.
- Primary actions reachable in the lower two-thirds of the screen for one-handed use while holding the tablet.
- No hover-dependent interactions.

### 6.4 Data safety

- Every tap persisted immediately to IndexedDB.
- A crash, refresh, or battery death resumes the draft session at the exact point it stopped.
- Sessions retained in IndexedDB indefinitely, until manually cleared. There is no server-side copy (see §7 — ADR 0001) — the tablet's local storage is the only copy of the data. The settings screen should nudge toward periodic CSV/export backups.

### 6.5 Security — resolved 2026-08-04

v1 runs on a single Android tablet, on-premises, protected by the tablet's own device/OS password. No in-app authentication layer. If the tablet ever leaves the premises or the app is exposed beyond it, this must be revisited.

---

## 7. Architecture and Stack

### 7.1 Stack — decided (ADR 0001, 2026-08-04)

No server, no database, no sync layer. Everything runs client-side on the tablet.

| Layer | Choice | Rationale |
|---|---|---|
| Client | React 18 + TypeScript + Vite | Fast builds, strong typing over the data model |
| Styling | Tailwind CSS | Rapid layout of large touch targets |
| PWA shell | `vite-plugin-pwa` (Workbox) | Installable, offline app shell and asset caching |
| Local store | Dexie (IndexedDB) | The only data store — catalogue, sessions, and history all live here |

This was the "simpler alternative" (formerly §7.3) — chosen because there is no machine on the network to host a backend, and the requirement is for everything to run on the tablet itself. See [ADR 0001](decisions/0001-client-only-architecture.md) for the full tradeoff discussion, in particular: **there is no automatic backup.** If the tablet is lost, factory-reset, or has its browser storage cleared, the catalogue and all session history are gone. Periodic manual export is the only mitigation in v1.

### 7.2 Single-device model

Single tablet, single active session at a time, no sync or conflict resolution needed. If a second tablet or multi-user access is ever required, this entire architecture must be revisited — Dexie/IndexedDB has no built-in multi-device sync.

---

## 8. Phase 2 — Future Work

Listed roughly by expected value.

### 8.1 Consumption analysis and reorder prediction

The goal is to learn from session history how quickly each item depletes, and to surface that during the walk.

**What tap-only data supports:** with status history alone, the app can measure the interval between Out events per item, and how often an item is Low versus OK. That is enough for genuinely useful signals:

- Items that reach Out repeatedly → par level is too low
- Items never leaving OK across many sessions → par level is too high, capital tied up in stock
- Items whose Out interval is shortening → demand is rising

This is descriptive statistics, not machine learning, and it is the right first step. It needs roughly 8–12 completed weekly sessions before the output means anything.

**What it does not support:** true consumption rate. Two items both marked Low may have very different amounts on the shelf, so units-per-week cannot be derived. Forecasting a specific order quantity requires the optional `counted_qty` field to be filled consistently, which is exactly why it is worth capturing in v1 even though it is optional.

**Realistic progression:**

1. Descriptive dashboard — par-level suggestions from Out frequency. Low effort, immediate value.
2. Per-item depletion rate from counted sessions, where counts exist. Moderate effort.
3. Seasonality and trend forecasting. Requires a year or more of data. Only worth building if steps 1–2 prove the data quality is there.

A note on framing: the value here is almost entirely in step 1, and step 1 needs no AI. Build the history capture correctly in v1, and the analysis becomes straightforward later.

### 8.2 Other candidates

- Barcode scanning via the tablet camera to jump to an item
- Email the order list directly to each supplier
- Multi-tablet concurrent walks with section assignment
- Price fields and order cost totals
- Photo attachment per line for damaged or unclear stock
- Two-level Low status (Low / Very Low) for better ordering without full counts

---

## 9. Open Questions — resolved 2026-08-04

1. ~~Approximate catalogue size~~ — up to 100 SKUs.
2. ~~Stable SKU or article number~~ — none existed; generated via `docs/templates/catalogue-import-template.csv` (sequential `0001`, `0002`, ...).
3. ~~Are par levels already known~~ — no, don't exist yet. Will be filled into the template; order quantities are meaningless until then.
4. ~~Tablet model and OS~~ — Android.
5. ~~Server on the same network~~ — none, and none wanted. See §7 / ADR 0001: no backend, everything runs on the tablet.
6. ~~Authentication decision~~ — see §6.5. Tablet's own device password is sufficient.
