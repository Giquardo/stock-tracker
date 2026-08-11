# Stock Check & Reorder

[![CI & Deploy](https://github.com/Giquardo/stock-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/Giquardo/stock-tracker/actions/workflows/ci.yml)

A tablet PWA for weekly stockroom checks. Walk the stockroom, tap each item **OK / Low / Out**, and get a supplier-grouped order list calculated from par levels — no spreadsheet, no paper.

**Live app:** https://stock-tracker-max.netlify.app/

## Status

| Phase | What it covers | Status |
|---|---|---|
| 1 — App shell & catalogue import | PWA scaffold, CSV import with preview/commit, Dexie schema | ✅ Done |
| 2 — Stock walk screen | Tap-to-check list, search/filters, shelf count entry, draft persistence | 🟡 Built, pending real-tablet testing |
| 3 — Order review & export | Supplier-grouped order list, CSV/PDF export | Not started |
| 4 — History & settings | Past sessions, settings, backup nudges | Not started |

## Tech stack

Pure client-side PWA — **no backend, no server, no database beyond the browser**. See [ADR 0001](docs/decisions/0001-client-only-architecture.md) for why.

| Layer | Choice |
|---|---|
| Client | React 18, TypeScript (strict), Vite |
| Styling | Tailwind CSS |
| PWA | `vite-plugin-pwa` (Workbox) |
| Local storage | Dexie (IndexedDB) |
| Hosting | Netlify, deployed via GitHub Actions on every push to `main` ([ADR 0002](docs/decisions/0002-netlify-hosting.md)) |

Because there's no server, all data — the catalogue, in-progress walks, history — lives only in the browser storage of whichever device is using it. There's no sync between devices; see the ADRs for the tradeoffs that come with that.

## Getting started

```bash
cd frontend
npm install
npm run dev       # start the dev server
npm run test      # run the unit test suite (Vitest)
npm run lint      # oxlint
npm run build     # type-check + production build
```

To try it with sample data: open the app, switch to the **Import** tab (it auto-loads a placeholder snacks & drinks catalogue), and hit **Commit import**.

## Docs

- [`docs/SPEC.md`](docs/SPEC.md) — full functional spec; the source of truth for what this app does.
- [`docs/decisions/`](docs/decisions/) — ADRs recording non-obvious architecture decisions.
- [`docs/templates/catalogue-import-template.csv`](docs/templates/catalogue-import-template.csv) — starter CSV for a real catalogue.
- [`CLAUDE.md`](CLAUDE.md) — build conventions and phase plan.
