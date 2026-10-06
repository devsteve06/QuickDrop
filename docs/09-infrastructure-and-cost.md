# 09 — Infrastructure and Cost

Status: pre-implementation, planning only. Every command and file below is a **specification to be created**, not something that exists in this repository today.
Owner: engineering, with named per-iteration infra owner (see [11-roadmap-and-iterations.md](11-roadmap-and-iterations.md)).
Sibling docs: [00-product-brief.md](00-product-brief.md) · [01-tech-stack.md](01-tech-stack.md) · [02-architecture.md](02-architecture.md) · [03-data-model.md](03-data-model.md) · [04-api-contract.md](04-api-contract.md) · [05-auth-and-roles.md](05-auth-and-roles.md) · [06-tracking-and-eta.md](06-tracking-and-eta.md) · [07-payments-and-ledger.md](07-payments-and-ledger.md) · [08-dispatch-and-matching.md](08-dispatch-and-matching.md) · [09-frontend-and-pwa.md](09-frontend-and-pwa.md) · [10-testing-quality-and-security.md](10-testing-quality-and-security.md) · [11-roadmap-and-iterations.md](11-roadmap-and-iterations.md) · [DECISIONS.md](DECISIONS.md) · [docs index](README.md)
Operational set: [08-testing-strategy.md](08-testing-strategy.md) · [09-infrastructure-and-cost.md](09-infrastructure-and-cost.md) · [10-risk-register.md](10-risk-register.md) · [11-launch-playbook.md](11-launch-playbook.md)

---

## 1. Local development prerequisites

| Requirement | Version / detail | Why |
|---|---|---|
| Node.js | **v24.19.0** (Active LTS, EOL 2028-04-30) | Pinned in [stack_report.md §1](../stack_report.md). Install via `fnm` or `volta` so the version lives in `package.json` (`"volta": { "node": "24.19.0" }`) rather than in a wiki page |
| Package manager | **pnpm 10.x** (workspace) | One lockfile across `apps/web`, `apps/api`, `apps/worker`, `packages/*`; strict `node_modules` by default, which catches phantom dependencies early. [pnpm workspaces](https://pnpm.io/workspaces) |
| Docker | Docker Desktop 4.x with Compose v2, or Docker Engine + Compose v2 on Linux | Postgres+PostGIS and Redis must be real, not emulated. See [08](08-testing-strategy.md) §3 for why. `docker compose version` must report v2 |
| PostgreSQL client | `psql` 17 | For `pg_dump`, `pg_restore`, and inspecting the ledger |
| Git | 2.40+ with `core.hooksPath=.githooks` | Pre-push runs the fast test suite so CI failures are locally avoidable |
| Optional | `gh` CLI, `wrangler`/`railway` CLI | Deploy and incident tooling |

**Not required locally:** Stripe account (fixtures cover it), routing engine (haversine fallback is the dev default), Docker registry auth.

### 1.1 The toolchain, stated precisely

```bash
node --version      # v24.19.0
pnpm --version      # 10.x
docker compose version   # v2.x
```

`package.json` engine and runtime pinning:

```jsonc
{
  "engines": { "node": "24.19.0", "pnpm": ">=10 <11" },
  "volta":  { "node": "24.19.0", "pnpm": "10.4.1" },
  "packageManager": "pnpm@10.4.1"
}
```

**Carry-forward:** Node 26 enters LTS on 2026-10-28 ([nodejs.org release schedule](https://nodejs.org/en/about/previous-releases/)). Node 24 remains supported to 2028-04-30, so we do **not** need to chase it. Decision point: re-evaluate the Node major only when Railway's image catalogue defaults to 26 *and* every native dependency has a prebuild for it. Revisit at month 6.

---

## 2. `compose.yaml`

Create at repository root. Pin image digests in CI and Renovate updates them; the tags below are the versions to start from.

```yaml
# compose.yaml — QuickDrop local development stack.
# Start:  docker compose up -d
# Reset:  docker compose down -v && pnpm db:reset
name: quickdrop

services:
  postgres:
    # postgis/postgis:17-3.5 — Postgres 17 with PostGIS 3.5.
    # REQUIRED: the nearest-available-courier query uses ST_DWithin on
    # geography(Point,4326) and cannot run without PostGIS.
    image: postgis/postgis:17-3.5
    environment:
      POSTGRES_USER: quickdrop
      POSTGRES_PASSWORD: quickdrop
      POSTGRES_DB: quickdrop
      # Deterministic collation so ORDER BY tie-breaks are stable across machines.
      POSTGRES_INITDB_ARGS: "--locale=C --encoding=UTF8"
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    command:
      - postgres
      # Log anything slower than 200ms. We want lock waits visible in local dev,
      # because they are the cause of the double-dispatch class of bug.
      - -c
      - log_min_duration_statement=200
      - -c
      - log_lock_waits=on
      - -c
      - max_connections=200
      # Lets the integration suite create per-worker schemas without superuser dance.
      - -c
      - search_path=public
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U quickdrop -d quickdrop"]
      interval: 5s
      timeout: 3s
      retries: 20
      start_period: 20s

  redis:
    image: redis:7.4-alpine
    # noeviction is MANDATORY for BullMQ: if Redis evicts a job key under memory
    # pressure, that job is silently lost. See https://docs.bullmq.io/guide/going-redis
    command:
      - redis-server
      - --maxmemory-policy
      - noeviction
      - --appendonly
      - "yes"
      - --appendfsync
      - everysec
      - --maxmemory
      - 512mb
      - --save
      - ""
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 20

  # ---- OPTIONAL routing engine -------------------------------------------------
  # Only needed if you are working on ETA or distance-matrix code. Dev defaults to
  # the haversine/straight-line estimator, so most days this stays down:
  #   docker compose --profile routing up -d osrm
  osrm:
    image: project-osrm/osrm-backend:latest
    profiles: ["routing"]
    environment:
      OSRM_DATA: /opt
    volumes:
      - ./infra/osrm:/opt
    ports:
      - "5000:5000"
    # One-shot: download the PBF, precompute, then serve. First run takes ~10 min.
    command: >
      bash -c "set -e;
      if [ ! -f /opt/berlin.osrm ]; then
        wget -q https://download.geofabrik.de/europe/germany/berlin-latest.osm.pbf;
        osrm-extract -p /opt/car.lua /opt/berlin-latest.osm.pbf;
        osrm-partition /opt/berlin.osrm;
        osrm-customize /opt/berlin.osrm;
      fi;
      osrm-routed --algorithm mld /opt/berlin.osrm --max-table-size 10000"
    healthcheck:
      test: ["CMD-SHELL", "test -f /opt/berlin.osrm"]
      interval: 10s
      timeout: 5s
      retries: 60

  # ---- Email OTP sink ----------------------------------------------------------
  # OTP codes must be readable by a human and by an E2E test. Mailpit gives both.
  mailpit:
    image: axllent/mailpit:latest
    ports:
      - "1025:1025"   # SMTP
      - "8025:8025"   # Web UI
    environment:
      MP_SMTP_AUTH_ACCEPT_ANY: 1
      MP_SMTP_AUTH_ALLOW_INSECURE: 1

  # ---- Local observability parity ---------------------------------------------
  # Profiles only. Not used in CI or staging; staging uses the hosted stack in §10.
  prometheus:
    image: prom/prometheus:latest
    profiles: ["observability"]
    ports:
      - "9090:9090"
    volumes:
      - ./infra/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro

  grafana:
    image: grafana/grafana:latest
    profiles: ["observability"]
    ports:
      - "3001:3000"
    environment:
      GF_AUTH_ANONYMOUS_ENABLED: "true"
      GF_AUTH_ANONYMOUS_ORG_ROLE: Admin

volumes:
  pgdata:
  redisdata:
```

Local `.env.example` (never commit a real `.env`):

```dotenv
NODE_ENV=development
DATABASE_URL=postgresql://quickdrop:quickdrop@localhost:5432/quickdrop
REDIS_URL=redis://localhost:6379/0
# Dev leaves the routing engine down; unset OSRM_URL to use the haversine estimator.
# OSRM_URL=http://localhost:5000
SMTP_URL=smtp://localhost:1025
# Stripe is never contacted from dev. Fixtures only.
STRIPE_API_KEY=sk_test_fixture_only
STRIPE_API_VERSION=2026-xx-xx        # pinned; asserted in tests (08 §5.5)
STRIPE_WEBHOOK_SECRET=whsec_local_fixture
NEXT_PUBLIC_MAP_TILE_URL=https://api.maptiler.com/maps/streets-v2/style.json
E2E_SECRET=local-e2e-secret
FAULT_INJECTION=1
```

---

## 3. First run, end to end

```bash
git clone <repo> && cd quickdrop
cp .env.example .env
docker compose up -d                    # postgres, redis, mailpit
docker compose --profile routing up -d  # optional, only for ETA work

pnpm install
pnpm db:reset                           # create extensions + run all migrations
pnpm db:seed --seed=quickdrop-dev-v1    # realistic dev dataset (§7)

pnpm dev                               # turbo-run: Next.js :3000, API :8787, worker

# Verify the stack is genuinely ready (not just "container up"):
pnpm verify:infra
#   - pg_isready
#   - psql -c "SELECT postgis_version();"      -> must return a version, not an error
#   - redis-cli CONFIG GET maxmemory-policy    -> noeviction
#   - GET /healthz on web, api, worker
#   - POST a booking in Stripe-fixture mode and assert a balanced ledger transaction
```

`pnpm verify:infra` is deliberately a script and not tribal knowledge: the most common local failure is "Postgres is up but PostGIS is missing", which fails silently at query time rather than at boot.

---

## 4. Environments

| | **dev** | **staging** | **prod** |
|---|---|---|---|
| Where | Each engineer's laptop | Railway project: `quickdrop-staging` | Railway project: `quickdrop-prod` |
| Data | Seeded, resettable in 5 s | Synthetic, seeded to production shape; **plus a scrubbed, anonymised clone for migration rehearsals** | Real |
| Postgres | Local container, `postgres:17` | Railway Postgres + PostGIS, 1 GB | Railway Postgres HA, 2–4 GB |
| Redis | Local container | Railway container, 256 MB | Railway container, 512 MB+ |
| Replicas | 1 | 1 | 2+ (WebSocket connections require ≥ 2 for zero-downtime deploys) |
| Stripe | Fixtures only; `STRIPE_API_KEY` is a non-loading sentinel | Stripe **test mode**, own keys | Stripe **live mode** |
| Feature flags | All defaults, all kill switches live | Mirrors prod flag values | Conservative defaults |
| `FAULT_INJECTION` | on | on | **must be unset** — the app throws on boot if it is `1` in production |
| Uptime checks | none | yes (internal) | yes (public status page) |
| Deploy authority | Anyone | Anyone on the team, no approval | **One of the two founders, via a GitHub environment approval rule.** No one can deploy their own unreviewed change to prod without a second engineer's approval. |

**Data policy.**
- Non-prod contains **synthetic data only**. Addresses are drawn from a fixed fixture set, names from a seeded generator, phone numbers from the `+49 30 5555xxxx` documentation range, card numbers from Stripe's test-mode set. No production row is ever copied into a non-prod environment.
- PII is retained for the minimum operational window: courier location history 90 days, customer address history 24 months (needed for delivery disputes), full request logs 30 days. Enforced by a scheduled retention worker, tested in [08](08-testing-strategy.md) B-16 style.
- Production database access is **read-only by default**, granted per-person and reviewed monthly; write access is requested per-incident and logged.
- Migration rehearsals use a **schema-only, data-scrubbed clone**: `pg_dump --schema-only` plus a synthetic row generator sized to match production (see §7). No real PII ever leaves prod.

---

## 5. CI/CD pipeline

### 5.1 Repository layout

```
apps/
  web/        Next.js 15.5.27 — /customer, /courier, /ops
  api/        Hono 4.13.13 — REST + WebSocket
  worker/     BullMQ 6.3.11 consumers
  ops/        Railway service definitions + deploy scripts
packages/
  core/       domain logic, ports, state machine, money math
  db/         Drizzle schema + migrations + seed
  ui/         shared React components
  config/     eslint, tsconfig, vitest presets
infra/
  prometheus/ compose/ osrm/
```

### 5.2 Pipeline

Create at `.github/workflows/ci.yml`. Stages are ordered so the cheapest, most-likely-to-fail checks run first and no deploy can happen on a red test.

```yaml
name: ci
on:
  pull_request:
  push:
    branches: [main]
  schedule:
    - { cron: "17 3 * * *" }   # nightly, off-peak minute on purpose
  workflow_dispatch:

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

env:
  NODE_VERSION: "24.19.0"
  PNPM_VERSION: "10.4.1"
  # Stray .only( in a diff is a hard failure, not a lint warning.
  FORBID_ONLY: "1"

jobs:
  # ---------- 1. Static -----------------------------------------------------
  static:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v5
      - uses: pnpm/action-setup@v5
        with: { version: ${{ env.PNPM_VERSION }} }
      - uses: actions/setup-node@v5
        with: { node-version: ${{ env.NODE_VERSION }}, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - name: Reject .only / focused tests
        run: git diff origin/main -- '*.ts' '*.tsx' | grep -nE '\.(only|skip)\(' && exit 1 || true
      - run: pnpm db:check          # migration drift + zero-downtime lint (§6)

  # ---------- 2. Unit + contract -------------------------------------------
  test-unit:
    needs: static
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v5
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:unit
      - run: pnpm test:contract
      # Hard gate: money code is 100% or the build is red.
      - run: pnpm test:unit -- --coverage --coverage.thresholds.100=true packages/ledger

  # ---------- 3. Integration (real Postgres+PostGIS, real Redis) ------------
  test-integration:
    needs: static
    runs-on: ubuntu-24.04
    services:
      postgres:
        image: postgis/postgis:17-3.5
        env:
          POSTGRES_USER: quickdrop
          POSTGRES_PASSWORD: quickdrop
          POSTGRES_DB: quickdrop_test
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U quickdrop"
          --health-interval 5s --health-timeout 3s --health-retries 20
      redis:
        image: redis:7.4-alpine
        # BullMQ requirement — see 08 §3.
        command: redis-server --maxmemory-policy noeviction --appendonly yes
        ports: ["6379:6379"]
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 5s --health-timeout 3s --health-retries 20
    steps:
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:integration      # covers 08 §4 scenarios B-01..B-15
      - name: Ledger integrity sweep
        run: pnpm --filter @quickdrop/db ledger:verify --env=test

  # ---------- 4. Build ------------------------------------------------------
  build:
    needs: static
    runs-on: ubuntu-24.04
    steps:
      - run: pnpm install --frozen-lockfile
      - run: pnpm build                 # next build (3 surfaces) + api + worker bundles
      - uses: actions/upload-artifact@v4
        with: { name: build-output, path: apps/*/.output, retention-days: 3 }

  # ---------- 5. E2E against a throwaway preview ---------------------------
  test-e2e:
    needs: build
    runs-on: ubuntu-24.04
    services:
      postgres: { image: postgis/postgis:17-3.5, ... }
      redis:    { image: redis:7.4-alpine, ... }
    steps:
      - run: pnpm install --frozen-lockfile
      - run: docker compose up -d
      - run: pnpm db:reset && pnpm db:seed --seed=quickdrop-e2e-v1
      - run: pnpm dev &
      - run: pnpm exec playwright install --with-deps chromium webkit
      - run: pnpm test:e2e:smoke          # E1 golden path, E2 cancel mid-route
      - uses: actions/upload-artifact@v4
        if: failure()
        with: { name: playwright-traces, path: e2e/test-results }

  # ---------- 6. Security ---------------------------------------------------
  security:
    needs: static
    runs-on: ubuntu-24.04
    steps:
      - run: pnpm audit --omit=dev --audit-level=high
      - uses: gitleaks/gitleaks-action@v2
      - uses: github/codeql-action/analyze@v3
        with: { languages: typescript }
      - run: pnpm licenses:check

  # ---------- 7. Deploy staging (automatic) ---------------------------------
  deploy-staging:
    needs: [build, test-unit, test-integration, test-e2e, security]
    runs-on: ubuntu-24.04
    environment: staging          # no approval rules attached
    steps:
      - run: pnpm install --frozen-lockfile
      - name: Apply EXPAND migrations to staging
        run: pnpm db:migrate --env=staging
      - name: Deploy services
        run: pnpm deploy:staging
      - name: Smoke
        run: pnpm smoke:staging    # health, booking in fixture mode, ledger balances
      - name: Rollback on smoke failure
        if: failure()
        run: pnpm deploy:staging --rollback     # redeploy the previous Railway deployment

  # ---------- 8. Deploy prod (manual approval, expand only) -----------------
  deploy-prod:
    needs: [deploy-staging]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-24.04
    environment: prod             # required reviewers: 1 engineer who is not the author
    concurrency: { group: deploy-prod, cancel-in-progress: false }
    steps:
      - name: Preflight — verify backups are fresh
        run: pnpm ops:assert-backups-fresh   # fails if last logical dump > 26h old
      - name: Apply EXPAND migrations
        run: pnpm db:migrate --env=prod --tag=expand
      - name: Deploy
        run: pnpm deploy:prod
      - name: Post-deploy smoke (60s grace, then 3 checks over 5 min)
        run: pnpm smoke:prod
      - name: Automatic rollback on smoke failure
        if: failure()
        run: |
          pnpm deploy:prod --rollback
          pnpm ops:page                    # wake a human; prod is now on the previous build
      - name: CONTRACT migrations — separate, manual, >=24h later
        if: github.event_name == 'workflow_dispatch' && inputs.contract == 'true'
        run: pnpm db:migrate --env=prod --tag=contract
```

Nightly, load, and pre-release jobs live in `.github/workflows/nightly.yml` and `release.yml`, gating exactly as specified in [08](08-testing-strategy.md) §8.

### 5.3 Rollback-on-failure behaviour, stated precisely

| Failure | Automatic action | Time cost |
|---|---|---|
| Any test stage red | No deploy. The job simply fails. | 0 |
| Staging deploy or smoke fails | `pnpm deploy:staging --rollback` redeploys the previous Railway deployment | ~60 s |
| Prod deploy fails at build | Railway keeps the previous deployment live; nothing to undo | 0 |
| Prod deploy succeeds, smoke fails | Redeploy previous Railway deployment, then page a human. **Expand migrations are intentionally left in place** — they are backward-compatible by construction | ~2 min |
| Prod smoke passes, error rate climbs in the first 15 min | Automatic rollback is **not** triggered. A human decides, using the playbook ([11](11-launch-playbook.md) §4) | minutes |
| A bad expand migration lands | Roll back the **code**. Then ship a forward-fix migration. Never reverse a prod migration | minutes |
| A bad contract migration lands | Contract steps are gated ≥ 24 h later by a human; if a contract step is ever wrong, restore from PITR for the affected table only | up to RTO, 30 min |

Railway retains previous deployments, so application rollback is a redeploy of a prior image rather than a rebuild. Verify that retention depth is at least 5 on the production project; if it is not, that is an infra task in iteration 0, not a launch-week surprise.

### 5.4 Secrets inventory

| Secret | Where it lives | Consumed by | Rotation |
|---|---|---|---|
| `DATABASE_URL` (prod) | Railway project variables, encrypted at rest | api, worker | Quarterly; immediately on suspected exposure |
| `REDIS_URL` (prod) | Railway project variables | api, worker | Quarterly |
| `STRIPE_SECRET_KEY` (live) | Railway project variables | api | 90-day rolling keys — track the overlap window |
| `STRIPE_WEBHOOK_SECRET` | Railway project variables | api | Per-endpoint; both secrets accepted during rotation |
| `STRIPE_CONNECT_CLIENT_ID` | Railway project variables | api | Rare |
| `NEXT_PUBLIC_MAP_TILER_KEY` | Railway project variables (public scope) | web | — |
| `BETTER_AUTH_SECRET` | Railway project variables | web, api | Quarterly. Rotating invalidates all sessions |
| `SMS_PROVIDER_AUTH_TOKEN` | Railway project variables | api | Annually |
| `SENTRY_DSN` | Railway project variables | web, api, worker | Rare |
| `POSTHOG_API_KEY` | Railway project variables (public) | web | Rare |
| `E2E_SECRET` | GitHub Actions secret | api, worker (test paths only) | Quarterly |
| `RAILWAY_TOKEN` | GitHub Actions secret | deploy jobs | Quarterly |
| `OTLP_EXPORTER_*` | Railway project variables | api, worker | Rare |

Rules: no secret ever appears in an image, a `NEXT_PUBLIC_*` variable, a log line, or a Sentry breadcrumb (Sentry `beforeSend` scrubs known keys — test that it does). Railway variables are marked **encrypted at rest** and, for the deploy pipeline, restricted by GitHub environment protection rules per environment.

---

## 6. Migration strategy

### 6.1 Drizzle Kit usage

```jsonc
// packages/db/drizzle.config.ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/schema/index.ts',        // single entry, re-exports every table
  out: './migrations',                    // generated SQL, committed to git
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // Generate a migration for hand-written SQL (extensions, triggers, indexes).
  // This is how the ledger triggers from 08 §4 get created.
  migrations: { table: '__drizzle_migrations', schema: 'public' },
  strict: true,
  verbose: true,
})
```

| Command | What it does | Where it may run |
|---|---|---|
| `pnpm db:generate` | Diff schema against `migrations/` and emit a new `.sql` file. **Committed to git and reviewed in the PR.** | Local + CI (read-only use) |
| `pnpm db:check` | `drizzle-kit check` — validates migration history for drift and conflicts. Also runs our zero-downtime linter. | **CI, blocking** |
| `pnpm db:migrate` | `drizzle-kit migrate` — apply pending migrations in order, inside a transaction per migration, tracked in `__drizzle_migrations`. | Local, staging, prod |
| `pnpm db:generate --custom` | Emit an empty migration for hand-written SQL (PostGIS extension, ledger balance trigger, partial indexes). | Local |
| `pnpm db:push` | Direct schema sync, no migration file. **Never in staging or prod.** Development convenience only. | Local only |
| `pnpm db:studio` | Drizzle Studio for browsing data. | Local only |
| `pnpm db:rollback` | Local-only down-migration helper. | Local only |

`pnpm db:push` and `pnpm db:rollback` are wired to `preprod` guard scripts that exit 1 when `NODE_ENV=production` or when the database host does not end in a known-local pattern. This is checked by a unit test in [08](08-testing-strategy.md) §3's L0 band.

### 6.2 Zero-downtime rules

1. **Expand, then contract, across at least two deploys and at least 24 hours.** Never both in one deploy.
2. **No destructive change in the same deploy as the code that stops using it.** `DROP COLUMN` happens only after the previous release has been fully retired.
3. **No `NOT NULL` without a default or a validated check constraint.** A bare `ALTER TABLE ... SET NOT NULL` on a large table takes an `ACCESS EXCLUSIVE` lock for a full scan.
4. **Every migration sets `lock_timeout` and `statement_timeout`.** A migration must fail fast rather than sit in the queue behind long transactions:
   ```sql
   SET lock_timeout = '3s';
   SET statement_timeout = '60s';
   ```
5. **Backfills run outside the deploy**, in an idempotent BullMQ job with `LIMIT n` batches (500 rows), a per-batch sleep, and its own feature flag kill switch. A 10-minute backfill must not be a 10-minute deploy.
6. **New enum values are additive.** Add the value, deploy code that reads it, backfill, then clean up. Never `ALTER TYPE ... RENAME VALUE` on a value in use. (Accounts-v2-era Stripe objects also mean our stored enums should be tolerant of unknown values — read with a fallback.)
7. **Index creation uses `CREATE INDEX CONCURRENTLY`**, which cannot run inside a transaction and therefore needs its own migration file with `--custom`.
8. **Migrations are forward-only in prod.** Rollback means rolling back code and shipping a forward fix. The one exception is a contract step that has not yet run anywhere but staging, which may be edited.
9. **Every migration gets a written pre-flight note in the PR** answering: does it take a strong lock? On how many rows? How long? What is the abort condition?
10. **Out of hours for anything with an estimated lock over 1 second on a table above 100k rows.** Announce it in the deploy channel, take a PITR point first (`railway postgres pitr backup create --name pre-migration`).

### 6.3 Worked example: adding `couriers.vehicle_capacity NOT NULL`

**Deploy 1 — Expand (backward-compatible, no code break).**

Migration `0021_courier_vehicle_capacity_expand.sql`:

```sql
SET lock_timeout = '3s';
SET statement_timeout = '60s';

-- Nullable, so reads of the old shape keep working. No default yet: a default
-- silently rewrites the table on PG<11 and obscures intent on newer versions.
ALTER TABLE couriers ADD COLUMN IF NOT EXISTS vehicle_capacity integer;

-- Guard rail: capacity is a positive number when present.
ALTER TABLE couriers
  ADD CONSTRAINT couriers_vehicle_capacity_positive
  CHECK (vehicle_capacity IS NULL OR vehicle_capacity > 0) NOT VALID;

-- Capacity is only filterable once it is populated; index now, query later.
-- CREATE INDEX CONCURRENTLY cannot run in a transaction: separate migration file.
-- 0022_courier_vehicle_capacity_index.sql
-- CREATE INDEX CONCURRENTLY idx_couriers_vehicle_capacity
--   ON couriers (vehicle_capacity);
```

Code in the same deploy reads `vehicle_capacity ?? 1` — backward-compatible with the nulls. Backfill starts as a flagged job:

```ts
// apps/worker/src/jobs/backfill-courier-vehicle-capacity.ts
export const backfillVehicleCapacity = Job.withName('backfill:vehicle-capacity')
  .batchSize(50)
  .attempts(5)
  .addOptions({ removeOnComplete: 5000 })
  .handler(async (job, token) => {
    // 500 rows per batch, then yield. Never a single unbounded UPDATE.
    const n = await db.execute(sql`
      WITH batch AS (
        SELECT id FROM couriers
         WHERE vehicle_capacity IS NULL
         ORDER BY id
         LIMIT 500
         FOR UPDATE SKIP LOCKED
      )
      UPDATE couriers c
         SET vehicle_capacity = 1
        FROM batch b
       WHERE c.id = b.id
    `)
    const remaining = await db.execute(sql`
      SELECT count(*)::int AS n FROM couriers WHERE vehicle_capacity IS NULL`)
    await metrics.gauge('backfill.courier_vehicle_capacity.remaining', remaining[0].n)
    if (remaining[0].n > 0 && !flags.isOff('flag_backfill_vehicle_capacity')) {
      // Re-enqueue only if the worker is healthy; otherwise leave it for the
      // nightly catch-up run. Never spin.
      await queue.add('backfill:vehicle-capacity', {}, { delay: 1000 })
    }
    return { updated: n.rowCount }
  })
```

Verification before Deploy 2 (this is a **gate**, not a suggestion):
`SELECT count(*) FROM couriers WHERE vehicle_capacity IS NULL` = 0, and it has been 0 continuously for ≥ 1 hour (recorded as a metrics observation, not a one-off check, because a background job elsewhere can re-null a row).

**Deploy 2 — Validate (lock-cheap constraint).**

```sql
SET lock_timeout = '3s';
SET statement_timeout = '60s';

-- SET NOT NULL in PG12+ can use an already-validated CHECK to avoid the full
-- table scan, so: add a NOT VALID check, validate it (SHARE UPDATE EXCLUSIVE,
-- does not block reads or writes), then SET NOT NULL.
-- https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-NOT-NULL
ALTER TABLE couriers
  ADD CONSTRAINT couriers_vehicle_capacity_not_null
  CHECK (vehicle_capacity IS NOT NULL) NOT VALID;

ALTER TABLE couriers VALIDATE CONSTRAINT couriers_vehicle_capacity_not_null;

ALTER TABLE couriers ALTER COLUMN vehicle_capacity SET DEFAULT 1;
ALTER TABLE couriers ALTER COLUMN vehicle_capacity SET NOT NULL;
```

At this point the application can drop the `?? 1` fallback, but keeping it is harmless and makes the next expand/contract cycle cheaper. Keep it.

**Deploy 3+ — Contract (≥ 24 h after Deploy 2).**

```sql
ALTER TABLE couriers DROP CONSTRAINT couriers_vehicle_capacity_not_null;
ALTER TABLE couriers DROP CONSTRAINT couriers_vehicle_capacity_positive;
```

Total calendar time: ≥ 2 days. Total lock time: milliseconds. That ratio is the whole point — the constraint work is *not* on the critical path.

### 6.4 Migration verification in CI

`pnpm db:check` fails the build when it sees, in a migration added on the branch:

- `DROP TABLE`, `DROP COLUMN`, `DROP TYPE`, `TRUNCATE`
- `ALTER COLUMN ... TYPE` on an existing column
- `ALTER TYPE ... RENAME VALUE`, `ALTER TYPE ... ADD VALUE` without a preceding comment acknowledging the additive-only rule
- `SET NOT NULL` without a `NOT VALID` check constraint or a `DEFAULT` in the same file
- `CREATE INDEX` without `CONCURRENTLY`
- more than 5,000 estimated row changes in a migration
- any migration file that is not purely additive

`DROP` requires the file to contain the machine-readable escape hatch `-- allow-drop: <ticket-url> -- reason: <one line>`, which a founder must approve in review. That is the point at which the linter stops being a nuisance.

---

## 7. Seed data

A realistic dataset is what makes the dispatch algorithm and the ops surface reviewable. Empty databases hide bugs; synthetic-but-plausible databases surface them.

```ts
// packages/db/src/seed/seed.ts
import { mulberry32 } from '../../test/support/prng'

export interface SeedOptions { seed: string; orders: number; couriers: number }

/** Deterministic: same --seed always produces byte-identical output. */
export async function seed(opts: SeedOptions) {
  const rng = mulberry32(hashSeed(opts.seed))
  const now = clock.now()                 // injected, never Date.now() (08 §5.2)

  await db.transaction(async (tx) => {
    await tx.execute(sql`TRUNCATE ... RESTART IDENTITY CASCADE`)  // dev only

    // 1. Zones — real polygon boundaries for the launch city, stored in
    //    zone_polygons and served to the customer booking form.
    await seedZones(tx)

    // 2. Couriers at varied coordinates, deliberately pathological:
    //      - 60% clustered at the zone centroid (tests nearest-courier tie-breaks)
    //      - 15% at the fringe (tests 5km ST_DWithin boundary)
    //      - 10% deliberately OUTSIDE every zone (must never be offered)
    //      -  5% with last_seen_at 20 minutes stale (must be excluded by freshness)
    //      - 10% in a non-available status (busy / offline / pending_kyc)
    for (let i = 0; i < opts.couriers; i++) {
      await tx.insert(couriers).values(sampleCourier(rng, i, now))
    }

    // 3. Shipments — every state in the machine, with age distributions that
    //    make the ops dashboard look like a Tuesday.
    //    8% draft/quote, 4% payment_pending, 10% booked (no courier yet),
    //    6% offer_pending, 12% assigned, 10% picked_up, 15% in_transit,
    //    4% arrived, 20% delivered, 8% cancelled, 3% failed
    for (let i = 0; i < opts.orders; i++) {
      const s = sampleShipment(rng, i, now)
      await tx.insert(shipments).values(s)
      await writePositionTrail(tx, s, rng, now)   // 2-5s interval, realistic accuracy
      if (TERMINAL.has(s.status)) await writeTerminalEvent(tx, s, now)
    }

    // 4. The ledger trail: at least one COMPLETED delivery with a full,
    //    balanced set of entries, so reviewers can see what "correct" means.
    //       capture:            customer_funds   -1200 / stripe_clearing +1200
    //       courier_fee:        courier_payable   -1830 / platform_revenue +1830
    //       tip:                courier_payable   -200  / platform_revenue  +200
    //       payout:             courier_payable    +2030 / stripe_clearing -2030
    //    assertBalanced(txnId) runs after insert; a seed that produces an
    //    unbalanced ledger is a bug in the seed, and CI will say so.
    await seedGoldenPathDelivery(tx, rng, now)

    // 5. Two couriers with a full location history, one deliberately containing
    //    out-of-order and implausible points, so the anomaly dashboard is not
    //    empty when you first open it.
    await seedAnomalies(tx, rng, now)
  })

  // Invariant sweep. A seed that violates an invariant must fail loudly.
  await assertLedgerBalanced()
  await assertNoShipmentInTwoStates()
  await assertEveryDeliveredShipmentHasBalancedCapture()
}
```

```bash
pnpm db:seed --seed=quickdrop-dev-v1 --orders=500 --couriers=120   # day-to-day dev
pnpm db:seed --seed=chaos-v1        --orders=5000 --couriers=1000 # perf + edge cases
pnpm db:seed --seed=staging-v1      --orders=50000 --couriers=2500  # production shape
```

Staging must be **production-shaped**: the load targets in [08](08-testing-strategy.md) §7 (500k shipments, 10k couriers) assume a specific index selectivity. Load testing a 5,000-row database proves nothing about a `GIST` index.

---

## 8. Backups and disaster recovery

### 8.1 Layers

| Layer | Mechanism | Restores to | Frequency |
|---|---|---|---|
| **Point-in-time recovery** | Railway Postgres PITR: pgBackRest streams WAL to a Railway Bucket; weekly full + daily differential, last 4 fulls retained | A **new sibling service** at any timestamp in a ~4-week window | Continuous (`archive_timeout=60`) |
| **Volume backups** | Railway scheduled volume snapshots | The same service, in place | Daily |
| **Logical dumps** | `pg_dump -Fc` from a nightly cron service to a **separate** Railway Bucket, plus a weekly copy to an unrelated account | Anywhere — laptop, another provider, another cloud account | Nightly + weekly |

Use all three. The logical dump is the only layer that survives account-level deletion or provider failure, and it is the only one we can rehearse cheaply. [Railway Postgres backups and restores](https://docs.railway.com/guides/postgres-backups-restores)

PITR specifics worth knowing before an incident, not during one:

```bash
railway postgres pitr status   --service postgres   # archiver health + restore window
railway postgres pitr enable   --service postgres
railway postgres pitr backup create --service postgres --name pre-migration
railway postgres pitr restore  --service postgres --at 2026-10-05T08:59:00Z
railway postgres pitr schedule --service postgres --daily-at 03:00
```

The restore provisions a **new** service; the source keeps serving. Cut over by swapping the connection string. **The restore window starts at the first base backup after enabling PITR** — enabling it during an incident is how teams discover they had no history. Enable it in iteration 0. [Railway PITR docs](https://docs.railway.com/volumes/point-in-time-recovery)

### 8.2 RPO / RTO targets

These are commitments. Revisit them in the month-6 review; do not quietly relax them.

| Scenario | **RPO** (max data loss) | **RTO** (max time to restore) | Mechanism |
|---|---|---|---|
| Bad deploy, corrupt rows, accidental `DELETE` | **≤ 60 s** | **≤ 15 min** | PITR to T-60s, copy rows back or cut over |
| Accidental `DROP TABLE` by a migration | ≤ 60 s | **≤ 30 min** | PITR fork, cut over connection string |
| Worker or API crash | 0 (stateless) | **≤ 5 min** | Redeploy the previous Railway deployment |
| Redis loss (eviction, corruption, wipe) | 0 for money, ≤ 30 s for queue lag | **≤ 30 min** | Rebuild from Postgres; ledger is the source of truth. In-flight offers are re-derived by the dispatch sweep |
| Single-region / provider outage | ≤ 15 min (dump cadence) | **≤ 4 h** | Rebuild on an alternative provider from the latest logical dump, then replay |
| Credential compromise / bad `git push` | n/a | **≤ 2 h** | Rotate secrets, redeploy; if data is implicated, PITR |

**Declared gap:** 4-hour RTO for a full provider outage assumes a second provider is ready, and we are not building multi-region in the launch runway. That is an accepted risk with a documented number ([10-risk-register.md](10-risk-register.md) R-16), not an oversight.

### 8.3 Restore drill procedure

**Monthly**, on the calendar, non-negotiable. A backup you have never restored is a hypothesis.

```bash
# 0. Announce in #ops. Take a fresh named backup first.
railway postgres pitr backup create --service staging --name "drill-$(date +%Y%m%d)"

# 1. Restore to a timestamp 6 hours ago — simulates a bad migration window.
railway postgres pitr restore --service staging --at 6h

# 2. Wait for the fork to come up and replay WAL.
railway postgres pitr status --service staging-restored

# 3. Verify DATA, not just connectivity. These must all return the expected shape.
export D=postgresql://.../restored
psql "$D" -c "SELECT count(*) FROM shipments WHERE status='delivered'"
psql "$D" -c "SELECT count(*) FROM ledger_entries"                 # > 0
psql "$D" -c "SELECT txn_id FROM ledger_entries GROUP BY txn_id
              HAVING sum(amount_minor) <> 0"                        # MUST be 0 rows
psql "$D" -c "SELECT count(*) FROM couriers WHERE vehicle_capacity IS NULL"  # 0
psql "$D" -c "SELECT count(*) FROM account_balances WHERE balance_minor < 0" # 0

# 4. Run the app's read path against the fork and confirm it boots:
#    migrations are already applied by the restore; do NOT re-run them.
pnpm --filter @quickdrop/db ledger:verify --env=drill
curl -fsS "$RESTORED_URL/healthz"

# 5. Time it. Record: drill start, data-verified time, total elapsed.
#    If elapsed > RTO, the RTO is wrong — update the table above, do not
#    lower the number in the post-mortem.
```

Log the drill in `docs/09-infrastructure-and-cost.md`'s companion issue with the elapsed time and any surprise. Quarterly, repeat steps 0–4 using a **logical dump** restored onto an engineer’s laptop, so we have also proven the layer that survives provider failure.

---

## 9. Observability

### 9.1 The stack

| Signal | Tool | Concrete configuration |
|---|---|---|
| Structured logs | **pino** (JSON) → stdout → Railway log drains → **Grafana Cloud Logs (Loki)** | Railway's own log history is 7 days on Pro ([pricing](https://railway.com/pricing)); that is not enough for a money dispute. Ship to Loki for ≥ 30 days. Free tier exists; VERIFY current limits before relying on it |
| Request identity | `X-Request-Id` | Generated at the Next.js edge if absent; propagated through `fetch`, BullMQ job payloads, and Stripe request options. Every log line, Sentry event, and metric exemplar carries it. A user reporting "it failed at 14:32" must lead to one grep |
| Error tracking | **Sentry** (web, api, worker) | `release` = git SHA from CI; source maps uploaded in `build`; `tracesSampleRate` 0.1 in prod, 1.0 in staging; `beforeSend` scrubs PII and secrets (unit-tested). Team plan $26/mo includes 50k errors ([Sentry pricing](https://sentry.io/pricing/)); Developer free tier at launch |
| Metrics | **prom-client** → `/metrics` → **Grafana Cloud Prometheus** | Low-cardinality only. Never a label value that is a user ID, shipment ID, or error message |
| Tracing | **OpenTelemetry** → OTel Collector on Railway → Grafana Tempo | Sampled 10% prod, 100% staging. Trace the booking path end to end: web render → API → Postgres → Stripe → queue → worker |
| Uptime & status page | **Better Stack** or **OpenStatus** (free tier sufficient) | 3 checks at 60 s from 3 regions: `/` (web), `/healthz/live`, `/healthz/ready` (API + DB + Redis). Status page public, published during incidents |
| Product analytics | **PostHog** | Self-hosted on Railway (free, full control of PII) or PostHog Cloud free tier. Events: `booking_started`, `quote_shown`, `booking_completed`, `offer_shown`, `offer_accepted`, `offer_declined`, `pickup_confirmed`, `delivery_confirmed`, `delivery_failed`, `support_contacted`, `refund_issued`. **Never** send addresses, coordinates, names, or phone numbers. Wire a PII-scrubbing test |
| Courier-device heartbeat | Custom metrics + a synthetic prober | See §9.3 — this is our most important custom signal |

### 9.2 Dashboards

Six, in this order of how often they get opened during an incident.

1. **Golden signals — web + API.** Rate, errors, duration (p50/p95/p99) per route; WebSocket connections and fan-out latency; Postgres pool saturation; Redis ops/sec and memory.
2. **Delivery operations.** Shipments by state; time-to-assign (booked → assigned) p50/p95; time-to-deliver; **count of shipments in `assigned` older than 30 min**; cancelled and failed rates by hour; offers issued / accepted / declined / expired.
3. **Courier health.** Online couriers; couriers with `last_seen_at` older than 60 s / 5 min; GPS rejection rate by reason; per-zone available-courier count; count of couriers in each anomaly state.
4. **Money.** Captures, refunds, disputes by hour; payment failure rate; **ledger balance check (last run, rows out of balance)**; payout batch totals and count; Stripe reconciliation delta; contribution margin per order.
5. **Realtime.** WS connections, connections opened/closed, fan-out p95, reconnect rate, SSE fallback usage, client-side fallback-to-polling rate.
6. **Support.** Tickets by reason code, refunds by operator, courier contact reasons, refund authority usage.

### 9.3 Courier-device heartbeat monitoring

Because iOS will not promise background location updates ([stack_report.md §2](../stack_report.md)), the *absence* of data is a first-class signal, not a gap in the data.

| Signal | Definition | Meaning |
|---|---|---|
| `courier_heartbeat_missing` | An `available` or `assigned` courier with no inbound heartbeat for > 90 s | Device issue, app killed, network loss, or battery saver |
| `courier_position_rate` | Positions per courier per minute, bucketed | Expected 0.5/min (2 s interval, but adaptive). Below 0.1/min for a courier on a live shipment is a red flag even if "not stale" |
| `courier_stale_share` | % of live shipments whose courier position is > 60 s old | **The customer-facing tracking promise degrades here.** This is the headline number in the daily review |
| `courier_ws_reconnect_rate` | Reconnects per courier per hour | High rate = degraded network or SW eviction loop |
| `courier_app_session` | Install id, app version, `display-mode: standalone` vs browser | Distinguishes "installed PWA" from "opened in a tab" — the single biggest predictor of tracking quality |
| Synthetic probe | A scripted courier persona on a real device in the ops account, pinging every 60 s | Answers "is iOS delivering positions for us right now, today" without waiting for a real user to complain |

### 9.4 Alerts

Alert routing: severity 1–2 → PagerDuty (or phone tree) 24/7; severity 3 → `#ops-alerts` Slack, business hours; severity 4 → dashboard only, weekly review. Definitions align with [11-launch-playbook.md](11-launch-playbook.md) §5.

```yaml
# infra/prometheus/rules/quickdrop.yml
groups:
  - name: delivery-correctness
    rules:
      - alert: ShipmentStuckAssigned
        # REQUIRED ALERT: a shipment has been assigned but not picked up.
        expr: |
          count(shipments{state="assigned"} and on(shipment_id)
                (time() - shipments_assigned_at_seconds > 1800)) > 0
        for: 2m
        labels: { severity: "2" }
        annotations:
          summary: "{{ $value }} shipments assigned for >30 min with no pickup"
          runbook: "docs/11-launch-playbook.md#courier-not-arriving"

      - alert: NoCouriersAvailableInZone
        # REQUIRED ALERT: dispatch has nothing to offer in a live zone.
        expr: |
          sum by (zone_id) (couriers_available{zone_id!=""})
            == 0
          and
          sum by (zone_id) (shipments_awaiting_courier) > 0
        for: 3m
        labels: { severity: "1" }     # customers cannot book or are stranded
        annotations:
          summary: "Zone {{ $labels.zone_id }} has bookings but zero available couriers"

  - name: tracking-health
    rules:
      - alert: TrackingStalenessHigh
        # REQUIRED ALERT: the tracking promise is degrading for real customers.
        expr: courier_stale_share > 0.20
        for: 10m
        labels: { severity: "2" }
        annotations:
          summary: "{{ $value | humanizePercentage }} of live shipments have a stale courier position"

      - alert: PositionUpdateRateCollapsed
        expr: courier_position_rate < 0.10
        for: 15m
        labels: { severity: "2" }
        annotations:
          summary: "Courier position rate collapsed to {{ $value }}/min — suspect iOS backgrounding"

  - name: money
    rules:
      - alert: LedgerImbalance
        # REQUIRED ALERT. Fires on a single unbalanced row and stays firing.
        expr: ledger_unbalanced_transaction_count > 0
        for: 0m
        labels: { severity: "1" }     # money correctness is a launch blocker
        annotations:
          summary: "{{ $value }} ledger transactions do not balance to zero"

      - alert: PaymentFailureRateSpike
        # REQUIRED ALERT: baseline is ~2-3%; 4x over a 15 min window is an incident.
        expr: |
          (sum(rate(http_requests_total{route=~"/v1/shipments|.*payment.*",status=~"4.."}[15m]))
           / sum(rate(http_requests_total{route=~"/v1/shipments|.*payment.*"}[15m]))) > 0.12
        for: 10m
        labels: { severity: "1" }
        annotations:
          summary: "Payment failure rate {{ $value | humanizePercentage }} (threshold 12%)"

      - alert: StripeReconciliationDrift
        expr: abs(stripe_ledger_delta_minor) > 0
        for: 30m
        labels: { severity: "1" }
        annotations:
          summary: "Stripe balance transactions disagree with our ledger by {{ $value }} minor units"

  - name: realtime-and-capacity
    rules:
      - alert: WebSocketConnectionsHigh
        # REQUIRED ALERT: connections are the main scaling variable (R-11).
        # 1000 per replica is where we saw fan-out p95 degrade in load test.
        expr: websocket_connections_per_replica > 1000
        for: 10m
        labels: { severity: "3" }
        annotations:
          summary: "{{ $value }} WS connections on one replica — scale or shed load"

      - alert: WebSocketConnectionsDropped
        expr: increase(websocket_connections_closed_total[5m]) > 200
        and on(instance) increase(websocket_disconnects_error_total[5m]) > 50
        for: 5m
        labels: { severity: "1" }
        annotations:
          summary: "Mass WebSocket disconnection — probable deploy or OOM"

  - name: workers
    rules:
      - alert: WorkerQueueDepth
        # REQUIRED ALERT: oldest job age matters more than depth (08 §7.2).
        expr: bullmq_job_oldest_age_seconds > 30
        for: 5m
        labels: { severity: "2" }
        annotations:
          summary: "Queue {{ $labels.queue }} oldest job is {{ $value }}s old"

      - alert: WorkerQueueBacklog
        expr: bullmq_queue_waiting > 1000
        for: 10m
        labels: { severity: "3" }
        annotations:
          summary: "Queue {{ $labels.queue }} has {{ $value }} waiting jobs"

  - name: availability
    rules:
      - alert: ApiDown
        expr: up{job="quickdrop-api"} == 0
        for: 2m
        labels: { severity: "1" }

      - alert: LatencyBudgetBurned
        expr: |
          histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket[5m]))) > 0.4
        for: 10m
        labels: { severity: "2" }
        annotations:
          summary: "API p95 {{ $value }}s exceeds the 400ms booking budget"
```

Every alert has a runbook URL in its annotations. An alert without a runbook link is deleted, not triaged.

---

## 10. Cost model

### 10.1 A flag on the pinned figures

[stack_report.md §5](../stack_report.md) estimated **~$105/month** at 5k orders/month as four flat lines (web ~$40, worker ~$20, Postgres ~$30, Redis ~$15). **Railway's pricing shape has changed.** As of verification on 2026-09, Railway bills:

- A **workspace plan fee** (Free $0 with $1 credit · Hobby $5 with $5 credit · Pro $20 with $20 credit), where the fee *is* a credit against usage. [Pricing](https://railway.com/pricing)
- Plus **per-second metered** consumption: **RAM $10/GB-month**, **CPU $20/vCPU-month**, **egress $0.05/GB**, **volume $0.15/GB-month**. [Pricing plans](https://docs.railway.com/pricing/plans)
- **Postgres and Redis are no longer flat "managed database" line items** — they are billed as ordinary container services by RAM/CPU/volume. That is why this doc derives them from a sizing model rather than quoting a catalogue.

Two consequences worth stating plainly:
1. **The ~$105/month total still reproduces** — re-deriving the same architecture from current rates lands at roughly $78/month of Railway spend plus staging, i.e. the same order of magnitude. The total was right; the line-item *shape* was wrong.
2. **Pro beats Hobby above ~$25/month of usage**, because the plan fee is a credit and Pro credits $20 vs Hobby's $5. At our scale, use **Pro**. Model-derived, not a quote — verify in the Railway dashboard before the first invoice.
3. Per-service numbers below are **model outputs from a sizing assumption**, not quotes. Re-derive before every budget review.

### 10.2 Assumptions

State these out loud, because every total depends on them.

| Assumption | Value | Basis |
|---|---|---|
| Average order value (AOV) | **$12.00** | Assumption, no evidence. **The single most important number to validate in the seeded beta.** |
| Courier net payout | **$9.15** (76% of AOV) | Assumption: 18% platform take |
| Orders: month 1 / month 6 / growth | **300 / 5,000 / 50,000** per month | Month 6 matches the [stack_report](../stack_report.md) scale |
| Concurrent viewers, growth | ~2,000 | 4% of shipments in flight at once |
| SMS: orders × 3 messages | 1 OTP + 2 status | Assumption |
| Dispute rate | 0.05% | Industry-typical; VERIFY at beta |
| Stripe | **2.9% + 30¢** per domestic card charge | [stripe.com/pricing](https://stripe.com/pricing). Effective 5.4% at $12 AOV. Assumes **$0 transfer fee** on Connect — VERIFY |
| SMS | **$0.0083** per US segment + **$1.15**/mo number | [Twilio US SMS pricing](https://www.twilio.com/en-us/sms/pricing/us). A2P 10DLC registration fees extra |
| Sentry | $0 on Developer free tier; **$26/mo** Team (50k errors) | [sentry.io/pricing](https://sentry.io/pricing/) |
| Map tiles | **VERIFY** — placeholder bands shown | MapTiler's free tier (5k sessions/mo, 100k API req/mo) is **non-commercial only**, so launch needs a paid plan. [MapTiler Cloud pricing](https://www.maptiler.com/cloud/pricing/) |
| Observability | $0 free tier until limits bite | VERIFY Grafana Cloud free-tier limits before relying on them |

### 10.3 Monthly cost table

| Line item | Fixed/variable | Month 1 (300 orders) | Month 6 (5,000 orders) | Growth (50,000 orders) |
|---|---|---|---|---|
| Railway Pro workspace fee | Fixed | $20.00 | $20.00 | $20.00 |
| Railway web/API (2 replicas, 512 MB, 0.15 vCPU, 40 GB egress) | Mixed: RAM+CPU fixed, egress variable | $5.29 (1×384 MB) | $18.24 | $64.22 (4×768 MB, 350 GB egress) |
| Railway worker (768 MB, 0.10 vCPU) | Fixed | $4.84 (1×384 MB) | $9.93 | $27.00 (2×1 GB) |
| Railway Postgres (PostGIS) | Fixed + storage | $13.90 (1 GB) | $28.75 (2 GB + 25 GB vol) | $65.00 (4 GB + 100 GB vol) |
| Railway Redis | Fixed | $3.20 (256 MB) | $6.87 (512 MB) | $15.00 (1 GB) |
| Railway staging (always-on, billed even when idle) | Fixed | $14.00 | $18.00 | $20.00 |
| PITR bucket + volume backups | Fixed | $0.90 | $2.00 | $8.00 |
| **Railway subtotal** | | **$62.13** | **$103.79** | **$219.22** |
| *less plan fee applied as usage credit* | | *−$20 → **$42.13*** | *−$20 → **$83.79*** | *−$20 → **$199.22*** |
| MapTiler tiles (VERIFY band) | Variable per map session | $0.00 (internal dogfood) | $35.00 (band $25–50) | $150.00 (band $100–250) |
| Stripe fees on charges | **Variable per order** | $194.40 | $3,240.00 | $32,400.00 |
| Stripe disputes (0.05%, $15 each) | Variable per dispute | $2.25 | $37.50 | $375.00 |
| SMS/OTP (Twilio + number) | Variable per message | $8.62 | $126.15 | $1,246.15 |
| Error tracking (Sentry) | Fixed until quota | $0.00 | $26.00 | $36.00 |
| Observability (metrics/logs/uptime/analytics) | Fixed + ingest | $0.00 | $0.00 | $100.00 |
| Domain (~$15/yr, Cloudflare Registrar at cost) | Fixed | $1.25 | $1.25 | $1.25 |
| GitHub Actions | Fixed-ish | $5.00 | $20.00 | $60.00 |
| **Grand total** | | **~$253** | **~$3,559** | **~$34,198** |
| *with 15% contingency* | | **~$291** | **~$4,093** | **~$39,328** |

Every Railway figure is `(RAM_GB × $10) + (vCPU × $20) + (egress_GB × $0.05) + (vol_GB × $0.15)` summed per service, then reduced by the $20 plan credit. Worked example, month 6 web/API: `(1.024 × 10) + (0.30 × 20) + (40 × 0.05) = 10.24 + 6.00 + 2.00 = $18.24`.

### 10.4 Separating pass-through from our own margin

Stripe fees look enormous in the table above and are mostly **not** our cost: we collect the fare and pay most of it to the courier. Judge the business on contribution margin, not on the gross total.

| At 5,000 orders/month | Amount |
|---|---|
| Revenue (5,000 × $12.00) | $60,000 |
| Courier payouts (5,000 × $9.15) | −$45,750 |
| Stripe fees on charges | −$3,240 |
| SMS/OTP | −$126 |
| **Contribution (after variable cost of revenue)** | **$10,884** |
| Our operating cost (Railway, maps, Sentry, domain, CI) | −$160 |
| **Contribution margin** | **$10,724 (17.9% of revenue, $2.14/order)** |

At $2.14 per delivery, **fixed operating cost is irrelevant until roughly 75 orders/month** and the business is comfortably fundable. The margin is far more sensitive to AOV than to infrastructure: at a $9 AOV the effective Stripe rate rises to 6.2% and contribution per order drops by roughly $2.40. **Watch AOV and courier take rate, not the hosting bill.**

### 10.5 Top 3 cost risks

| # | Risk | Exposure | Early warning | Mitigation |
|---|---|---|---|---|
| **1** | **Stripe take rate on a low AOV.** 2.9% + 30¢ is 5.4% at $12 but 6.2% at $9 and 8.2% at $6.60 (the break-even where the fixed 30¢ equals the percentage fee). We cannot discount — coupons cost more than the fee. | Up to ~$0.90/order of margin per $3 of AOV loss | Weekly AOV and contribution-per-order in the metrics review ([11](11-launch-playbook.md) §7) | Confirm AOV in the seeded beta before public launch. Consider a small multi-parcel or multi-stop upsell (v2, [11](11-launch-playbook.md) §8) rather than discounting. Cap discount liability so gross margin cannot go negative |
| **2** | **WebSocket connection cost.** Connections are the one variable that scales with *viewers*, not orders, and it hits RAM. One viral shipment with 5,000 viewers is a 5,000× multiplier on a resource that has no per-connection ceiling. | +$0.15–0.30 per concurrent viewer-month; a 10k-connection event could add ~$30–60/month and blow the p95 fan-out budget first | `websocket_connections_per_replica` alert; fan-out p95 in the golden-signals dashboard | Load-test 500 viewers on one shipment before beta ([08](08-testing-strategy.md) L2). One connection per shipment room, not per update. Throttle to 2 s. SSE/polling fallback above a soft connection cap. Set Railway **replica limits** per service as a blast-radius bound, and a workspace usage hard limit at 5× normal spend — note that a Railway hard limit takes all workloads offline, so leave real headroom ([docs](https://docs.railway.com/guides/right-size-cpu-memory)) |
| **3** | **Map tile spend and licensing.** The free tier is non-commercial, so the moment a real customer loads a map we are on a paid plan. Billing is per *session* (a map open), and a courier with the app open all shift is a session that repeats. | Unbounded if we ship an open map to consumers; bands are $25–250/month | Tile session count vs. active users, tracked weekly | Decide the provider **before** public launch, not after the first bill. Ship the courier map with a **small fixed style and low zoom** to cut tile requests. Do not put a live map on the public marketing page until the plan is confirmed. Self-hosting [Protomaps](https://protomaps.com/) `.pmtiles` on Railway + object storage is the fallback if per-session pricing proves hostile — it trades a vendor for our own ops load |

**Runner-up risks** (not top 3, but tracked): always-on staging burning ~$14–20/month while idle; GitHub Actions minutes on a large E2E matrix; Sentry overage if error volume spikes during an incident (set `spendAllocation` alerts); egress growth from shipping map tiles through our own domain instead of the provider's CDN.

### 10.6 Cost controls

- Railway workspace **usage limits**: soft email alert at expected monthly spend, hard limit at 5× — the hard limit is destructive and takes all workloads offline, so leave headroom.
- Railway **replica limits** per service, so one runaway service cannot consume the whole bill.
- Per-service resource caps in `railway.json`; the API service caps RAM so a fan-out leak degrades rather than evicts the whole deployment.
- Sentry `spendAllocation` alerts at 50% and 90% of quota.
- A weekly cost line in the metrics review, comparing actuals to this model. **Drift above 20% for two consecutive weeks triggers a re-derivation of this table before anything else is optimised.**
- Never optimise the hosting bill when contribution margin is above 30% of revenue. Infrastructure cost is not the business risk; see [10-risk-register.md](10-risk-register.md) R-10 and R-02.

---

## 11. Sources

- [Railway pricing](https://railway.com/pricing) · [Railway pricing plans](https://docs.railway.com/pricing/plans) · [Understanding your bill](https://docs.railway.com/pricing/understanding-your-bill) · [Right-sizing CPU and memory](https://docs.railway.com/guides/right-size-cpu-memory)
- [Railway Postgres backups and restores](https://docs.railway.com/guides/postgres-backups-restores) · [Railway PITR](https://docs.railway.com/volumes/point-in-time-recovery) · [Railway Postgres CLI](https://docs.railway.com/cli/postgres)
- [PostgreSQL `NOT NULL` constraints](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-NOT-NULL) · [PostgreSQL `CREATE INDEX CONCURRENTLY`](https://www.postgresql.org/docs/current/sql-createindex.html#SQL-CREATEINDEX-CONCURRENTLY)
- [PostGIS](https://postgis.net/) · [ST_DWithin](https://postgis.net/docs/ST_DWithin.html)
- [Drizzle Kit overview](https://orm.drizzle.team/docs/kit-overview)
- [BullMQ: Redis configuration](https://docs.bullmq.io/guide/going-redis)
- [Stripe pricing](https://stripe.com/pricing) · [Stripe idempotent requests](https://docs.stripe.com/api/idempotent_requests) · [Stripe Connect](https://docs.stripe.com/connect/)
- [Twilio US SMS pricing](https://www.twilio.com/en-us/sms/pricing/us)
- [Sentry pricing](https://sentry.io/pricing/) · [Sentry quotas](https://docs.sentry.io/pricing/quotas/)
- [MapTiler Cloud pricing](https://www.maptiler.com/cloud/pricing/) · [MapTiler sessions vs requests](https://docs.maptiler.com/guides/account/sessions-vs-requests/) · [Protomaps](https://protomaps.com/)
- [iOS service worker lifecycle](https://webkit.org/blog/8090/workers-at-your-service/) · [Web Push on iOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)