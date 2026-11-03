# 08 — Testing Strategy

Status: pre-implementation, planning only. No application code exists yet.
Owner: engineering (rotating named owner per iteration).
Sibling docs: [00-product-brief.md](00-product-brief.md) · [01-tech-stack.md](01-tech-stack.md) · [02-architecture.md](02-architecture.md) · [03-data-model.md](03-data-model.md) · [04-api-contract.md](04-api-contract.md) · [05-realtime-and-tracking.md](05-realtime-and-tracking.md) · [06-frontend-architecture.md](06-frontend-architecture.md) · [07-roadmap.md](07-roadmap.md) · [DECISIONS.md](DECISIONS.md) · [docs index](README.md)
Operational set: [08-testing-strategy.md](08-testing-strategy.md) · [09-infrastructure-and-cost.md](09-infrastructure-and-cost.md) · [10-risk-register.md](10-risk-register.md) · [11-launch-playbook.md](11-launch-playbook.md)

---

## 1. Principles

1. **The money and the dispatch are the product.** Coverage percentages are a proxy. The real gate is: every branch of the ledger and every edge of the shipment state machine has a named test that fails if the branch is deleted.
2. **Real database, real constraints.** Postgres is where our invariants live (`CHECK`, triggers, partial indexes, `FOR UPDATE SKIP LOCKED`). Testing dispatch or the ledger against an in-memory fake would test the fake. Integration tests run against real Postgres + PostGIS.
3. **No network in unit or integration tests.** Stripe, routing engines, SMS, and map tiles are reached only through ports with deterministic test doubles or recorded fixtures. Tests must pass offline.
4. **Nondeterminism is injected, not slept through.** Clock, geolocation, randomness, and network are all ports. No test ever calls `Date.now()` directly in business logic and no test ever uses `setTimeout` to wait for a race to resolve.
5. **Flakiness is a defect with a severity.** Any test that flakes is quarantined same-day and fixed within 48h, or deleted. A suite that is red "sometimes" is worse than no suite.

---

## 2. Test pyramid for QuickDrop

The shape differs from a typical CRUD app because two of our riskiest surfaces (real-time fan-out and money movement) are not naturally unit-testable. The pyramid is therefore *wider in the middle*: a heavy integration band sitting under a thin E2E cap.

| Layer | Share of suite (est. runtime minutes) | What belongs here | Coverage target |
|---|---|---|---|
| **L0 Static / contract** | 1% | `tsc --noEmit`, ESLint, Prettier check, Zod schema snapshots of every OpenAPI response, `drizzle-kit` migration drift check, dependency + licence audit, secret scan | 100% of files type-check; zero `any` in `packages/core`; zero licence-blocked deps |
| **L1 Unit** | 12% | Pure functions: money math, fee split, ETA smoothing, haversine, geo-fence predicate, state-machine transition table, password/OTP policy, idempotency-key derivation, clock-skew tolerance | **95% lines / 90% branches** in `packages/core`; **100%** in `packages/money` and `packages/ledger` |
| **L2 Component (React)** | 10% | Every route component rendered in isolation with a mock server: `/customer` booking form (address autocomplete, validation errors), shipment tracker (map, ETA, status timeline, disconnected banner), courier offer card (accept/decline countdown), courier nav controls, `/ops` tables and filters. Accessibility assertions per component | 90% lines; 100% of interactive controls have at least one interaction test |
| **L3 Integration (in-process)** | 40% | Hono app mounted via `app.request()` against real Postgres + PostGIS + real Redis. Repositories, dispatch, offer lifecycle, position ingest, state machine, authz middleware, idempotency middleware, worker job handlers, ledger writes, Stripe webhook handlers | 85% lines in `packages/api` + `packages/worker`; **100%** of shipment state transitions and ledger transaction types |
| **L4 Contract** | 3% | Stripe webhook payload fixtures against our handlers; `/v1/*` request/response shapes; event schema versioning for the courier telemetry stream | 100% of documented endpoints; every webhook event type we subscribe to has a fixture |
| **L5 E2E (browser)** | 4% | Five journeys only, in Playwright, against a real preview stack. See §6 | Handful of specs, ~12 assertions each; measured stability target ≥ 98% over 30 consecutive runs |
| **L6 Load / soak / chaos** | 5% | k6 against staging-shaped data; Redis/worker kill; network partition injection | Not coverage; pass/fail against numeric SLO thresholds (§5) |
| **L7 Exploratory / field** | Manual | Real iOS Safari and Android Chrome on real devices, beta cohort sessions, courier ride-alongs | n/a |

**Why the middle is heavy.** Dispatch correctness and ledger correctness are properties of a *database plus concurrent processes plus at-least-once delivery*. There is no way to test "two workers racing to assign one shipment" in a unit test without reimplementing Postgres. So L3 gets the largest budget and the real database.

**Absolute coverage gates (blocking):**
- `packages/ledger`: 100% line and branch. No exceptions, no `/* c8 ignore */` without a linked ticket.
- Shipment state transition table: every (from, to) pair that is legal has a test; every pair that is illegal has a test asserting the rejection. 64 pairs if we model 8 states — cheap, and it is the single highest-value table in the repo.
- Every idempotency-keyed write path has a "called twice" test.

---

## 3. Tooling decisions

| Concern | Choice | Version | Why this and not the obvious alternative |
|---|---|---|---|
| Test runner (all TS layers) | **Vitest** | 5.0.3 | Single runner for L1/L2/L3 with `vi.useFakeTimers()`, first-class ESM + TS 7 support, native `describe/test` mirroring Playwright so one mental model covers both. Chosen over Node's built-in `node:test` (weaker fake timers, no DOM env) and Jest (slow ESM, Churn under React 19). [vitest.dev](https://vitest.dev/) |
| Unit assertions | **Vitest `expect`** + `@vitest/coverage-v8` (V8 coverage) | bundled | V8 coverage is native to Node 24, no Babel instrument pass, accurate on modern syntax. [Vitest coverage](https://vitest.dev/guide/coverage.html) |
| Component testing | **Vitest + jsdom** (`@vitest/browser` optional) + Testing Library React | current | Testing Library matches the accessibility-first queries we want (`getByRole`), which is the same query set `eslint-plugin-jsx-a11y` and Playwright use. Avoids Enzyme (dead) and Jest-dom-with-jest. [testing-library.com](https://testing-library.com/docs/react-testing-library/intro/) |
| Browser E2E | **Playwright** (`@playwright/test`) | 1.63.0 | Only driver that bundles first-class **WebKit**, which matters because our most fragile surface is iOS Safari (service worker termination, no Background Sync). Also gives `storageState` reuse across projects, `context.addInitScript` for geolocation injection, `context.setOffline`, and trace/screenshot-on-retry. [playwright.dev](https://playwright.dev/) |
| Real-browser fidelity where jsdom lies | Playwright + Chromium for L2-critical components (service worker, `navigator.geolocation`, IndexedDB offline queue) | 1.63.0 | jsdom has no service worker and no `geolocation`; the courier offline-queue and SW caching tests must run in a real browser. [Playwright locators](https://playwright.dev/docs/locators) |
| API testing | **Vitest + `app.request()`** (Hono) + **MSW 3.0.2** for outbound HTTP | current | Hono's `app.request` runs the real router and middleware chain in-process with no socket, so L3 stays fast. MSW intercepts at the network layer. [MSW](https://mswjs.io/) |
| Real Postgres in tests | **Testcontainers** (`@testcontainers/postgresql` 12.2.0) on the `postgis/postgis:17-3.5` image | 12.2.0 | PostGIS is unavailable in PGlite and in `pg-mem`, so the `ST_DWithin` nearest-courier query and `geography(Point,4326)` columns cannot be tested any other way. Testcontainers gives a real engine, real locks, real triggers. [Testcontainers Node](https://node.testcontainers.org/) |
| Real Redis in tests | Testcontainers `redis:7.4-alpine` | current | BullMQ requires a real Redis; fake-redis breaks Lua-scripted atomicity that our idempotency relies on. [BullMQ](https://docs.bullmq.io/) |
| Stripe | **Hand-rolled record/replay fixture server + MSW**; SDK pinned to `fetch` transport | `stripe` 23.0.0 | Configure `Stripe.createFetchHttpClient()` so every call goes through `fetch` and MSW can intercept it. Fixtures are checked into `tests/fixtures/stripe/<event_type>/<scenario>.json` so replay-safety tests are reproducible even when Stripe's test-mode payloads change. A general VCR package would fight the SDK's custom transport and the 2026 Accounts v2 shape. [Stripe idempotent requests](https://docs.stripe.com/api/idempotent_requests) |
| SMS/OTP | MSW-intercepted provider HTTP + Mailpit (`axllent/mailpit`) for email OTP capture in E2E | current | OTP codes must be *readable by the test*, not predicted by it. [Mailpit](https://mailpit.axllent.org/) |
| Routing engine (ETA) | Recorded OSRM/GraphHopper responses + a local OSRM container for L6 | see [09](09-infrastructure-and-cost.md) | Recorded responses make ETA unit tests instant and deterministic; the local container proves the integration. |
| Load / performance | **k6** (Grafana), run from a dedicated Railway service or laptop, not from CI shared runners | binary, or `grafana/k6` image | Declarative scenarios, WebSocket support via `k6/ws`, thresholds as pass/fail assertions in code. k6 is distributed as a **binary / container image**, not a meaningful npm package — do not add it to `package.json`. [k6 docs](https://k6.io/docs/) |
| E2E fixtures & DB isolation | Drizzle migrations + per-worker Postgres schema + `pg_advisory_lock`-guarded reset | with Drizzle Kit 0.31.11 | Per-worker schema gives real parallelism without cross-worker interference. |
| Flake detection | `--repeat-each=3` on L5 in nightly; Playwright trace viewer; CI re-run of *failed* tests only, reported as a metric | 1.63.0 | A test that passes on re-run is a broken test; it must be visible in the dashboard, not silently green. |
| Security | `osv-scanner` / `npm audit --omit=dev`, `gitleaks`, CodeQL on `packages/api` | current | Supply-chain and injection scanning are cheap now and impossible to retrofit. [osv.dev](https://osv.dev/) |

Budget reality check for 2–4 engineers: the expensive parts are L3 (Testcontainers cold start) and L5 (browser). Budget ~6 min for L3 and ~4 min for L5 on PRs. Split test files by domain and shard L5 by persona.

---

## 4. The critical business scenarios

These are the tests that must exist before beta. Each is a named, addressable test ID referenced from the PR that changes the behaviour. `setup / action / assert` is exhaustive on purpose: vague assertions are how money bugs survive.

### B-01 Double-dispatch prevention (two workers race to assign one shipment)

- **Layer:** L3 integration, real Postgres, 2 concurrent connections.
- **Setup:** One `shipment` in state `offer_pending`. Two `courier_offers` rows for distinct couriers, both `status='offered'` and not yet expired. Two independent `BullMQ` worker processes (or two direct concurrent calls to the dispatch service) sharing one Redis.
- **Action:** Fire `acceptOffer(offerA)` and `acceptOffer(offerB)` simultaneously (`Promise.all` across two DB connections). Both read the shipment row before either writes.
- **Assert:**
  1. Exactly **one** offer transition `offered → accepted` commits; the other gets `409 OFFER_STALE`.
  2. `SELECT count(*) FROM shipments WHERE id=$1 AND courier_id IS NOT NULL` = 1; `shipments.courier_id` equals exactly the winner.
  3. The losing courier's `couriers.status` is not left as `busy` (it is reset to `available` or `offer_pending`).
  4. `shipments.status = 'assigned'` and `assigned_at` is non-null.
  5. Exactly **one** `ledger_transaction` of type `capture` exists for the shipment.
  6. Exactly **one** `dispatch_events` row with `event_type='assigned'` exists.
  7. Repeat 200 times with randomised delays (0–40 ms) between the two calls; the invariant in (1)–(6) holds on all 200 runs.
- **Implementation notes:** The candidate query must use `SELECT ... FOR UPDATE SKIP LOCKED` (see [stack_report.md §4](../stack_report.md)) and the transition must be a single conditional `UPDATE ... WHERE status = 'offer_pending' RETURNING id`. If `RETURNING` yields zero rows, that is the lost race — raise `409`. Add a unique partial index `CREATE UNIQUE INDEX ON shipments (id) WHERE courier_id IS NOT NULL AND status NOT IN ('delivered','cancelled','failed')` as a database-level backstop.

### B-02 Payment idempotency (retrying the same charge)

- **Layer:** L3 + L4 contract.
- **Setup:** `Idempotency-Key: ord_9f3a...` recorded against `POST /v1/shipments`. Stripe fixture `payment_intent.succeeded`.
- **Action:** Send the identical request three times: (a) sequentially; (b) three concurrent requests; (c) after a simulated 502 from Stripe on the first attempt (fault injection on the outbound call, which forces the client to retry).
- **Assert:**
  1. Exactly **one** `PaymentIntent` is created — assert on the outbound Stripe request count in the MSW handler, not on our own log.
  2. All three responses are `201` and byte-identical after normalising the `idempotency_key` field, or later ones return `200` with the stored original body. Pick one and document it; recommended: first `201`, subsequent `200` replay of the original body plus header `Idempotent-Replayed: true`.
  3. `ledger_entries` for the capture transaction sum to the order total, with **one** transaction, not three.
  4. `ledger_operations` unique index on `idempotency_key` did not raise; retry did not insert a second row.
  5. Scenario (c): the retried call reached Stripe with the **same** `Idempotency-Key` header, so Stripe returns the original PaymentIntent rather than charging again. Assert the recorded request headers.
- **Negative variant:** same key, **different** payload hash → `422 IDEMPOTENCY_KEY_REUSED`. Test this; it is the classic silent-corruption bug.

### B-03 Payout correctness (no over-payment, no under-payment, no double payout)

- **Layer:** L3 integration.
- **Setup:** 50 completed shipments for one courier. Fare rule: base $4.50 + $1.10/km, platform fee 18%, tip $2.00, surge multiplier 1.0. All distances computed with a fixed haversine fixture so the expected value is exact.
- **Action:** Run the payout batch job. Then run it again immediately (simulating a BullMQ retry after a crash between Stripe transfer success and job completion).
- **Assert:**
  1. The payout total equals `sum(each shipment's courier_net)` exactly, in integer minor units, computed independently in the test from first principles.
  2. `payouts` has exactly **one** row for the batch; `payouts.stripe_transfer_id` is a single Stripe id.
  3. MSW handler records exactly **one** `POST /v1/transfers` call across both runs.
  4. Each shipment's `payout_id` is set exactly once; no shipment appears in two payouts.
  5. The ledger for the batch balances to zero (§B-07).
  6. **Under-payment variant:** one shipment in `delivered` with `payout_id IS NULL` (worker crashed mid-batch) — the next batch includes it and the earlier courier's payout total increases by exactly that shipment's net. Test: total across two batches equals total across one batch of all 50.
  7. **Rounding variant:** 3 shipments whose per-shipment rounding remainder is 1 cent. Assert the sum of rounded per-shipment amounts equals the rounded batch total — i.e. rounding happens **once, at the payout level**, not per shipment. This is the test that prevents the classic off-by-a-few-cents support ticket.

### B-04 Illegal shipment state transitions are rejected with 409

- **Layer:** L3, table-driven, exhaustive.
- **Setup:** The state machine from [04-api-contract.md](04-api-contract.md). States: `draft`, `quoted`, `payment_pending`, `booked`, `offer_pending`, `assigned`, `picked_up`, `in_transit`, `arrived`, `delivered`, `cancelled`, `failed`.
- **Action:** For every ordered pair `(from, to)` with `from != to`, attempt the transition through the service and through the HTTP endpoint.
- **Assert:**
  1. Legal pairs → `200`, `shipments.status = to`, and one `shipment_events` row.
  2. Illegal pairs → `409 ILLEGAL_TRANSITION`, body includes `{ from, to, allowedNext: [...] }`; **row unchanged**.
  3. Terminal states (`delivered`, `cancelled`, `failed`) accept **no** outbound transition except the explicit `delivered → refunded` money path, which is a ledger operation, not a state change.
  4. The HTTP layer rejects with 409 *before* any side effect: assert no ledger row, no Stripe call (MSW count unchanged), no queue enqueue.
- **Additional:** a DB-level guard test that a direct `UPDATE shipments SET status='delivered'` on a `booked` shipment is rejected by a `BEFORE UPDATE` trigger. Application checks alone are not sufficient — a background job with a raw SQL update would bypass them.

### B-05 Courier accepts an offer that has already been withdrawn

- **Layer:** L3 integration.
- **Setup:** Offer `o1` on shipment `s1` for courier `c1` in state `offered`, with `expires_at = now() + 90s`. Simulate ops withdrawing the offer (`offered → withdrawn`) because a better courier was found.
- **Action:** `c1` taps Accept at T+2s on a phone that was offline since the offer was pushed.
- **Assert:**
  1. Response is `409 OFFER_WITHDRAWN` (not a generic 409, and **not** a silent 200).
  2. `shipments.courier_id` is null (or the replacement courier); `shipments.status` is unchanged from its value at withdrawal.
  3. `c1` is offered a **compensating** flow: the API response carries `reoffer: true` so the client can re-enter the available pool.
  4. No ledger entry, no Stripe call.
- **Variant:** the same accept arrives at T+91s, after `expires_at`. Assert `409 OFFER_EXPIRED` and that the expiry sweeper job did not already reassign the shipment to a second courier (`assignments` count still 1).
- **Variant:** accept arrives while the offer row is being deleted by the expiry sweeper in another transaction. Assert exactly one terminal outcome and no `SerializationFailure` leaking to the client (must be retried internally up to 3 times).

### B-06 Concurrent cancellation vs. pickup

- **Layer:** L3 integration, real Postgres, 2 connections.
- **Setup:** Shipment `s1` in `assigned`, courier en route, 300 m from pickup.
- **Action:** Customer calls `POST /v1/shipments/s1/cancel` at the same instant the courier calls `POST /v1/shipments/s1/pickup`. Run 200 randomised-order iterations.
- **Assert:**
  1. The shipment ends in exactly one of `cancelled` or `picked_up`. Never both, never neither.
  2. The losing side gets `409` with a specific code (`SHIPMENT_ALREADY_PICKED_UP` / `SHIPMENT_NOT_CANCELLABLE`).
  3. **Money is consistent with the outcome:** if `picked_up` wins, the customer is not refunded and the courier keeps the assignment; if `cancelled` wins, exactly one refund ledger transaction exists, amount equals the capture, and the courier's `pending_payout` is released back to zero.
  4. The customer's `late cancel` rule is applied correctly (cancel after pickup-approach threshold may be penalised — assert the flag, not the fee).
  5. Exactly one row in `shipment_events` with `event_type IN ('cancelled','picked_up')`.
- **Why it matters:** this is the single most common real-world support complaint in on-demand delivery marketplaces, and it is where a naive read-modify-write loses a customer's parcel.

### B-07 Every ledger transaction balances to zero

- **Layer:** L3 integration + a permanent CI assertion job.
- **Setup:** Any committed `ledger_transactions` row.
- **Action:** `SELECT txn_id, SUM(amount_minor) FROM ledger_entries WHERE txn_id = $1 GROUP BY txn_id HAVING SUM(amount_minor) <> 0`.
- **Assert:**
  1. Zero rows returned. Run this as a **dedicated nightly job** over the entire ledger, not only over fixtures.
  2. The invariant is enforced by Postgres itself, so a code path *cannot* commit an unbalanced transaction even if application code is wrong:

```sql
-- Deferred constraint trigger: the check runs at COMMIT, after all entries are written.
CREATE OR REPLACE FUNCTION ledger_txn_must_balance() RETURNS trigger AS $$
DECLARE imbalance bigint;
BEGIN
  SELECT COALESCE(SUM(amount_minor), 0) INTO imbalance
    FROM ledger_entries
   WHERE txn_id = NEW.txn_id;
  IF imbalance <> 0 THEN
    RAISE EXCEPTION 'unbalanced ledger txn %: sum=%', NEW.txn_id, imbalance
      USING ERRCODE = '23514';  -- check_violation
  END IF;
  RETURN NULL;
END $$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER ledger_txn_balances
  AFTER INSERT ON ledger_entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION ledger_txn_must_balance();
```

  3. Additionally assert per-account balances never go negative for `customer_funds`, `courier_payable`, `platform_revenue`, `platform_stripe_clearing`:
`SELECT account_code FROM account_balances WHERE balance_minor < 0` returns zero rows.
  4. **Negative test:** attempt to commit a transaction with a deliberate 1-cent imbalance inside a `BEGIN ... COMMIT` block in the test. Assert Postgres raises `23514` and rolls back. This proves the guard is live, not decorative.

### B-08 Ledger entries are immutable

- **Layer:** L3 integration + a nightly audit job.
- **Setup:** A committed entry in any state.
- **Action:** (a) `UPDATE ledger_entries SET amount_minor = amount_minor + 100 WHERE id = $1`; (b) `DELETE FROM ledger_entries WHERE id = $1`; (c) run the application code that "fixes" a typo in an entry.
- **Assert:**
  1. (a) and (b) both raise and change nothing. Enforced by triggers, not by convention:

```sql
CREATE OR REPLACE FUNCTION ledger_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ledger_entries is append-only; % attempted', TG_OP
    USING ERRCODE = '42501';  -- insufficient_privilege
END $$ LANGUAGE plpgsql;

CREATE TRIGGER ledger_entries_no_update BEFORE UPDATE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION ledger_append_only();
CREATE TRIGGER ledger_entries_no_delete BEFORE DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION ledger_append_only();
```

  2. (c) corrections are only possible by posting a **reversing** transaction: the original entry remains, a new `reversal` txn offsets it, and the pair balances to zero. Assert both rows exist after a correction and that the account balance returns to its pre-error value.
  3. Nightly audit asserts `COUNT(*) = 0` for `updated_at > created_at` on ledger entries (belt and braces — the trigger should make this impossible).
- **Note:** if ops ever legitimately needs to correct data, the answer is a reversing entry, full stop. Document that in [03-data-model.md §7.3 Invariants](03-data-model.md#73-invariants).

### B-09 Webhook replay safety

- **Layer:** L4 contract + L3.
- **Setup:** Fixture `payment_intent.succeeded` with `event.id = evt_1Qzs...`, same `data.object.id` as one we already processed. `webhook_events` table has the row with `processed_at` set.
- **Action:** Deliver the identical webhook body **four times** in one minute: once with the real `Stripe-Signature`, once with a valid signature replayed after 30 min, once with a **tampered** body, once with a valid signature but an event id we've never seen.
- **Assert:**
  1. Deliveries 1 and 2 are no-ops. Exactly one `ledger_transaction` of type `capture`; `shipments.status` unchanged.
  2. Tampered body → `400`, no state change, and a security log line at `warn` with the event id (do not log full payload — it contains PII).
  3. Valid signature, unknown event type → `200` with `{ ignored: true }` (we must 200 unknown types or Stripe retries forever), and a `debug` log.
  4. A *new* event id for a **different** transition (e.g. `payment_intent.payment_failed` after success) → `200` but the shipment enters `payment_review`, and it must **not** silently flip a delivered shipment back to failed. Assert state machine rejects it (§B-04).
  5. Handler is safe under **concurrent** duplicate delivery: two copies of delivery 1 fired in parallel against two workers → still one ledger transaction. Assert via unique index on `webhook_events(stripe_event_id)`.
  6. Raw-body signature verification is tested against a fixture with a **future** `timestamp` outside the 5-minute tolerance → `400`. Catches the classic "we re-serialise the body before verifying" bug.
- **Sources:** [Stripe webhook signature verification](https://docs.stripe.com/webhooks/signature); [Stripe event replay](https://docs.stripe.com/webhooks#preventing-out-of-order-delivery).

### B-10 GPS spoof / implausible-jump rejection

- **Layer:** L3 (validator) + L5 (one E2E).
- **Setup:** Courier `c1` legitimately at (52.5200, 13.4050). Server clock T.
- **Action:** Submit position payloads in five variants:
  1. Legitimate: 5 m movement, `accuracyM = 8`.
  2. **Impossible speed:** a point 50 km away with `recordedAt` 60 s later (≈833 m/s).
  3. **Perfect GPS:** 5 km away with `accuracyM = 3`, `recordedAt = 2 s` in the past (the classic emulator/"GPS fixer app" spoof signature: perfect accuracy, impossible speed).
  4. **Future-dated:** `recordedAt = serverNow + 30 s` (client clock ahead).
  5. **Accurate but far:** 8 km away over 600 s (130 km/h — plausible for a van on a motorway, but our zone is city; our policy is to accept and flag, not reject).
- **Assert:**
  1. (1) accepted, stored, broadcast; no anomaly flag.
  2. (2) and (3) **rejected** with `422 IMPLAUSIBLE_JUMP`; the last known position is unchanged; `couriers.location_integrity = 'suspect'`; an `anomaly_events` row is written and surfaces on the `/ops` courier panel.
  3. (4) rejected with `422 CLOCK_SKEW` (tolerance: reject `clientTs > serverNow + 5s`; accept up to 60 s of lag, which is normal for buffered offline batches).
  4. (5) accepted but flagged `low_confidence`; the shipment ETA is marked unreliable rather than silently wrong.
  5. Rejection is **not** a disconnect: the connection stays open and the courier's next legitimate point is accepted. A spoof must not be able to lock a courier out of the platform.
  6. After 3 anomalies in 15 min, the courier is flagged for ops review and their pending payout is held — asserted, with the exact threshold in one shared constant so ops and tests agree.
- **Constants live in one place** (`packages/core/src/tracking/plausibility.ts`) so the alert threshold, the ops rule, and the test never drift.

### B-11 Out-of-order position rejection

- **Layer:** L3.
- **Setup:** Courier `c1` has already stored a position at `recordedAt = T`.
- **Action:** Deliver a batch `[T-1s, T-3s, T-2s]` (correctly chronological inside the batch but entirely behind what we already have), and separately deliver a batch with internal disorder `[T+2s, T+1s, T+3s]`.
- **Assert:**
  1. Every point whose `recordedAt <= last_accepted_recorded_at` is rejected (`202 STALE_POSITION`, counted in `positions_rejected_total{reason="out_of_order"}`) and does **not** overwrite the newer position.
  2. Points inside a batch that pass validation are still accepted even if earlier points in the same batch were rejected — one bad point must not poison the batch.
  3. After the batch, `couriers.last_seen_at` and `location_geog` reflect only accepted points.
  4. The offline-queue flush path (IndexedDB replay on reconnect) is the real-world source of this: E2E test goes offline, moves 400 m, comes back, and asserts the map path renders **forward-only** with no backtracking.
  5. Duplicate points (identical `recordedAt` and identical coords, from a WS reconnect replay) are idempotent, not errors — `202` with `duplicate: true`.

### B-12 ETA regression when a courier goes offline

- **Layer:** L3 + L5.
- **Setup:** Shipment `in_transit`, ETA service computed at `T`, last position at `T`, `last_seen_at = T`, displayed ETA 9 min.
- **Action:** Advance the fake clock 4 minutes with no inbound position (courier's phone in a tunnel / app swiped away — the expected iOS case, see [stack_report.md §2](../stack_report.md)). Then advance to 10 minutes.
- **Assert:**
  1. At `T + 60 s` (staleness threshold) the courier is marked `stale`; `shipments.eta_confidence` drops from `high` to `low`.
  2. At `T + 90 s` the API stops returning a numeric ETA. It returns `{ etaSeconds: null, etaConfidence: 'unavailable', lastSeenAt: T }` — **never a stale frozen number**. This is the specific bug this test exists to prevent: a customer watching a countdown that is quietly wrong.
  3. The customer UI shows the "courier connection lost, we're tracking" state and does not show a fabricated arrival time.
  4. At `T + 5 min` a BullMQ job escalates: shipment is flagged `needs_attention`, `/ops` shows it, and the dispatch policy decides reassign-vs-wait. Assert the job ran (not the UI).
  5. If the courier reconnects and sends a plausible position, ETA returns to numeric confidence and the escalation flag clears. No orphaned `needs_attention` flags.
  6. Assert no ETA regression *math* is needed for this scenario: the requirement is "stop lying", not "predict better".

### B-13 Concurrent offer expiry vs. acceptance (dispatch liveness)

- **Layer:** L3.
- **Setup:** `s1` in `offer_pending`, 3 offers, one expiring in 2 s.
- **Action:** Run the expiry sweeper and a courier accept at the same instant; repeat 200 times.
- **Assert:** Either the accept wins (`assigned`) or the sweeper wins (`offer_pending` → next courier offered), never both; `assignments` count for `s1` is always ≤ 1; the sweeper is idempotent across repeated runs.

### B-14 Authorization boundaries (three roles)

- **Layer:** L3 (API), one E2E.
- **Setup:** Customer A's shipment `sA` assigned to courier `c1`. Signed-in: customer A, courier `c2`, courier `c1`, ops user.
- **Action:** `GET /v1/shipments/sA`, `GET /v1/shipments/sA/events`, `POST /v1/shipments/sA/cancel`, `GET /v1/couriers/c1` from each identity. Also: courier reads the **drop-off** address before pickup.
- **Assert:**
  1. `c2` → `404` on every `sA` route (404, not 403, so we do not confirm shipment existence).
  2. Customer A can cancel but not transition to `delivered`.
  3. Courier `c1` sees the **drop-off** address only after the pickup event is confirmed; before that the response omits it (this is a real privacy and safety design choice, see [10-risk-register.md](10-risk-register.md) R-08).
  4. Ops user can read but every ops read is written to an `audit_log` row. Assert the audit row exists.
  5. A courier cannot write to `ledger_*` or `payouts` under any route. Assert via a route-level allowlist test that enumerates every mutating route and its permitted roles — cheap, mechanical, and catches the classic forgotten `requireRole`.

### B-15 Refund correctness and abuse resistance

- **Layer:** L3.
- **Setup:** A `delivered` shipment with a captured charge of $12.00.
- **Action:** (a) Refund once. (b) Refund again with the same request `Idempotency-Key`. (c) Refund more than the captured amount. (d) Refund a shipment that was never charged.
- **Assert:** (a) one refund, ledger reverses to zero net, `charge_refunded`; (b) `200` replay, no second refund, no negative customer balance; (c) `422 REFUND_EXCEEDS_CHARGE` with no Stripe call; (d) `409`/`422` with no Stripe call. Plus: cumulative refund attempts per shipment per hour are rate-limited (card-testing defence, see [11-launch-playbook.md](11-launch-playbook.md)).

---

## 5. Deterministic testing of nondeterminism

The rule: **business logic never imports `Date`, `Math.random`, `navigator.geolocation`, `fetch`, or a global.** It receives ports. Tests inject fakes; production injects real implementations.

### 5.1 Ports

```ts
// packages/core/src/testing/ports.ts — compiled into prod, no test-only deps.

export interface TimerHandle { readonly __brand: 'TimerHandle' }

export interface Clock {
  /** Wall-clock now, UTC. The ONLY time source in business logic. */
  now(): Date
  /** Monotonic ms since process start. For durations/ELAs; immune to clock changes. */
  monotonicMs(): number
  setTimeout(fn: () => void, ms: number): TimerHandle
  setInterval(fn: () => void, ms: number): TimerHandle
  clear(h: TimerHandle): void
  /** Test-only: advance time deterministically and flush due timers. */
  advance?(ms: number): Promise<void>
  /** Test-only: move wall clock without firing timers (simulates NTP jump). */
  skew?(deltaMs: number): void
}

export interface PositionSample {
  lat: number
  lon: number
  accuracyM: number
  headingDeg?: number
  speedMps?: number
  /** When the fix was taken on the device. */
  recordedAt: Date
}

export interface GeolocationSource {
  watchPosition(
    opts: { highAccuracy: boolean; maxAgeMs: number; minIntervalMs: number },
    onSample: (s: PositionSample) => void,
    onError: (e: GeolocationError) => void,
  ): () => void // returns unsubscribe
}

export interface RandomSource {
  next(): number            // [0, 1)
  int(minInclusive: number, maxExclusive: number): number
  /** Stable id generation; in tests, a seeded generator so ids are reproducible. */
  id(prefix: string): string
}

export interface PaymentGateway {
  createCharge(req: ChargeRequest & { idempotencyKey: string }): Promise<ChargeResult>
  refund(req: RefundRequest & { idempotencyKey: string }): Promise<RefundResult>
  createTransfer(req: TransferRequest & { idempotencyKey: string }): Promise<TransferResult>
}

export interface RouteEngine {
  route(req: { coords: [number, number][]; profile: 'car' | 'bike' | 'foot' }): Promise<RouteResult>
}

export interface NetworkControl {
  /** Test-only. Partitions the browser↔server or server↔third-party edge. */
  partition(target: 'ws' | 'http' | 'stripe' | 'redis' | 'all'): void
  heal(target: 'ws' | 'http' | 'stripe' | 'redis' | 'all'): void
}
```

`packages/core` imports only these interfaces. `packages/api` and `packages/worker` receive them from a `createContainer({ clock, geo, random, payments, routing, network })` factory. Wiring is the only place that differs between test and production.

### 5.2 Faking the clock

Vitest fake timers cover `Date`, `setTimeout`, `setInterval`, and `performance.now` in one switch, which is exactly the surface a time-dependent bug lives on.

```ts
// vitest.config.ts
export default defineConfig({
  test: {
    setupFiles: ['./test/setup.ts'],
    // Fake by default. Tests that need real time opt in per-file.
    fakeTimers: { toFake: ['Date', 'setTimeout', 'setInterval', 'clearTimeout',
                          'clearInterval', 'performance', 'queueMicrotask'] },
  },
})
```

```ts
// test/clock.ts
import { vi } from 'vitest'
import type { Clock } from '@quickdrop/core/testing'

export function installClock(startIso = '2026-10-05T09:00:00.000Z'): Clock {
  vi.useFakeTimers({ now: new Date(startIso), shouldAdvanceTime: false })
  vi.setSystemTime(new Date(startIso))

  return {
    now: () => new Date(),
    monotonicMs: () => Number(process.hrtime.bigint() / 1_000_000n),
    setTimeout: (fn, ms) => vi.setTimeout(fn, ms) as unknown as TimerHandle,
    setInterval: (fn, ms) => vi.setInterval(fn, ms) as unknown as TimerHandle,
    clear: (h) => vi.clearTimeout(h as unknown as ReturnType<typeof vi.setTimeout>),
    advance: async (ms) => { await vi.advanceTimersByTimeAsync(ms) },
    skew: (deltaMs) => { vi.setSystemTime(Date.now() + deltaMs) },
  }
}

/** The four clock states the app must survive, as one table. */
export const CLOCK_CASES = [
  { name: 'normal',                 skewMs: 0 },
  { name: 'client 30s ahead',       skewMs:  30_000 },   // -> 422 CLOCK_SKEW (B-10.4)
  { name: 'client 60s behind',      skewMs: -60_000 },   // -> accepted, normal lag
  { name: 'server NTP jump +8h',    skewMs:  28_800_000 }, // -> monotonic timers unaffected
] as const
```

Rules that make this actually work:
- **Never `advance` past an `await` you do not control.** Use `advanceTimersByTimeAsync`, never `advanceTimersByTime`, or promise resolution deadlocks.
- **BullMQ delayed jobs**: pass `clock.now()` into the job's `delay` computation instead of `Date.now()`. Then `clock.advance(91_000)` triggers the expiry sweeper deterministically (B-05 variant).
- **Every test uses a fixed start instant.** No `new Date()` at test scope. If a test passes only at midnight, it is a bug in the code.
- **Snapshot the boundary, not the interior.** For the money tests, assert on the integer minor-unit result, never on a formatted currency string with a locale.

### 5.3 Faking GPS

Three layers, each covering a different surface:

**(a) Server-side validator tests (L3, fastest, ~90% of position coverage).** Feed `PositionSample[]` directly into the handler with a fixed clock. This is where B-10 and B-11 live.

**(b) Browser-side source tests (L2/L5, Playwright).** Override `navigator.geolocation` before any app code runs, and drive it from `page.evaluate` so the test can move the courier like a puppet.

```ts
// e2e/fixtures/geo-track.ts
export async function installScriptedGeolocation(
  page: Page,
  track: Array<{ lat: number; lon: number; accuracyM?: number; offsetS?: number }>,
) {
  await page.addInitScript((points) => {
    const w = window as any
    w.__geoTrack = points.map((p, i) => ({
      coords: {
        latitude: p.lat, longitude: p.lon,
        accuracy: p.accuracyM ?? 8,
        heading: null, speed: null,
      },
      timestamp: Date.now() - (p.offsetS ?? i * 2) * 1000,
    }))
    w.__geoCursor = 0
    const emit = () => {
      const p = w.__geoTrack[w.__geoCursor++]
      if (!p) return
      w.__geoWatchers?.forEach((cb: GeolocationCallback) =>
        cb({ coords: p.coords, timestamp: p.timestamp } as GeolocationPosition))
      if (w.__geoCursor < w.__geoTrack.length) setTimeout(emit, 20)
    }
    w.__geoAdvance = (n: number) => { w.__geoCursor = n }
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (ok: GeolocationCallback) => {
          const p = w.__geoTrack[w.__geoCursor] ?? w.__geoTrack[w.__geoTrack.length - 1]
          ok({ coords: p.coords, timestamp: p.timestamp } as GeolocationPosition)
        },
        watchPosition: (ok: GeolocationCallback) => {
          w.__geoWatchers ??= new Set(); w.__geoWatchers.add(ok)
          setTimeout(emit, 10)
          return w.__geoWatchers.size
        },
        clearWatch: () => { w.__geoWatchers?.clear() },
      },
    })
  }, track)
}
```

A realistic fixture path — courier walking from pickup to drop-off — is then just data: 180 points interpolated along a polyline at 3 s intervals with `accuracyM` jittered 6–20 m. Commit it; do not generate it at runtime.

**(c) Real-device Playwright project.** Chromium `context.setGeolocation({ latitude, longitude, accuracy })` for a coarse "somewhere in Berlin" case, plus a physical-device manual lane in the nightly matrix for the iOS-specific paths (see [11-launch-playbook.md](11-launch-playbook.md)).

**Clock skew in E2E:** `page.clock` (Playwright 1.45+) installs a fake clock in the page context, so `page.clock.setFixedTime()` / `page.clock.fastForward()` lets us test the app's *client-side* timeouts (offer countdown, "connection lost" banner) without waiting. Use it only in the two or three tests that need client time; server-side timing is covered by the injected `Clock`.

### 5.4 Network partitions and outages

| Failure | Technique | Used by |
|---|---|---|
| Device offline / flaky mobile data | `await context.setOffline(true)` then `false` | Offline position queue flush (B-11.4), reconnect backoff |
| Courier app closed mid-route | Close the context, reopen with saved `storageState` | iOS SW termination behaviour, heartbeat gaps (B-12) |
| Stripe unreachable | MSW `onUnhandledRequest: 'error'` + a handler that delays 30 s or throws | B-02(c), retry/backoff, webhook spool drain |
| Redis down | `redis-cli -p 6379 CLIENT PAUSE 10000` or stop the Testcontainer | Graceful degradation: reads served from Postgres, writes queued, API returns `503` on position ingest only — booking must keep working |
| Worker down | Kill the BullMQ worker process mid-job | Job retry + at-least-once idempotency (B-03 run-twice) |
| Postgres failover | `railway postgres pitr` drill (§[09](09-infrastructure-and-cost.md)) | Restore procedure, not a unit test |

A server-side fault-injection middleware (`FAULT_INJECTION=1`, refuses to boot otherwise) gives precise control: `POST /__test__/fault { kind: 'latency', target: 'db', ms: 3000 }`. It exists only in staging and E2E environments and its presence is asserted in the prod boot sequence (`if (process.env.FAULT_INJECTION === '1') throw` when `NODE_ENV === 'production'`). Add that as a CI test — B-16, cheap and embarrassing if you forget.

### 5.5 Deterministic Stripe

```ts
// test/support/stripe-double.ts
import Stripe from 'stripe'
import { setupServer, http, HttpResponse } from 'msw/node'

export function stripeDouble() {
  const calls: Array<{ method: string; path: string; idempotencyKey?: string }> = []

  const server = setupServer(
    // Replay: serve the committed fixture for this endpoint+scenario.
    http.post('https://api.stripe.com/v1/payment_intents', async ({ request }) => {
      calls.push({ method: 'POST', path: '/v1/payment_intents',
                   idempotencyKey: request.headers.get('idempotency-key') ?? undefined })
      return HttpResponse.json(
        await loadFixture('payment_intent.created', 'success'),
        { headers: { 'stripe-version': PINNED_API_VERSION } },
      )
    }),
    // Fault injection for the retry scenarios.
    http.post('https://api.stripe.com/v1/transfers', ({ request }) => {
      calls.push({ method: 'POST', path: '/v1/transfers',
                   idempotencyKey: request.headers.get('idempotency-key') ?? undefined })
      if (faults.current.transfers === 'timeout') return HttpResponse.error()
      return HttpResponse.json(loadFixture('transfer.created', 'success'))
    }),
  )

  return {
    server,
    calls,                       // assertions count Stripe calls, not our logs
    reset: () => { calls.length = 0; faults.current = {} },
    failNext: (endpoint: string, mode: 'timeout' | '402' | '500', times = 1) => { /* ... */ },
  }
}
```

Two rules:
1. **Pin `stripe.setApiVersion(...)` and assert it.** With Connect Accounts v2 in transition ([stack_report.md §1](../stack_report.md)), a silent SDK default bump would change fixture shapes under us. Assert the version string in a unit test.
2. **Recorder mode** (`STRIPE_RECORD=1` with a real test-mode key) writes new fixtures into `tests/fixtures/stripe/` for review before commit. Recorded, human-reviewed, version-controlled. That is the entire "VCR" story — we do not need a library.

### 5.6 Seeded, reproducible fixtures

```ts
// test/support/prng.ts — deterministic, fast, dependency-free.
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
```

```bash
pnpm db:seed --seed=quickdrop-ci-v1   # committed baseline, byte-identical every run
pnpm db:seed --seed=chaos            # pathological data: 8 couriers in one spot, 1 in another
```

A test that depends on random data is a test that will flake. Random data is a *fixture file*, generated once and committed.

---

## 6. E2E strategy for a 3-role app

### Personas

Four committed persona fixtures in `e2e/fixtures/personas.ts`, each with a committed `storageState` JSON generated by a `globalSetup` login step:

| Persona | Role | Used by |
|---|---|---|
| `customer.ok` | customer | golden path, cancellation |
| `customer.b` | customer | fairness check, second-customer fan-out |
| `courier.online` | courier, KYC complete, online, at zone centre | accept offer, pickup, deliver |
| `courier.far` | courier, 12 km away | offer-fairness and decline paths |
| `ops.admin` | ops | manual reassign, force-cancel, refund |

Password is a constant (`Str0ngTest!passphrase`) and every persona email is `@quickdrop.test` — a reserved TLD, so a stray production deploy can never be pointed at by a test.

### Auth state reuse

`storageState` is produced once in `globalSetup` and committed under `e2e/.auth/`. Re-login costs ~400 ms per test and hits Better Auth every time; reuse costs nothing and keeps the suite deterministic. Regenerate the files whenever the session cookie name or role claims change — a stale `storageState` failure is a confusing one, so the fixture builder asserts a `sessionVersion` marker inside each file.

### Data isolation and reset

- **Per-worker schema.** `DATABASE_URL=...?options=-csearch_path%3De2e_w%24{{test.workerIndex}}`. Each Playwright worker gets its own schema; migrations run once per schema in `globalSetup`. Four workers in parallel, zero interference.
- **Reset = per-test unique data, not truncation.** Truncating between tests serialises the suite and hides ordering bugs. Instead every test mints unique entity IDs (`shipment_${testInfo.testId}`) and a `globalTeardown` truncates once per run. Tests must therefore be order-independent, which is what we wanted anyway.
- **Time control per test.** `test.use({ clock: { installAt: new Date('2026-10-05T09:00:00Z') } })` — no wall-clock dependence, so a test run at 03:00 UTC behaves identically.
- **Explicitly serialised tests** (`test.describe.configure({ mode: 'serial' })`) are permitted only for the fan-out WebSocket scenario, which needs a stable shared world.

### The five journeys worth the flakiness cost

Everything else is covered faster and more reliably at L2/L3. Flakiness in E2E is a tax on every future engineer, so the list is deliberately short.

1. **E1 — Golden path (customer → courier → customer).** Customer books a delivery in-zone with a card; payment succeeds; a courier receives an offer and accepts; the customer watches live tracking; the courier marks picked up, then delivered; the customer sees delivered; the ledger shows a balanced capture. Assert at every step with `expect(...).toBeVisible()` on the specific status text, plus a final API assertion that the ledger balances. **This is the one test that must never flake and must never be skipped.**
2. **E2 — Cancelled mid-route.** Same as E1 through `picked_up`, then the customer cancels. Assert the courier's app transitions to "shipment cancelled", no further pickup/delivery buttons exist, and the refund appears in the ledger. Covers B-06 from the user's side.
3. **E3 — Delivery failed and redispatched.** Courier marks failed with a reason at the drop-off; ops reassigns; a second courier completes. Assert the customer was notified, the shipment is in exactly one consistent state, and there is exactly one capture and no double payout.
4. **E4 — Courier offline mid-route (iOS reality).** Install a scripted geolocation track, go offline for 3 minutes mid-route, come back, and assert the tracking path renders forward-only with no backtracking and the "connection lost" state appeared and cleared. This is the PWA constraint test and it is the one that catches B-11/B-12 regressions in the real client. [stack_report.md §2](../stack_report.md)
5. **E5 — Fan-out to many viewers.** Customer + ops + a second customer all watch one shipment live while the courier moves. Assert all three update within the 2 s interval. Cheap way to keep the WebSocket path honest without a full 500-client test.

Deliberately **not** E2E: signup/login permutations, form validation, address autocomplete, admin CRUD. Those are L2/L3 problems. Login *is* used as a setup step, never as an assertion.

### E2E hygiene rules

- No `waitForTimeout`. Wait on a condition (`expect(locator).toBeVisible()`, `page.waitForFunction`).
- No selectors on text that a copywriter might change. Add `data-testid` only for genuinely stable semantic anchors, and prefer role+accessible-name queries everywhere else — which incidentally keeps the app accessible.
- Trace on first retry, video on first retry. `--retries=1` locally, `0` in CI merge-gate (retries only in nightly, and a first-retry pass is reported as a failure metric).
- Budget: **< 6 minutes** for the full L5 suite. If it exceeds that, the suite is wrong, not the budget.

---

## 7. Load and performance testing

All load tests run against **staging seeded to production shape** (see [09](09-infrastructure-and-cost.md) §7). Thresholds are assertions in the k6 script, so a regression fails a CI gate rather than producing a report nobody reads.

### 7.1 Targets

| # | Scenario | Load shape | Pass/fail thresholds |
|---|---|---|---|
| **L1** | Booking: `POST /v1/shipments` (quote + payment intent + dispatch enqueue) | 5 min warm @ 5 rps → 10 min @ **20 rps sustained** → 60 s @ **50 rps peak** → 5 min @ 20 rps | p50 < 180 ms · **p95 < 400 ms** · p99 < 900 ms · HTTP error rate < 0.1% · **0 duplicate charges** (assert via the idempotency ledger) · 0 `shipment_stuck` beyond 30 s |
| **L2** | Tracking fan-out: 500 concurrent WebSocket viewers on **one** shipment, position published every **2 s** | 500 VUs connect in a 60 s ramp, then 15 min steady; 1 position/2 s from the courier | server-side fan-out latency (publish → last subscriber write) **p95 < 200 ms**, p99 < 500 ms · **0** subscribers dropped over the run · 0 duplicate frames per subscriber · heap growth < 200 MB per replica · subscriber ack p95 < 300 ms |
| **L3** | Position ingest: 200 couriers × 1 position per 2 s = **100 msg/s** sustained | 10 min steady, mixed accuracy/heading | ingest ack p95 < 150 ms, p99 < 300 ms · 0 out-of-order accepted · anomaly-rejection CPU < 5% of one core · Redis op rate < 5k/s |
| **L4** | Dispatch + worker throughput | Arrival rate tuned so each queue sits at 60% utilisation | `dispatch-offer` enqueue → offer issued **p95 < 5 s**, p99 < 15 s · `webhook-process` p95 < 2 s from delivery · `eta-recompute` throughput ≥ **50/s** · `payout-batch` of 200 shipments < 60 s · **oldest job age in every queue < 30 s** |
| **L5** | Read path with production volume | 100 rps mixed (tracking snapshot, shipment list, ops queries) against 500k shipments / 10k couriers | p95 < 250 ms · **PostGIS nearest-courier `ST_DWithin` query p95 < 50 ms** with a `GIST` index present · `/ops` filtered list p95 < 800 ms |
| **L6** | Soak / leak | 6 h at 20 rps with a steady 50 WS viewers | RSS growth < 10% between hour 1 and hour 6 · no WS reconnect churn (reconnects/hour < 1% of connections) · no BullMQ memory growth beyond BullMQ's `maxRetainedPerJob` budget |
| **L7** | Chaos under load (pre-release only) | L1 at 20 rps while: Redis paused 10 s → worker killed → Postgres failover | Booking error rate < 2% during the Redis pause (must degrade to Postgres-served reads) · **0** lost shipments · 0 unbalanced ledger rows after recovery · full recovery to baseline latency within 60 s |

### 7.2 Why these specific numbers

- **20 rps sustained / 50 rps peak** at 5k orders/month. 5k orders/month is roughly 170/day, ~7/hour average — so 20 rps is a ~10× headroom factor over the *average*, deliberately generous because a city launch is spiky (rain, lunch rush) and the failure mode we care about is a peak, not a mean. Revisit after the seeded beta with real arrival curves.
- **500 viewers on one shipment** is the viral-failure case: a promotion or a news story drives everyone to watch one parcel. Per-connection cost is the thing to prove early — a naive fan-out that serialises writes will collapse here while looking perfectly healthy at 10 viewers.
- **p95 < 200 ms server-side against a 2 s update interval** leaves a 10× margin so that even a bad client network never sees updates arriving out of order or batched. The user-visible target derived from this is: **position-to-viewer latency p95 < 1.5 s**.
- **Oldest-job age < 30 s** is the metric that matters more than throughput. A queue can have excellent throughput and a terrible tail latency; a 5-minute-old offer is a lost customer.

### 7.3 What k6 cannot tell you

k6 does not render a browser, so it will never catch a MapLibre paint regression or an iOS service-worker eviction bug. L6's leak numbers are also weak — a JS heap snapshot over 6 h via the metrics endpoint is a better signal than k6's. Budget a real-device manual lane for visual and PWA-lifecycle checks, and treat `docs/11-launch-playbook.md`'s beta cohort as the only trustworthy answer for "does tracking feel real".

---

## 8. CI gating policy

```
                       ┌── merge-blocking ──┐   ┌───── nightly ─────┐   ┌─ pre-release ─┐
lint + typecheck         ███
unit (L1)               ███
component (L2)          ███
integration (L3)        ███            ███ (full, 3× repeat)
contract (L4)           ███
migration drift check   ███
build (next + api)      ███
E2E smoke (E1 + E2)     ███            ███
E2E full (E1–E5)                        ███  ███
E2E on WebKit/mobile                    ███
load smoke (2 min)                       ███            ███ (L1+L2)
full load + chaos                                      ███ (L1–L7)
chaos                                                       ███
security scan           ███            ███               ███
restore drill                           ███ (monthly)
```

### Blocks a merge (required, all green, < 15 min total)

1. `pnpm lint` — ESLint, `import/no-cycle` across `packages/core`, no `ts-ignore` without a comment.
2. `pnpm typecheck` — `tsc --noEmit` on all packages, TS 7 strict.
3. `pnpm test:unit` — L1. Coverage gate on `packages/ledger` = 100%, `packages/core` ≥ 95%.
4. `pnpm test:component` — L2.
5. `pnpm test:integration` — L3, real Postgres+PostGIS and Redis via Testcontainers. Includes **all** money-core tests B-02, B-03, B-07, B-08 with no `.skip`.
6. `pnpm test:contract` — L4.
7. `pnpm db:check` — `drizzle-kit check` plus: generated migrations match the schema, and **every** new migration passes the zero-downtime linter from [09](09-infrastructure-and-cost.md) §6 (no `DROP COLUMN`/`DROP TABLE`/`ALTER TYPE` in the same deploy as a code change that still references it). A red flag here is a rollback, not a bypass.
8. `pnpm build` — `next build` (three surfaces) and the Hono/worker bundle. Fails on type errors leaking through.
9. `pnpm test:e2e:smoke` — E1 and E2 against a throwaway preview environment.
10. `pnpm audit --omit=dev --audit-level=high` + `gitleaks detect` + CodeQL on `packages/api`.

### Nightly (main branch, ~60 min, does not block merges)

- L1–L4 with `--repeat-each=3` to surface flake.
- Full E2E (E1–E5) on Chromium, WebKit, and a mobile Pixel 7 profile, with `--retries=2` and a **first-retry-pass reported as a failure metric**. WebKit is non-negotiable: it is our worst-supported and most-used client.
- Load smoke: L1 at 20 rps for 3 min + L2 at 200 viewers for 3 min. Catches regressions a 5-person smoke test cannot.
- Chaos: Redis pause, worker kill, Postgres connection-limit exhaustion. Assert 0 lost shipments, 0 unbalanced ledger rows.
- Full dependency audit + licence review + secret scan across the whole history.
- Restore drill on the staging volume: prove `pg_dump`/`pg_restore` and record the elapsed time (feeds the RTO in [09](09-infrastructure-and-cost.md) §8).
- Seed-freshness check: does `pnpm db:seed --seed=quickdrop-ci-v1` still produce byte-identical output? If not, someone changed a generator and every recorded test result is now suspect.

### Pre-release (before each phased rollout, per [11](11-launch-playbook.md))

- Full load suite L1–L6 against production-shaped staging, with results attached to the go/no-go ticket.
- L7 chaos with a Postgres PITR restore timed end to end.
- Full E2E on physical iOS (current + previous major) and Android, manual, scripted.
- Migration rehearsal: apply the release's migrations to a **production-sized clone**, then run the expand/contract sequence and verify the contract step is safe with the previous release still live. This is the only way to know the migration is genuinely zero-downtime.
- Accessibility audit (axe on the golden path) and a manual screen-reader smoke on the customer booking flow.
- 3-day soak at expected peak, twice the expected peak, and twice-expected-peak with a Redis kill in the middle.
- Reconciliation: Stripe balance transactions vs. our ledger for the full test period, difference must be exactly zero. This is the same query that runs in production ([03-data-model.md §4.4 Money](03-data-model.md#44-money)); if it does not pass on test data it will not pass on real money.

### Policy on flakiness and bypasses

- No `skip` without a linked issue and an owner. No `only` — ever; CI rejects the string `.only(` in a diff.
- A quarantined test is tracked in `docs/08-testing-strategy.md`'s companion issue and reviewed weekly.
- **Test deletions in a money or dispatch path require a second engineer's approval in the PR description.** Deleting a test that guards money is a design decision, not a chore.
- Coverage may not decrease on `main`; the gate fails on regression, not on an absolute number, so legitimate deletions are still a conversation.

---

## 9. Definition of Done, per iteration

An iteration is not done until:

- [ ] Every state-machine edge introduced in that iteration has a test.
- [ ] Every idempotency-keyed write introduced has a "called twice" test.
- [ ] Every new third-party integration has a recorded fixture and a fault-injection test (timeout and 4xx).
- [ ] Every new BullMQ job has a retry-safety test that kills the worker mid-job.
- [ ] L1–L4 green in CI, and E2E green on Chromium **and** WebKit.
- [ ] Load thresholds re-measured if this iteration touched the hot path.
- [ ] Anything deliberately untested is written down in the PR with a reason.

---

## 10. Known gaps and open questions

| Gap | Why it is open | Plan |
|---|---|---|
| iOS background-tracking acceptance criteria | iOS gives no guarantee of position updates when a PWA is backgrounded ([stack_report.md §2](../stack_report.md)). We can test our *handling* of gaps (B-12) but not the platform's behaviour. | Field-measure on real devices in iteration 1 with the internal cohort; record the observed update interval distribution and set the product promise from data, not from the spec. Tracked in [10](10-risk-register.md) R-02 |
| Real WebKit WebSocket behaviour under aggressive SW termination | Playwright's WebKit is close to, but not, Safari on device. | Manual lane on physical iOS in the pre-release matrix; treat it as the source of truth and E2E as the regression guard |
| Load numbers are derived from an assumed arrival curve, not a measured one | We have no production traffic yet | Re-baseline L1/L2 after the seeded beta with real curves; keep the 10× headroom factor until month 6 |
| Third-party routing engine quality | OSRM vs. Valhalla vs. GraphHopper is not decided ([stack_report.md](../stack_report.md)) | Wrap behind the `RouteEngine` port precisely so the choice stays swappable and its responses are recordable |
| Stripe Connect Accounts v2 shape under test | Accounts v2 is in transition ([stack_report.md §1](../stack_report.md)) | Pin the API version, assert it in a test (B-09), keep all fixtures version-tagged so a future bump is a reviewable diff, not a rewrite |
| Contribution margin per delivery | Cannot be tested, only measured | [09](09-infrastructure-and-cost.md) §10 defines the per-order variable cost; track it as a launch metric in [11](11-launch-playbook.md) |

---

## 11. Sources

- [Vitest](https://vitest.dev/) · [Vitest fake timers](https://vitest.dev/guide/clock.html) · [Vitest coverage](https://vitest.dev/guide/coverage.html)
- [Playwright](https://playwright.dev/) · [Playwright clock API](https://playwright.dev/docs/api/class-clock) · [Playwright network](https://playwright.dev/docs/network) · [Playwright authentication state](https://playwright.dev/docs/auth)
- [Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Testcontainers for Node](https://node.testcontainers.org/) · [BullMQ](https://docs.bullmq.io/) · [Redis eviction policy and BullMQ](https://docs.bullmq.io/guide/going-redis)
- [MSW](https://mswjs.io/) · [Stripe idempotent requests](https://docs.stripe.com/api/idempotent_requests) · [Stripe webhook signature verification](https://docs.stripe.com/webhooks/signature)
- [k6 documentation](https://k6.io/docs/) · [k6 WebSockets](https://k6.io/docs/javascript/examples/k6-ws/)
- [PostGIS `ST_DWithin`](https://postgis.net/docs/ST_DWithin.html) · [PostGIS spatial indexes](https://postgis.net/workshops/postgis-intro/indexing.html)
- [Drizzle ORM](https://orm.drizzle.team/) · [Drizzle Kit migrations](https://orm.drizzle.team/docs/kit-overview)
- [Web Geolocation API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API) · [iOS service worker lifecycle](https://webkit.org/blog/8090/workers-at-your-service/) · [Background Sync support](https://caniuse.com/background-sync)