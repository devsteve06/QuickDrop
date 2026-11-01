# AGENTS.md — QuickDrop

Operating notes for coding agents and contributors.

**This repository contains two unrelated artefacts that share the name QuickDrop.** Read the
routing table before anything else. They describe different products, use different stacks, and
have different rules. Do not port a convention from one to the other, and do not "fix" one to
match the other without an entry in [docs/DECISIONS.md](docs/DECISIONS.md).

| If you are working on | Read | Status as of 2026-11-01 |
|---|---|---|
| The **food-delivery MVP** — `server/`, `mobile/`, `client/`, [PLAN.md](PLAN.md) | [Part A](#part-a--food-delivery-mvp-runnable-code) | Phases 0–1 done; API and web build verified |
| The **courier / parcel-pickup PWA plan** — `docs/`, `stack_report.md` | [Part B](#part-b--courierparcel-pwa-plan-docs-only) | Planning complete; no application code |

The shared commit rules are at the [end of this file](#commit-conventions-shared).

---

# Part A — Food-delivery MVP (runnable code)

## What this is

A **guest-checkout food-delivery MVP**: browse restaurants, add items to a cart, check out, pay
(simulated), see a confirmation. One React Native (Expo) codebase targets iOS, Android, and web;
a small Express + `node:sqlite` API backs it. There are no accounts, no real payments, and no
courier tracking.

The authoritative roadmap for this track is [PLAN.md](PLAN.md). [mobile/AGENTS.md](mobile/AGENTS.md)
adds Expo-specific rules and must be followed when touching `mobile/`.

## Current status (2026-11-01)

| Phase | State | Notes |
|---|---|---|
| 0 — Decisions & scaffold | Done | Expo SDK 58 app in `mobile/`, Expo Router entry, web export verified |
| 1 — API MVP-complete | Done | `/api/health`, binds `0.0.0.0`, hardened validation, 15 passing tests |
| 2 — Expo foundation | Next | API client, theme/components, `CartProvider`, platform alerts |
| 3–7 | Not started | Browse/menu, cart, checkout, polish, docs/release |

Verified at this checkpoint:

- `npm test` (in `server/`) → 15 tests, 4 suites, all passing.
- `npm run lint` (in `mobile/`) → exit 0.
- `npx expo export --platform web` → success (781 modules, 3 bundles).
- `npx expo-doctor` → 20/20 checks passed.

## Commands

Run from the repo root unless noted.

| Command | Purpose |
|---|---|
| `npm run dev` | API + Expo dev server together |
| `npm run dev:api` | API only (`node --watch`) |
| `npm run dev:app` | Expo dev server only |
| `npm run dev:web` | Expo web only |
| `npm run seed` | Reset the local DB to the 4 seeded restaurants (wipes orders) |
| `npm test` | API tests (delegates to `server/`) |
| `npm run lint --prefix mobile` | ESLint for the Expo app |
| `npm run export:web --prefix mobile` | Static web build into `mobile/dist/` |

Do **not** use `npx expo lint` here — the CLI version check fails under ESLint 9 even though the
config is valid. Use `npm run lint --prefix mobile`.

## Environment

Server:

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `4000` | HTTP port |
| `HOST` | `0.0.0.0` | Bind address (needed for physical devices) |
| `QUICKDROP_DB` | `server/quickdrop.db` | Alternate SQLite file (tests use a temp file) |
| `CORS_ORIGIN` | `*` | Comma-separated allowed origins |

Mobile:

| Variable | Meaning |
|---|---|
| `EXPO_PUBLIC_API_URL` | API base URL. Web/simulator: `http://localhost:4000`; Android emulator: `http://10.0.2.2:4000`; device: `http://<LAN-IP>:4000` |

Requirements: **Node >= 22.5** (`node:sqlite`). Node 24.22 is the verified runtime.

## Layout

```
quickdrop/
├── server/                  Express + node:sqlite API
│   ├── src/app.js           createApp(): routes, validation, error handling
│   ├── src/index.js         starts the server (HOST 0.0.0.0, PORT 4000)
│   ├── src/db.js            schema + DB connection (QUICKDROP_DB override)
│   ├── src/seed.js          seedDatabase() + CLI entry
│   ├── test/api.test.js     node:test + supertest, temp DB
│   └── quickdrop.db         local data (gitignored)
├── mobile/                  Expo app — iOS / Android / web
│   ├── src/app/             Expo Router routes (_layout.jsx, index.jsx, …)
│   ├── src/                 non-route code (api, state, components, theme)
│   ├── app.json             Expo config (scheme, expo-router plugin)
│   ├── .env.example         EXPO_PUBLIC_API_URL for web/simulator/device
│   └── AGENTS.md            Expo-specific agent rules
├── client/                  LEGACY Vite web app — frozen, delete in Phase 7
├── PLAN.md                  MVP scope, phases, decisions, risks
├── docs/                    UNRELATED: courier/parcel plan — see Part B
└── AGENTS.md                this file
```

## Conventions

- **JavaScript/JSX only** for the MVP. Do not introduce TypeScript mid-flight without updating the plan.
- **Routing:** Expo Router only. Every file in `mobile/src/app/` is a route; keep hooks,
  components, API code, and state outside that directory. Never import `@react-navigation/*`
  directly (SDK 56+).
- **Styling:** React Native `StyleSheet` + theme tokens. No UI kit for the MVP.
- **Money:** the server always computes subtotal, delivery fee, and total from the database.
  Never send prices from the client. Keep rounding to 2 dp server-side. Floats are a known MVP
  compromise; integer minor units are the post-MVP fix (the courier plan in Part B already
  mandates them, but that rule is not retroactive here).
- **Errors:** throw `HttpError(status, message)` in `server/src/app.js`; the handler returns JSON.
  Unknown errors log server-side and return a generic 500.
- **Tests:** use `QUICKDROP_DB` pointed at a temp file; call `seedDatabase(db)`, then close and
  delete the file. Never test against `quickdrop.db`.
- **Persistence:** the DB file is gitignored. A fresh clone must run `npm run seed`.
- **Native folders:** `ios/` and `android/` are generated (CNG). Configure native behavior in
  `app.json` / config plugins; never edit generated folders by hand.
- **Legacy client:** `client/` is frozen. Do not add features there; delete it in Phase 7 after
  the Expo app reaches parity.
- **Secrets/data:** never commit `.env`, `*.db`, `node_modules/`, or `dist/`.

## API contract

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Liveness probe |
| GET | `/api/restaurants` | List, sorted by rating |
| GET | `/api/restaurants/:id` | Restaurant + `menu[]` |
| POST | `/api/orders` | Create order; server prices it |
| POST | `/api/orders/:id/pay` | Simulated payment; `pending_payment` → `preparing` |
| GET | `/api/orders/:id` | Order + items + restaurant summary |

Order statuses today: `pending_payment` → `preparing`. Later phases add delivery states.

## Verification checklist (before declaring work done)

1. `npm test` passes.
2. `npm run lint --prefix mobile` exits 0.
3. `npm run export:web --prefix mobile` succeeds when routes/deps change.
4. Manual flow still works: restaurants → menu → cart → checkout → confirmation.
5. `PLAN.md` status table is updated if a phase completes.

## Known issues / gotchas

- **npm 11.19 + user-level `allow-scripts`:** `npx expo install` fails with `EALLOWSCRIPTS`.
  Workaround: install with plain `npm install` using the SDK-compatible versions Expo resolved,
  or run with a clean `npm_config_userconfig`.
- **SQLite on hosts:** many platforms reset local disk; orders are not durable in production.
  Postgres is the post-MVP step.
- **Money as floats:** acceptable for the MVP; integer cents is the future fix.
- **Loopback restrictions:** some sandboxes block `localhost`; use in-process `supertest` tests.
- **Emoji:** the app uses emoji instead of food photography; rendering varies by platform. This is
  the one place emoji are acceptable; see the house style in Part B.
- **No auth:** orders are guest-only; `GET /api/orders/:id` is unauthenticated by design.

## Rules for agents on this track

- Stay within the current phase's scope; record scope changes in `PLAN.md`.
- Prefer small, reviewable changes that keep the API and app runnable.
- Run the verification checklist before finishing.
- Do not reseed or delete `quickdrop.db` unless explicitly asked — it holds user-created orders.
- When adding an Expo/native dependency, check the Expo SDK docs for the installed major version
  first; Expo APIs change every release.

---

# Part B — Courier/parcel PWA plan (docs only)

## What this is

**QuickDrop as specified in `docs/`** — on-demand courier and parcel pickup. A customer requests
a pickup at one address and a drop-off at another; the platform assigns the nearest available
courier; both watch the parcel move live until it is delivered.

Mobile-first responsive web app shipped as an installable **PWA**. One codebase, three
role-routed surfaces: `/customer`, `/courier`, `/ops`. No native mobile app.

## Status: read this before anything else

**Pre-implementation. No part of this plan has been built.**

Nothing in `server/`, `mobile/` or `client/` implements this plan. Those directories are the
food-delivery MVP in Part A. `docs/` is a design for a different product, on a different stack
(Postgres/Hono/Next.js, not SQLite/Express/Expo). Do not treat the MVP as Iteration 0 of this
plan, and do not report the MVP's passing tests as evidence that this plan is implemented.

The previous task on this track was **planning only**. Iteration 0 (bootstrap) has not started.

## The plan is the source of truth

Files that exist on disk today:

| File | What it owns |
|---|---|
| [docs/README.md](docs/README.md) | Doc index, reading orders, known gaps |
| [docs/00-product-brief.md](docs/00-product-brief.md) | Assumptions, personas, scope, 18 MoSCoW stories, pricing |
| [docs/01-tech-stack.md](docs/01-tech-stack.md) | Pinned versions, rejected alternatives, 5 full ADRs |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Running ADR log (ADR-0001…0028) with status |
| [docs/02-architecture.md](docs/02-architecture.md) | Containers, dispatch algorithm, 14 race conditions |
| [docs/03-data-model.md](docs/03-data-model.md) | ER diagram, state machines, double-entry ledger |
| [docs/04-api-contract.md](docs/04-api-contract.md) | Endpoints, authz matrix, idempotency, rate limits |
| [docs/05-realtime-and-tracking.md](docs/05-realtime-and-tracking.md) | Position streaming, throttling, ETA, iOS limits |
| [docs/06-frontend-architecture.md](docs/06-frontend-architecture.md) | Routes, state, offline, service worker, a11y |
| [docs/07-roadmap.md](docs/07-roadmap.md) | **Owns the iteration count.** 11 iterations I0–I10, gantt, critical path, per-iteration DoD |
| [docs/08-testing-strategy.md](docs/08-testing-strategy.md) | Test pyramid, load targets, CI gating |
| [docs/09-infrastructure-and-cost.md](docs/09-infrastructure-and-cost.md) | Compose, CI/CD, migrations, observability, cost |
| [docs/10-risk-register.md](docs/10-risk-register.md) | 26 risks, top-5 deep dives, assumptions register |
| [docs/11-launch-playbook.md](docs/11-launch-playbook.md) | Go/no-go, phased rollout, rollback, incidents |
| [stack_report.md](stack_report.md) | The only place version research lives — read-only |

**The plan is complete.** All twelve documents `00`–`11` exist, plus `DECISIONS.md`.

**Iteration count is fixed: 11 iterations, I0–I10, over 14 weeks**
(2026-10-12 to 2027-01-10), 109 committed person-days against a 2-engineer
capacity of 140. Critical path: **I0 → I1 → I3 → I4 → I6 → I9 → I10**. Read
`docs/07-roadmap.md` before planning any work.

### Filenames are canonical

An earlier index reserved a different set of filenames (`05-auth-and-roles.md`,
`06-tracking-and-eta.md`, `07-payments-and-ledger.md`, `08-dispatch-and-matching.md`,
`09-frontend-and-pwa.md`, `10-testing-quality-and-security.md`,
`11-roadmap-and-iterations.md`). Those files were never written. All cross-references
have been repointed at the twelve files in the table above, which are now the single
canonical scheme. The `05`/`06` collision is settled in favour of
`05-realtime-and-tracking.md` and `06-frontend-architecture.md`. Do not resurrect the old
names, and do not duplicate content elsewhere to work around a 404 — fix the link.

One subject still has no document of its own: the operational Stripe Connect flows.
`01-tech-stack.md` ADR-3 owns the account model and `docs/03-data-model.md` owns the
ledger and settlement mechanics. See gap 6 in `docs/README.md`.

## Pinned stack

Verified 2026-09. Sourced from `stack_report.md`; never re-research it per task and
never invent a version that is not in that file.

Node.js v24.19.0 (Active LTS) · pnpm workspaces · TypeScript 7.0.2 · React 19.3.0 ·
Next.js 15.5.27 App Router · Tailwind CSS 4.3.3 · hand-rolled Workbox/Serwist
service worker · Zod 4.6.5 · **Hono 4.13.13** (separate API/realtime service) ·
PostgreSQL + **PostGIS** · Drizzle ORM 0.45.3 · postgres.js 3.4.9 · **BullMQ 6.3.11**
+ Redis · **Better Auth 1.7.7** · **MapLibre GL JS 6.12.0** · routing via
OSRM/Valhalla/GraphHopper · **Stripe** Connect separate charges and transfers
(`@stripe/stripe-js` 10.0.0, `stripe` 23.0.0) · **Railway** hosting · integer minor
units with a hand-rolled double-entry ledger.

## Rules that survive contact with code

1. **Money is never a float.** Integer minor units, a `currency` sibling column, a
   balanced double-entry journal, and an idempotency key on every mutating money
   operation. Enforce the balance in the database, not in application code.
2. **Never let the service worker enforce correctness.** It is an optimisation. Every
   invariant must hold with the network, the worker, and the browser all misbehaving.
3. **Concurrency invariants live in the database.** Optimistic locking or
   `SELECT … FOR UPDATE SKIP LOCKED` for dispatch and assignment. A double-assign
   must be impossible even with two workers racing. See `docs/02-architecture.md`.
4. **Illegal state transitions return `409`.** The shipment and courier state machines
   in `docs/03-data-model.md` are normative.
5. **Never render a stale position as live.** iOS background geolocation is not
   guaranteed. Every displayed position carries its age; withdraw the ETA rather than
   show a frozen countdown.
6. **Event handlers are idempotent.** Delivery is at-least-once. Outbox rows are
   written in the same transaction as the state change and published only after commit.
7. **Do not change a pinned version** without adding an entry to `docs/DECISIONS.md` and
   checking the Status column first — several entries are `Proposed` and blocked on a
   named check.
8. **Mark unverified claims as OPEN or *placeholder*.** Never fake precision in a
   version, a price, or an estimate.

## House style for anything written here

GitHub-flavoured Markdown · **no emojis, ever** · Mermaid for all diagrams, never ASCII
art · ISO `YYYY-MM-DD` dates · docs dated 2026-10-05 unless a later revision is recorded ·
link between documents instead of duplicating content · cite a URL for every non-obvious
factual claim.

"Here" means `docs/` and `stack_report.md`. The MVP in Part A uses emoji as its icon set;
that is a runtime asset, not documentation prose.

## Known blockers, as of 2026-10-06

1. Launch city and currency are unnamed. Fares in `00-product-brief.md` are illustrative;
   `08` assumes Berlin while `09` mixes `$` with a EUR-shaped Stripe fee.
2. Map tile provider unresolved: self-hosted is pinned, but the risk register notes the
   free tier is non-commercial, implying a paid plan.
3. `courier_stale_share` alert thresholds disagree across three documents (5/12% vs 20% vs
   25/20/15%). `07-roadmap.md` pins a provisional 20% at I2 and assigns reconciliation to
   I9 — that is not yet reflected in the older docs.
4. Three cost figures are marked `VERIFY`: MapTiler tile pricing, Grafana Cloud free-tier
   limits, A2P 10DLC registration fees.
5. No document owns the operational Stripe Connect flows end to end. `01-tech-stack.md`
   ADR-3 owns the account model and `03-data-model.md` owns the ledger and settlement; the
   flow-by-flow narrative does not exist yet. Assign an owner at Iteration I6.

Doc numbering is no longer a blocker — the twelve filenames on disk are canonical and every
cross-reference has been repointed.

Full list with owners: [docs/README.md § Known gaps](docs/README.md).

## If you are starting implementation of this plan

Read `docs/09-infrastructure-and-cost.md` §1–5 for the local stack and CI, then
`docs/01-tech-stack.md` §5.4 for the DX risks that must be retired first. Generate Drizzle
migrations from `docs/03-data-model.md` before writing feature code. CI must be green on the
first commit, not retrofitted.

Decide first whether this plan supersedes the MVP in Part A, or is a separate product. That
decision is not recorded anywhere yet, and it determines whether `server/` and `mobile/` are
deleted, kept, or evolved.

---

# Commit conventions (shared)

- Conventional commits: `feat:`, `fix:`, `docs:`, `chore:`.
- Never commit secrets, `.env` files, `*.db`, `node_modules/`, or build output.
- The courier plan landed in `ab7f8d9`; its link repair followed it. The MVP scaffold and API
  landed in `81b5cfe` (`phase-1-checkpoint`).
- Keep the two tracks in separate commits. A commit that touches `docs/` should not also change
  MVP code, so either track can be reviewed or reverted independently.
