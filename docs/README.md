# QuickDrop — Planning Docs

**Status: pre-implementation, planning only. No application code exists as of 2026-10-05.** This directory is the plan. Every version claim is taken verbatim from [../stack_report.md](../stack_report.md) and is not re-researched here.

**Iteration count: fixed — 11 iterations, I0–I10, over 14 weeks** (2026-10-12 to 2027-01-10). [07-roadmap.md](./07-roadmap.md) owns the count, the capacity model, and the per-iteration Definition of Done. Committed demand is 109 person-days against a 2-engineer capacity of 140 (78% utilisation, the remainder being the deliberate reserve for R-20). Critical path: **I0 → I1 → I3 → I4 → I6 → I9 → I10**; I2, I5, I7 and I8 have float.

---

## Document index

Legend: **Written** = landed and usable. Every document below is on disk; the filename scheme is the one the links use. Content gaps — subjects no document yet owns — are listed in [Known gaps](#known-gaps-in-the-plan-as-of-2026-10-05).

| Doc | Purpose | State |
|---|---|---|
| [00-product-brief.md](./00-product-brief.md) | Product brief: assumptions (A-01…A-20), problem statement, personas, golden path, three unhappy paths, scope, North Star plus guardrails, 18 MoSCoW user stories with acceptance criteria, pricing model | Written |
| [01-tech-stack.md](./01-tech-stack.md) | Pinned stack table, rejected alternatives with sources, five full ADRs, tooling table, DX summary | Written |
| [DECISIONS.md](./DECISIONS.md) | Running numbered decision log, ADR-0001 to ADR-0028, with status, dates, cross-document ownership map, and open questions | Written |
| [02-architecture.md](./02-architecture.md) | System context, containers, deployable units, golden-path and failure-path flows, **the dispatch algorithm**, event catalogue, trust boundaries, roles | Written |
| [03-data-model.md](./03-data-model.md) | ER diagram, shipment state machines, enumerations, field-level tables, ledger schema, pricing and earnings model | Written |
| [04-api-contract.md](./04-api-contract.md) | Endpoints, payloads, **authN/authZ matrix**, error envelope, rate limits, idempotency, OpenAPI | Written |
| [05-realtime-and-tracking.md](./05-realtime-and-tracking.md) | Courier position pipeline, WebSocket fan-out, map-matching, ETA model, staleness sweeps, offline replay, surge | Written |
| [06-frontend-architecture.md](./06-frontend-architecture.md) | The three role-routed surfaces, routing, Tailwind tokens, service worker build and caching policy, manifest, iOS install UX | Written |
| [07-roadmap.md](./07-roadmap.md) | The iteration plan, capacity, per-iteration Definition of Done, critical path, sequencing of open questions | Written · **owns the iteration count** |
| [08-testing-strategy.md](./08-testing-strategy.md) | Test pyramid, deterministic testing of nondeterminism, E2E per role, load targets, CI gating policy | Written |
| [09-infrastructure-and-cost.md](./09-infrastructure-and-cost.md) | Local dev prerequisites, compose stack, environments, CI/CD, migrations, seed data, backups and DR, observability, cost model | Written |
| [10-risk-register.md](./10-risk-register.md) | Risk register, top-5 deep dives, assumptions register, review process | Written |
| [11-launch-playbook.md](./11-launch-playbook.md) | Launch gates, go/no-go checklist, incident and rollback runbooks, beta cohort, v2 deferral execution | Written |

The filenames above are canonical. Earlier drafts of this index, and the cross-reference headers in `08`, `09`, `10` and `11`, referred to a second, never-written numbering (`05-auth-and-roles.md`, `06-tracking-and-eta.md`, `07-payments-and-ledger.md`, `08-dispatch-and-matching.md`, `09-frontend-and-pwa.md`, `10-testing-quality-and-security.md`, `11-roadmap-and-iterations.md`). Those references now point at the files above. Where a subject has no document of its own, the owner column in [DECISIONS.md](./DECISIONS.md#cross-document-reconciliation) names the two documents that split it rather than inventing a filename.

### Where the pinned facts live

Only [../stack_report.md](../stack_report.md) carries version research. Everything else links to it. If you need a version that is not there, it is **not decided** — raise it in [DECISIONS.md](./DECISIONS.md) rather than picking one.

### Canonical vocabulary

The booked thing is a **`shipment`**. Lifecycle states are `draft`, `quoted`, `payment_pending`, `booked`, `offer_pending`, `assigned`, `picked_up`, `in_transit`, `arrived`, `delivered`, `cancelled`, `failed` ([03-data-model.md](./03-data-model.md)). Roles are `customer`, `courier`, `ops`, `admin` ([02-architecture.md](./02-architecture.md)). Roles `customer` / `courier` / `ops` / `admin` are the set used throughout this doc set. Where this doc set disagrees with a written doc, the written doc wins and the discrepancy goes in the gap list.

---

## How to use this plan

### (a) A new engineer joining

Goal: understand the system well enough to make a safe change in your first iteration, without reading every document. Budget one day.

1. **[00-product-brief.md — Vocabulary and Assumptions](./00-product-brief.md#1-assumptions) — 10 minutes.** Twenty load-bearing assumptions, each with an ID and an "impact if wrong" column. Read the impact column; that is what tells you what breaks.
2. **[00-product-brief.md §4 and §5](./00-product-brief.md#4-golden-path-journey) — 15 minutes.** The golden-path sequence diagram and the three unhappy paths. These two explain most of why the system exists.
3. **[01-tech-stack.md §1](./01-tech-stack.md#1-pinned-stack) — 10 minutes.** The pinned stack. Notice the "why not the alternative" text; those are the decisions you will be tempted to reopen.
4. **[DECISIONS.md — Index](./DECISIONS.md)** — scan the 28 entries and their Status column. Seven are `Proposed` and blocked on a named check; do not build past a `Proposed` entry without closing it.
5. **[02-architecture.md](./02-architecture.md)** — containers, deployable units, failure paths, and the dispatch algorithm. Read §6 (dispatch) and §8 (trust boundaries) with care; everything else will make more sense after them.
6. **[03-data-model.md](./03-data-model.md) §2 and §3** — the shipment state machine and the enumerations. You will reference these daily.
7. **The document for your surface** — [05-realtime-and-tracking.md](./05-realtime-and-tracking.md) for courier movement and ETA, [03-data-model.md](./03-data-model.md) for money and the ledger, [06-frontend-architecture.md](./06-frontend-architecture.md) for UI, [04-api-contract.md](./04-api-contract.md) for endpoints and authorisation, [02-architecture.md](./02-architecture.md) for dispatch and matching.
8. **[08-testing-strategy.md](./08-testing-strategy.md)** before your first PR. The CI gating policy tells you what is expected of you and which suites block merge.
9. **[09-infrastructure-and-cost.md](./09-infrastructure-and-cost.md) §1–2** to get running: local prerequisites and the compose stack.

Working rules: never change a pinned version without a new [DECISIONS.md](./DECISIONS.md) entry; never write money without an idempotency key; never let correctness depend on the service worker staying alive; never let application code be the only thing enforcing a money or concurrency invariant.

### (b) The product owner

Goal: sign off scope, promise, and economics. Budget two hours.

1. **[00-product-brief.md](./00-product-brief.md) in full** — written to be read straight through.
2. **[00-product-brief.md §6](./00-product-brief.md#6-success-metrics)** — the North Star metric and the guardrail table. The thresholds are marked *placeholder*: they must be replaced with observed baselines after the first 200 completed deliveries.
3. **[00-product-brief.md §8](./00-product-brief.md#8-user-stories)** — 18 stories: 13 Must, 3 Should, 2 Could. The Must set is the definition of a shippable v1.
4. **[00-product-brief.md §11](./00-product-brief.md#11-open-questions-carried-forward)** — ten questions deliberately left open, each with an owner. This is your decision queue.
5. **[10-risk-register.md](./10-risk-register.md)** — read the register and the assumptions register. R-02 (iOS tracking) and R-17 (money correctness) are the two that can end the product if they materialise.
6. **[DECISIONS.md — Index](./DECISIONS.md)** — anything marked `Proposed` is waiting on a check; `ADR-0021` is waiting specifically on your iOS background-tracking acceptance criteria.
7. **[02-architecture.md §6](./02-architecture.md)** — read the dispatch algorithm and the fallback ladder only. It bounds what we can promise about pickup time.

You do not need [02-architecture.md](./02-architecture.md), [04-api-contract.md](./04-api-contract.md), [05-realtime-and-tracking.md](./05-realtime-and-tracking.md), [06-frontend-architecture.md](./06-frontend-architecture.md), or [09-infrastructure-and-cost.md](./09-infrastructure-and-cost.md). For money mechanics, [01-tech-stack.md ADR-3](./01-tech-stack.md#adr-3--stripe-connect-separate-charges-and-transfers) is the shortest correct answer.

### (c) The person about to start Iteration 0

Iteration 0 is bootstrap, not features. Its output is a working skeleton, a green CI, and four retired risks. Define its scope from [10-risk-register.md](./10-risk-register.md) assumptions `A-06` (TypeScript 7.0 build) and `A-14` (service worker with the Next.js build) — both are explicitly cheap to retire early and both can silently break the whole plan later.

Read, in this order:

1. **[09-infrastructure-and-cost.md §1–5](./09-infrastructure-and-cost.md)** — prerequisites, compose stack, environments, CI/CD pipeline. This is the script for your first week.
2. **[01-tech-stack.md §4 and §5](./01-tech-stack.md#4-tooling)** — tooling and DX. `pnpm dev` must bring up every service plus Postgres and Redis in one command.
3. **[01-tech-stack.md §5.4](./01-tech-stack.md#54-known-dx-risks-to-retire-in-iteration-0)** — six named DX risks with the action that retires each. Your work list.
4. **[DECISIONS.md](./DECISIONS.md)** entries `ADR-0001` (version pins), `ADR-0002` (service split), `ADR-0008` (service worker), `ADR-0019` (deploys), `ADR-0024` (TypeScript gate), `ADR-0027` (Workbox vs. Serwist). This is the Iteration 0 decision set.
5. **[08-testing-strategy.md §2, §3, §8](./08-testing-strategy.md)** — the pyramid, tooling choices, and CI gating. CI must be green on the first commit, not retrofitted.
6. **[03-data-model.md](./03-data-model.md)** — generate the initial schema and migrations before writing feature code. Migrations must pass the zero-downtime linter on day one.
7. **[02-architecture.md §3](./02-architecture.md)** — the deployable units and their health endpoints, so the three Railway services exist before any feature needs them.

**Iteration 0 exit criteria, proposed:** CI green for format, lint, typecheck, unit/integration, E2E, and build; `tsc --noEmit` and a production `next build` both pass on TypeScript 7.0.2 (`ADR-0024` closed); a real WebSocket connection succeeds against a Railway staging URL; the service worker builds with a CI assertion that every precache revision matches a real asset (`ADR-0027` closed); `drizzle-kit check` passes with generated migrations committed; the three services deploy to a Railway environment with `/healthz` green on each; a seed script produces a deterministic demo city with a balanced ledger; and PITR plus a nightly logical dump to a second provider are enabled ([09-infrastructure-and-cost.md §8](./09-infrastructure-and-cost.md)). `07-roadmap.md` owns the authoritative version of this list.

---

## Conventions used across all docs

| Rule | Detail |
|---|---|
| No emojis | Enforced. Status is written in words. |
| Diagrams | Mermaid only. If a diagram will not render on GitHub, simplify it rather than reaching for ASCII art. |
| Pinned versions | Sourced from [../stack_report.md](../stack_report.md) and cited upstream. Anything not in that report is either "pin at Iteration 0" or an open question. Never invent a version. |
| Unverified claims | Marked **OPEN** or *placeholder*, with the iteration or document that must resolve them. |
| Decisions | One entry per decision in [DECISIONS.md](./DECISIONS.md), 15 lines maximum, with the full argument in the owning document. No duplication across docs — link instead. |
| Normative ownership | Every technical area has one owning document, listed in the [DECISIONS.md cross-document reconciliation table](./DECISIONS.md#cross-document-reconciliation). Other documents reference it and do not restate it. |
| Money | Integer minor units. No floats, no client-side arithmetic, no percentage applied directly to money. Every mutating money operation carries an idempotency key. |
| Dates | ISO `YYYY-MM-DD`. All planning docs are dated 2026-10-05 unless a later revision is recorded. |
| iOS honesty | Any displayed live position carries its age. Never render a stale dot as live, and withdraw the ETA rather than show a frozen countdown. ([WebKit Geolocation](https://developer.apple.com/documentation/webkitjs/geolocation)) |

## Known gaps in the plan as of 2026-10-05

These are unresolved and each has an owner. They are listed here rather than silently absorbed into whichever document happened to be written last.

| # | Gap | Owner |
|---|---|---|
| 1 | Launch city and currency are not named. `08-testing-strategy.md` assumes Berlin; `09-infrastructure-and-cost.md` mixes `$` with a `2.9% + 30¢` fee that reads as EUR. Every fare figure in `00-product-brief.md` is illustrative until this is fixed. | Product owner, then [03-data-model.md](./03-data-model.md) and `09` |
| 2 | Fare model conflict: `00-product-brief.md` §9 uses illustrative components; `09-infrastructure-and-cost.md` §10 and `03-data-model.md` carry the worked AOV and contribution model. One must become normative. | Product owner + Finance |
| 3 | Which routing binary ships (OSRM / Valhalla / GraphHopper). `02-architecture.md` assumes OSRM as the default with a haversine fallback; `01-tech-stack.md` lists Valhalla first. No decision entry exists yet. | Author of [05-realtime-and-tracking.md](./05-realtime-and-tracking.md), then a new [DECISIONS.md](./DECISIONS.md) entry |
| 4 | Map tile provider is unresolved: self-hosted vector tiles are pinned for the SDK, but `10-risk-register.md` R-25 flags that the free tier is non-commercial, so a paid plan is implied and not yet decided. | Engineering + Finance |
| 5 | Courier position upload transport is `Proposed` in `ADR-0022`; `02-architecture.md` implies batched writes with a plausibility filter but does not fix the transport. | Iteration I4 spike |
| 6 | **No document owns the operational Stripe Connect flows end to end** — onboarding, KYC state, separate charges and transfers, weekly payout batching, disputes and chargebacks. The ledger and settlement mechanics live in [03-data-model.md](./03-data-model.md) and the account model in [01-tech-stack.md ADR-3](./01-tech-stack.md#adr-3--stripe-connect-separate-charges-and-transfers), but the flow-by-flow narrative a new engineer would want does not exist. | Doc owner to be assigned at Iteration I6 |

## Resolved

| Was | Resolution |
|---|---|
| Doc numbering and filenames conflict; `08`, `09`, `10` referenced `01-architecture.md`, `02-data-model.md`, `03-api-contracts.md` | The filenames on disk won. `01-tech-stack.md`, `02-architecture.md`, `03-data-model.md` and `04-api-contract.md` are canonical; every stale reference now resolves to the file that actually owns the subject. |
| `01` slot contested between `01-tech-stack.md` and `01-architecture.md` | `01-architecture.md` references were stale. Architecture is `02-architecture.md`. |
| `03-api-contracts.md` versus `04-api-contract.md` | Singular, `04`. The API contract is [04-api-contract.md](./04-api-contract.md). |
| `04`–`07` and `11` did not exist | All twelve documents `00`–`11` are on disk. |
| Iteration count unfixed | Fixed at 11 iterations, I0–I10, by [07-roadmap.md](./07-roadmap.md). |
| Root `README.md` was a stale placeholder | Replaced with a QuickDrop README that states the pre-implementation status and points here. |

## Related

- Research input: [../stack_report.md](../stack_report.md) — the pinned-stack research report. Read-only. If a version here is wrong, correct it there and record the change in [DECISIONS.md](./DECISIONS.md).