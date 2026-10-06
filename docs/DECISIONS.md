# QuickDrop — Decision Log

Running, numbered ADR log. Every decision the project makes gets an entry here, in order, dated.

- **Status values:** `Accepted` (decided and in force) · `Proposed` (decided in principle, blocked on a named check) · `Rejected` (considered and declined; kept for archaeology) · `Superseded by ADR-XXXX` (a later entry replaced it — the original text is preserved, the status line is amended, and a pointer is added).
- **Line budget:** entries here are deliberately ≤15 lines. The full Context/Decision/Consequences/Alternatives argument lives in [01-tech-stack.md](./01-tech-stack.md) for architecture decisions and in [00-product-brief.md](./00-product-brief.md) for product decisions. Do not duplicate it here.
- **Version rule:** a pinned version never changes without a new entry. Amend, do not rewrite history.
- Research inputs are taken verbatim from [../stack_report.md](../stack_report.md); versions are not re-researched.

---

## Index

| ID | Title | Status |
|---|---|---|
| [ADR-0001](#adr-0001--pin-the-runtime-and-framework-versions-to-the-verified-2026-09-set) | Pin the runtime and framework versions to the verified 2026-09 set | Accepted |
| [ADR-0002](#adr-0002--next-js-web-tier-plus-a-separate-hono-api-service) | Next.js web tier plus a separate Hono API service | Accepted |
| [ADR-0003](#adr-0003--postgresql--postgis-as-the-single-source-of-truth) | PostgreSQL + PostGIS as the single source of truth | Accepted |
| [ADR-0004](#adr-0004--integer-minor-units-with-a-hand-rolled-double-entry-ledger-in-postgres) | Integer minor units with a hand-rolled double-entry ledger in Postgres | Accepted |
| [ADR-0005](#adr-0005--stripe-connect-separate-charges-and-transfers) | Stripe Connect: separate charges and transfers | Accepted |
| [ADR-0006](#adr-0006--pwa-only-no-native-app-for-v1) | PWA-only, no native app for v1 | Accepted |
| [ADR-0007](#adr-0007--websocket-primary-tracking-with-sse-fallback) | WebSocket-primary tracking with SSE fallback | Accepted |
| [ADR-0008](#adr-0008--hand-rolled-workbox-service-worker-not-ext-pwa) | Hand-rolled Workbox service worker, not ext-pwa | Accepted |
| [ADR-0009](#adr-0009--self-hosted-better-auth-sessions-in-our-own-postgres) | Self-hosted Better Auth sessions in our own Postgres | Accepted |
| [ADR-0010](#adr-0010--drizzle-orm-and-postgres-js-over-prisma) | Drizzle ORM and postgres.js over Prisma | Accepted |
| [ADR-0011](#adr-0011--bullmq-and-redis-over-inngest-or-trigger-dev) | BullMQ and Redis over Inngest or Trigger.dev | Accepted |
| [ADR-0012](#adr-0012--maplibre-gl-js-with-self-hosted-vector-tiles) | MapLibre GL JS with self-hosted vector tiles | Accepted |
| [ADR-0013](#adr-0013--match-with-st_dwithin-and-for-update-skip-locked) | Match with `ST_DWithin` and `FOR UPDATE SKIP LOCKED` | Accepted |
| [ADR-0014](#adr-0014--railway-as-the-single-hosting-provider) | Railway as the single hosting provider | Accepted |
| [ADR-0015](#adr-0015--one-ledger-currency-and-no-fx-in-v1) | One ledger currency and no FX in v1 | Accepted |
| [ADR-0016](#adr-0016--ops-adjusts-money-in-the-ledger-never-in-the-stripe-dashboard) | Ops adjusts money in the ledger, never in the Stripe dashboard | Accepted |
| [ADR-0017](#adr-0017--no-courier-funds-held-longer-than-the-weekly-settlement-run) | No courier funds held longer than the weekly settlement run | Accepted |
| [ADR-0018](#adr-0018--webkit-runs-in-ci-from-day-one) | WebKit runs in CI from day one | Accepted |
| [ADR-0019](#adr-0019--manual-railway-deploys-from-main-for-v1) | Manual Railway deploys from `main` for v1 | Accepted |
| [ADR-0020](#adr-0020--single-city-address-based-and-prepaid-only-at-launch) | Single city, address-based, prepaid only at launch | Accepted |
| [ADR-0021](#adr-0021--foreground-tracking-plus-server-side-staleness-detection) | Foreground tracking plus server-side staleness detection | Accepted |
| [ADR-0022](#adr-0022--courier-position-upload-defaults-to-batched-http-post) | Courier position upload defaults to batched HTTP POST | Proposed |
| [ADR-0023](#adr-0023--pin-the-stripe-api-version-and-migrate-onto-accounts-v2) | Pin the Stripe API version and migrate onto Accounts v2 | Proposed |
| [ADR-0024](#adr-0024--typescript-70-programmatic-api-compatibility-gate) | TypeScript 7.0 programmatic-API compatibility gate | Proposed |
| [ADR-0025](#adr-0025--keep-node-24-until-node-26-lts-is-proven-in-production) | Keep Node 24 until Node 26 LTS is proven in production | Proposed |
| [ADR-0026](#adr-0026--better-auth-post-vercel-acquisition-exit-plan) | Better Auth post-acquisition exit plan | Proposed |
| [ADR-0027](#adr-0027--serwist-is-the-pre-agreed-sw-fallback-if-workbox-integration-fails) | Serwist is the pre-agreed SW fallback if Workbox integration fails | Proposed |
| [ADR-0028](#adr-0028--courier-position-history-retention-and-downsampling) | Courier position history retention and downsampling | Proposed |

---

## Entries

### ADR-0001 — Pin the runtime and framework versions to the verified 2026-09 set

- **Status:** Accepted · **Date:** 2026-10-05 · **Deciders:** Engineering
- **Context:** Dependency versions move fast, and unversioned installs have broken Next.js builds during pre-production.
- **Decision:** Pin exactly: Node 24.19.0, TypeScript 7.0.2, Next.js 15.5.27, React 19.3.0, Tailwind 4.3.3, Hono 4.13.13, Drizzle 0.45.3, postgres.js 3.4.9, BullMQ 6.3.11, Zod 4.6.5, Better Auth 1.7.7, MapLibre GL JS 6.12.0, stripe 23.0.0, @stripe/stripe-js 10.0.0.
- **Consequences:** No `^` or `latest` ranges in `package.json`; Renovate/Dependabot proposes, humans merge. Node 26 is explicitly not a launch dependency (see [ADR-0025](#adr-0025--keep-node-24-until-node-26-lts-is-proven-in-production)).
- **Alternatives:** Tracking `latest` (rejected: non-reproducible builds); adopting 16.x on day one (rejected: 15.5.27 carries the September 2026 security patches and is the stability line).
- **Sources:** [stack_report §1](../stack_report.md#1-pinned-stack-table) · [Next 15.5](https://nextjs.org/blog/next-15-5) · [React 19.3](https://react.dev/blog/2026/09/09/react-19-3)
- **Full discussion:** [01-tech-stack.md §1](./01-tech-stack.md#1-pinned-stack)

### ADR-0002 — Next.js web tier plus a separate Hono API service

- **Status:** Accepted · **Date:** 2026-10-05 · **Deciders:** Engineering
- **Context:** The PWA web tier (SSR, session reading, installable shell) and the realtime tier (long-lived WebSocket, position fan-out, SSE) have incompatible scaling and deploy characteristics.
- **Decision:** Two services plus a worker from one repo: `apps/web` (Next.js 15.5.27), `apps/api` (Hono 4.13.13 on Node 24.19.0), `apps/worker` (BullMQ). Shared libraries in `packages/*` with an enforced import boundary.
- **Consequences:** Realtime uptime is independent of web deploys; two services to deploy, secure, and observe; internal web→API calls cross the network, so auth must be verifiable from both.
- **Alternatives:** Next.js API routes only (rejected: long-lived WebSocket + tier coupling); NestJS monolith (rejected: DI framework outweighs the problem); service-per-entity microservices (rejected: wrong granularity for three surfaces and one marketplace).
- **Full discussion:** [01-tech-stack.md ADR-1](./01-tech-stack.md#adr-1-next-js-web-tier-plus-a-separate-hono-api-service-not-next-js-api-routes-only)

### ADR-0003 — PostgreSQL + PostGIS as the single source of truth

- **Status:** Accepted · **Date:** 2026-10-05 · **Deciders:** Engineering
- **Context:** "Nearest available courier" is a transactional composite filter (status, freshness, vehicle capability, zone, radius) that must commit atomically with the order reservation.
- **Decision:** One Postgres + PostGIS holds orders, couriers, positions as `geography(Point,4326)`, proof records, the ledger, and the audit log. GiST spatial index plus `(status, last_seen_at)` composite index; distance selected only for ordering.
- **Consequences:** No double-assignment, and joins/reconciliation in SQL; Redis may be added purely as a read-through cache for nearby-courier dashboards, never as authority.
- **Alternatives:** Turbopuffer or a vector DB (rejected: similarity search, not transactional filtering); Redis geohash as authority (rejected: cannot express the composite filter or join atomically); Supabase-hosted Postgres (rejected as primary: multi-vendor split, no capability gain); Firestore GeoQuery (rejected: no cross-document transaction shape we need).
- **Full discussion:** [01-tech-stack.md ADR-2](./01-tech-stack.md#adr-2-postgresql--postgis-not-a-hosted-geo-database)

### ADR-0004 — Integer minor units with a hand-rolled double-entry ledger in Postgres

- **Status:** Accepted · **Date:** 2026-10-05 · **Deciders:** Engineering, Finance
- **Context:** Money moves between customer, platform, and independent courier across refunds, cancellation fees, tips, surges, adjustments, and disputes. Float arithmetic and unconstrained balance updates are unacceptable.
- **Decision:** All amounts stored as integer minor units in `BIGINT`; every money movement is a balanced double-entry transaction written in one DB transaction; `CHECK` constraints enforce non-negative balances and per-transaction balancing; every mutating money operation carries an idempotency key with a `UNIQUE` constraint in our table *and* is forwarded to Stripe.
- **Consequences:** Reconciliation and dispute forensics become SQL queries; ledger writes are the slowest write path and must stay inside transactions; ledger rows are append-only and corrections are reversing entries, never edits.
- **Alternatives:** Floating-point cents (rejected: precision loss); a third-party double-entry ledger library (rejected: no dominant option, and we need exact control of the constraints and idempotency semantics); Stripe balance as source of truth for entitlement (rejected: Stripe is authority for external movement only).
- **Full discussion:** [01-tech-stack.md §1 and §2.7](./01-tech-stack.md#1-pinned-stack) · product rules in [00-product-brief.md §9.4](./00-product-brief.md#94-unit-economics-invariants-to-enforce-in-code)

### ADR-0005 — Stripe Connect: separate charges and transfers

- **Status:** Accepted · **Date:** 2026-10-05 · **Deciders:** Engineering, Finance
- **Context:** Customers must see one merchant, one receipt, one refund path. Couriers are independent contractors paid per completed delivery, earned at delivery and settled weekly.
- **Decision:** Platform is merchant of record and takes the customer charge. Courier earnings become a `courier_payable` ledger entry at proof acceptance, settled by a separate Connect transfer on a weekly schedule with idempotency key `(courier_id, period)`.
- **Consequences:** Clean receipts and no per-order onboarding interruption; we absorb Stripe fees, chargebacks, and refund risk; Connect onboarding is a real flow in courier signup; Accounts v2 transition is tracked in [ADR-0023](#adr-0023--pin-the-stripe-api-version-and-migrate-onto-accounts-v2).
- **Alternatives:** Direct charges (rejected: exposes the connected account per order, breaks the single receipt); destination charges with `application_fee_amount` (rejected: order creation fails if courier onboarding is incomplete, and matching is already the fragile step).
- **Sources:** [Stripe Connect](https://docs.stripe.com/connect/) · [idempotent requests](https://docs.stripe.com/api/idempotent_requests)
- **Full discussion:** [01-tech-stack.md ADR-3](./01-tech-stack.md#adr-3-stripe-connect-separate-charges-and-transfers)

### ADR-0006 — PWA-only, no native app for v1

- **Status:** Accepted · **Date:** 2026-10-05 · **Deciders:** Engineering, Product
- **Context:** Three role surfaces must ship as one codebase on a production bar. A native app would double the release surface, and iOS Safari PWAs have real limits.
- **Decision:** v1 ships as an installable PWA only, served by Next.js, for `/customer`, `/courier`, and `/ops`. No native wrapper, no app-store distribution.
- **Consequences:** Guaranteed continuous background courier tracking on iOS is not achievable in a browser, so the product promises foreground tracking plus staleness honesty (see [ADR-0021](#adr-0021--foreground-tracking-plus-server-side-staleness-detection)). Install must be taught manually for iOS because `beforeinstallprompt` never fires there.
- **Alternatives:** Capacitor/React Native wrapper now (rejected: app-store tooling, native toolchain, and background-location integration before we know we need them); PWA plus native in parallel (rejected: two product surfaces to keep honest with one team).
- **Sources:** [web.dev iOS install](https://web.dev/learn/pwa/installation/#ios-installation) · [WebKit Geolocation](https://developer.apple.com/documentation/webkitjs/geolocation)
- **Full discussion:** [00-product-brief.md A-09/A-10](./00-product-brief.md#1-assumptions) · [01-tech-stack.md ADR-5](./01-tech-stack.md#adr-5-hand-rolled-workbox-service-worker-not-ext-pwa)

### ADR-0007 — WebSocket-primary tracking with SSE fallback

- **Status:** Accepted · **Date:** 2026-10-05 · **Deciders:** Engineering
- **Context:** Courier→server is bidirectional and bursty; server→consumer is mostly unidirectional fan-out. iOS drops connections on screen lock, tab switch, and network handover, and terminates service workers aggressively.
- **Decision:** WebSocket rooms per `shipment:<id>` / `courier:<id>` at `/v1/stream`, automatic SSE fallback for one-way consumers, 5s polling as last resort. The ladder is invisible to the user; the connection indicator is visible. No correctness depends on any transport. Fan-out is coalesced to one message per room per 2 s.
- **Consequences:** Two realtime transports plus a polling path to build and test; connection-state bugs are the main defect class and must be tested. Staleness is two-tier and server-authoritative: 60 s withdraws the customer ETA (`etaConfidence: 'unavailable'`), 120 s revokes the assignment and re-dispatches. Both thresholds are defined in [02-architecture.md](./02-architecture.md); this entry restates them and does not own them.
- **Alternatives:** SSE only (rejected: acceptable for server→consumer, hence the fallback, but awkward as the primary); polling only (rejected: a visible product failure and a load multiplier); Firebase listeners (rejected: vendor-gated, cannot join our Postgres state); MQTT (rejected: an extra broker and auth surface for fan-out we already have).
- **Sources:** [MDN WebSocket vs SSE](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_client_applications#differences-between-websocket-and-http) · [stack_report §3](../stack_report.md#3-tracking-architecture-consumer-server-fan-out)
- **Full discussion:** [01-tech-stack.md ADR-4](./01-tech-stack.md#adr-4-websocket-primary-tracking-with-sse-fallback)

### ADR-0008 — Hand-rolled Workbox service worker, not ext-pwa

- **Status:** Accepted · **Date:** 2026-10-05 · **Deciders:** Engineering
- **Context:** The courier PWA needs a fast shell, offline write queueing, and precached map tiles, with SW/app versions paired on every deploy.
- **Decision:** Workbox `injectManifest` built in a separate `pnpm sw:build` step, with route-class caching (app shell precached; surfaces network-first; quotes/orders/positions network-only; tiles and images cache-first with bounded LRU). The SW is a performance layer only.
- **Consequences:** We own cache invalidation and SW bugs; CI must assert every precache revision matches a real built asset or a stale shell can ship forever; no feature may depend on the SW staying alive.
- **Alternatives:** ext-pwa (rejected: limiting with App Router/Turbopack, wrong default caching); Serwist (deferred as a pre-agreed fallback, see [ADR-0027](#adr-0027--serwist-is-the-pre-agreed-sw-fallback-if-workbox-integration-fails)); no service worker (rejected: loses installability and offline queueing).
- **Sources:** [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps) · [Workbox](https://developer.chrome.com/docs/workbox/) · [MDN Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- **Full discussion:** [01-tech-stack.md ADR-5](./01-tech-stack.md#adr-5-hand-rolled-workbox-service-worker-not-ext-pwa)

### ADR-0009 — Self-hosted Better Auth sessions in our own Postgres

- **Status:** Accepted · **Date:** 2026-10-05 · **Deciders:** Engineering
- **Context:** Three role-routed surfaces need role claims, long-lived courier sessions, and server-side invalidation, and session verification must work from `apps/api` as well as Next.js middleware.
- **Decision:** Better Auth 1.7.7, self-hosted, sessions in our Postgres, roles `customer` / `courier` / `ops` / `admin`. Email + phone OTP at launch. The normative authorisation matrix lives in [02-architecture.md](./02-architecture.md), not here.
- **Consequences:** Full control of session lifetime and recovery; we own the users/session tables and therefore the migration path if the vendor relationship changes (see [ADR-0026](#adr-0026--better-auth-post-vercel-acquisition-exit-plan)).
- **Alternatives:** Auth.js v5 (rejected: maintenance mode, and Next-coupled); Clerk (rejected: managed directory and sessions as a vendor dependency); Lucia (rejected: deprecated); hand-rolled sessions (rejected: rotation and CSRF are not worth authoring).
- **Sources:** [Better Auth](https://www.better-auth.com/) · [Vercel acquires Better Auth](https://vercel.com/blog/vercel-acquires-better-auth)
- **Full discussion:** [01-tech-stack.md §2.1](./01-tech-stack.md#21-authentication)

### ADR-0010 — Drizzle ORM and postgres.js over Prisma

- **Status:** Accepted · **Date:** 2026-10-05 · **Deciders:** Engineering
- **Context:** The schema is geospatial (`geography`), ledger-shaped (immutable rows, `CHECK` balances), and audit-shaped. We need real SQL with type safety, not an abstraction over it.
- **Decision:** Drizzle ORM 0.45.3 with postgres.js 3.4.9. Generated migration SQL is committed and reviewed; expand/contract with no destructive step inside a single deploy.
- **Consequences:** Query shapes are explicit and index-driven; no ORM-level protection against a hand-written `UPDATE` skipping business rules, so repository functions own writes.
- **Alternatives:** Prisma (rejected: 8.0.0-rc pre-stable, and its query layer fights spatial and `CHECK`-heavy schemas); Kysely/raw SQL (rejected: no schema-diff migrations); TypeORM (rejected: heavier, no advantage).
- **Full discussion:** [01-tech-stack.md §2.2](./01-tech-stack.md#22-data-access-and-migrations)

### ADR-0011 — BullMQ and Redis over Inngest or Trigger.dev

- **Status:** Accepted · **Date:** 2026-10-05 · **Deciders:** Engineering
- **Context:** Matching, ETA refresh, notifications, and settlement are long-lived Node processes on Railway, not serverless invocations.
- **Decision:** BullMQ 6.3.11 with Redis for queues: delayed jobs, retry with backoff, concurrency limits, per-order serialisation, flow dependencies.
- **Consequences:** Redis is a required dependency and a failure domain; queue depth and job latency are first-class metrics; a Postgres-only queue remains a legitimate later simplification.
- **Alternatives:** Inngest and Trigger.dev (rejected: durable execution is designed for serverless function invocation, adding a hop and a second failure domain for no gain); Postgres `SKIP LOCKED` queue (deferred: viable, revisit if Redis stops paying for itself); cron in the web service (rejected: ties periodic correctness to web deploys).
- **Full discussion:** [01-tech-stack.md §2.4](./01-tech-stack.md#24-queue-and-background-work)

### ADR-0012 — MapLibre GL JS with self-hosted vector tiles

- **Status:** Accepted · **Date:** 2026-10-05 · **Deciders:** Engineering
- **Context:** Live tracking needs smooth pan/zoom on mobile data, PWA-friendly caching of tiles, and predictable cost with no client-visible API key.
- **Decision:** MapLibre GL JS 6.12.0 rendering self-hosted vector tiles and sprites. Routing (OSRM/Valhalla/GraphHopper) is called server-side only; routes are cached per order leg.
- **Consequences:** We host and update the tile pipeline; tile caching becomes a first-class bandwidth decision; a tile outage degrades to a visible "map unavailable" panel while tracking, ETA, and proof capture keep working.
- **Alternatives:** Leaflet (rejected: raster-first, worse mobile cost and smoothness); Google Maps JS (rejected: restrictive licensing, per-request billing, key in client); Mapbox GL (rejected: proprietary and billable).
- **Sources:** [MapLibre](https://maplibre.org/) · [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps)
- **Full discussion:** [01-tech-stack.md §2.5](./01-tech-stack.md#25-maps-and-geospatial)

### ADR-0013 — Match with `ST_DWithin` and `FOR UPDATE SKIP LOCKED`

- **Status:** Accepted · **Date:** 2026-10-05 · **Deciders:** Engineering
- **Context:** Two couriers must never be assigned the same order, and candidate selection must stay fast as the courier table grows.
- **Decision:** Stage-1 candidate query filters on `status = available`, `last_seen_at > now() - interval '5 minutes'`, `ST_DWithin(...)` within radius, vehicle capability, and active zone; selects `ST_Distance` for ordering only; reserves with `FOR UPDATE SKIP LOCKED LIMIT 10` inside one transaction. Stage-2 ranking (routed distance plus weighted factors) is specified in [02-architecture.md](./02-architecture.md) and is normative there; this entry fixes only the prefilter and the reservation guard.
- **Consequences:** Assignment is race-free without advisory locks; a slow query shows up as matching latency, not as double-booking; freshness threshold is a product decision tied to [ADR-0021](#adr-0021--foreground-tracking-plus-server-side-staleness-detection).
- **Alternatives:** Application-level locking (rejected: not race-free across processes); Redis-first geo (rejected as authority, see [ADR-0003](#adr-0003--postgresql--postgis-as-the-single-source-of-truth)); selecting `ST_Distance` in the `WHERE` clause (rejected: defeats the spatial index).
- **Sources:** [PostGIS](https://postgis.net/) · [ST_DWithin](https://postgis.net/docs/ST_DWithin.html)
- **Full discussion:** [01-tech-stack.md ADR-2](./01-tech-stack.md#adr-2-postgresql--postgis-not-a-hosted-geo-database)

### ADR-0014 — Railway as the single hosting provider

- **Status:** Accepted · **Date:** 2026-10-05 · **Deciders:** Engineering
- **Context:** We need long-lived WebSocket connections, background workers as separate services, managed Postgres with PostGIS, and managed Redis, at roughly 5k orders/month.
- **Decision:** Railway: `apps/web`, `apps/api`, `apps/worker` as separate services plus managed Postgres and Redis. ~$105/month at that volume.
- **Consequences:** One vendor for compute and data, so no cross-provider hop on the API path; less infra flexibility than AWS, which is acceptable at this size; a staging environment must be provisioned deliberately, not accidentally.
- **Alternatives:** Render (rejected: no decisive advantage); Fly.io (rejected for now: more operational fluency needed; revisit for multi-region); AWS (rejected: disproportionate ops surface at 5k orders/month); Vercel for the web tier (rejected: adds a cross-vendor hop per API call for no gain).
- **Full discussion:** [01-tech-stack.md §2.6](./01-tech-stack.md#26-hosting)

### ADR-0015 — One ledger currency and no FX in v1

- **Status:** Accepted · **Date:** 2026-10-05 · **Deciders:** Engineering, Finance
- **Context:** Multi-currency adds per-currency rounding, per-region ledger constraints, and FX gain/loss accounts.
- **Decision:** Single currency for ledger, Stripe account, quotes, payouts, and receipts in v1. `currency` is stored on every amount row but has exactly one value.
- **Consequences:** Simple integer arithmetic is valid; adding a currency later requires an explicit FX design, not just a config change.
- **Alternatives:** Per-currency accounts from day one (rejected: complexity with no v1 user); a vendor multi-currency ledger (rejected: we already own the ledger per [ADR-0004](#adr-0004--integer-minor-units-with-a-hand-rolled-double-entry-ledger-in-postgres)).
- **Full discussion:** [00-product-brief.md A-11](./00-product-brief.md#1-assumptions)

### ADR-0016 — Ops adjusts money in the ledger, never in the Stripe dashboard

- **Status:** Accepted · **Date:** 2026-10-05 · **Deciders:** Engineering, Finance
- **Context:** Dispatchers need refund and payout-adjustment authority. Doing it in the provider dashboard produces money movement with no ledger entry and no audit trail.
- **Decision:** All adjustments originate in the ops console against our ledger, with idempotency key, reason code, actor, and before/after balances; the API then instructs Stripe. Every move is recorded and reversible by entry, not by edit.
- **Consequences:** Support answers "where did my money go" with one query; Stripe remains a system of record for external state, never for entitlement; per-order and daily authority caps are a Finance open question.
- **Alternatives:** Manual dashboard refunds (rejected: unauditable, unidempotent, invisible to the customer timeline); raw SQL edits by ops (rejected: bypasses idempotency and the audit log).
- **Full discussion:** [00-product-brief.md US-O4](./00-product-brief.md#us-o4--must--move-money-correctly-and-show-what-moved)

### ADR-0017 — No courier funds held longer than the weekly settlement run

- **Status:** Accepted · **Date:** 2026-10-05 · **Deciders:** Engineering, Finance
- **Context:** Separate charges and transfers create a real working-capital interval between "courier earned" and "courier paid".
- **Decision:** Weekly settlement on a fixed schedule, with the pending balance, next transfer date, and minimum threshold visible to the courier at all times.
- **Consequences:** Statement honesty becomes a product requirement (user story US-R7); a delayed or failed transfer must be surfaced immediately, never swallowed; the payable balance is a monitored metric.
- **Alternatives:** Instant transfers per delivery (rejected: transfer-fee cost and failure surface at high frequency); monthly settlement (rejected: unacceptable trust cost for independent contractors).
- **Full discussion:** [01-tech-stack.md ADR-3](./01-tech-stack.md#adr-3-stripe-connect-separate-charges-and-transfers)

### ADR-0018 — WebKit runs in CI from day one

- **Status:** Accepted · **Date:** 2026-10-05 · **Deciders:** Engineering
- **Context:** The most expensive defect class in this product is an iOS-only failure in tracking, service worker, or install behaviour. Chromium-only CI hides all of it.
- **Decision:** Playwright project matrix includes `chromium` and `webkit`, with the courier tracking flow, SW update path, and offline queue replay exercised in both from the first iteration.
- **Consequences:** Roughly doubles browser CI time; accepted as the cost of the platform we are actually targeting. Manual smoke testing on a physical iPhone remains part of the release checklist.
- **Alternatives:** Chromium-only CI with manual iOS testing (rejected: manual testing does not scale with every PR); no E2E until late (rejected: iOS regressions are then indistinguishable from platform changes).
- **Full discussion:** [01-tech-stack.md §4 and §5.3](./01-tech-stack.md#53-dx-principles)

### ADR-0019 — Manual Railway deploys from `main` for v1

- **Status:** Accepted · **Date:** 2026-10-05 · **Deciders:** Engineering
- **Context:** Continuous deployment during rapid schema and contract churn turns a bad commit into a bad customer-facing state.
- **Decision:** CI runs lint, typecheck, test, e2e, and build on every PR. Deploy to Railway is manual from `main`, with a migration dry-run in CI against a schema snapshot.
- **Consequences:** Deploys are explicit and auditable; to change that, adopt progressive delivery and a migration strategy as explicit work in the release iteration.
- **Alternatives:** Auto-deploy on merge (rejected: pre-release churn makes rollbacks routine rather than exceptional); preview deploys per PR (deferred: adds Railway usage and secret management before it is needed).
- **Full discussion:** [01-tech-stack.md §4](./01-tech-stack.md#4-tooling)

### ADR-0020 — Single city, address-based, prepaid only at launch

- **Status:** Accepted · **Date:** 2026-10-05 · **Deciders:** Product, Engineering
- **Context:** Launch scope determines the matching problem, the ledger shape, and the courier contract model.
- **Decision:** One city; pickup and drop-off as addresses only (A-03); card-prepaid only, no COD (A-04); one live courier per order (A-07); small parcels with enforced dimension and weight limits (A-05).
- **Consequences:** Matching is a single-radius query; the ledger never holds customer funds it has not seen; custody stays simple. Multi-city, scheduling, returns, and relay remain v2 per [00-product-brief.md §7.3](./00-product-brief.md#73-v2-deferred-list).
- **Alternatives:** Multi-city at launch (rejected: per-region zones and pricing before the loop is proven); cash on delivery (rejected: breaks ledger integrity and creates shortage exposure); geo-pin-only addressing (rejected: failed-pickup rate).
- **Full discussion:** [00-product-brief.md §1 and §7](./00-product-brief.md#1-assumptions)

### ADR-0021 — Foreground tracking plus server-side staleness detection

- **Status:** Accepted · **Date:** 2026-10-05 · **Deciders:** Product, Engineering
- **Context:** iOS Safari does not report location continuously for a backgrounded or closed PWA, and Background Sync is unavailable there. Browser-only continuous courier tracking is not possible.
- **Decision:** The product promises foreground tracking. The server stores last-known position with its timestamp, validates and smooths points, emits an explicit `tracking_degraded` event past the staleness threshold, and the UI renders position age rather than a bare live dot.
- **Consequences:** The courier app must show its own tracking health; the customer view must be able to say "tracking delayed"; ops sees a stale-tracking flag. iOS acceptance criteria are the acceptance test for this decision.
- **Alternatives:** Promise continuous background tracking and hope (rejected: it is false on iOS and will generate support and trust damage); native app to solve it (deferred behind [ADR-0006](#adr-0006--pwa-only-no-native-app-for-v1)).
- **Sources:** [WebKit Geolocation](https://developer.apple.com/documentation/webkitjs/geolocation) · [caniuse Background Sync](https://caniuse.com/background-sync) · [WebKit on service workers](https://webkit.org/blog/8090/workers-at-your-service/)
- **Full discussion:** [00-product-brief.md §10](./00-product-brief.md#10-cross-cutting-product-requirements)

### ADR-0022 — Courier position upload defaults to batched HTTP POST

- **Status:** Proposed · **Date:** 2026-10-05 · **Deciders:** Engineering
- **Context:** Courier→server is a steady low-volume stream that must survive reconnects and mid-route network loss. A multiplexed WebSocket write path is more complex and buys little at 2–5 second batch intervals.
- **Decision:** Default to `POST /v1/courier/positions` with batched points, flushed on movement threshold, time interval, or page hide. Revisit WebSocket upload only if a spike shows batching cannot meet freshness targets.
- **Blocked on:** A Iteration 4 spike measuring end-to-end courier→customer position latency and battery cost on a mid-range Android and an iPhone 13.
- **Consequences if confirmed:** Simpler reconnect semantics and an IndexedDB replay queue that is trivially correct; the WebSocket tier becomes server→consumer only.
- **Alternatives:** WebSocket for both directions (rejected for now: complexity without a measured need); long-polling (rejected: overhead and proxy timeouts).
- **Full discussion:** [01-tech-stack.md ADR-4](./01-tech-stack.md#adr-4-websocket-primary-tracking-with-sse-fallback)

### ADR-0023 — Pin the Stripe API version and migrate onto Accounts v2

- **Status:** Proposed · **Date:** 2026-10-05 · **Deciders:** Engineering
- **Context:** Connect is transitioning to Accounts v2, with legacy account types deprecated in favour of controller properties. An unpinned API version will drift underneath us.
- **Decision:** Set the Stripe API version explicitly on the client and in `STRIPE_API_VERSION`; write all new Connect code against Accounts v2 guidance; never construct an account with a legacy `type`.
- **Blocked on:** Confirming the exact Accounts v2 surface supported by `stripe` 23.0.0 and the webhook event set we must handle.
- **Consequences if confirmed:** Predictable webhook payloads and no surprise breaking change on upgrade; a migration note is required if any legacy shape leaks into stored payloads.
- **Alternatives:** Rely on the SDK default version (rejected: implicit upgrades in a money path); stay on legacy account types (rejected: deprecated).
- **Sources:** [Accounts v2 changelog](https://docs.stripe.com/changelog/clover/2025-12-15/accounts-v2) · [stack_report §7](../stack_report.md#7-open-questions)
- **Full discussion:** [01-tech-stack.md ADR-3](./01-tech-stack.md#adr-3-stripe-connect-separate-charges-and-transfers)

### ADR-0024 — TypeScript 7.0 programmatic-API compatibility gate

- **Status:** Proposed · **Date:** 2026-10-05 · **Deciders:** Engineering
- **Context:** TypeScript 7.0 is the native Go port. Tooling that depends on the TypeScript compiler API may not support it, and we run several build-time plugins.
- **Decision:** Pin 7.0.2 for type-checking and authoring. Before any release, prove `tsc --noEmit` and a production `next build` succeed in CI with the chosen plugin set.
- **Blocked on:** Iteration 0 CI standing up the full build. If a plugin fails, pin that plugin; do not downgrade TypeScript.
- **Consequences if confirmed:** Fast type-check in CI with no fallback work; if a plugin is permanently incompatible, the only fallback is a documented downgrade of TypeScript alone, which is a new ADR.
- **Alternatives:** Stay on TypeScript 5.x (rejected for now: no measured blocker and we lose the speedup); use both compilers (rejected: two type-checkers disagreeing is worse than one).
- **Sources:** [TS 7.0 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/) · [stack_report §7](../stack_report.md#7-open-questions)
- **Full discussion:** [01-tech-stack.md §5.4](./01-tech-stack.md#54-known-dx-risks-to-retire-in-iteration-0)

### ADR-0025 — Keep Node 24 until Node 26 LTS is proven in production

- **Status:** Proposed · **Date:** 2026-10-05 · **Deciders:** Engineering
- **Context:** Node 26 enters LTS on 2026-10-28. It is unproven for our dependency set at the plan date, and Node 24 has a support runway to 2028-04-30.
- **Decision:** Launch on Node 24.19.0. Evaluate Node 26 after a full iteration in production on staging, checking BullMQ, postgres.js pool churn, and the Hono WebSocket path.
- **Blocked on:** Staging availability plus one clean iteration of Node 26 in the staging environment.
- **Consequences if confirmed:** Supported runtime until April 2028 with no forced upgrade; upgrade is a scheduled, reversible change with `.nvmrc`, `engines`, and `NODE_VERSION` updated together.
- **Alternatives:** Launch on Node 26 (rejected: it becomes LTS three weeks after this plan and is untested for our stack); pin Node 22 (rejected: shorter runway, already behind the Active LTS line).
- **Sources:** [Node.js releases](https://nodejs.org/en/about/previous-releases/) · [release schedule](https://nodejs.org/en/blog/announcements/evolving-the-nodejs-release-schedule/)
- **Full discussion:** [01-tech-stack.md §1](./01-tech-stack.md#1-pinned-stack)

### ADR-0026 — Better Auth post-acquisition exit plan

- **Status:** Proposed · **Date:** 2026-10-05 · **Deciders:** Engineering
- **Context:** Better Auth was acquired by Vercel in July 2026. The MIT licence and self-hosted DB ownership are unchanged as of the report date, but roadmap control may move.
- **Decision:** Keep self-hosting. The users, sessions, and account tables are ours in Postgres, behind a thin adapter interface in `packages/auth`, so swapping the session implementation touches one package.
- **Blocked on:** No action required now. Revisit only on a licence change, a schema-breaking major, or the loss of a self-hosted feature we depend on.
- **Consequences if confirmed:** Migration cost is bounded to `packages/auth`; no user-visible change; role claims stay portable because they are our columns.
- **Alternatives:** Move to Auth.js v5 preemptively (rejected: maintenance mode, and swapping into a less capable option is not an improvement); write our own sessions (rejected: no demonstrated need).
- **Sources:** [Vercel acquires Better Auth](https://vercel.com/blog/vercel-acquires-better-auth)
- **Full discussion:** [01-tech-stack.md §2.1](./01-tech-stack.md#21-authentication)

### ADR-0027 — Serwist is the pre-agreed SW fallback if Workbox integration fails

- **Status:** Proposed · **Date:** 2026-10-05 · **Deciders:** Engineering
- **Context:** Workbox `injectManifest` must agree with the Next.js 15.5 asset hash. Serwist is the credible alternative if it does not.
- **Decision:** Decision point is Iteration 0: attempt Workbox; if the injectManifest step cannot be made reliable, switch to Serwist immediately rather than accumulating workarounds. The caching policy from [ADR-0008](#adr-0008--hand-rolled-workbox-service-worker-not-ext-pwa) is library-agnostic.
- **Blocked on:** The Iteration 0 build spike. Do not defer this decision past the first surface that needs the SW.
- **Consequences if confirmed:** A 1–2 day switch cost decided in advance, instead of an open-ended workaround tax.
- **Alternatives:** ext-pwa as a fallback (rejected: reintroduces exactly the limitation we are avoiding); no SW (rejected).
- **Full discussion:** [01-tech-stack.md ADR-5](./01-tech-stack.md#adr-5-hand-rolled-workbox-service-worker-not-ext-pwa)

### ADR-0028 — Courier position history retention and downsampling

- **Status:** Proposed · **Date:** 2026-10-05 · **Deciders:** Engineering, Product
- **Context:** Raw position points accumulate quickly and are both a storage cost and, aggregated, a location-privacy exposure for independent contractors.
- **Decision:** Retain the latest position per courier in the hot table, keep a short raw window for dispute forensics, then downsample to coarser intervals. Retention periods and downsampling factors are set with the privacy doc.
- **Blocked on:** A storage estimate at ~40 active couriers, and a legal/privacy view on courier location data.
- **Consequences if confirmed:** Bounded Postgres growth, defensible privacy posture, and disputes still reconstructable.
- **Alternatives:** Keep all raw points indefinitely (rejected: cost and privacy exposure); store no history (rejected: kills dispute forensics and ETA-quality analysis); a time-series database (rejected: a new datastore for a volume Postgres handles comfortably).
- **Full discussion:** [00-product-brief.md §10](./00-product-brief.md#10-cross-cutting-product-requirements)

---

## Cross-document reconciliation

This log records decisions. Where another document owns a normative detail, the decision here points at it rather than restating it. Ownership map:

| Concern | Normative owner |
|---|---|
| Shipment entity, tables, state machine, enums, ledger schema | [03-data-model.md](./03-data-model.md) |
| Dispatch algorithm, offer ladder and TTLs, staleness sweeps, event catalogue, trust boundaries, role set | [02-architecture.md](./02-architecture.md) |
| Endpoints, error envelope, rate limits, authorisation matrix, idempotency | `03-api-contracts.md` (pending; see [README.md](./README.md#known-gaps-in-the-plan-as-of-2026-10-05)) |
| Service worker, manifest, surfaces, offline behaviour | `04-frontend-pwa.md` (pending) |
| Stripe Connect flows, settlement, reconciliation | `05-payments-and-ledger.md` (pending) |
| Tracking pipeline detail, ETA model | `06-dispatch-and-tracking.md` (pending) |
| Iteration plan and capacity | `07-roadmap.md` (pending) |
| Test matrix and CI gating | [08-testing-strategy.md](./08-testing-strategy.md) |
| Deployment, cost model, backups, retention | [09-infrastructure-and-cost.md](./09-infrastructure-and-cost.md) |
| Risks and assumptions register | [10-risk-register.md](./10-risk-register.md) |
| Launch gates and go/no-go | `11-launch-playbook.md` (pending) |

Canonical vocabulary: the booked thing is a **`shipment`**; lifecycle states are `draft`, `quoted`, `payment_pending`, `booked`, `offer_pending`, `assigned`, `picked_up`, `in_transit`, `arrived`, `delivered`, `cancelled`, `failed`; roles are `customer`, `courier`, `ops`, `admin`. Older drafts of `00-product-brief.md` used "order" and a `searching` state — both are superseded by the above.

---

## Open questions

Carried deliberately unresolved. Each is tracked in [../stack_report.md §7](../stack_report.md#7-open-questions) and assigned to the entry that will close it.

| Question | Entry that will close it | Trigger to revisit |
|---|---|---|
| TypeScript 7.0 programmatic-API compatibility with build plugins | [ADR-0024](#adr-0024--typescript-70-programmatic-api-compatibility-gate) | Iteration 0 CI |
| Node 26 LTS entering 2026-10-28 | [ADR-0025](#adr-0025--keep-node-24-until-node-26-lts-is-proven-in-production) | One clean staging iteration on Node 26 |
| Better Auth post-Vercel-acquisition stability | [ADR-0026](#adr-0026--better-auth-post-vercel-acquisition-exit-plan) | Licence change, breaking major, or loss of a self-hosted feature |
| Stripe Connect Accounts v2 transition | [ADR-0023](#adr-0023--pin-the-stripe-api-version-and-migrate-onto-accounts-v2) | Before the first live Connect transfer |
| iOS background-tracking acceptance criteria | [ADR-0021](#adr-0021--foreground-tracking-plus-server-side-staleness-detection) and [ADR-0006](#adr-0006--pwa-only-no-native-app-for-v1) | Product sign-off on what promise is acceptable; reassess per courier complaint data |
| Workbox vs. Serwist integration | [ADR-0027](#adr-0027--serwist-is-the-pre-agreed-sw-fallback-if-workbox-integration-fails) | Iteration 0 build spike |
| Which routing binary ships (OSRM / Valhalla / GraphHopper) | Not yet raised — must become a new entry before Iteration 4 | Iteration 4 ETA spike |
| Courier position retention and downsampling factors | [ADR-0028](#adr-0028--courier-position-history-retention-and-downsampling) | Privacy doc sign-off |