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
│   └── api-server/         # Express API server
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
- Service lifecycle: `pending_payment → available → accepted → in_progress → completed → rated`
- **Stripe Checkout payment flow**: mobile calls backend to create Stripe Checkout Session, opens browser, polls status after browser closes
- Key files: `app/(tabs)/index.tsx` (client flow), `app/(tabs)/global.tsx` (marketplace), `app/(tabs)/provider.tsx` (provider), `context/AppContext.tsx`
- Chat available after service is accepted
- AsyncStorage keys: `servicosapp_services_v2` (services), `servicosapp_provider_v3` (provider)
- `EXPO_PUBLIC_DOMAIN=$REPLIT_DEV_DOMAIN` — used to construct API URL: `https://${EXPO_PUBLIC_DOMAIN}/api`

### Stripe Payment Integration

End-to-end Stripe Checkout payment flow for the SOLICITE app:

- **DB table**: `service_payments` (`service_id`, `session_id`, `amount`, `status`, `created_at`, `paid_at`)
- **Backend** (`artifacts/api-server/src/`):
  - `stripeClient.ts` — gets Stripe credentials from Replit Stripe connector
  - `routes/payment.ts` — 4 endpoints: `POST /api/payment/create-checkout`, `GET /api/payment/status/:serviceId`, `GET /api/payment/success`, `GET /api/payment/cancel`
  - `app.ts` — webhook route at `/api/stripe/webhook` (BEFORE express.json middleware)
- **Mobile flow** (`artifacts/mobile/app/(tabs)/index.tsx`):
  1. User fills service form → creates service with `pending_payment` status
  2. Payment screen shows "Pagar com Stripe" button
  3. App calls `POST /api/payment/create-checkout` → gets checkout URL
  4. Opens Stripe Checkout in browser via `expo-web-browser`
  5. User pays → Stripe redirects to `/api/payment/success` → DB updated to `paid`
  6. After browser closes, app polls `/api/payment/status/:serviceId` for up to 8 seconds
  7. If `paid`, `confirmPayment()` is called → service becomes `available` in marketplace
- **Platform fee**: 10% only for "free" plan providers; waived for basic/destaque/premium
- **Escrow model**: client pays upfront, funds held in platform until service completion

### Subscription Payment (Plano Assinatura)

Stripe Checkout subscription flow for provider plans:

- **Backend** (`artifacts/api-server/src/routes/subscription.ts`):
  - `POST /api/criar-assinatura` — receives `{ plan, userId }`, creates Stripe Checkout Session with `mode: "subscription"` and `recurring: { interval: "month" }`, returns `{ url }`. `userId` is embedded in `success_url` so the DB can be updated on Stripe redirect.
  - `GET /api/subscription/success` — success redirect page; updates `users.isPremium=true` and `premiumExpiresAt=+1 month` in DB using `user_id` from query string; validates Stripe session status before writing
  - `GET /api/subscription/cancel` — cancel redirect page
  - Plan prices: basic R$59 (5900), destaque R$79 (7900), premium R$99 (9900) in cents
- **Mobile flow** (`artifacts/mobile/app/(tabs)/profile.tsx`):
  1. Provider selects a plan → confirmation alert
  2. `subscribePlan(plan)` calls `POST /api/criar-assinatura` → gets checkout URL
  3. Opens Stripe Checkout in browser via `expo-web-browser` (native) or `window.location.href` (web)
  4. After browser closes (native): `refreshUser()` syncs `isPremium` from DB, then `activatePlan()` updates local provider display state
  5. Profile tab also calls `refreshUser()` on every focus (via `useFocusEffect`) to keep `isPremium` in sync

### Stripe Webhook Security

The webhook at `POST /api/stripe/webhook` handles 3 event types:
- `checkout.session.completed` (mode=payment) → marks service_payments as paid
- `checkout.session.completed` (mode=subscription) → activates isPremium for 30 days
- `invoice.payment_succeeded` → renews isPremium on monthly subscription renewal

**Signature verification logic:**
- With `STRIPE_WEBHOOK_SECRET` set: uses `stripe.webhooks.constructEvent()` to cryptographically verify the Stripe signature — tamper-proof
- Without secret in production: rejects webhook with 400 (security enforced)
- Without secret in development: accepts with a warning log (convenience for local dev)

**To configure in production (Render):**
1. Stripe Dashboard → Developers → Webhooks → Add endpoint
2. URL: `https://YOUR-SERVICE.onrender.com/api/stripe/webhook`
3. Events: `checkout.session.completed`, `invoice.payment_succeeded`
4. Copy the signing secret (`whsec_...`)
5. Add as `STRIPE_WEBHOOK_SECRET` env var in Render (or Replit Secrets)

**Note:** Even without webhooks, payment confirmation is reliable via:
- `success_url` handler: verifies with Stripe API on redirect
- `GET /api/payment/status/:id`: verifies live with Stripe if DB shows pending

### Production URL Resolution (`getApiBase`)

Both `payment.ts` and `subscription.ts` use `getApiBase(req)` which resolves the server's public URL in priority order:
1. `APP_URL` env var (manual override for any platform)
2. `REPLIT_DOMAINS` (Replit development/hosting)
3. `RENDER_EXTERNAL_URL` (auto-set by Render)
4. Derived from `x-forwarded-proto` + `x-forwarded-host` request headers (works behind any proxy)

### Service Status Tracking

- **DB table**: `services` (`service_id`, `status`, `started_at`, `updated_at`)
- **Backend**: `POST /api/iniciar-servico` — receives `{ serviceId }`, upserts status to `em_andamento`
- **Mobile**: `startService()` in `AppContext.tsx` optimistically updates local state, calls API, reverts on failure

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.
