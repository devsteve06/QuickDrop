# QuickDrop Stack Research Report (RESEARCH ONLY — Verified as of 2026)

## 1. Pinned Stack Table

| Component | Exact version | One-line why |
|---|---|---|
| **Node.js (LTS)** | **v24.19.0** (Active LTS, Krypton) | Current Active LTS (EOL 2028-04-30). Node 26 enters LTS Oct 28 2026 but still Current as of Sept 2026; v24 is safest for production. [nodejs.org](https://nodejs.org/en/about/previous-releases/); [Release schedule](https://nodejs.org/en/blog/announcements/evolving-the-nodejs-release-schedule/) |
| **TypeScript** | **7.0.2** | TypeScript 7.0 (native Go port, July 2026) is current stable with major performance gains. [Blog](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/); [Releases](https://github.com/microsoft/TypeScript/releases); [npm](https://www.npmjs.com/package/typescript) |
| **Next.js (App Router)** | **15.5.27** | Current stable App Router line with Sept 2026 security patches. 16.x exists; 15.5.x recommended for stability. [Next.js 15.5](https://nextjs.org/blog/next-15-5); [Security release](https://nextjs.org/blog/september-2026-security-release); [npm latest](https://registry.npmjs.org/next/latest) |
| **React / React DOM** | **19.3.0** | Latest stable React 19 (Sept 2026) with View Transitions and Fragment Refs stable. [React 19.3](https://react.dev/blog/2026/09/09/react-19-3); [Versions](https://react.dev/versions) |
| **Tailwind CSS** | **4.3.3** | Current stable v4.x line. [Blog](https://tailwindcss.com/blog/tailwindcss-v4-3); [npm](https://www.npmjs.com/package/tailwindcss) |
| **Backend framework** | **Hono v4.13.13** (recommended) | Lightweight, runtime-agnostic (Node/workers), built-in WebSocket support; better fit than heavier NestJS or more barebones Fastify for self-hosted multi-surface app. [Hono](https://hono.dev/); [npm](https://www.npmjs.com/package/hono) |
| **ORM (Postgres)** | **Drizzle ORM 0.45.3** + **postgres.js 3.4.9** (recommended) | Drizzle: SQL-first, type-safe, minimal; Prisma 8.0.0-rc is pre-stable. postgres.js: ESM-friendly, good streaming, preferred over pg for modern TS/ESM. [Drizzle](https://orm.drizzle.team/); [postgres.js](https://github.com/porsager/postgres) |
| **Job/Queue** | **BullMQ 6.3.11 + Redis** (recommended) | Mature worker model, retries, scaling, portable across PaaS (Railway/Render/Fly). Inngest/Trigger.dev are serverless-first; BullMQ better for explicit background workers. [BullMQ](https://docs.bullmq.io/) |
| **Validation** | **Zod 4.6.5** (recommended) | Current v4 stable, broad ecosystem. Valibot 1.5.0 fast/light; Zod strongest in Next/TS schema DX. [Zod](https://zod.dev/) |
| **Auth** | **Better Auth 1.7.7** (recommended) | Self-hosted-friendly with roles/orgs via plugins, MIT, actively developed. Auth.js v5 maintenance mode (Sept 2025); Clerk managed; Lucia deprecated. Vercel acquisition (July 2026) — license/DB ownership unchanged for now; monitor. [Better Auth](https://www.better-auth.com/) |
| **Maps SDK** | **MapLibre GL JS 6.12.0** (recommended) | OSS, self-hostable, vector tiles, offline/PWA friendly. Leaflet 1.9.4 simpler; Google Maps restrictive/licensing. [MapLibre](https://maplibre.org/) |
| **Payments** | **@stripe/stripe-js 10.0.0, stripe 23.0.0** | Current SDKs. Use **separate charges + transfers** for marketplace payouts (platform charges, transfers to connected accounts). Stripe moving to **Accounts v2** for Connect (unified Account objects); legacy account types deprecated in favor of controller properties. New Connect integrations should follow Accounts v2 guidance. [Stripe Connect](https://docs.stripe.com/connect/) |

## 2. PWA + iOS Constraints

- **Recommended approach (2026):** Use Next.js App Router with a service worker strategy. 
ext-pwa is still commonly used, but the preferred modern approach is **hand-rolled Workbox** (or Serwist) integrated with Next.js build output for finer control. 
ext-pwa can work but can be limiting with App Router/Turbopack; consider custom SW for background sync, runtime caching. [Next.js PWA guidance](https://nextjs.org/docs/app/guides/progressive-web-apps); [Workbox](https://developer.chrome.com/docs/workbox/)
- **Web App Manifest:** Must include 
ame, short_name, start_url, display (standalone), icons (multiple sizes incl. maskable), 	heme_color, ackground_color, scope, and preferably lang, description. Also consider prefer_related_applications not needed; include maskable icons for adaptive icons. [Web App Manifest (MDN)](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- **iOS Safari PWA limitations (critical for courier app):**
  - **Background geolocation:** iOS does not allow continuous background location updates via browser Geolocation API when PWA is in background/closed in the same way as native; geolocation callbacks may pause significantly. If background tracking is mandatory, plan native fallback or user education; watchPosition works while app is foreground/active; backgrounded behavior is highly restricted. [WebKit Geolocation](https://developer.apple.com/documentation/webkitjs/geolocation)
  - **Install prompt:** eforeinstallprompt event not fired on iOS Safari; users must manually Add to Home Screen. Cannot programmatically trigger install. [PWA on iOS](https://web.dev/learn/pwa/installation/#ios-installation)
  - **Background Sync:** Background Sync API not supported in iOS Safari. Use fallback (retry on reconnect, manual sync) or push notifications with server-side logic. [Background Sync support](https://caniuse.com/background-sync)
  - **Service Workers:** Supported in iOS 11.3+; however lifecycle/timing differs (SW may be terminated aggressively). [Service Workers on iOS](https://webkit.org/blog/8090/workers-at-your-service/)
  - **Storage eviction:** iOS may evict PWAs under low storage/memory or after inactivity; IndexedDB/Cache Storage can be cleared. Design for resilience (re-sync critical state). [iOS storage limits](https://developer.apple.com/documentation/webkitjs/working_with_web_storage)
  - **Geolocation while backgrounded:** No guarantee of frequent updates; battery/network optimization aggressively throttles. Consider periodic heartbeats + server-side smoothing; for accurate ETAs, combine with client-side filtering. 
  - **Notifications/Push:** Web Push API supported on iOS 16.4+ for installed PWAs; earlier versions no. [Web Push on iOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)

## 3. Tracking Architecture (consumer→server fan-out)

- **Browser constraints:** 
avigator.geolocation.watchPosition(success, error, options) provides positions; enableHighAccuracy, maximumAge, 	imeout tradeoffs affect battery/accuracy. Expect variable accuracy (10m+ in poor GPS). Mobile browsers throttle in background. [Geolocation API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API)
- **Recommended design:** **Client streams positions to server (primary WebSocket)**; server fuses, validates, stores recent points, and **fan-outs updates to consumers (customers/dispatch) via WebSocket/SSE**. 
  - **Courier client → server:** send position batches (throttle to e.g. 2–5s, or on movement > threshold, or adaptive by speed) with timestamp, accuracy, heading, speed. Include request idempotency keys. Use WebSocket with heartbeat/ping-pong; reconnect with backoff.
  - **Server → consumers:** push live updates (courier position, ETA updates, status) via WebSocket rooms per delivery/job. For browser clients, prefer WebSocket; if WebSocket unavailable, fallback to **SSE** (unidirectional) or **long-polling**.
  - **Fallbacks:** WebSocket primary; SSE if only one-way needed/simple; polling (e.g. 2–5s) as last resort. SSE works over HTTP but has connection limits; WebSocket better for bidirectional. [WebSocket vs SSE](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_client_applications#differences_between_websocket_and_http)
- **ETA from position stream:** Use map-matching + route-based ETA (OSRM/Valhalla/GraphHopper) with current position along route, speed, traffic if available. If no route calculated, use haversine/velocity projection as rough estimate; smooth with Kalman/exponential moving average; update on significant position change or time interval. Cache routes per job. 
- **Resilience:** store last-known position with timestamp; detect stale (>threshold), flag accuracy issues; offline queue (IndexedDB) for courier position sends when reconnecting; server rejects out-of-order/implausible jumps (speed > max). 

## 4. Geospatial "Find Nearest Available Courier"

- **Recommended:** **Postgres + PostGIS** (self-hosted, cost-effective, full control). Neon/Supabase also run Postgres+PostGIS; for self-hosted deployment, plain Postgres+PostGIS is simplest. Turbopuffer is vector DB (not ideal for transactional availability+filters); avoid purely hosted black-boxes unless needed.
- **Schema essentials:** couriers (id, status enum, last_lat, last_lng, last_seen_at, vehicle_type, etc.), spatial index on geography/geometry (point). Use geography(Point, 4326) for meter-based distance. Also index status+last_seen_at.
- **Query shape (nearest available within radius, e.g. 5km):**
  `sql
  SELECT 
    c.id,
    ST_Distance(c.location_geog, ST_SetSRID(ST_MakePoint(:drop_lng, :drop_lat), 4326)) AS distance_m,
    c.last_lat, c.last_lng, c.status, c.last_seen_at
  FROM couriers c
  WHERE c.status = 'available'
    AND c.last_seen_at > NOW() - INTERVAL '5 minutes'  -- freshness
    AND ST_DWithin(c.location_geog, ST_SetSRID(ST_MakePoint(:drop_lng, :drop_lat), 4326), 5000)  -- 5km
  ORDER BY distance_m
  LIMIT 10;
  `
- **Notes:** Use ST_DWithin (index-assisted, efficient) over ST_Distance in WHERE for large tables; store location as geography(Point,4326). Update last position with timestamp; consider bounding box first for performance. For Redis-only geospatial (geohash), possible but less flexible for complex filters (status, vehicle, etc.) vs PostGIS.

## 5. Hosting/Deployment

- **Comparison (PaaS supporting long-lived WebSocket + background workers):**
  - **Railway:** Simple, supports persistent services (WebSocket long-lived), background workers as separate services, managed Postgres/Redis. Reasonable scaling. Good DX. Pricing can grow with usage.
  - **Render:** Web services + background workers + Redis/Postgres. Free tier limited; paid plans support WebSockets. May have cold starts on free; workers billed separately.
  - **Fly.io:** Apps run as VMs/containers close to users, great for WebSocket + workers (separate machines/processes), global; requires more ops awareness but flexible. 
  - **AWS (ECS/Fargate/App Runner):** Most flexible but higher ops; can run WS + workers + RDS/ElastiCache; overkill for small scale unless already invested.
- **Rough small-scale cost estimate (~5k monthly orders, a few hundred concurrent):**
  - **Railway (recommended):** Web service (WS + API) ~–40/mo, background worker(s) ~–20/mo, Postgres ~–30/mo, Redis ~–15/mo → **~–/mo** (small). Scale up with traffic; can be higher if heavy compute.
  - **Render:** Similar ballpark; may be comparable. Fly.io: VM-based, can be cost-effective but varies by region/resources.
- **Recommendation:** **Railway**. Why: straightforward setup for WebSocket + background workers (separate services), managed infra, predictable pricing, good for one-codebase deployment (API + WS + workers), less YAML/infra complexity than AWS, and sufficient for 5k orders scale. Fly.io is also strong if global latency critical; Railway wins on simplicity.

## 6. Money Correctness

- **Standards:**
  - **Integer minor units:** Store all amounts in cents/smallest currency unit (e.g. integer) — never floats. Avoid floating point for money. 
  - **Double-entry ledger:** Every money movement is a balanced transaction (debits/credits across accounts). Immutable ledger entries with references (charge, transfer, payout, refund, fee). 
  - **Idempotency keys:** All write operations (charges, transfers, payouts, ledger writes) must use idempotency keys to prevent duplicates on retries. 
  - **Other essentials:** Use database transactions with constraints, audit trail, reconciliation, avoid negative balances where not allowed, handle currency precision, Stripe webhooks must be idempotently processed (event keys), 3-way reconciliation between platform, Stripe, ledger.
- **Recommended tooling:** **Stripe** (payments/Connect) as source of truth for external money movement; for internal ledger in TS/Postgres, use a well-tested approach. Libraries: consider dinero.js for currency math if needed, but with integer minor units arithmetic is simple. For double-entry, avoid homegrown complex frameworks unless necessary — implement a minimal double-entry ledger with strict constraints (CHECK balances non-negative, transactions balanced). Tools like @snaplet/seed/raw SQL are fine; no single "blessed" TS double-entry lib dominates, but patterns are well-known. Also use Stripe's idempotency keys and event processing. [Stripe idempotency](https://docs.stripe.com/api/idempotent_requests); [Money handling best practices](https://stripe.com/docs/treasury/money-movement)

## 7. Open Questions

- **Node.js LTS timing:** Node 26 enters LTS Oct 28 2026; if deployment happens after that date, consider targeting Node 26 LTS (24 remains valid until 2028). Verify hosting platform Node version at deploy time.
- **TypeScript 7.0 ecosystem:** Some tooling (especially build plugins that depend on TypeScript compiler API) may need updates for 7.0 (TS 7.0 shipped without stable programmatic API in some cases; follow 7.1). Verify compatibility with chosen Next.js version.
- **Better Auth Vercel ownership:** License (MIT) and self-hosted DB ownership unchanged as of July 2026, but roadmap/control could evolve. Monitor for breaking changes if using paid plugins/features. [Vercel acquisition](https://vercel.com/blog/vercel-acquires-better-auth)
- **Stripe Connect Accounts v2:** API shape changing; new Connect integrations should prefer Accounts v2, but ensure SDK compatibility and webhook/event handling with chosen API version. Set explicit Stripe API version. [Accounts v2](https://docs.stripe.com/changelog/clover/2025-12-15/accounts-v2)
- **iOS background geolocation:** Browser-only cannot guarantee continuous background updates on iOS. If courier compliance requires guaranteed background tracking, plan alternative (native wrapper) or acceptance criteria; current browser constraints cannot be fully eliminated. [WebKit geolocation limitations](https://developer.apple.com/documentation/webkitjs/geolocation)
- **Background Sync/Push on iOS:** Web Push only iOS 16.4+ for installed PWAs; Background Sync unsupported. Requires fallback design.
- **PWA/Turbopack:** If using Next.js with Turbopack, custom service worker integration needs verification per version.

## 8. Sources

- Node.js: [nodejs.org releases](https://nodejs.org/en/about/previous-releases/), [Release schedule blog](https://nodejs.org/en/blog/announcements/evolving-the-nodejs-release-schedule/), [PkgPulse comparison](https://www.pkgpulse.com/guides/nodejs-22-vs-nodejs-24-2026)
- TypeScript: [TS 7.0 blog](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/), [GitHub releases](https://github.com/microsoft/TypeScript/releases), [npm typescript](https://www.npmjs.com/package/typescript)
- Next.js: [Next 15.5](https://nextjs.org/blog/next-15-5), [Sept 2026 security](https://nextjs.org/blog/september-2026-security-release), [npm next](https://registry.npmjs.org/next/latest)
- React: [React 19.3](https://react.dev/blog/2026/09/09/react-19-3), [react.dev versions](https://react.dev/versions), [npm react](https://www.npmjs.com/package/react)
- Tailwind: [v4.3 blog](https://tailwindcss.com/blog/tailwindcss-v4-3), [npm](https://www.npmjs.com/package/tailwindcss)
- Hono: [hono.dev](https://hono.dev/), [npm](https://www.npmjs.com/package/hono)
- Drizzle/postgres.js: [Drizzle ORM](https://orm.drizzle.team/), [postgres.js](https://github.com/porsager/postgres)
- BullMQ: [docs.bullmq.io](https://docs.bullmq.io/), [npm](https://www.npmjs.com/package/bullmq)
- Zod: [zod.dev](https://zod.dev/), [npm](https://www.npmjs.com/package/zod)
- Better Auth: [better-auth.com](https://www.better-auth.com/), [npm](https://www.npmjs.com/package/better-auth), [Vercel acquisition](https://vercel.com/blog/vercel-acquires-better-auth), [comparisons](https://wolf-tech.io/blog/nextjs-authentication-frameworks-2025-2026-authjs-v5-clerk-better-auth-lucia-b2b-saas)
- MapLibre: [maplibre.org](https://maplibre.org/), [npm](https://www.npmjs.com/package/maplibre-gl)
- Stripe: [Connect](https://docs.stripe.com/connect/), [Accounts v2 changelog](https://docs.stripe.com/changelog/clover/2025-12-15/accounts-v2), [idempotency](https://docs.stripe.com/api/idempotent_requests)
- PWA/iOS: [MDN Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest), [iOS PWA](https://webkit.org/blog/8090/workers-at-your-service/), [Web Push on iOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [Background Sync](https://caniuse.com/background-sync)
- Geolocation/WebSocket: [Geolocation API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API), [WebSocket vs SSE](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_client_applications#differences_between_websocket_and_http)
- Geospatial: [PostGIS](https://postgis.net/), [ST_DWithin](https://postgis.net/docs/ST_DWithin.html)
- Hosting: [Railway](https://railway.app/), [Render](https://render.com/), [Fly.io](https://fly.io/)
