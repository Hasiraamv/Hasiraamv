# Fit Pocket

Fitness + nutrition + budget tracker. Backend API built on Cloudflare Workers
(Hono) with a Cloudflare D1 database. Deploys to `fitpocket.in`.

This repo currently contains the **backend/API only** by design — see
`FITPOCKET_UI_SPEC.md` for the frontend brief (handed to GitHub Copilot / a
separate frontend effort).

## Stack

- **Runtime**: Cloudflare Workers
- **Framework**: [Hono](https://hono.dev)
- **Database**: Cloudflare D1 (SQLite)
- **Auth**: JWT (HS256) in an httpOnly cookie, PBKDF2 password hashing (Web Crypto, no external deps)
- **AI**: Cloudflare Workers AI (`env.AI` binding) — no separate API key, billed on the Cloudflare account

## Status

- The `fitpocket-db` D1 database already exists in the Cloudflare account
  and has this schema applied directly (old app's tables were dropped and
  replaced — see migration note below). `wrangler.toml` already points at
  its real `database_id`.
- The `fitpocket` Worker already exists in the account (currently still
  running the old app's bundle) — deploying this repo will overwrite it
  with the new API.
- Remaining manual steps (need your Cloudflare login, not done from here):
  authenticate wrangler, set the `JWT_SECRET` secret, and run `wrangler deploy`.

## Local setup

```bash
npm install

# run migrations locally (only needed for local dev DB, remote is already migrated)
npm run db:migrate:local

# set a JWT secret for local dev
echo 'JWT_SECRET="replace-with-a-long-random-string"' > .dev.vars

npm run dev
```

## Deploy

```bash
npx wrangler login
npx wrangler secret put JWT_SECRET   # paste a strong random secret
npm run deploy
```

Then point `fitpocket.in` (and/or `api.fitpocket.in`) at the Worker via a
route in the Cloudflare dashboard or by uncommenting the `route` lines in
`wrangler.toml`.

> Note: the remote D1 schema was applied directly via the Cloudflare API
> rather than `wrangler d1 migrations apply`, so D1's migration-tracking
> table (`d1_migrations`) is not present on the remote database. This is
> harmless — the schema matches `migrations/0001_init.sql` /
> `0002_seed.sql` exactly — but running `db:migrate:remote` later may try
> to re-apply from scratch. If so, recreate `d1_migrations` first or apply
> future migrations by hand the same way.

## API overview

All endpoints are under `/api`. Authenticated endpoints expect either the
`fitpocket_session` cookie (set automatically on register/login) or an
`Authorization: Bearer <token>` header.

- `POST /api/auth/register` `{ email, password, name }`
- `POST /api/auth/login` `{ email, password }`
- `POST /api/auth/logout`
- `GET  /api/auth/me`

- `GET/POST /api/workouts`, `GET/PUT/DELETE /api/workouts/:id`, `PUT /api/workouts/:id/sets`
- `GET/POST /api/workouts/exercises/library`
- `GET/POST /api/workouts/metrics/log` (body weight / body fat over time)

- `GET/POST /api/nutrition/foods`
- `GET/POST /api/nutrition/logs`, `DELETE /api/nutrition/logs/:id`
- `GET /api/nutrition/summary?date=`
- `PUT /api/nutrition/targets`
- `GET/POST /api/nutrition/water?date=` — water intake log

- `GET/POST /api/budget/categories`
- `GET/POST /api/budget/transactions`, `PUT/DELETE /api/budget/transactions/:id`
- `GET/POST /api/budget/budgets`, `DELETE /api/budget/budgets/:id`
- `GET /api/budget/summary?month=YYYY-MM`

- `GET/POST/PUT/DELETE /api/goals`

- `GET /api/dashboard` — one-shot aggregate for the home screen

- `POST /api/ai/coach` `{ message }` — chat with the AI coach (has access to your real
  calories/workouts/goals); replies and history are persisted
- `GET /api/ai/coach/history` — past coach messages
- `POST /api/ai/scan-food` `{ image: "data:image/jpeg;base64,..." }` — estimates a food's
  name/calories/macros from a photo; returns a suggestion for the client to confirm and
  save via `POST /api/nutrition/logs`
- `POST /api/ai/import-plan` `{ text }` — pastes a workout/nutrition plan, AI extracts
  structured data and creates matching nutrition targets, goals, and workouts directly

See `migrations/0001_init.sql` and `migrations/0003_ai_and_water.sql` for the full data model.
