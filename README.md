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

## Local setup

```bash
npm install

# create the D1 database (first time only)
npx wrangler d1 create fitpocket-db
# copy the returned database_id into wrangler.toml

# run migrations locally
npm run db:migrate:local

# set a JWT secret for local dev
echo 'JWT_SECRET="replace-with-a-long-random-string"' > .dev.vars

npm run dev
```

## Deploy

```bash
npm run db:migrate:remote
npx wrangler secret put JWT_SECRET   # paste a strong random secret
npm run deploy
```

Then point `fitpocket.in` (and/or `api.fitpocket.in`) at the Worker via a
route in the Cloudflare dashboard or by uncommenting the `route` lines in
`wrangler.toml`.

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

- `GET/POST /api/budget/categories`
- `GET/POST /api/budget/transactions`, `PUT/DELETE /api/budget/transactions/:id`
- `GET/POST /api/budget/budgets`, `DELETE /api/budget/budgets/:id`
- `GET /api/budget/summary?month=YYYY-MM`

- `GET/POST/PUT/DELETE /api/goals`

- `GET /api/dashboard` — one-shot aggregate for the home screen

See `migrations/0001_init.sql` for the full data model.
