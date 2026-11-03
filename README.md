# QuickDrop

A guest-checkout food-delivery MVP: browse restaurants, add dishes to a cart, check out,
pay (simulated), and land on a confirmation. One React Native (Expo) codebase runs on
iOS, Android, and the web; a small Express + SQLite API prices and stores orders.

No accounts, no real payment gateway, no courier tracking — those are post-MVP.

## Status (2026-11-03)

| Phase | State | Notes |
|---|---|---|
| 0 — Decisions & scaffold | Done | Expo SDK 58, Expo Router entry, web export verified |
| 1 — API MVP-complete | Done | `/api/health`, hardened validation, 15 passing tests |
| 2 — Expo foundation | Done | API client, theme/components, `CartProvider`, platform alerts |
| 3 — Browse & menu | Done | Restaurant list, menu, steppers, cross-restaurant confirm |
| 4 — Cart & state | Done | Cart survives reload (versioned AsyncStorage), 32 mobile unit tests |
| 5 — Checkout & order | Done | Guest checkout, server-priced order, simulated payment, confirmation |
| 6–7 | Next | Cross-platform polish/QA, then release |

Verified at the last checkpoint: `npm test` 15 server + 52 mobile passing · full order flow exercised
against the real API on a throwaway DB · mobile lint exit 0 · `expo export --platform web` succeeded ·
`expo-doctor` 20/20.

## Quick start

Requires **Node >= 22.5** (`node:sqlite`). Node 24.22 is the verified runtime.

```bash
npm install          # root tooling + server + mobile
npm run seed         # 4 seeded restaurants, 16 menu items (wipes existing orders)
npm run dev          # API on http://localhost:4000 + Expo dev server
```

Then open the app in Expo Go, a simulator, or the browser.

| Command | Purpose |
|---|---|
| `npm run dev` | API + Expo together |
| `npm run dev:web` | Expo web only |
| `npm test` | Both test suites (server API + mobile cart) |
| `npm run lint --prefix mobile` | ESLint for the app |
| `npm run export:web --prefix mobile` | Static web build into `mobile/dist/` |

`EXPO_PUBLIC_API_URL` tells the app where the API is: `http://localhost:4000` for web and
simulators, `http://10.0.2.2:4000` for the Android emulator, `http://<LAN-IP>:4000` for a
physical device. Copy `mobile/.env.example` to `mobile/.env`.

## Layout

```
quickdrop/
├── server/        Express + node:sqlite API (routes, validation, seed, tests)
├── mobile/        Expo app — iOS / Android / web (Expo Router routes in src/app/)
├── client/        Legacy Vite web app — frozen, deleted once the Expo app reaches parity
├── PLAN.md        MVP scope, phases, API contract, acceptance criteria, risks
├── AGENTS.md      Working agreement for contributors and agents
└── mobile/AGENTS.md   Expo-specific rules
```

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Liveness probe |
| GET | `/api/restaurants` | List, sorted by rating |
| GET | `/api/restaurants/:id` | Restaurant + `menu[]` |
| POST | `/api/orders` | Create order; the server prices it |
| POST | `/api/orders/:id/pay` | Simulated payment; `pending_payment` → `preparing` |
| GET | `/api/orders/:id` | Order + items + restaurant summary |

Prices are always computed from the database, never sent by the client.

## Note on removed files

An unrelated plan for a courier/parcel-pickup PWA briefly lived in `docs/` and
`stack_report.md` in this repository. It was a different product on a different stack, so it
was moved out and now lives in the sibling `quickdrop-courier-plan` folder. It remains in
this repository's git history, but nothing here depends on it.
