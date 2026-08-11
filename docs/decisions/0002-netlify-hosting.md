# ADR 0002: Static hosting on Netlify, deployed via GitHub Actions

**Status:** Accepted — 2026-08-05

## Context

ADR 0001 made this a pure client-side PWA with no backend. That left one gap: the tablet needs a stable URL to install the app from. Up to now that's been the developer machine's LAN IP while running `npm run dev` — fine for testing, not durable (requires that machine to be on, reachable, and running the dev server every time).

## Decision

Host the production build as a static site on Netlify, deployed automatically via the existing `.github/workflows/ci.yml` — not Netlify's own Git integration.

- The `deploy` job runs only on pushes to `main`, only after the `test-and-build` job (lint, unit tests, `tsc` type-check, `vite build`) succeeds. A broken build never reaches the live URL.
- The Netlify site is created empty ("Deploy manually", not linked to the GitHub repo), so Netlify never triggers its own build — the Action is the only path to a deploy. Avoids double-deploys and keeps the CI gate meaningful.
- Auth is two repo secrets: `NETLIFY_SITE_ID` and `NETLIFY_AUTH_TOKEN` (a Netlify personal access token), consumed by `netlify-cli deploy --prod` in the deploy job.

## Consequences

- The tablet gets a stable, permanent URL to install from regardless of whether any particular machine is on.
- Adds one more external account dependency (Netlify) and two secrets to keep valid — if the token is ever revoked/expired, deploys fail loudly in Actions (not silently).
- Netlify's free tier is well within this app's needs (static assets only, no functions, low traffic, single user).
- This doesn't change ADR 0001: there's still no backend, no database, no server-side logic. Netlify only ever serves the same static files `vite build` already produces for local testing.
- This also doesn't reopen spec §6.5's no-auth decision. The public URL only serves the static app shell - zero data lives on Netlify. Every device's catalogue/session data lives solely in its own local IndexedDB, gated by that device's OS lock screen. Anyone visiting the URL from a different device just gets an empty app; the tablet's actual data is never reachable through it.
