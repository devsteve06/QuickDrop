# QuickDrop — MVP Plan (React Native + Web)

## Status

- **Phase 0 — Decisions & scaffolding: ✅ done** (Expo SDK 58 app in `mobile/`, Expo Router entry, web export verified)
- **Phase 1 — API MVP-complete: ✅ done** (`/api/health`, binds `0.0.0.0`, hardened validation, 15 API tests passing)
- **Phase 2 — Expo foundation: ✅ done** (API client with timeout/error extraction, theme tokens, shared
  components, `CartProvider`, platform alert helper, five-route shell)
- **Phase 3 — Browse & menu: ✅ done** (restaurant list, menu screen, quantity steppers, cross-restaurant
  confirm modal, loading/empty/retry states). Verified with lint, web export, and a reducer smoke test;
  the iOS/Android click-through is folded into the Phase 6 device matrix.
- **Phase 4 — Cart & state: ✅ done** (versioned AsyncStorage key `quickdrop.cart.v1` with hydration on
  launch, write-behind persistence that never blocks the flow, clearing when the cart empties, `hydrated`
  flag so the cart screen does not flash an empty state, 32 mobile unit tests). The native
  survive-a-kill verification is folded into the Phase 6 device matrix.
- **Phase 5 — Checkout & order: ✅ done** (validated guest form, server-priced order, simulated payment,
  confirmation with status/ETA/itemised totals, retry that never duplicates an order, 20 more unit
  tests). The create→pay→confirm flow was also exercised end-to-end against the real API on a
  throwaway database; the iOS/Android click-through stays in the Phase 6 device matrix.
- **Phase 6 — Cross-platform polish & QA: ✅ done (code side)** (safe areas, web max-width containers,
  44 px touch targets, accessibility roles/labels/focus rings, dynamic-type tolerance, route error
  boundary + not-found screen, global offline banner, Android cleartext dev config). The manual
  simulator/device/browser matrix still has to be run by a human — see the Phase 6 status note.
- **Phase 7 — Tests, docs, release build: ✅ done** (README rewrite with prerequisites, per-target
  run instructions, API contract, web release, EAS preview builds, and troubleshooting; legacy
  `client/` deleted; `mobile/eas.json` preview profiles; web export + `expo serve` scripts). The
  Phase 6 device/browser matrix remains manual and is the only outstanding QA item.

## 1. Goal

Ship a **guest-checkout food delivery MVP** from a **single React Native codebase** that runs on
iOS, Android, and the web (via `react-native-web`), backed by the existing Express + SQLite API.

The original `client/` was a React DOM/Vite app. It proved the flow but could not run on mobile,
so the MVP replaced it with an Expo app; the server was kept and hardened.

**MVP means:** a user can browse restaurants, build a cart, check out with delivery details,
place an order with simulated payment, and see a confirmed order with status and ETA — on phone and web.

## 2. MVP scope

### In scope
- Restaurant list (name, cuisine, rating, ETA, delivery fee)
- Restaurant menu with prices and descriptions
- Add / remove / change quantity; single-restaurant cart
- Cart persisted across app restarts (AsyncStorage)
- Guest checkout: name, address, optional phone
- Server-computed totals (client never sends prices)
- Simulated payment (`pending_payment` → `preparing`)
- Order confirmation: order number, items, total, ETA, status
- Loading, empty, and error states on every network screen
- Responsive web layout + native-safe areas/keyboard handling

### Out of scope (post-MVP)
Accounts/auth, real payments, order history, live courier tracking, push notifications,
restaurant admin, search/filters, ratings/reviews, coupons, multi-currency, i18n, real food photography.

## 3. Architecture

```
quickdrop/
├── server/                 # Express + node:sqlite API (keep, harden)
│   └── src/{db,index,seed}.js
├── mobile/                 # NEW: Expo app (iOS / Android / Web)
│   ├── src/app/            # Expo Router screens (template convention)
│   │   ├── _layout.jsx
│   │   ├── index.jsx            # restaurant list
│   │   ├── restaurant/[id].jsx  # menu
│   │   ├── cart.jsx
│   │   ├── checkout.jsx
│   │   └── order/[id].jsx       # confirmation
│   ├── src/
│   │   ├── api/client.js        # fetch wrapper + EXPO_PUBLIC_API_URL
│   │   ├── state/cart.jsx       # Context + useReducer (pure reducer)
│   │   ├── components/          # Button, TextField, QuantityStepper, Card, StateViews
│   │   └── theme.js             # spacing, colors, typography tokens
│   ├── app.json
│   ├── eas.json                 # internal-preview build profiles
│   └── package.json
└── package.json            # dev scripts for API + Expo
```

**Data flow:** screens → `api/client.js` → Express → SQLite. Cart lives in a reducer under
`CartProvider`; checkout posts `{restaurantId, customerName, address, phone, items:[{id, qty}]}`,
then calls `/pay`, then routes to the confirmation screen.

### Key technical decisions
| Decision | Choice | Why |
|---|---|---|
| Mobile + web framework | **Expo** (latest stable SDK) + `react-native-web` | One codebase, managed native builds, first-class web |
| Navigation | **Expo Router** (file-based) | Deep links and real URLs on web; standard for new Expo apps |
| Language | **JavaScript** for MVP (TS later) | Matches existing server/client code; avoids a migration detour |
| State | **Context + `useReducer`** | No Redux dependency; reducer is unit-testable |
| Persistence | **AsyncStorage** | Works on native and web (localStorage) |
| Styling | **`StyleSheet` + theme tokens** | No UI-kit lock-in; consistent cross-platform |
| API base URL | `EXPO_PUBLIC_API_URL` env var | `localhost` does not work from a physical device |
| Icons | `@expo/vector-icons` | Bundled with Expo; no asset pipeline needed |

### API base URL per target
```
Web (same machine)      EXPO_PUBLIC_API_URL=http://localhost:4000
iOS/Android simulator   EXPO_PUBLIC_API_URL=http://localhost:4000
Android emulator        EXPO_PUBLIC_API_URL=http://10.0.2.2:4000
Physical device         EXPO_PUBLIC_API_URL=http://<LAN-IP>:4000   (server must bind 0.0.0.0)
```

## 4. Phases

Effort assumes one developer. Total: **~8–10 working days**.

### Phase 0 — Decisions & guardrails (0.5 day)
- Confirm the four open decisions in §7.
- Scaffold `mobile/` with `npx create-expo-app@latest` (blank/TypeScript template → strip to JS).
- Add `mobile/.env.example` with `EXPO_PUBLIC_API_URL`.
- Update root scripts: `dev:api`, `dev:app`, `dev` (concurrently).
- Add `engines: { "node": ">=22.5" }` to `server/package.json`.

**Done when:** `npx expo start` opens the starter app on web and a simulator, and the API still runs.

### Phase 1 — API MVP-complete (0.5–1 day)
Already working: list restaurants, restaurant + menu, create order, simulated pay, get order.
Remaining:
- `GET /api/health` returning `{ ok: true }`.
- Bind `app.listen(PORT, "0.0.0.0")` so devices on the LAN can reach it.
- Harden validation: trim strings, cap lengths, validate phone shape, reject non-numeric/NaN qty.
- Return consistent `{ error }` bodies; log unexpected 500s server-side but keep them generic.
- Scope the item lookup inside the order transaction to `restaurant_id`.
- Add cart-shaped integration tests with `node:test` + `supertest` (or direct handler tests).

**Done when:** every MVP request is covered by a test; `POST /api/orders` rejects bad payloads with 400 and
never inserts a partial order.

### Phase 2 — Expo foundation (1 day)
- Expo Router root layout + 5 route files (placeholders).
- `src/api/client.js`: `request(path, options)` with base URL, JSON headers, error extraction,
  and a timeout/abort guard.
- `src/theme.js` tokens; shared `Button`, `TextField`, `Card`, `Screen`, `StateView` components.
- `CartProvider` mounted in the root layout.
- Platform helper for alerts: `Alert.alert` on native, inline banner/modal on web.

**Done when:** navigating between placeholder screens preserves cart state on native and web,
and a test request to `/api/health` succeeds from both.

### Phase 3 — Browse & menu (1–1.5 days)
- Home: fetch restaurants, render `RestaurantCard` in a responsive list (1 column mobile, grid ≥768 px web).
- Restaurant screen: fetch by route param, header with rating/ETA/fee, menu rows with price + Add.
- Quantity stepper for items already in the cart.
- Loading skeleton/spinner, empty state, retry on error.
- Add-to-cart from a different restaurant triggers a confirm (custom modal, not `confirm()`).

**Done when:** user can browse to any restaurant and add items on all three targets.

### Phase 4 — Cart & state (1 day)
- Pure reducer: `ADD`, `INC`, `DEC`, `REMOVE`, `CLEAR`, `REPLACE_RESTAURANT`; selectors for count/subtotal.
- Single-restaurant invariant enforced in the reducer, not the UI.
- Cart screen: line items, steppers, subtotal, delivery fee, total, clear cart.
- Persist cart to AsyncStorage (versioned key), rehydrate on launch, clear on successful order.
- Badge on the cart entry point.

**Done when:** cart survives an app reload; totals match the server's math to the cent.

**Status:** done 2026-11-03. `cartReducer.js` owns `HYDRATE` + `normalizeCart`; `cartPersistence.js`
is the pure serialize/parse layer (schema version 1, junk payloads discarded); `cartStorage.js` wraps
AsyncStorage with a serialized write queue and swallows storage failures. Clearing on successful order
is wired in Phase 5, where orders exist. Covered by `mobile/test/` (32 tests: reducer, invariants,
hydration, persistence round-trip and corruption).

### Phase 5 — Checkout & order (1–1.5 days)
- Checkout form: name, address, phone; inline validation; keyboard avoidance (`KeyboardAvoidingView`).
- Place order → `POST /api/orders` → `POST /api/orders/:id/pay` → navigate to `/order/[id]`.
- Disable the submit button while in flight; prevent double submission; surface API errors inline.
- Confirmation: order number, status, ETA, delivery address, itemized totals.
- "Order again" resets cart and routes home (no full page reload).
- Handle the edge case where create succeeds but pay fails: show retry, keep the order id.

**Done when:** a full order completes on iOS, Android, and web from a clean install.

**Status:** done 2026-11-03, with the device matrix deferred to Phase 6. `lib/checkoutValidation.js`
mirrors the server's field rules so the form and the API cannot disagree; `api/orderFlow.js` keeps
"create failed" and "pay failed" apart, so a failed payment keeps the order id and retries the payment
instead of creating a second order. A 409 from `/pay` is read as "already paid" (the lost-response
case). The order screen also offers payment for an order left in `pending_payment`, so that state is
not a dead end. Covered by `mobile/test/checkoutValidation.test.js`, `orderFlow.test.js`, and
`format.test.js`.

### Phase 6 — Cross-platform polish & QA (1–2 days)
- Safe areas (`react-native-safe-area-context`), web max-width container, touch targets ≥44 px.
- Accessibility: roles/labels on interactive elements, focus order on web, dynamic type tolerance.
- Error boundaries and offline/network-failure messaging.
- Manual test matrix: iOS simulator, Android emulator, iOS/Android device, Chrome + Safari web.
- Verify Android cleartext HTTP dev config or use the Expo tunnel for physical devices.

**Done when:** the matrix passes with no layout breaks, unhandled exceptions, or dead-end states.

**Status:** implementation done 2026-11-09; manual matrix pending a human with simulators/devices.

- `Screen` wraps every route in `SafeAreaView` (bottom edge only — the native stack header owns the
  top inset), and both floating banners offset by `useSafeAreaInsets().top`.
- Long-form screens (`cart`, `checkout`, `order/[id]`) cap at `layout.maxFormWidth` (720 px) and the
  home grid collapses to one column when `fontScale > 1.3`, so large text does not crush cards.
- All interactive controls are ≥44 px (`layout.minTouchTarget`), including the small Button size,
  the quantity stepper, the cart button, and the alert dismiss button.
- Accessibility: heading roles on screen titles/sections, richer button/card labels and hints,
  `accessibilityViewIsModal` on the confirm dialog, live regions on transient status text, and a
  visible `focusRing` (a `boxShadow`, because react-native-web ignores outline props) for keyboard
  focus on web.
- Failure handling: Expo Router's exported `ErrorBoundary` in `src/app/_layout.jsx` renders
  `ErrorFallback` with a retry that keeps the cart, `+not-found.jsx` catches bad links, and
  `OfflineBanner` uses `expo-network` to explain why requests fail while the device is disconnected.
- Android dev builds allow plain-HTTP LAN traffic via `expo-build-properties`
  (`android.usesCleartextTraffic: true`). This is a development convenience for reaching
  `http://<LAN-IP>:4000`; it should be removed or narrowed once the API is HTTPS.
- Verified: `npm test` (15 server + 52 mobile), `npm run lint --prefix mobile` exit 0,
  `npx expo-doctor` 20/20, `npm run export:web --prefix mobile` bundles 822 modules.
- Still manual: iOS simulator, Android emulator, iOS/Android physical device (including a cart
  survive-a-kill check and the cleartext LAN request), plus Chrome and Safari at desktop and mobile
  widths with VoiceOver/TalkBack and large-text settings.

### Phase 7 — Tests, docs, release build (1 day)
- Unit-test the cart reducer; API tests from Phase 1.
- `README.md`: prerequisites, install, seed, env config, run on web/iOS/Android, API contract, troubleshooting.
- Remove the old `client/` once parity is confirmed; update root scripts and `.gitignore`.
- Web release: `npx expo export --platform web` → static bundle (optionally served by Express).
- Native release: EAS build profiles for internal preview (TestFlight / APK) — not store submission.

**Done when:** a fresh clone can go from zero to a running app on all targets using only the README,
and a production web bundle builds cleanly.

**Status:** done 2026-11-09. `README.md` now covers prerequisites, install, seed, env config,
per-target run instructions, the API contract, web release (`npm run build:web` →
`mobile/dist/`, `npm run serve:web`), EAS preview builds, and troubleshooting. The legacy Vite
`client/` was removed (8 files), so `mobile/` is the only frontend. `mobile/eas.json` defines
`preview` (internal Android APK / iOS ad-hoc), `preview-simulator`, and `production` profiles;
bundle IDs are set in `app.json`. Verified with `npm test`, mobile lint, `expo-doctor` 20/20, and a
clean web export (822 modules).

## 5. API contract (MVP)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Liveness probe (new) |
| GET | `/api/restaurants` | List, sorted by rating |
| GET | `/api/restaurants/:id` | Restaurant + `menu[]` |
| POST | `/api/orders` | Create order; server computes prices |
| POST | `/api/orders/:id/pay` | Simulated payment; `pending_payment` → `preparing` |
| GET | `/api/orders/:id` | Order + items + restaurant summary |

Statuses for MVP: `pending_payment` → `preparing`. Later phases add `out_for_delivery` / `delivered`.

## 6. Acceptance criteria (MVP definition of done)

1. One codebase runs on iOS, Android, and web.
2. User can browse restaurants and menus loaded from the API.
3. User can add, change, and remove items; the cart survives restart and holds one restaurant.
4. Checkout requires name and address; totals are computed server-side and match the UI.
5. Simulated payment moves the order to `preparing`; confirmation shows id, items, total, ETA, status.
6. Network failures show a recoverable message — no white screens or unhandled exceptions.
7. API tests and cart-reducer tests pass; README reproduces setup from scratch.

## 7. Decisions to confirm before Phase 0

1. **Expo vs bare React Native** — recommend Expo (web support and native builds for free).
2. **Expo Router vs React Navigation** — recommend Expo Router (URLs/deep links on web).
3. **Replace `client/` vs run in parallel** — recommend parallel `mobile/`, delete `client/` in Phase 7.
4. **JavaScript vs TypeScript** — recommend JS for MVP; revisit TS after the flow is stable.

## 8. Risks & mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| `localhost` unreachable from devices | App appears broken on phones | Env-based API URL; bind server to `0.0.0.0`; document LAN IP/emulator addresses |
| Expo web quirks (`Alert`, keyboard, safe areas) | Web-only bugs | Platform-specific helpers; test web each phase, not only at the end |
| SQLite file resets on some hosts | Lost orders in demo | Accept for MVP; note managed Postgres as the post-MVP step |
| `node:sqlite` needs Node ≥ 22.5 | Deploy failure | Add `engines`; pin runtime in deploy config |
| Float money math | Off-by-a-cent totals | Server rounds to 2 dp; consider integer cents post-MVP |
| No idempotency key on `POST /api/orders` | A create that times out after the row is written can be retried into a duplicate order | Accepted for the MVP; the post-MVP fix is a client-supplied idempotency key stored with the order. Payment is protected: a second `/pay` returns 409 |
| `npx expo install` fails under npm 11.19 when a user-level `allow-scripts` is set (`EALLOWSCRIPTS`) | Dependency installs blocked | Add packages with `npm install` using the SDK-compatible versions Expo resolved (see `mobile/package.json`), or run with a clean `npm_config_userconfig` |
| Android dev builds allow cleartext HTTP | A shipped build would permit unencrypted traffic | Scoped as a development convenience for LAN API access; remove `usesCleartextTraffic` (or move to a dev-only build profile) when the API is served over HTTPS |
| Scope creep (accounts, tracking) | MVP slips | Out-of-scope list in §2 is binding until acceptance criteria pass |

## 9. Immediate next step

**MVP is feature-complete.** Phases 0–7 are done; the only outstanding item is the manual Phase 6
device/browser matrix (iOS simulator, Android emulator, physical iOS/Android devices, Chrome +
Safari, screen readers, large text), which needs hardware this environment does not have. Run it
before calling the MVP released.

After that, the post-MVP queue from §2 is next: accounts, real payments, order history, courier
tracking, Postgres persistence, integer-cent money, an idempotency key for `POST /api/orders`, and
store submission via EAS. The functional flow — browse → menu → cart → checkout → payment →
confirmation — is complete and was verified end-to-end against the API on a throwaway database.

Phase 2 was a hard prerequisite for Phase 3 (API client, theme, components, `CartProvider`, route
shell), so both phases landed together on 2026-11-03.
