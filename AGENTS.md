# AGENTS.md — QuickDrop

Context and working agreement for AI agents and contributors. Read this before changing code.

## What this is

QuickDrop is a **guest-checkout food-delivery MVP**. One React Native (Expo) codebase targets
iOS, Android, and web; a small Express + SQLite API backs it. There are no accounts, no real
payments, and no courier tracking yet.

The authoritative roadmap is [`PLAN.md`](./PLAN.md). `mobile/AGENTS.md` adds Expo-specific rules.

## Current status (2026-11-01)

| Phase | State | Notes |
|---|---|---|
| 0 — Decisions & scaffold | ✅ Done | Expo SDK 58 app in `mobile/`, Expo Router entry, web export verified |
| 1 — API MVP-complete | ✅ Done | `/api/health`, binds `0.0.0.0`, hardened validation, 15 passing tests |
| 2 — Expo foundation | ⬜ Next | API client, theme/components, `CartProvider`, platform alerts |
| 3–7 | ⬜ Not started | Browse/menu, cart, checkout, polish, docs/release |

Verified at this checkpoint:
- `npm test` (in `server/`) → 15 tests, 4 suites, all passing.
- `npm run lint` (in `mobile/`) → exit 0.
- `npx expo export --platform web` → success (781 modules, 3 bundles).
- `npx expo-doctor` → 20/20 checks passed.

## Repo layout

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
└── AGENTS.md                this file
```

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

## Conventions

- **JavaScript/JSX only** for the MVP. Do not introduce TypeScript mid-flight without updating the plan.
- **Routing:** Expo Router only. Every file in `mobile/src/app/` is a route; keep hooks,
  components, API code, and state outside that directory. Never import `@react-navigation/*`
  directly (SDK 56+).
- **Styling:** React Native `StyleSheet` + theme tokens. No UI kit for the MVP.
- **Money:** the server always computes subtotal, delivery fee, and total from the database.
  Never send prices from the client. Keep rounding to 2 dp server-side.
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
- **Emoji:** the app uses emoji instead of food photography; rendering varies by platform.
- **No auth:** orders are guest-only; `GET /api/orders/:id` is unauthenticated by design.

## Rules for agents

- Stay within the current phase's scope; record scope changes in `PLAN.md`.
- Prefer small, reviewable changes that keep the API and app runnable.
- Run the verification checklist before finishing.
- Do not reseed or delete `quickdrop.db` unless explicitly asked — it holds user-created orders.
- When adding an Expo/native dependency, check the Expo SDK docs for the installed major version
  first; Expo APIs change every release.
