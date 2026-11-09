# QuickDrop

A guest-checkout food-delivery MVP: browse restaurants, add dishes to a cart, check out,
pay (simulated), and land on a confirmation. One React Native (Expo) codebase runs on
iOS, Android, and the web; a small Express + SQLite API prices and stores orders.

No accounts, no real payment gateway, no courier tracking — those are post-MVP.

## Status (2026-11-09)

| Phase | State | Notes |
|---|---|---|
| 0 — Decisions & scaffold | Done | Expo SDK 58, Expo Router entry, web export verified |
| 1 — API MVP-complete | Done | `/api/health`, hardened validation, 15 API tests |
| 2 — Expo foundation | Done | API client, theme/components, `CartProvider`, platform alerts |
| 3 — Browse & menu | Done | Restaurant list, menu, steppers, cross-restaurant confirm |
| 4 — Cart & state | Done | Cart survives reload (versioned AsyncStorage), 32 mobile unit tests |
| 5 — Checkout & order | Done | Guest checkout, server-priced order, simulated payment, confirmation |
| 6 — Cross-platform polish | Done (code) | Safe areas, responsive widths, 44 px targets, a11y, error boundary, offline banner |
| 7 — Docs & release | Done | README, web export + local serve, EAS preview profiles, legacy `client/` removed |

Verified at this checkpoint: `npm test` 15 server + 52 mobile passing · mobile lint exit 0 ·
`npm run export:web --prefix mobile` succeeded (822 modules) · `expo-doctor` 20/20.

Still manual: the Phase 6 device/browser matrix (iOS simulator, Android emulator, physical
devices, Chrome/Safari, screen readers, large text).

## Requirements

- **Node >= 22.5** — the API uses the built-in `node:sqlite` module. Node 24.22 is the verified runtime.
- npm 10+ (npm 11.19 is what the project was verified with).
- For native targets: Expo Go for quick checks, or a development/preview build for native modules.
  Xcode (iOS) and Android Studio (Android) are only needed for local native runs; EAS builds in the cloud.

## Quick start

```bash
# 1. Install root tooling, the API, and the Expo app
npm run install:all

# 2. Point the app at the API (pick the URL for your target)
#    Web/simulator: http://localhost:4000
#    Android emulator: http://10.0.2.2:4000
#    Physical device: http://<your-computer-LAN-IP>:4000
cp mobile/.env.example mobile/.env          # macOS/Linux
# copy mobile\.env.example mobile\.env       # Windows PowerShell

# 3. Seed the database (4 restaurants, 16 menu items; wipes existing orders)
npm run seed

# 4. Start the API and Expo together
npm run dev
```

Then open the app in Expo Go, a simulator, or the browser. The API is on
`http://localhost:4000`; Expo prints the dev-server URL and a QR code.

Use `npm run dev:api` and `npm run dev:app` (or `npm run dev:web`) to run the two halves
separately.

## Commands

Run from the repo root unless noted.

| Command | Purpose |
|---|---|
| `npm run dev` | API + Expo dev server together |
| `npm run dev:api` | API only (`node --watch`) |
| `npm run dev:app` | Expo dev server only |
| `npm run dev:web` | Expo web only |
| `npm run seed` | Reset the local DB to the 4 seeded restaurants (wipes orders) |
| `npm test` | Both suites: API tests (`server/`) then unit tests (`mobile/test/`) |
| `npm run lint --prefix mobile` | ESLint for the Expo app |
| `npm run build:web` | Static web export into `mobile/dist/` |
| `npm run serve:web` | Serve the exported web build at `http://localhost:8081` |

Do **not** use `npx expo lint` here — the CLI version check fails under ESLint 9 even though the
config is valid. Use `npm run lint --prefix mobile`.

## Running on each target

| Target | API URL (`EXPO_PUBLIC_API_URL`) | How to run |
|---|---|---|
| Web | `http://localhost:4000` | `npm run dev:web` (or `npm run dev`) |
| iOS simulator | `http://localhost:4000` | `npm run dev`, then press `i` |
| Android emulator | `http://10.0.2.2:4000` | `npm run dev`, then press `a` |
| Physical device | `http://<LAN-IP>:4000` | `npm run dev`, scan the QR in Expo Go |

The server binds `0.0.0.0`, so a phone on the same network can reach it. If the phone cannot
connect, check the firewall and make sure the API and phone are on the same subnet.

`expo-network`, AsyncStorage, and the other dependencies used here are all in Expo Go, so a quick
check needs no native build. A **development build** is only required after adding a library with
native code: `npx expo run:ios|android` locally, or an EAS `development` build.

## Project layout

```
quickdrop/
├── server/              Express + node:sqlite API
│   ├── src/app.js       createApp(): routes, validation, error handling
│   ├── src/index.js     starts the server (HOST 0.0.0.0, PORT 4000)
│   ├── src/db.js        schema + DB connection (QUICKDROP_DB override)
│   ├── src/seed.js      seedDatabase() + CLI entry
│   ├── test/api.test.js node:test + supertest against a temp DB
│   └── quickdrop.db     local data (gitignored)
├── mobile/              Expo app — iOS / Android / web
│   ├── src/app/         Expo Router routes (every file is a screen)
│   ├── src/             non-route code: api, state, components, lib, theme
│   ├── test/            node --test suites for pure modules
│   ├── app.json         Expo config (scheme, plugins, bundle IDs, web output)
│   ├── eas.json         EAS build profiles (preview / simulator / production)
│   ├── .env.example     EXPO_PUBLIC_API_URL for web/simulator/device
│   └── AGENTS.md        Expo-specific agent rules
├── PLAN.md              MVP scope, phases, decisions, risks
├── AGENTS.md            Working agreement for contributors and agents
└── README.md            this file
```

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
| `EXPO_PUBLIC_API_URL` | API base URL. See the target table above. |

Never commit `.env`, `*.db`, `node_modules/`, or `dist/`.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Liveness probe |
| GET | `/api/restaurants` | List, sorted by rating |
| GET | `/api/restaurants/:id` | Restaurant + `menu[]` |
| POST | `/api/orders` | Create order; the server prices it |
| POST | `/api/orders/:id/pay` | Simulated payment; `pending_payment` → `preparing` |
| GET | `/api/orders/:id` | Order + items + restaurant summary |

Prices are always computed from the database, never sent by the client. Order statuses today are
`pending_payment` → `preparing`. Payment is one-shot: a second `/pay` returns 409.

## Web release

The app exports as a single-page bundle (`web.output: "single"`), which any static host can serve
with an SPA fallback to `index.html`.

```bash
npm run build:web     # writes mobile/dist/
npm run serve:web     # serves that build at http://localhost:8081
```

Deploy the contents of `mobile/dist/` to any static host (Netlify, Vercel, GitHub Pages, S3, …).
For hosts that need an explicit rewrite, redirect all paths to `/index.html` with status 200.
Because the web build is a client-side app, `EXPO_PUBLIC_API_URL` must point at a reachable API
(CORS is open by default in this MVP).

## Native preview builds (EAS)

`mobile/eas.json` defines internal-preview profiles — no store submission is configured.

| Profile | Output | Use |
|---|---|---|
| `preview` | Android `.apk`, iOS ad-hoc build | Install directly on registered devices |
| `preview-simulator` | iOS simulator build (extends `preview`) | Run in the iOS Simulator |
| `production` | Store-style binaries | Future store builds; not used in the MVP |

```bash
cd mobile
npx eas-cli@latest login
npx eas-cli@latest init          # first time only: links the project to your Expo account

# Android APK for a physical device
npx eas-cli@latest build --profile preview --platform android

# iOS simulator build
npx eas-cli@latest build --profile preview-simulator --platform ios

# iOS device build (register the device when prompted)
npx eas-cli@latest build --profile preview --platform ios
```

The bundle identifiers live in `mobile/app.json` (`com.devsteve06.quickdrop`). Change them if you
fork the project and EAS reports that they are already in use.

Android preview builds allow plain-HTTP traffic (`android.usesCleartextTraffic`) so a device can
reach a LAN API such as `http://192.168.1.20:4000`. Remove that setting, or move it behind a
development-only profile, before serving the API over HTTPS. iOS blocks cleartext HTTP by default;
use the Expo tunnel or an HTTPS API for physical iOS devices.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `EALLOWSCRIPTS` from `npx expo install` | npm 11.19 with a user-level `allow-scripts` setting; install with plain `npm install` using the SDK-compatible versions Expo resolved, or run with a clean `npm_config_userconfig` |
| App shows a network error on a phone | Set `EXPO_PUBLIC_API_URL` to the computer's LAN IP and restart Expo; confirm the API is reachable at `http://<LAN-IP>:4000/api/health` |
| Android emulator cannot reach the API | Use `http://10.0.2.2:4000`, not `localhost` |
| `node:sqlite` not found | Upgrade to Node >= 22.5 (`node --version`) |
| Database has no restaurants | Run `npm run seed`; `quickdrop.db` is gitignored |
| Web refresh on a deep link 404s | The host needs an SPA rewrite to `index.html` |
| `npx expo lint` fails | Use `npm run lint --prefix mobile` (ESLint 9 CLI quirk) |
| Web export warns about a Metro cache | Harmless; it falls back to a full crawl. Delete `mobile/.expo` if it persists |

## Notes

- **No auth:** orders are guest-only and `GET /api/orders/:id` is unauthenticated by design.
- **Storage:** SQLite is local and some hosts reset disk; orders are not durable in production.
  Postgres is the post-MVP step.
- **Money:** totals are rounded to 2 dp server-side; integer cents are a post-MVP refinement.
- **Emoji:** the app uses emoji instead of food photography; rendering varies by platform.
- **Tests:** API tests use a temp `QUICKDROP_DB` file; mobile tests cover pure modules only
  (reducer, persistence, validation, order flow, formatters). Screens and storage are checked manually.

## Note on removed files

An unrelated plan for a courier/parcel-pickup PWA briefly lived in `docs/` and
`stack_report.md` in this repository. It was a different product on a different stack, so it
was moved out and now lives in the sibling `quickdrop-courier-plan` folder. It remains in
this repository's git history, but nothing here depends on it.

The original React DOM/Vite `client/` app was deleted in Phase 7 now that the Expo app covers the
same flow on iOS, Android, and web.
