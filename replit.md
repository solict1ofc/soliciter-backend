# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   ├── admin/              # Admin panel (React/Vite) — /admin route
│   └── mobile/             # Expo mobile app
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `artifacts/mobile` (`@workspace/mobile`)

Expo React Native app — "SOLICITE" services marketplace. Dark tech design (cyan/navy palette).
- 4 tabs: Solicitations, Global marketplace, Provider area, Profile
- **Service lifecycle**: `pending_payment → available → accepted → in_progress → completed → rated`
- **Marketplace payment system**: PIX via Mercado Pago → platform account → retained until service finalized → released (90% provider / 10% platform) on client confirmation
- Key files: `app/(tabs)/index.tsx` (client flow + PIX payment step), `app/(tabs)/global.tsx` (marketplace), `app/(tabs)/provider.tsx` (provider), `context/AppContext.tsx`
- Chat available after service is accepted
- AsyncStorage keys: `servicosapp_services_v2` (services), `servicosapp_provider_v3` (provider)
- `EXPO_PUBLIC_DOMAIN=$REPLIT_DEV_DOMAIN` — used to construct API URL: `https://${EXPO_PUBLIC_DOMAIN}/api`

### Payment System (Marketplace Escrow)

Full marketplace payment flow implemented:
- `createService()` sets `status: "pending_payment"` — service not yet visible to providers
- `createPayment()` calls `POST /api/payment/create-payment` → returns PIX QR code + copia-e-cola code
- `index.tsx` shows 3-step bar: Dados → Pagamento → Publicado
- Payment step: QR code image, copia-e-cola button, auto-poll every 4s via `GET /api/payment/status/:serviceId`
- When payment confirmed: DB status → `"retained"` (funds held by platform); service → `"available"` in mobile
- `confirmAndRate()` calls `POST /api/payment/release/:serviceId` → releases 90% to provider, 10% to platform
- **Test mode**: No `MERCADO_PAGO_ACCESS_TOKEN` configured → generates test PIX code, confirms payment immediately on first status poll
- **DB table** `service_payments`: `serviceId`, `paymentId`, `amount`, `status` (pending/test_pending/retained/released), `pixCode`, `providerId`, `providerAmount`, `platformAmount`, `createdAt`, `paidAt`, `retainedAt`, `releasedAt`
- `PLATFORM_FEE_RATE = 0.10` (10% platform fee on all paid services)
- Backend routes: `POST /api/payment/create-payment`, `GET /api/payment/status/:serviceId`, `POST /api/payment/release/:serviceId`

### Subscription Plans (Plano Assinatura)

Plans: Basic R$59, Destaque R$79, Premium R$99. Plan UI exists in `profile.tsx` but tapping subscribe shows "Em breve" alert. Plans will be activatable in a future update.

### Service Status Tracking

- **DB table**: `services` (`service_id`, `status`, `started_at`, `updated_at`)
- **Backend**: `POST /api/iniciar-servico` — receives `{ serviceId }`, upserts status to `em_andamento`
- **Mobile**: `startService()` in `AppContext.tsx` optimistically updates local state, calls API, reverts on failure
- **"Iniciar Serviço" / "Finalizar Serviço"**: Inline two-tap confirmation UI (no `Alert.alert` dialog) in `provider.tsx` `ServiceBlock`
- **Profile photo**: `expo-image-picker` used in `profile.tsx`; photo URI stored in `provider.photoUri` (AsyncStorage); displayed as circular avatar with camera overlay button

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.

## Render Deployment

Single Render web service — one Express server serves everything:

| Path | What |
|------|------|
| `/api/*` | Express API routes |
| `/admin` and `/admin/*` | Admin SPA (Vite build, SPA fallback) |
| `GET /` (with `expo-platform` header) | Expo Go platform manifests (JSON) |
| `GET /` (without header) | Mobile landing page (QR code) |
| `/_expo/*`, `/ios/*`, `/android/*` | Expo static bundles + assets |

### Build pipeline — `server/` standalone npm package
The `server/` directory is a self-contained npm project (no pnpm, no workspace:*).
Render uses it directly:
- **buildCommand**: `npm install && node build.mjs`
- **startCommand**: `npm start`  (→ `node --enable-source-maps dist/index.mjs`)
- **rootDir**: `server`

`server/build.mjs` does:
1. esbuild bundles `artifacts/api-server/src/index.ts` → `dist/index.mjs`
   Workspace libs (`@workspace/db`, `@workspace/api-zod`) are inlined via path aliases — no pnpm needed.
2. Copies pre-built admin panel `artifacts/admin/dist/public/` → `dist/admin-public/`

**Admin dist is committed to git** (`.gitignore` has `!artifacts/admin/dist/**` exception).
To update admin after changes: `pnpm --filter @workspace/admin run build` then commit.

### Root scripts (Replit dev only)
- `pnpm run render:build` — legacy (kept for reference)
- `pnpm run render:start` — legacy

### Required environment variables on Render
| Variable | Notes |
|----------|-------|
| `DATABASE_URL` | PostgreSQL connection string |
| `MERCADO_PAGO_ACCESS_TOKEN` | Mercado Pago production token |
| `SESSION_SECRET` | Render can auto-generate |
| `ADMIN_SECRET` | Token for admin panel login |
| `NODE_ENV` | Set to `production` |

Render auto-sets `PORT` (10000) and `RENDER_EXTERNAL_HOSTNAME` (used during build for Expo domain).

### Admin security
`/admin/*` requires Bearer token (`ADMIN_SECRET`) on all API calls — validated server-side via `requireAdmin` middleware in `src/routes/admin.ts`. The admin login page at `/admin/login` tests the token against `/api/admin/payouts` before storing it in `localStorage`.
