# AGENTS.md

Operating notes for coding agents working in this repository.

## What this project is

**QuickDrop** — on-demand courier and parcel pickup. A customer requests a pickup at
one address and a drop-off at another; the platform assigns the nearest available
courier; both watch the parcel move live until it is delivered.

Mobile-first responsive web app shipped as an installable **PWA**. One codebase,
three role-routed surfaces: `/customer`, `/courier`, `/ops`. No native mobile app.

## Status: read this before anything else

**Pre-implementation. There is no application code.**

No `package.json`, no `src/`, no database, no deploy, no runnable command. The
repository currently contains a plan and nothing else. Do not assume any command
works, do not report a build as passing, and do not invent a run script.

The previous task was **planning only**. Iteration 0 (bootstrap) has not started.

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
There is still no application code.

**Iteration count is now fixed: 11 iterations, I0–I10, over 14 weeks**
(2026-10-12 to 2027-01-10), 109 committed person-days against a 2-engineer
capacity of 140. Critical path: **I0 → I1 → I3 → I4 → I6 → I9 → I10**. Read
`docs/07-roadmap.md` before planning any work.

### Beware the index drift

`README.md` and `docs/README.md` both list documents under filenames that were
never written (`05-auth-and-roles.md`, `06-tracking-and-eta.md`,
`07-payments-and-ledger.md`, `08-dispatch-and-matching.md`, `09-frontend-and-pwa.md`,
`10-testing-quality-and-security.md`, `11-roadmap-and-iterations.md`). **Trust the
table above, not those indexes.** Do not go hunting for those files, and do not
duplicate their content elsewhere to work around a 404.

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
2. **Never let the service worker enforce correctness.** It is an optimisation.
   Every invariant must hold with the network, the worker, and the browser all
   misbehaving.
3. **Concurrency invariants live in the database.** Optimistic locking or
   `SELECT … FOR UPDATE SKIP LOCKED` for dispatch and assignment. A double-assign
   must be impossible even with two workers racing. See `docs/02-architecture.md`.
4. **Illegal state transitions return `409`.** The shipment and courier state
   machines in `docs/03-data-model.md` are normative.
5. **Never render a stale position as live.** iOS background geolocation is not
   guaranteed. Every displayed position carries its age; withdraw the ETA rather
   than show a frozen countdown.
6. **Event handlers are idempotent.** Delivery is at-least-once. Outbox rows are
   written in the same transaction as the state change and published only after
   commit.
7. **Do not change a pinned version** without adding an entry to `docs/DECISIONS.md`
   and checking the Status column first — several entries are `Proposed` and
   blocked on a named check.
8. **Mark unverified claims as OPEN or *placeholder*.** Never fake precision in a
   version, a price, or an estimate.

## House style for anything written here

GitHub-flavoured Markdown · **no emojis, ever** · Mermaid for all diagrams, never
ASCII art · ISO `YYYY-MM-DD` dates · docs dated 2026-10-05 unless a later revision is
recorded · link between documents instead of duplicating content · cite a URL for
every non-obvious factual claim.

## Known blockers, as of 2026-10-05

1. Doc numbering conflicts; `01` and `03`/`04` slots are contested between files on
   disk and links inside other docs.
2. Launch city and currency are unnamed. Fares in `00-product-brief.md` are
   illustrative; `08` assumes Berlin while `09` mixes `$` with a EUR-shaped Stripe
   fee.
3. Map tile provider unresolved: self-hosted is pinned, but the risk register notes
   the free tier is non-commercial, implying a paid plan.
4. `courier_stale_share` alert thresholds disagree across three documents
   (5/12% vs 20% vs 25/20/15%). `07-roadmap.md` pins a provisional 20% at I2 and
   assigns reconciliation to I9 — that is not yet reflected in the older docs.
5. Three cost figures are marked `VERIFY`: MapTiler tile pricing, Grafana Cloud
   free-tier limits, A2P 10DLC registration fees.

Full list with owners: [docs/README.md § Known gaps](docs/README.md).

## Conventions for commits

Write conventional commits (`feat:`, `fix:`, `docs:`, `chore:`). Do not commit
secrets or `.env` files. Nothing has been committed since `4ac8f38 Initial commit` —
the entire plan plus `stack_report.md` is currently untracked, and `README.md` is
modified but uncommitted.

## If you are starting implementation

Read `docs/09-infrastructure-and-cost.md` §1–5 for the local stack and CI, then
`docs/01-tech-stack.md` §5.4 for the DX risks that must be retired first. Generate
Drizzle migrations from `docs/03-data-model.md` before writing feature code. CI must
be green on the first commit, not retrofitted.