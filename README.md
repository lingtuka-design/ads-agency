# AdAgencyHub — Advertising Agency Marketplace

A production-oriented **advertising agency marketplace** connecting **advertisers** with **publishers / media owners**, operated end-to-end by a central agency. Built Cloudflare-native: **Workers + D1 + R2 + KV**, with a **Vite + React + TypeScript + TanStack Router/Query + Tailwind** frontend.

## Highlights

- **Three dashboards** — Advertiser, Publisher, Admin (strict role-based access)
- **Live inventory** — transactional slot reservations; no overbooking (spec §6)
- **Booking state machine** — only valid transitions allowed, full history (spec §73)
- **Permanent financial snapshots** — commission frozen at booking time, immutable ledger (spec §55)
- **Payment abstraction** — swap gateways without redesign; server-side verification + webhooks (spec §56); manual provider for local/test
- **Invoices, settlements, disputes, creative studio, scoped messaging, notifications, audit logs, CSV reports**
- **AI Advertising Assistant** — Gemini (via server-side Worker only), Mizo/English, recommends *real* database packages — never invented data (spec §28, §76)
- **Cron maintenance** — expired reservations auto-released (spec §72)

## Quick start

Prerequisites: Node 20+, npm, [wrangler](https://developers.cloudflare.com/workers/wrangler/) (included as devDependency).

```bash
npm install                       # install all workspaces
npm run db:migrate                # apply D1 migrations to local DB
npm run dev:worker                # start Cloudflare Worker API on :8787 (in one terminal)
npm run dev                       # start Vite frontend on :5173 (in another terminal)
npm run db:seed                   # load demo publishers/packages/campaigns (worker must be running)
```

Open http://localhost:5173

### Local secrets (`.dev.vars` — never commit)

```bash
ADMIN_BOOTSTRAP_USERNAME=lingtuka
ADMIN_BOOTSTRAP_PASSWORD=MAWLA1984@mala
SESSION_SECRET=<random>
PAYMENT_PROVIDER=manual
```

> The bootstrap admin is created **only** from these environment secrets, hashed with PBKDF2, and must change the password on first login (spec §36).

### Demo accounts (after `npm run db:seed`)

| Role      | Email / username              | Password  |
| --------- | ----------------------------- | --------- |
| Admin     | `lingtuka`                    | `MAWLA1984@mala` |
| Advertiser| `demo.advertiser@agency.test` | `demo1234` |
| Publishers| `demo.influencer@agency.test`, `demo.youtube@agency.test`, `demo.news@agency.test`, `demo.paper@agency.test`, `demo.fb@agency.test` | `demo1234` |

## Testing

```bash
npm test        # unit tests: commission engine, inventory, booking state machine
npm run typecheck
```

## Deploying to Cloudflare

1. Create resources: `wrangler d1 create ad-agency-db`, `wrangler r2 bucket create ad-agency-files`, `wrangler kv namespace create KV` — copy IDs into `wrangler.jsonc`.
2. Set secrets (never in code):
   ```bash
   wrangler secret put ADMIN_BOOTSTRAP_USERNAME
   wrangler secret put ADMIN_BOOTSTRAP_PASSWORD
   wrangler secret put SESSION_SECRET
   wrangler secret put GEMINI_API_KEY      # optional; fallback recommender works without it
   wrangler secret put PAYMENT_PROVIDER    # "manual" or "razorpay"
   wrangler secret put RAZORPAY_KEY_ID     # if using razorpay
   wrangler secret put RAZORPAY_KEY_SECRET
   wrangler secret put RAZORPAY_WEBHOOK_SECRET
   ```
3. `npm run build` (builds web → `apps/web/dist`, worker dry-run)
4. `wrangler d1 migrations apply ad-agency-db --remote`
5. `npx wrangler deploy`

The Worker serves both the API and the built SPA (single deployment).

## Architecture

```
apps/web        React frontend (Vite, TanStack Router, TanStack Query, Tailwind)
worker/src      Hono API on Cloudflare Workers (auth, RBAC, domains)
worker/seed     Demo-data seeder (runs against a running dev worker)
shared/src      Shared domain types + pure business logic (commission, inventory, state machines)
migrations/     D1 SQL migrations
```

### API modules

`/api/auth` · `/api/public` · `/api/users` · `/api/publishers` · `/api/bookings` · `/api/payments` · `/api/invoices` · `/api/settlements` · `/api/creatives` · `/api/messages` · `/api/disputes` · `/api/favorites` · `/api/notifications` · `/api/uploads` · `/api/reviews` · `/api/ai` · `/api/admin`

### Security posture (spec §57)

- PBKDF2 password hashing (Web Crypto), httpOnly/SameSite session cookies, Bearer support
- Server-side authorization on every endpoint — never trust the frontend
- Zod input validation everywhere; consistent error format
- Payment success only via server-side verification (never the frontend callback alone)
- Webhook HMAC signature verification (Razorpay)
- Private R2 files served only to their owner, through the Worker
- Audit logging for sensitive actions; secrets live only in Cloudflare secrets
- Rate limiting hooks provided via `Rate Limit`/security headers ready for production tuning

## Project structure notes

- Spec reference: master requirements are implemented across the codebase; pure financial/inventory/state-machine rules live in `shared/src` so they are unit-testable and identical on both sides.
- New media types, commission structures, payment providers and future business models can be added without rewriting the core (spec §71).
