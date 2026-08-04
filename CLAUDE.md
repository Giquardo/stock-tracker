# CLAUDE.md — Stock Check & Reorder App

## What this is

A tablet PWA for weekly stockroom checks. Staff tap items as OK / Low / Out during a walk; the app calculates order quantities from par levels and produces a supplier-grouped order list.

**`docs/SPEC.md` is the source of truth.** Read it fully before writing code. This file covers how to build it, not what to build. Where the two conflict, the spec wins — and tell me about the conflict.

---

## Blockers — resolved 2026-08-04

See [`docs/decisions/0001-client-only-architecture.md`](docs/decisions/0001-client-only-architecture.md) for full context.

1. **Stable SKU per item.** No existing spreadsheet/SKU. Resolved with a generated template at `docs/templates/catalogue-import-template.csv` using sequential SKUs (`0001`, `0002`, ...), assigned once and kept stable.
2. **Par levels.** Don't exist yet. Not a blocker — Phase 1 proceeds; order quantities are meaningless until real par levels are filled into the template.
3. **Catalogue size.** Up to 100 products. Well under the ~500 threshold — no virtualisation needed in Phase 3.
4. **Tablet model and OS.** Android, single device.
5. **Server availability.** None, and none wanted — everything runs on the tablet. This eliminated the backend entirely; see the architecture note below.
6. **Authentication.** The tablet's own device/OS password is sufficient. No in-app auth layer.

---

## Stack — decided, do not substitute

**No backend.** Per ADR 0001, this is a pure client-side PWA — no server, no database, no Docker. Everything below runs entirely on the tablet, in the browser.

| Layer | Choice |
|---|---|
| Client | React 18, TypeScript (strict), Vite |
| Styling | Tailwind CSS |
| PWA | `vite-plugin-pwa` / Workbox |
| Local store | Dexie (IndexedDB) — the only data store, no server behind it |

If you think one of these is wrong for a specific reason, say so before building — don't silently swap it.

---

## Repo structure

```
/
├── docs/
│   ├── SPEC.md
│   ├── decisions/          # ADRs, one file per non-obvious choice
│   └── templates/          # catalogue-import-template.csv
├── frontend/
│   ├── src/
│   │   ├── db/             # Dexie schema
│   │   ├── features/       # walk/, review/, history/, import/
│   │   ├── components/
│   │   └── lib/            # order-qty calculation, CSV merge logic
│   └── tests/
└── CLAUDE.md
```

---

## Conventions

- TypeScript strict mode. No `any` — if the type is genuinely unknown, use `unknown` and narrow.
- Order-quantity calculation (spec §FR-2) is implemented **once**, in a pure function, unit tested against every case in the table including pack-size rounding edge cases. Do not scatter the logic across components.
- All quantity values are `number` with explicit rounding at calculation boundaries only.
- Every Dexie schema change is a versioned `.stores()` upgrade, not a silent shape change.
- Commit per logical unit with a descriptive message. Do not commit a whole phase at once.
- Record non-obvious decisions as short ADRs in `docs/decisions/`.

---

## Build phases

Complete and verify each phase before starting the next. Stop at the end of each and wait for my confirmation.

### Phase 1 — App shell and catalogue import

Deliverables:
- Vite + React + TS + Tailwind scaffold
- PWA config: installable, offline app shell, correct manifest and icons
- Dexie schema for all five tables in spec §3 (as IndexedDB tables, not Postgres)
- CSV import implementing the merge rules in §4.2 exactly, including the flag-don't-delete behaviour for missing SKUs — runs entirely client-side against IndexedDB
- Two-phase import UI: a preview step showing the summary without writing, then a commit step that applies it
- Row-level validation per §4.3 — invalid rows reported with row numbers, valid rows still import
- Unit tests for the merge logic: new SKU, existing SKU, missing SKU, duplicate SKU in file, unknown supplier, blank cells preserving existing values

Acceptance: install to tablet home screen; import `docs/templates/catalogue-import-template.csv` (or a real filled-in copy), see an accurate preview, commit it, and IndexedDB matches. Put the device in airplane mode and the catalogue is still there.

### Phase 2 — Stock walk screen

**This is the phase that determines whether the app is usable.** Build it on the real tablet, in the real stockroom lighting, before moving on.

Deliverables:
- Item list ordered by `location` then `sort_order`
- Three-state OK / Low / Out control per row, 48 dp minimum targets, distinct colours
- Optimistic state update — visible feedback under 100 ms, persistence async
- List virtualisation not required at this catalogue size (≤100 items) — skip unless it's actually janky on the real tablet
- Sticky header: progress counter, search, filters by supplier / category / location
- Jump-to-unchecked control
- Optional count entry per FR-3: tappable quantity field, large numeric keypad, entry is the **shelf count** not the order quantity, sets `is_adjusted`, shows a badge
- Draft session resumes exactly where it stopped after a refresh or crash

Acceptance: a full walk of the real catalogue on the real tablet, offline, with no dropped taps and no scroll jank. Then I test it before Phase 3 exists.

Pull in frontend design guidance at the start of this phase rather than accumulating defaults.

### Phase 3 — Order review and export

Deliverables:
- Review screen: lines with `order_qty > 0`, grouped by supplier, collapsible, per-supplier subtotals
- Inline quantity edit and per-line exclude
- Visual distinction between estimated and counted lines
- Unchecked-items warning with a link back
- CSV export, per supplier and combined
- PDF export via print stylesheet and browser print-to-PDF — not a PDF library

### Phase 4 — History and settings

Deliverables:
- Session list with date, checker, counts
- Read-only session detail, re-export from history
- Settings: rounding direction, default Low multiplier, walk grouping
- Import screen wired to the Phase 1 import logic
- Nudge toward periodic catalogue/history export as manual backup — there is no server copy (ADR 0001)

---

## Rules of engagement

- **Don't build ahead.** If a later phase seems easy while you're in the current one, note it and move on.
- **Ask when the spec is ambiguous.** A wrong assumption compounds; a question costs one message.
- **Don't add dependencies** without saying why first.
- **Don't refactor across phase boundaries** without asking.
- Phase 2 (stock walk) gets tested on real hardware before Phase 3. Do not skip this.

## Not in v1

Barcode scanning, supplier email, multi-tablet concurrency, price and cost tracking, user accounts, photo attachments, consumption prediction. Spec §8 covers the phase-2 roadmap — build the history capture correctly in v1 and that becomes straightforward later. Do not build any of it now.
