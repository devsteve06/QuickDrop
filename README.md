# QuickDrop

On-demand courier and parcel pickup in one city: a customer requests a pickup at one address and a drop-off at another, the platform assigns the nearest available courier, and both watch the parcel move live until it is delivered.

## Status

**Pre-implementation. Planning complete, zero application code.** There is no `package.json`, no database, no deploy, and no command in this repository that runs yet. What exists is the plan: the pinned stack, the architecture, the data model, the API contract, and the operational documentation.

Start here: **[docs/README.md](docs/README.md)**.

## What we are building

A mobile-first responsive web app shipped as an installable **PWA** — one codebase, three role-routed surfaces:

| Surface | Who uses it | What it does |
|---|---|---|
| `/customer` | Anyone with a parcel to move | Books a pickup and drop-off, pays, watches live tracking, contacts the courier through the platform |
| `/courier` | Independent couriers | Accepts offers, navigates, shares location, confirms pickup and delivery, sees earnings and payout history |
| `/ops` | Dispatch and support | Watches the live board, reassigns, cancels, refunds, investigates anomalies and stuck shipments |

There is no native mobile app. Both sides track the parcel live through WebSockets, with server-side validation and honest degradation when a device goes quiet.

## How to read the plan

Twelve documents, roughly in the order below. Each says who it is for.

| Read in this order | Doc | Who it is for |
|---|---|---|
| 1 | [00-product-brief.md](docs/00-product-brief.md) | Everyone. Assumptions, personas, golden path, scope, pricing, stories |
| 2 | [01-tech-stack.md](docs/01-tech-stack.md) | Engineers. Pinned versions and the ADRs explaining why the alternatives lost |
| 3 | [DECISIONS.md](docs/DECISIONS.md) | Everyone. The running decision log; read the Status column before implementing |
| 4 | [02-architecture.md](docs/02-architecture.md), [03-data-model.md](docs/03-data-model.md), [04-api-contract.md](docs/04-api-contract.md) | Engineers. The three documents you will use daily |
| 5 | [05-auth-and-roles.md](docs/05-auth-and-roles.md), [06-tracking-and-eta.md](docs/06-tracking-and-eta.md), [07-payments-and-ledger.md](docs/07-payments-and-ledger.md), [08-dispatch-and-matching.md](docs/08-dispatch-and-matching.md), [09-frontend-and-pwa.md](docs/09-frontend-and-pwa.md) | Engineers. The surface you own |
| 6 | [10-testing-quality-and-security.md](docs/10-testing-quality-and-security.md) | Engineers. Before your first PR |
| 7 | [11-roadmap-and-iterations.md](docs/11-roadmap-and-iterations.md) | Everyone. The iteration plan and Definition of Done |
| 8 | [08-testing-strategy.md](docs/08-testing-strategy.md), [09-infrastructure-and-cost.md](docs/09-infrastructure-and-cost.md), [10-risk-register.md](docs/10-risk-register.md), [11-launch-playbook.md](docs/11-launch-playbook.md) | Engineers and the founder. Operational set: how it is tested, hosted, paid for, risked, and launched |

Documents 05 through 11 may not exist yet; they are being authored. A 404 means "still being written", not "wrong". Research input for every version claim lives in [stack_report.md](stack_report.md) and is not duplicated.

## Pinned stack

Verified 2026-09. Versions are not re-researched per document; they come from [stack_report.md](stack_report.md).

- **Node.js** v24.19.0 (Active LTS) · **pnpm** workspaces
- **TypeScript** 7.0.2 · **React** 19.3.0 · **Next.js** 15.5.27 App Router
- **Tailwind CSS** 4.3.3 · hand-rolled **Workbox/Serwist** service worker · **Zod** 4.6.5
- **Hono** 4.13.13 — separate API and realtime Node service
- **PostgreSQL** + **PostGIS** · **Drizzle ORM** 0.45.3 · postgres.js 3.4.9
- **BullMQ** 6.3.11 + **Redis**
- **Better Auth** 1.7.7
- **MapLibre GL JS** 6.12.0 · routing via OSRM / Valhalla / GraphHopper
- **Stripe** Connect, separate charges and transfers (`@stripe/stripe-js` 10.0.0, `stripe` 23.0.0)
- **Railway** hosting · integer minor units and a hand-rolled double-entry ledger with idempotency keys

## Iterations

Nine iterations, approximately 14 weeks, small team, one city. Iteration 0 is bootstrap — a working skeleton, a green CI, and named risk retirements — not a feature iteration. The authoritative breakdown with per-iteration Definition of Done is in **[11-roadmap-and-iterations.md](docs/11-roadmap-and-iterations.md)**.

## Running it

**Nothing runs yet.** Iteration 0 has not started, so there is no command in this repository that will install, build, or serve the app. Do not follow instructions you find elsewhere in this repository that suggest otherwise.

When Iteration 0 lands, the intent is a single command that brings up the whole stack — Postgres with PostGIS, Redis, and the three services — followed by a deterministic seed. The exact commands, the `compose.yaml` contents, and the migration and seeding workflow are specified in **[09-infrastructure-and-cost.md](docs/09-infrastructure-and-cost.md)** sections 2 and 3; treat that document as the specification to build against, not as a description of working software.

## Known open questions

Carried forward deliberately, each with an owner in the plan: Node 26 entering LTS on 2026-10-28 · TypeScript 7.0 programmatic-API compatibility with Next.js build plugins · Better Auth stability after the Vercel acquisition · Stripe Connect Accounts v2 transition · iOS background-tracking acceptance criteria · courier payout and KYC onboarding lead time.

See [00-product-brief.md](docs/00-product-brief.md) §11 and [DECISIONS.md](docs/DECISIONS.md) for the full list.

## Conventions

No emojis · GitHub-flavoured Markdown and Mermaid diagrams · ISO dates · money in integer minor units with an idempotency key on every write · any displayed live position carries its age · version claims cite [stack_report.md](stack_report.md).