# 11 — Launch Playbook

Status: pre-implementation, planning only. Every checkbox below is an **unmet** commitment, and every command is a specification to be created.
Owner: F (go/no-go authority). ENG-A holds the technical gates.
Sibling docs: [00-product-brief.md](00-product-brief.md) · [01-tech-stack.md](01-tech-stack.md) · [02-architecture.md](02-architecture.md) · [03-data-model.md](03-data-model.md) · [04-api-contract.md](04-api-contract.md) · [05-realtime-and-tracking.md](05-realtime-and-tracking.md) · [06-frontend-architecture.md](06-frontend-architecture.md) · [07-roadmap.md](07-roadmap.md) · [DECISIONS.md](DECISIONS.md) · [docs index](README.md)
Operational set: [08-testing-strategy.md](08-testing-strategy.md) · [09-infrastructure-and-cost.md](09-infrastructure-and-cost.md) · [10-risk-register.md](10-risk-register.md) · [11-launch-playbook.md](11-launch-playbook.md)

**Reading rule:** an item is checked only with **evidence** — a URL to a CI run, a query output, a screenshot of a dashboard, or a document. "Looks fine" is not evidence. An item that cannot be verified objectively does not belong on this list.

---

## 1. Go/no-go checklist

**Gates.** Areas **A–D** and **E (legal)** are hard gates: any unchecked item blocks the public launch. **F–H** may be waived only by F, in writing, with a stated compensating control and an expiry date.

### A. Functionality

- [ ] **F-01** Golden-path E2E (customer books → courier accepts → live tracking → delivered → ledger balances) passes on Chromium **and** WebKit for **30 consecutive CI runs** with zero retries used.
- [ ] **F-02** Cancelled-mid-route E2E passes on Chromium and WebKit for 30 consecutive runs.
- [ ] **F-03** Delivery-failed-and-redispatched E2E passes on Chromium and WebKit.
- [ ] **F-04** Physical-device manual test passed on the current and previous major iOS Safari, and on Chrome for Android — signed off by ENG-B with date and device model recorded.
- [ ] **F-05** Shipment state machine: all 64 `(from, to)` pairs covered; every illegal pair returns `409 ILLEGAL_TRANSITION` and changes no row. Verified by the exhaustive transition test ([08](08-testing-strategy.md) B-04).
- [ ] **F-06** `SELECT count(*) FROM shipments WHERE status='assigned' AND courier_id IS NULL` returns 0.
- [ ] **F-07** Every `assigned` shipment has a non-null `assigned_at` and an `assigned` event row.
- [ ] **F-08** `dispatch_mode=manual` fallback works end to end: ops can assign a courier by hand from the ops queue view and the customer sees the assignment. Demonstrated live, not in a test.
- [ ] **F-09** `dispatch_mode=auto` can be switched on and off at runtime without a deploy, and the switch is recorded in the ops audit log.
- [ ] **F-10** Zone gating works: setting a zone to closed makes new bookings in that zone return `409 ZONE_CLOSED`, and existing shipments continue to completion.
- [ ] **F-11** Tracking degrades correctly with no service worker: first load shows a clear offline banner; the app recovers on reconnect without a hard refresh.
- [ ] **F-12** The service worker installs, activates, and serves the app shell offline. Verified by loading the app in airplane mode on a real device.
- [ ] **F-13** Web App Manifest passes Lighthouse PWA checks: `name`, `short_name`, `start_url`, `display: standalone`, `scope`, `theme_color`, `background_color`, icons including at least one maskable. [MDN manifest reference](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [ ] **F-14** iOS Add-to-Home-Screen instructions are shown in the courier app, and iOS is never asked to fire `beforeinstallprompt` (unsupported; the code does not reference it).
- [ ] **F-15** Courier app resumes correctly after being killed and relaunched mid-route, and re-sends queued positions without duplication ([08](08-testing-strategy.md) B-11.4).
- [ ] **F-16** Courier backgrounded for 5 minutes produces the explicit "keep QuickDrop open" state, and returning to the app re-establishes tracking without a user action.
- [ ] **F-17** Customer sees `etaConfidence` and never a frozen countdown when the courier goes offline ([08](08-testing-strategy.md) B-12).
- [ ] **F-18** Address autocomplete resolves real addresses in the launch city and rejects out-of-zone addresses with a clear message.
- [ ] **F-19** Drop-off address is **not** returned to the assigned courier before `picked_up` is confirmed. Verified by an integration test and by a manual API check.
- [ ] **F-20** Notification delivery works for the supported matrix: iOS 16.4+ installed PWA (Web Push), Chrome Android, desktop. Older iOS falls back to in-app banner and is documented as such.
- [ ] **F-21** Courier acceptance declines (offer expiry, withdrawal, and out-of-service) all produce a clear, actionable UI state, not a spinner.
- [ ] **F-22** Time zone, currency, and locale formatting are correct for the launch city for both customers and couriers.
- [ ] **F-23** Empty states exist for every list and map surface: no shipment yet, no courier online, no delivery history, no completed payout.
- [ ] **F-24** All three surfaces (`/customer`, `/courier`, `/ops`) return HTTP 200 and pass an accessibility check (axe) on the golden path, and the customer booking flow passes a manual screen-reader smoke.

### B. Payments and money

- [ ] **M-01** All amounts are stored and computed in **integer minor units**. A repository-wide scan finds zero floating-point literals in money code paths. Verified by `rg -n "\d+\.\d+" packages/money packages/ledger` returning nothing relevant, reviewed by ENG-A.
- [ ] **M-02** Ledger balance sweep returns zero rows over the entire production ledger: the nightly job in [09](09-infrastructure-and-cost.md) §9.1 has run at least 7 consecutive nights with zero unbalanced transactions.
- [ ] **M-03** The database rejects an unbalanced transaction. Demonstrated live in a staging shell: an intentional 1-cent imbalance raises `23514` at commit.
- [ ] **M-04** `UPDATE` and `DELETE` on `ledger_entries` both raise `42501`. Demonstrated live in staging.
- [ ] **M-05** Reversal entries correct mistakes without mutating history; demonstrated end to end on a test order.
- [ ] **M-06** Every money write carries an idempotency key, and every such path has a "called twice" test in CI.
- [ ] **M-07** Reusing an idempotency key with a **different** payload returns `422 IDEMPOTENCY_KEY_REUSED` (not a silent replay).
- [ ] **M-08** Charge retry under a simulated Stripe 502 results in exactly **one** charge. Verified from Stripe's dashboard for the test order, not from our logs.
- [ ] **M-09** Payment failure produces no shipment in `booked`; the customer sees a recoverable error and can retry without a duplicate shipment.
- [ ] **M-10** Refund of a delivered shipment produces a balanced reversing ledger transaction exactly once.
- [ ] **M-11** Refund above the captured amount returns `422 REFUND_EXCEEDS_CHARGE` and makes no Stripe call.
- [ ] **M-12** Payout batch totals equal the sum of per-shipment courier net, in integer minor units, with rounding applied exactly once at the payout level ([08](08-testing-strategy.md) B-03.7).
- [ ] **M-13** Running a payout batch twice creates one payout and one Stripe transfer.
- [ ] **M-14** A shipment left un-paid-out by a crashed batch is picked up by the next batch; cumulative payouts across two batches equal a single batch of all shipments.
- [ ] **M-15** Double-dispatch protection: 200 concurrent accept races produce exactly one assignment, one capture, and one `assigned` event ([08](08-testing-strategy.md) B-01).
- [ ] **M-16** Cancel-versus-pickup race: 200 randomised runs end in exactly one consistent state, with money consistent with the outcome ([08](08-testing-strategy.md) B-06).
- [ ] **M-17** Stripe API version is pinned in code and asserted by a unit test. Accounts v2 compatibility documented ([10-risk-register.md](10-risk-register.md) R-07).
- [ ] **M-18** Webhook replay: the same event delivered four times produces one ledger effect; a tampered body returns `400`; an unknown event type returns `200` and logs.
- [ ] **M-19** Three-way reconciliation job (ledger vs. Stripe balance transactions vs. payout schedule) runs on schedule and reports a **number**. Delta equals zero for 7 consecutive days.
- [ ] **M-20** Courier payouts are blocked until `charges_enabled` **and** `payouts_enabled` are both true, enforced in the API and covered by a test.
- [ ] **M-21** Refund authority matrix is written, agreed, and configured in the ops tooling (§5.4).
- [ ] **M-22** Contribution margin per order is computed and displayed, and equals the independently calculated figure for 10 real orders.
- [ ] **M-23** Stripe Radar fraud rules are configured (velocity on charge attempts per account and per device) and tested against 5 synthetic card-testing patterns.
- [ ] **M-24** Disconnect and dispute handling tested: a `$15` dispute-received fee path is understood, and the dispute response deadline is in the ops runbook.
- [ ] **M-25** Refund rate and per-account refund rate are monitored with alerts wired and fired once in a test.

### C. Reliability

- [ ] **R-01** Staging is seeded to production shape and the full load suite L1–L6 passes with thresholds from [08](08-testing-strategy.md) §7.
- [ ] **R-02** Booking p95 < 400 ms at 20 req/s sustained for 10 minutes and 50 req/s for 60 s, with error rate < 0.1% and zero duplicate charges.
- [ ] **R-03** Tracking fan-out: 500 concurrent viewers on one shipment at a 2 s update interval, server-side fan-out p95 < 200 ms, zero subscribers dropped.
- [ ] **R-04** Worker oldest-job-age stays under 30 s under the L4 mixed-load profile.
- [ ] **R-05** Chaos test L7 passed: Redis paused 10 s, worker killed mid-job, and a Postgres failover, with booking error rate < 2%, zero lost shipments, zero unbalanced ledger rows, and full recovery within 60 s.
- [ ] **R-06** 6-hour soak shows RSS growth < 10% and no WebSocket reconnect churn.
- [ ] **R-07** Railway production project has **at least 5 retained deployments** so rollback is a redeploy, not a rebuild.
- [ ] **R-08** Railway workspace has a soft usage alert at expected spend and a hard limit at 5× — with headroom above legitimate growth confirmed, because a hard limit takes all workloads offline.
- [ ] **R-09** Railway per-service replica limits are set so one runaway service cannot consume the whole budget.
- [ ] **R-10** Rollback rehearsed: a deliberately bad deploy was rolled back to the previous deployment in under 5 minutes, measured.
- [ ] **R-11** PITR enabled and healthy for **at least 14 days before launch**, with a confirmed restore window of at least 7 days (`railway postgres pitr status` output attached).
- [ ] **R-12** Restore drill completed and timed within the last 30 days, with the elapsed time recorded and compared against the 30 min RTO ([09](09-infrastructure-and-cost.md) §8.3).
- [ ] **R-13** Nightly logical dump has run for 7 consecutive nights to a bucket in a **different provider**, and one dump has been restored to an engineer's laptop successfully.
- [ ] **R-14** Deploy pipeline: a full deploy from merge to production completed in under 20 minutes, with the expand/contract separation verified.
- [ ] **R-15** Zero-downtime migration rehearsal against a production-sized clone: the release's migrations applied, then verified safe with the previous release still serving ([09](09-infrastructure-and-cost.md) §6.4).
- [ ] **R-16** `FAULT_INJECTION` is unset in production and the app **throws on boot** if it is set to `1` with `NODE_ENV=production`. Verified by attempting a production deploy with it set and confirming the failure.
- [ ] **R-17** Redis in every environment runs `maxmemory-policy noeviction`, asserted by a boot check. [BullMQ requirement](https://docs.bullmq.io/guide/going-redis)
- [ ] **R-18** Graceful degradation verified: with Redis down, reads still serve from Postgres and booking still succeeds; only position ingest returns `503`.
- [ ] **R-19** Reconnect storm handled: 500 clients reconnecting simultaneously produces error rate < 0.5% and full recovery.
- [ ] **R-20** A runbook exists per alert in the alerting config, and every alert has a runbook URL in its annotations. An alert without a runbook link was removed rather than shipped.

### D. Security and privacy

- [ ] **S-01** Roles enforced server-side on every route; the enumerated route-permission test passes and no mutating route is missing a role check ([08](08-testing-strategy.md) B-14).
- [ ] **S-02** A courier cannot read another courier's shipments — returns `404`, not `403`, for non-existent shipments.
- [ ] **S-03** A customer cannot read or mutate another customer's shipments.
- [ ] **S-04** Every ops read of PII writes an audit-log row, verified by a query returning the expected count.
- [ ] **S-05** Session revocation works: changing a courier's status invalidates their active sessions within 60 s.
- [ ] **S-06** Auth rate limiting and lockout are configured and verified by observing lockout after repeated failures.
- [ ] **S-07** `pnpm audit --omit=dev --audit-level=high` is clean; CodeQL has run on `packages/api` with zero high-severity findings; `gitleaks` is clean over full history.
- [ ] **S-08** No secret is present in any built image, `NEXT_PUBLIC_*` variable, log line, or Sentry event. Verified by inspecting a production log sample and a Sentry event.
- [ ] **S-09** PII scrubber is unit-tested against addresses, phone numbers, coordinates, names, and card references in both log output and analytics events.
- [ ] **S-10** No PII is sent to product analytics. Verified by inspecting a PostHog event payload.
- [ ] **S-11** TLS enforced with HSTS; cookies are `HttpOnly`, `Secure`, `SameSite=Lax`; the WebSocket uses a short-lived, scoped token, not the session cookie.
- [ ] **S-12** Webhook endpoints verify the **raw** body signature with a timestamp tolerance, verified by a future-timestamp rejection test.
- [ ] **S-13** GPS plausibility validation is live with anomaly scoring, and a spoofed position was rejected in a staging test with the flag raised.
- [ ] **S-14** Retention jobs are running and enforced: courier location > 90 days deleted, customer addresses > 24 months redacted, logs > 30 days removed. Verified by querying for rows outside the window.
- [ ] **S-15** Database access is read-only by default per person, with write access granted per incident and logged.
- [ ] **S-16** The full-history secret scan is clean and CI blocks on new secrets.
- [ ] **S-17** Security headers present: `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` (with geolocation explicitly allowed only where needed), `X-Frame-Options`.
- [ ] **S-18** Dependency licences reviewed and no copyleft or unknown licence is present in shipped dependencies.
- [ ] **S-19** Load-balancer and platform admin surfaces are not publicly reachable, or are IP-restricted and behind authentication.

### E. Legal and compliance

- [ ] **L-01** Written jurisdiction-specific advice received on courier classification, covering employment tests, payroll exposure, and record-keeping obligations.
- [ ] **L-02** Courier agreement written, version-controlled, and accepted in-app with a timestamp and IP record before the courier's first delivery.
- [ ] **L-03** Terms of service published, versioned, and accepted by every customer and courier.
- [ ] **L-04** Privacy policy published, accurately describing what we store, for how long, and who it is shared with — including the retention schedule in §D-14 and the ledger/PII separation.
- [ ] **L-05** Data-subject deletion process implemented and tested end to end on a test account, including the ledger-tombstone behaviour ([10-risk-register.md](10-risk-register.md) R-24).
- [ ] **L-06** Parcel-loss and liability terms published, with insurance in place at a level matched to the parcel value ceiling.
- [ ] **L-07** Any required business, courier, or delivery licensing identified and obtained for the launch jurisdiction, or a written determination that none applies.
- [ ] **L-08** Tax treatment of courier payments confirmed, including any withholding, VAT/sales tax on the delivery service, and invoicing requirements for couriers.
- [ ] **L-09** Stripe Connect is configured in the correct mode for our flow (separate charges and transfers), with platform fee handling verified in Stripe's dashboard.
- [ ] **L-10** A cancellation and delay policy is published with clear fee consequences, written so support can apply it without judgement calls.
- [ ] **L-11** Anti-discrimination and accessibility statement published.
- [ ] **L-12** Breach-notification procedure documented, with a named decision-maker and a template ready. If GDPR-style rules apply, the 72-hour clock is explicitly owned.

### F. Operations and support

- [ ] **O-01** Courier recruitment at **60+ couriers in the launch zone**, of whom at least 45 have `payouts_enabled = true`.
- [ ] **O-02** Courier onboarding is a documented, tested flow, completed end to end by a real person who has never seen the platform.
- [ ] **O-03** Measured median courier KYC lead time recorded and the recruitment plan adjusted to match ([10-risk-register.md](10-risk-register.md) R-03).
- [ ] **O-04** Courier support channel tested: in-app contact reaches a human within the stated SLA.
- [ ] **O-05** Customer support channel tested: in-app support, with ticket creation, assignment, and reply all working.
- [ ] **O-06** Status page is public, with components matching real services, and the incident workflow has been rehearsed once.
- [ ] **O-07** Refund authority matrix configured and a support agent has executed a refund within their authority unaided.
- [ ] **O-08** Ops dashboard reviewed daily during the beta and every panel has been read at least once by each ops person.
- [ ] **O-09** Runbooks exist and have been walked through by someone who did not write them, for: courier not arriving, stuck shipment, payment stuck, ledger imbalance, Stripe outage, Redis outage, database failover, runaway cost.
- [ ] **O-10** Support tooling covers: ticket list with SLA timers, refund action, shipment search, force-assign, force-cancel, courier search with anomaly flags.
- [ ] **O-11** Escalation contacts recorded outside the codebase: Railway support, Stripe support, SMS provider support, DNS registrar.
- [ ] **O-12** Courier safety policy published: couriers must not be asked to enter private property, and the platform mediates all contact with the customer.
- [ ] **O-13** Incident communication templates written and pre-approved (§4.3).
- [ ] **O-14** On-call rotation published with names, dates, and contact numbers, covering at least the first 6 weeks post-launch.
- [ ] **O-15** Every exception category observed during the beta has either a self-serve flow or a documented support script.

### G. Observability

- [ ] **V-01** Structured JSON logs with `X-Request-Id` propagation through web → API → queue → worker → Stripe. Verified by grepping a single request ID across all surfaces.
- [ ] **V-02** Log retention is at least 30 days in the shipped system (not just Railway's 7-day history).
- [ ] **V-03** Sentry is connected for web, API, and worker, with release tags matching git SHAs and source maps uploaded.
- [ ] **V-04** Six dashboards exist and are populated: Golden signals, Delivery operations, Courier health, Money, Realtime, Support (§[09](09-infrastructure-and-cost.md) §9.2).
- [ ] **V-05** **All required alerts are live and each has been fired deliberately at least once** to confirm routing and that someone responded: shipment stuck in `assigned` > 30 min; no couriers available for a zone; tracking staleness rate; payment failure rate spike; ledger imbalance; Stripe reconciliation drift; WebSocket connection count; worker queue depth; API down; latency budget burned.
- [ ] **V-06** Alert routing is verified end to end: SEV1 pages a phone at 3 a.m. and a human acknowledges within the stated window.
- [ ] **V-07** Metrics cardinality is audited: no user, shipment, or error-message label.
- [ ] **V-08** Courier-device heartbeat monitoring is live, including the synthetic iOS probe, with an observed update-interval distribution recorded as a baseline.
- [ ] **V-09** `courier_stale_share` and `display-mode: standalone` share are on the daily review.
- [ ] **V-10** Product analytics events fire once each in staging, with payloads confirmed PII-free.
- [ ] **V-11** Tracing samples a booking end to end across web, API, Postgres, Stripe, and queue.
- [ ] **V-12** Synthetic uptime checks run from 3 regions at 60 s and have a 30-day history.

### H. Performance and capacity

- [ ] **P-01** PostGIS nearest-courier query p95 < 50 ms against 10,000 couriers with the `GIST` index present, confirmed by `EXPLAIN (ANALYZE, BUFFERS)` showing the index used.
- [ ] **P-02** `/ops` filtered shipment list p95 < 800 ms against 500,000 shipments.
- [ ] **P-03** Two web/API replicas confirmed active in production, and a deploy to one replica does not drop WebSocket connections for the other.
- [ ] **P-04** Position ingest p95 < 150 ms at 100 msg/s sustained for 10 minutes with zero out-of-order points accepted.
- [ ] **P-05** ETA recompute throughput ≥ 50/s sustained.
- [ ] **P-06** Memory per API replica under load is recorded, with headroom to the replica limit documented.
- [ ] **P-07** Cold-start time of a worker process recorded; no in-flight job is lost on worker restart.
- [ ] **P-08** Front-page Largest Contentful Paint < 2.5 s on a mid-tier Android device over 4G, measured on the customer booking surface.
- [ ] **P-09** App shell cached by the service worker loads in under 2 s on repeat visits over 4G.
- [ ] **P-10** Courier app position-reporting battery impact measured over a full shift and acceptable to a real courier.

---

## 2. Phased rollout

Each phase has explicit entry criteria, cohort, duration, success metrics with thresholds, exit and rollback criteria, and what is switched off. **A phase only starts when the previous phase's exit criteria are met in full.**

### Phase 0 — Internal dogfood

| | |
|---|---|
| **Cohort** | 2–5 engineers, F, and up to 10 friends and family acting as couriers. Real people, real parcels, one zone |
| **Duration** | 10 working days minimum, extendable |
| **Environment** | Production deployment, **Stripe test mode**, real couriers physically moving |
| **Entry criteria** | All areas **A, B, C** of §1 green · E1 and E2 E2E green on Chromium and WebKit for 30 consecutive runs · Chaos L7 passed · PITR enabled with a 7-day restore window · On-call and escalation contacts published |
| **Success metrics** | ≥ 200 completed internal deliveries · delivery success rate ≥ 95% · median time-to-assign ≤ 5 min · **zero SEV1 and zero SEV2** · ledger imbalance: zero, all 10 nights · zero double payouts · `courier_stale_share` < 25% · ≥ 5 real couriers reporting tracking works acceptably in the foreground |
| **Exit criteria** | All success metrics met for 10 consecutive days · every SEV2 has a merged fix and a written post-mortem · support scripts written for every exception seen · iOS field measurement complete ([10-risk-register.md](10-risk-register.md) R-02) |
| **Rollback criteria** | Any money error, any SEV1, or ledger imbalance — stop, do not proceed until resolved |
| **Disabled** | Real money (Stripe test mode) · public marketing · public signup (invite-only) · surge pricing · multi-stop · ratings · native app |

### Phase 1 — Seeded beta

| | |
|---|---|
| **Cohort** | **20 couriers** and **50 customers**, one zone of 3–5 km². Invite-only |
| **Duration** | 3 weeks |
| **Environment** | Production deployment, **Stripe live mode with real money**, capped volume |
| **Entry criteria** | Phase 0 exit criteria met in full · ≥ 45 couriers `payouts_enabled` · areas **D, E** of §1 green · refund authority matrix configured and exercised · status page live |
| **Daily cap** | 25 bookings/day, hard-capped by a flag, to bound blast radius |
| **Success metrics** | median time-to-assign ≤ 8 min, p90 ≤ 20 min · delivery success ≥ 90% · offer acceptance ≥ 50% · **AOV ≥ $12.00** · **contribution margin ≥ $1.50/order** · courier week-4 retention ≥ 70% · support tickets ≤ 15 per 100 deliveries · **ledger imbalance zero, all 21 nights** · zero double payouts · zero SEV1 · ≤ 2 SEV2, each with a post-mortem · `courier_stale_share` < 20% |
| **Exit criteria** | Every success metric met for 14 consecutive days · ≥ 300 completed deliveries · at least 3 consecutive weeks of positive contribution · all three Critical risks in [10](10-risk-register.md) either closed or explicitly accepted in writing by F · 2 full restore-drill cycles completed since Phase 0 |
| **Rollback criteria** | Contribution margin < $0 for 5 consecutive days · delivery success < 80% for 3 days · ledger imbalance of any size · 2 or more SEV1 in a week · courier retention < 50% at week 3 · KYC lead time making supply growth impossible |
| **Disabled** | Public marketing · open signup · surge pricing · multi-stop · ratings and reviews · scheduled deliveries · third-party API · any city other than the launch zone |

### Phase 2 — City-limited public launch

| | |
|---|---|
| **Cohort** | Open to the public **within the launch zone**. Courier recruitment continues; target 200 couriers |
| **Duration** | 4 weeks of elevated attention, then steady state |
| **Environment** | Production, real money, marketing enabled |
| **Entry criteria** | Phase 1 exit criteria met in full · all of §1 green, or waived in writing by F with a compensating control and an expiry date · customer support staffed with named cover for every day of the first 2 weeks · marketing spend staged so week 1 is limited |
| **Success metrics** | ≥ 2,000 orders in month 1 · contribution margin ≥ $2.00/order · median time-to-assign ≤ 10 min · delivery success ≥ 92% · cancellation rate < 12% · refund rate < 8% · courier retention (8-week) ≥ 60% · `courier_stale_share` < 15% · NPS ≥ 40 (sample ≥ 100 responses) · zero SEV1 · ≤ 3 SEV2/month · Railway spend within 20% of the model ([09](09-infrastructure-and-cost.md) §10.3) |
| **Exit criteria** | 4 consecutive weeks meeting all metrics · on-call rotation sustainable for 8 weeks · a second restore drill completed against production-shaped data |
| **Rollback criteria** | Same as Phase 1, plus: contribution margin negative for 3 consecutive days · any data breach · tracking unavailable for > 30 min at p95 for 3 consecutive days |
| **Disabled** | Cities other than the launch zone · multi-stop · surge pricing · ratings · third-party API |

### Phase 3 — Expansion

| | |
|---|---|
| **Cohort** | Additional zones within the city, then additional cities |
| **Duration** | Zone by zone, two weeks of elevated attention each; a new city is a new phase, not a continuation |
| **Entry criteria** | Phase 2 steady state for 8 weeks · contribution margin positive for 3 consecutive months · density proven (≥ 30 active couriers per zone at < 10 min median time-to-assign) · a **fresh legal review for the new jurisdiction** ([10](10-risk-register.md) R-04, R-11) |
| **Success metrics** | New zone reaches 30 active couriers within 6 weeks · new-zone delivery success ≥ 88% within 4 weeks · city-level contribution margin ≥ $2.00/order by month 3 |
| **Disabled** | Always: international expansion, until a new legal and payments analysis is complete |
| **Note** | Multi-region and provider redundancy ([09](09-infrastructure-and-cost.md) §8.2, R-16) become affordable and are recommended at this phase |

---

## 3. Rollback plan

### 3.1 What can be rolled back, and how fast

| Layer | Mechanism | Target time-to-rollback | Notes |
|---|---|---|---|
| **Feature flag** | `flag_*` toggled in the ops admin, applied at request time | **< 2 min** | The primary and preferred response. Must not require a deploy |
| **Config** | Railway environment variable + redeploy | **< 5 min** | For anything that must be environment-specific (Stripe mode, zone gates, radius) |
| **Application code** | Redeploy the previous Railway deployment | **< 5 min** | Requires ≥ 5 retained deployments (checklist R-07). Verified in a rehearsal (R-10) |
| **Bookings** | `flag_new_booking` = off, optionally per zone | **< 2 min** | Stops new demand without stopping in-flight deliveries |
| **Charges** | `flag_payments_paused` = on: no new PaymentIntents created; existing authorised charges settle normally; a background job releases orphaned authorisations after 7 days | **< 5 min** | Never a blanket "stop Stripe". Existing customer money is unaffected |
| **Payouts** | `flag_payouts_manual_only` = on: batches queue for human approval | **< 2 min** | The right lever for anything money-suspicious. **This is the single most important money kill switch** |
| **Dispatch** | `flag_dispatch_mode` = manual; ops assigns by hand | **< 2 min** | Turns an algorithm bug into a staffing problem |
| **Tracking** | `flag_tracking_live` = off; UI falls back to status updates and manual ETA messaging | **< 2 min** | Honest degradation rather than a wrong map |
| **Whole service** | Scale to zero replicas, keep DB and Redis up | **< 3 min** | Only for a SEV1 total outage |
| **Database** | PITR restore to a new service, then connection-string cutover | **≤ 30 min** | Last resort. Expand migrations are left in place because they are backward-compatible |
| **A bad migration** | Roll back **code**, ship a forward-fix migration | minutes to hours | Prod migrations are forward-only by rule ([09](09-infrastructure-and-cost.md) §6.2) |

### 3.2 Emergency rollback triggers

Any **one** of these is sufficient. No debate, no diagnosis first — roll back, then investigate.

1. Any money is wrong: double charge, double payout, capture without a shipment, or a ledger transaction that does not balance.
2. The ledger imbalance check reports any row, or the Stripe reconciliation delta is non-zero for more than 30 minutes.
3. Confirmed or suspected data breach, or PII found in logs, analytics, or an error tracker.
4. Two shipments assigned to two different couriers, or one shipment delivered twice.
5. Tracking unavailable or materially wrong for more than 30 minutes at p95 (a broken map on live shipments).
6. Payment failure rate above 25% for 10 minutes, or a double-charge rate above 0.1%.
7. Contribution margin negative for 3 consecutive days.
8. Database unavailability, corruption, or an accidental destructive statement.
9. Two or more SEV1 incidents within 7 days.
10. Any engineer cannot state, within 5 minutes, why the system is doing the wrong thing. **Uncertainty is itself a rollback trigger** — an unexplained system is not shippable.

### 3.3 Rollback authority

Any engineer on call may execute a **flag kill switch** without permission. Only F may **resume** after a rollback. Rollback is never second-guessed in the moment; the post-mortem is where it gets judged.

---

## 4. Incident process

### 4.1 Severity levels

| | **SEV1** | **SEV2** | **SEV3** | **SEV4** |
|---|---|---|---|---|
| **Definition** | Customers cannot get their parcels moved, or money is wrong, or data is at risk | Major degradation with a workaround, or money is *suspicious* but not yet wrong | Degraded for some users, or an internal tool is down | Cosmetic, or a background process is behind |
| **Examples** | Payments failing city-wide; dispatch assigning no couriers; ledger imbalance; breach; database down | Tracking stale for > 20% of live shipments; assignment latency > 2× normal; one zone with no couriers | `/ops` dashboard failing; email notifications delayed; a single courier's app failing to install | A wrong label on the ops screen; a cosmetic layout bug; a stale cached tile |
| **Customer impact** | Widespread or irreversible | Significant but recoverable | Contained | None |
| **Response expectation** | Page immediately, 24/7. Acknowledge within **10 min**, mitigate within **30 min** | Page if in business hours. Acknowledge within **30 min**, mitigate within **4 h** | Same business hours. Triage within **1 business day** | Weekly review |
| **Comms** | Public status page update within 30 min, then hourly. Direct notice to affected couriers and partners | Status page only if customer-visible | No public comms | None |
| **Post-mortem** | Mandatory, blameless, within 5 business days | Mandatory, within 10 business days | If it recurs | No |
| **Escalation** | Primary → secondary → F → Railway/Stripe/SMS provider status | Primary → secondary | Primary | Weekly triage |

### 4.2 Response sequence

1. **Acknowledge** the page. An acknowledged incident is a calmer incident.
2. **Assess** in the first 5 minutes: is this money, is this data, is this total, or is this partial? Money and data escalate immediately regardless of user count.
3. **Mitigate, do not debug.** Apply a kill switch or roll back. Diagnosing while customers are affected is the most common way a SEV2 becomes a SEV1.
4. **Communicate** as soon as mitigation is under way. A holding statement beats silence.
5. **Verify** the fix against a metric, not a feeling. The alert that fired must clear.
6. **Hand over** explicitly if outside working hours, with a written state summary.
7. **Post-mortem** on the defined schedule, blameless, with actions that have owners and dates.

### 4.3 Communication templates

Four templates, pre-approved before launch (checklist O-13) so nobody is drafting under pressure.

**Status page — investigating (SEV1/2, within 30 min)**
> **Investigating — [plain-language symptom].** We are aware that [what customers experience] in [scope: all users / one zone / couriers only]. Started [time, timezone]. Next update within 30 minutes. We are not currently aware of any impact to payments or refunds — if that changes we will say so immediately.

**Status page — identified (SEV1/2)**
> **Cause identified.** [One sentence: what broke.] [What we are doing, and the expected time to fix.] Next update within [interval]. Applies to [scope].

**Status page — monitoring (resolved)**
> **Resolved.** The fix is live as of [time]. [One sentence on the cause.] We are monitoring and will update if anything changes. Thank you for your patience.

**Direct notice to affected couriers (in-app + SMS)**
> QuickDrop: we are aware that [symptom] may affect your deliveries right now. [What we are doing.] Your earnings are not affected — [if true]. Please [specific action: keep the app open / accept new offers / hold at current pickup]. Updates here. Sorry about this.

Rules: never speculate on cause before it is identified · never promise a fix time we cannot commit to · always state whether money is affected, explicitly, even when it is not · always state scope.

### 4.4 Post-mortem format

Blameless. Fixed template, no exceptions, kept short enough that people actually write them.

```
1. Summary        — 3 sentences. What broke, for how long, what the impact was in
                    customer terms and in money.
2. Timeline       — UTC timestamps from first signal to full recovery. Include
                    "first customer impact" and "first alert" separately; the gap
                    between them is a detection finding.
3. Impact         — orders affected, deliveries affected, money in and out,
                    customers and couriers contacted, data involved (yes/no).
4. Root cause     — technical AND organisational. "Alert was on the wrong
                    threshold" is as real as "off-by-one". If the answer is
                    "someone was tired", write that.
5. What went well  — genuinely. Things that limited the blast radius.
6. What went badly — with no names attached.
7. Where we were lucky — the near-misses that did not escalate. This section is
                    how the next incident gets prevented.
8. Actions         — each with a type (prevent / detect / mitigate / process),
                    an owner, a due date, and a link to the ticket. No action
                    without an owner and a date.
9. Risk register delta — which risk in docs/10-risk-register.md this realised, or
                    which new risk it creates, with a score.
10. Follow-up date — when we check that the actions actually landed.
```

---

## 5. On-call and support

### 5.1 Rotation shape for a 2–4 person team

Realistic on-call is not 24/7 heroics for four people; it is a small, honest rotation with a fast path to a founder.

- **Primary on-call: 1 week at a time, rotating.** During beta and the first 4 weeks of public launch this includes **evenings and one weekend day**. Afterwards, business hours only, with SEV1 covered by a phone tree.
- **Secondary on-call: the next person in the rotation.** Never the same person two weeks running.
- **F is the final escalation** and is reachable by phone for any SEV1, 24/7, for the first 8 weeks post-launch.
- **Coverage rules:** a person on on-call is not the sole author of a release that week. Deploys on Fridays are avoided during the first 4 weeks.
- **Load:** target under 2 pages per week per person after the first month. More than that is a capacity signal, not a heroism signal — raise it, do not absorb it.
- **Compensation:** on-call weeks are lighter on feature work. This is written down, because uncompensated on-call is how a small team burns out.

### 5.2 Escalation path

```
Alert fires (Prometheus / uptime / Railway / Stripe webhooks)
  -> Primary on-call       Acknowledge within 10 min (SEV1) / 30 min (SEV2)
     -> Apply kill switch or roll back         (most incidents stop here)
     -> Secondary on-call  Engaged after 15 min with no mitigation
        -> F               Engaged for any SEV1, or any rollback decision, or any
                           customer-communication decision
           -> External     Railway support, Stripe support, SMS provider,
                           DNS registrar — contacts recorded in the ops runbook,
                           not in this repository
```

Rules: the person closest to the problem leads · escalation is never perceived as blame · anyone may declare an incident, only the incident lead closes one.

### 5.3 Minimum support tooling

Non-negotiable at public launch. If an item is not ready, its dependent phase does not start.

- **Public status page** with components mapped to real services, subscribed-to incident updates, and an incident-history archive. Checked for real, in both directions, during a rehearsal.
- **In-app support contact** on all three surfaces, creating a ticket with the shipment context attached automatically. No "email us and we'll get back to you".
- **Support tooling in `/ops`:** ticket list with SLA timers · shipment search by ID, address reference, courier, or phone hash · refund action (subject to §5.4) · force-assign · force-cancel · courier search with anomaly and integrity flags.
- **Self-serve customer flows** that remove the most common ticket categories: reschedule within the allowed window · change drop-off instructions · contact the courier **through the platform only** · request a refund after a failed delivery · report a problem with proof of delivery state.
- **Help-centre articles written during the build,** not after. Top 10 ticket categories from Phase 0 and the beta, each with an article.
- **Escalation contacts** recorded outside the repository, with contract numbers.

### 5.4 Refund authority matrix

| Amount | Approver | Auto-approval | Evidence required |
|---|---|---|---|
| ≤ order price, delivery failed | Support agent | Yes, automatic | System-recorded failed delivery or customer-reported failure with no dispute |
| ≤ $75 goodwill | Ops lead | No | Agent discretion, logged with a reason code |
| $75–$300 | F | No | Written justification |
| > $300 | F + ENG-A | No | Written justification, plus a ledger review |
| Any amount where GPS integrity is flagged | F + ENG-A | **Never auto** | Spoof investigation completed first |
| Any amount on a shipment with an open dispute or payout hold | F + ENG-A | **Never auto** | Dispute resolved |
| Repeated refunds to the same account (> 3 in 30 days) | F | **Never auto** | Fraud/abuse review |

Constraints: a single customer has a **$200 goodwill ceiling per 30 days**, enforced by the system, not by discipline · every refund is a ledger operation with an operator id · refunds are never made outside the ledger, ever, by anyone, including F.

---

## 6. Post-launch metrics review cadence

### 6.1 Daily — 20 minutes, during beta and the first 4 weeks of public launch

| Metric | Source | Threshold / question | Owner |
|---|---|---|---|
| Orders booked, delivered, cancelled, failed | Product analytics | Compare to plan; any > 20% swing gets an explanation | OPS |
| Median and p90 time-to-assign | Delivery operations dashboard | p90 ≤ 20 min | ENG-A |
| Available couriers in the launch zone | Courier health dashboard | < 15 is an amber flag; < 8 triggers zone gating | OPS |
| `courier_stale_share` | Courier health dashboard | < 20%; a rising trend matters more than a single high reading | ENG-B |
| Shipments stuck in `assigned` > 30 min | `ShipmentStuckAssigned` alert | Should be 0 | ENG-A |
| Payment failure rate | Money dashboard | < 12% | ENG-A |
| **Contribution margin per order** | Money dashboard | **≥ $1.50**; below this is a launch-stopping conversation | F |
| Ledger balance check result | Nightly job | Zero unbalanced rows | ENG-A |
| Stripe reconciliation delta | Reconciliation job | Zero | ENG-A |
| Oldest job age, all queues | Worker dashboard | < 30 s | ENG-A |
| WebSocket connections per replica | Realtime dashboard | < 1000 | ENG-C |
| Support tickets opened, by reason | Support tooling | < 15 per 100 deliveries | OPS |
| Rail spend to date vs. model | Railway dashboard | Within 20% | ENG-C |

### 6.2 Weekly — 45 minutes, whole team, from Phase 0 onward

Everything daily, plus:

| Metric | Threshold | Owner |
|---|---|---|
| AOV and contribution per order, trending | AOV ≥ $12.00 | F |
| Courier funnel: recruited → KYC complete → first delivery → week-4 active | Each step reported; KYC completion ≥ 60% | F |
| Courier week-4 and week-8 retention | ≥ 70% and ≥ 60% | F |
| Offer acceptance, decline, and expiry rates | Acceptance ≥ 50% | ENG-A |
| **Courier offer-wait fairness: p95 by distance-to-zone-centre decile** | No decile above 3× the median decile ([10-risk-register.md](10-risk-register.md) R-06) | ENG-A |
| GPS rejection rate by reason | Stable or falling; a spike means a client regression | ENG-B |
| Installed-PWA share of couriers | ≥ 70% | ENG-B |
| iOS observed position interval distribution | Compared to the Phase 0 baseline; drifting worse means the platform, not our code | ENG-B |
| **Risk register review: every risk scoring 8+, plus any trigger that fired** | Each trigger that fired has a ticket | F |
| Scope: unplanned work as % of the iteration | < 20% | F |
| Carry-forward items status (Node 26, TS 7 plugin compat, Better Auth, Connect v2, iOS criteria, KYC lead time) | Each has a decision, not just a note | ENG-A |
| Cost model vs. actuals by line item | Drift < 20%; above that, re-derive ([09](09-infrastructure-and-cost.md) §10.6) | ENG-C |
| Restore drill due? | One per month; not overdue | ENG-C |

### 6.3 Monthly — 90 minutes, F chairs

| Metric | Purpose | Owner |
|---|---|---|
| All weekly metrics, plus monthly trend | Direction over time | F |
| Contribution margin decomposition: Stripe fee, courier payout, refunds, SMS, tiles, support cost per delivery | Diagnose **where** margin goes | F |
| Reliability against SLOs: availability, booking p95, fan-out p95, queue age | Are we still meeting the numbers in [08](08-testing-strategy.md) §7? | ENG-A |
| Incident record: count by severity, MTTA, MTTR, repeat offenders | Are we fixing causes or symptoms? | ENG-A |
| Full risk register re-score | Likelihood and impact change as we learn | F |
| Assumptions register re-test ([10](10-risk-register.md) §3) | Which bets have we falsified this month? | F |
| Competitive and market review | A competitor in the zone; courier poaching; CAC | F |
| Deferred backlog review ([§7](#7-deferred-backlog-for-v2)) | Is anything still correctly deferred? | F |
| Burn and runway | How many weeks of runway remain at the current spend? | F |
| Key-person dependency check | Bus factor per critical path | F |
| Restore drill results vs. RPO/RTO | Are the stated numbers still true? | ENG-C |
| Decision log: what changed, and why | Institutional memory that does not live in one person's head | F |

---

## 7. Deferred backlog for v2

Explicitly out of scope for the launch runway. Each has a rationale, because "no" needs a reason.

| Item | Why deferred |
|---|---|
| **Native mobile app** (iOS/Android) | A PWA covers the launch surface at a fraction of the cost. Only worth it if iOS field measurement proves background tracking is unusable ([10-risk-register.md](10-risk-register.md) R-02). Revisit at month 6 with data, not with enthusiasm. A thin Capacitor wrapper stays available as the cheaper fallback |
| **Multi-stop shipments** | Materially changes the dispatch problem (route optimisation, multiple recipients, one payout split) and the pricing model. It would consume the entire runway. One parcel, one pickup, one drop-off is a product decision, not a limitation |
| **Subscriptions and memberships** | Needs a dependable delivery cadence first, and introduces recurring billing, dunning, and churn on top of a marketplace with no supply. The market for a courier subscription does not exist until service reliability does |
| **Surge pricing** | Requires transparent surge UX and careful regulator/customer communication, and it punishes exactly the couriers we are trying to recruit. Use operational levers instead: dynamic radius and delivery-window extension ([10-risk-register.md](10-risk-register.md) R-15) |
| **International expansion** | A new jurisdiction means new classification, licensing, tax, payments, and support questions ([10](10-risk-register.md) R-04). Multi-city expansion already carries this cost. One city first, deliberately |
| **Courier ratings and leaderboards** | Creates a route to unsafe pressure on couriers and a gaming surface for fraud. Couriers are workers, not a marketplace commodity. Prioritise courier tooling and income predictability instead |
| **Public API for third parties** | A support surface and an SLA commitment we cannot honour with 2–4 engineers. Build it when there is a specific partner with volume worth the maintenance |
| **Scheduled and recurring deliveries** | Consumers order on demand; scheduling adds cancellation semantics, advance payment, and reservation complexity. Needs demand evidence from the beta, not speculation |

**Also explicitly deferred** (in case they are proposed again): drop-off signature photos · native driver navigation · in-app courier chat · warehouse and B2B accounts · multi-language UI · accessibility beyond WCAG AA · dark mode.

---

## 8. Feature-flag inventory

Every flag below **must** be togglable at runtime from the ops admin without a deploy, and must be settable **per zone** where marked. Every flag defaults to the safe value. A flag that requires a redeploy is not a kill switch.

| Flag | Type | Default | Scope | Owner | What it switches | Kill switch behaviour |
|---|---|---|---|---|---|---|
| `flag_dispatch_mode` | kill switch | `auto` | global + per zone | ENG-A | `auto` uses the dispatch scorer; `manual` sends offers to an ops queue for assignment by hand | Turn to `manual`; in-flight assignments are unaffected, new ones queue for ops |
| `flag_payments_paused` | kill switch | `false` | global | ENG-A | Stops creating new PaymentIntents | Turn on; existing authorised charges settle, orphaned authorisations released by a job after 7 days. **Never disables Stripe entirely** |
| `flag_payouts_manual_only` | kill switch | `false` | global | ENG-A | Automatic payout batches require human approval in `/ops` | Turn on; batches queue, nothing is sent to couriers without an explicit release |
| `flag_new_booking` | kill switch | `true` | global + per zone | F | Whether new shipments can be created | Turn off to stop new demand; in-flight shipments complete normally |
| `flag_tracking_live` | kill switch | `true` | global | ENG-B | Live map updates | Turn off; the UI shows status and last-known state plus a manually managed ETA, and tells the customer tracking is degraded. **Honest degradation beats a wrong map** |
| `flag_eta_auto_compute` | kill switch | `true` | global | ENG-A | Automated ETA from the route engine | Turn off; ETAs are supplied manually by ops |
| `flag_anomaly_scoring` | kill switch | `true` | global | ENG-A | GPS plausibility scoring and payout holds | Turn off **only** to stop false positives on a platform quirk — never to bypass an active integrity flag |
| `flag_native_location_fallback` | rollout | `false` | courier clients | ENG-B | The Capacitor native-location path, if iteration-1 measurement justifies it | Not a kill switch; removing the flag returns the client to browser location |
| `flag_install_prompt` | rollout | `true` | courier clients | ENG-B | Add-to-Home-Screen guidance and tracking-quality education | Turn off |
| `flag_self_serve_refund` | rollout | `true` | customer | OPS | Customers requesting their own refund after a failed delivery, within the policy ceiling | Turn off; refunds require an agent |
| `flag_customer_app_broadcast` | rollout | `false` | global | OPS | Broadcast channel to all active couriers (weather, disruption, operational notices) | Turn off |
| `flag_ops_bulk_actions` | rollout | `true` | ops | ENG-C | Bulk reassign, bulk cancel, bulk refund in `/ops` | Turn off |
| `flag_contribution_margin_alert` | monitor | `true` | global | F | The contribution-margin floor alert | Turn off to silence; **never turned off to avoid a reading** |
| `flag_zone_<zone_id>_open` | kill switch | `true` | per zone | F | Whether a zone accepts new bookings | Per-zone stop. This is the tool that bounds the blast radius of a cold start ([10-risk-register.md](10-risk-register.md) R-01) |
| `flag_assignment_radius_m` | config | `5000` | global + per zone | ENG-A | Candidate search radius for `ST_DWithin` | Reduce radius at runtime. **Lower value means fewer couriers, not more** — the panic move is to *raise* it, which increases dispatch latency and should be a deliberate, logged decision |
| `flag_backfill_<name>` | kill switch | `true` | global | ENG-C | Any long-running backfill job | Turn off; the job is idempotent and resumes safely |

**Flag hygiene, reviewed monthly:** every flag has an owner and a removal date · any flag fully enabled for more than 30 days after general availability is deleted · flags in the "Disabled" list of §2 must have their default set accordingly before that phase starts · adding a flag requires naming the condition that will delete it.

---

## 9. Sources

- [stack_report.md](../stack_report.md) — pinned stack, iOS PWA constraints, Connect Accounts v2, KYC lead time
- [Web Push on iOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/) · [iOS service worker lifecycle](https://webkit.org/blog/8090/workers-at-your-service/) · [Background Sync support](https://caniuse.com/background-sync) · [iOS PWA installation](https://web.dev/learn/pwa/installation/#ios-installation) · [Web App Manifest (MDN)](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [Stripe pricing and disputes](https://stripe.com/pricing) · [Stripe Connect](https://docs.stripe.com/connect/) · [Stripe idempotent requests](https://docs.stripe.com/api/idempotent_requests) · [Stripe webhook signature verification](https://docs.stripe.com/webhooks/signature)
- [Railway pricing](https://railway.com/pricing) · [Right-sizing CPU and memory](https://docs.railway.com/guides/right-size-cpu-memory) · [Railway Postgres backups and restores](https://docs.railway.com/guides/postgres-backups-restores) · [Railway PITR](https://docs.railway.com/volumes/point-in-time-recovery)
- [BullMQ Redis configuration](https://docs.bullmq.io/guide/going-redis) · [PostGIS](https://postgis.net/)
- [Better Auth](https://www.better-auth.com/) · [Twilio US SMS pricing](https://www.twilio.com/en-us/sms/pricing/us) · [Sentry pricing](https://sentry.io/pricing/) · [MapTiler Cloud pricing](https://www.maptiler.com/cloud/pricing/)
- [Web Geolocation API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API)