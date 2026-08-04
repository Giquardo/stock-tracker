# ADR 0001: Client-only architecture, no backend

**Status:** Accepted — 2026-08-04

## Context

CLAUDE.md listed six blockers that had to be answered before Phase 1. Answers received:

1. **SKU** — no existing spreadsheet has one. A template (`docs/templates/catalogue-import-template.csv`) was created with generated sequential SKUs (`0001`, `0002`, ...) for the user to assign once and keep stable.
2. **Par levels** — don't exist yet. They'll be filled into the template; order quantities will be meaningless until then. Not a blocker to building.
3. **Catalogue size** — up to 100 products. Well under the ~500 threshold, so list virtualisation in Phase 3 is not required.
4. **Tablet** — Android, single device.
5. **Server availability** — none. The user wants everything running on the tablet itself, with no separate machine on the network.
6. **Authentication** — the tablet's own OS/device password is sufficient. No in-app auth layer.

Point 5 directly conflicts with the stack CLAUDE.md had locked in (FastAPI + SQLAlchemy/Alembic + PostgreSQL + Docker Compose + Caddy), which requires an always-on host. Three options were presented: (a) drop the backend entirely and run everything client-side, (b) find a small always-on machine on the network to host the original stack, (c) run the backend on the Android tablet itself (e.g. via Termux). The user chose (a).

This is explicitly a **for-now** decision, not a permanent one: the user may later connect the app to an online or work server-side database once one is available. v1 is still local-only — no backend is being built now — but the decision below notes what to keep in mind so that migration isn't a rewrite.

## Decision

Build a pure client-side PWA. No backend, no database server, no Docker Compose, no Caddy.

- Catalogue, sessions, and history all live in the tablet's browser storage via Dexie (IndexedDB).
- CSV import (spec §4.2 merge rules) runs entirely client-side against IndexedDB — no `/imports/preview` or `/imports/commit` HTTP endpoints; the same two-phase preview/commit UX is implemented as in-app screens over local data.
- Exports (CSV, PDF-via-print) are generated and downloaded directly from the browser.
- This is the "simpler alternative" already described in spec §7.3, now the chosen path rather than the fallback.

## Consequences

- Removes an entire layer of infrastructure (Postgres, Alembic migrations, FastAPI, Docker, reverse proxy) — less to build, deploy, and maintain for a single-tablet, single-user tool.
- **No automatic backup.** If the tablet is lost, factory-reset, or has its browser storage cleared, the catalogue and all session history are gone. There is no server copy.
  - Mitigation: encourage periodic CSV/JSON export of the catalogue and history as a manual backup habit. Not building automated backup in v1 — flag if this risk becomes unacceptable later.
- Phase 2's "history and analysis" phase-2-of-the-roadmap work (spec §8.1, consumption prediction) has nothing to run on except client-side storage — still fine for descriptive stats over IndexedDB data, but rules out any server-side batch analysis without revisiting this decision.
- If a second tablet or multi-user access is ever needed, this decision must be revisited — Dexie/IndexedDB has no built-in sync.
- CLAUDE.md's stack table, repo structure, and phase breakdown are updated accordingly (see CLAUDE.md and `docs/SPEC.md` §7).

## Future path — not being built now

The user anticipates connecting this to a server-side or online database later (e.g. at work), which would address the backup gap above. Nothing below is scoped into any current phase — it's here so today's client-only code doesn't quietly foreclose it:

- Spec §3's data model already uses UUID primary keys and a `last_seen_in_import` / soft-delete (`active`) shape that maps cleanly onto a future Postgres schema — keep the Dexie schema matching it field-for-field rather than diverging for convenience.
- Keep the CSV merge logic and order-quantity calculation (CLAUDE.md conventions) as pure functions operating on plain data, not tied to Dexie calls directly — that's what makes them portable to a server later.
- When a server does get added, re-open this ADR rather than silently reintroducing the old FastAPI/Postgres/Docker stack — confirm it's still the right shape given whatever "work server" ends up meaning.
