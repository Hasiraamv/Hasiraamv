# Fit Pocket — Frontend / UI Build Brief

**For: GitHub Copilot (or whoever builds the frontend)**
**Backend: already built.** This doc tells you what to build on top of it — screens, flows, data shapes, and the design bar to hit. Do not redesign the data model or API; consume it as-is (or propose additive changes only).

Goal: the UI should feel like a premium, modern personal-finance-meets-fitness app — cleaner, faster, and more polished than typical student/budget trackers (e.g. pocketuni.in). Think Cash App / Whoop / Strava-level visual polish, not a generic admin dashboard.

---

## 1. What Fit Pocket is

One app, three connected trackers, one person's life:

1. **Fitness** — log workouts (exercises, sets, reps, weight), track body weight/body fat over time.
2. **Nutrition** — log meals against a food database, track calories/protein/carbs/fat vs daily targets.
3. **Budget** — log income/expenses by category, set monthly budgets, see spend vs budget.

Plus a **Dashboard** that ties all three together at a glance, and cross-cutting **Goals** (a goal can belong to any of the three domains — e.g. "lose 5kg", "bench 100kg", "save ₹10,000 this month").

## 2. Tech expectations

- API base: `https://api.fitpocket.in` (or same-origin `/api` if you deploy frontend behind the same Worker/domain).
- Auth: cookie-based (`fitpocket_session`, httpOnly, set automatically by the API on register/login) — `fetch` calls must use `credentials: "include"`. A `Bearer` token is also returned in the JSON response body if you'd rather manage it client-side (e.g. for a mobile/SPA build using localStorage).
- All authenticated requests return `401` with `{ error: "..." }` on invalid/missing session — redirect to `/login` on 401 globally (one interceptor, not per-call).
- Dates are ISO `YYYY-MM-DD` strings; months are `YYYY-MM`.
- Recommend: React + TypeScript + Tailwind, or Next.js if you want SSR/routing out of the box. Framework choice is yours — the API is plain JSON/REST, no framework lock-in.

---

## 3. Screens & flows

### 3.1 Auth
- **Sign up**: email, password (8+ chars), name. `POST /api/auth/register`.
- **Log in**: email, password. `POST /api/auth/login`.
- Show inline validation errors from the API's `{ error }` field.
- No email verification flow exists yet — don't build UI for it.

### 3.2 Dashboard (home screen, `GET /api/dashboard`)
This is the app's front door — make it the best-looking screen. Single call returns:
```json
{
  "date": "2026-09-05",
  "nutrition": { "today": { "calories": 0, "protein": 0, "carbs": 0, "fat": 0 }, "targets": { "daily_calories": 2200, ... } | null },
  "fitness": { "workouts_last_7_days": 3, "latest_metric": { "date": "...", "weight_kg": 78.2, "body_fat_pct": 15.1 } | null },
  "budget": { "month": "2026-09", "income": 0, "expenses": 0 },
  "goals": [ { "id", "domain", "type", "target_value", "current_value", "deadline", "status" }, ... ]
}
```
Design this as a card grid:
- **Nutrition card**: ring/progress bar for calories vs target, small bars for protein/carbs/fat.
- **Fitness card**: workouts this week count, latest body weight with trend arrow vs previous entry.
- **Budget card**: this month income vs expenses, a simple bar or donut, remaining budget.
- **Goals**: horizontal scroll of goal progress chips (`current_value / target_value`).
- Empty states matter — a brand-new user sees all zeros/nulls; design a friendly "log your first workout / meal / expense" prompt per card instead of a bare 0.

### 3.3 Fitness
- **Workout list** (`GET /api/workouts?from=&to=`): chronological list/calendar view, filterable by date range.
- **Workout detail / log a workout** (`GET/POST /api/workouts/:id`, `PUT /api/workouts/:id/sets`): a workout has `name`, `date`, `notes`, `duration_minutes`, and a list of **sets**, each with `exercise_name`, `reps`, `weight_kg` (or `duration_seconds`/`distance_km` for cardio), `rpe`. Build a fast "add set" row (exercise picker + reps + weight, repeat) — this is the highest-frequency interaction in the app, optimize for speed (autocomplete from `GET /api/workouts/exercises/library?q=`, minimal taps).
- **Exercise library**: searchable list, users can add custom exercises (`POST /api/workouts/exercises/library`).
- **Body metrics**: a simple weight-over-time line chart (`GET /api/workouts/metrics/log`), quick-add form for today's weight (`POST`, upserts by date).

### 3.4 Nutrition
- **Daily log** (`GET /api/nutrition/logs?date=`): grouped by `meal_type` (breakfast/lunch/dinner/snack/other), each row shows food name, quantity, calories/macros.
- **Add food to log**: search `GET /api/nutrition/foods?q=`, pick a food + enter grams → `POST /api/nutrition/logs` with `food_id` + `quantity_g` (macros auto-computed server-side). Also support a manual/quick-add entry (name + calories directly, no food_id) for things not in the database.
- **Daily summary** (`GET /api/nutrition/summary?date=`): calories/macros consumed vs `targets` — render as progress rings/bars, same visual language as the dashboard nutrition card.
- **Targets settings**: form to set daily calorie/protein/carb/fat/water targets (`PUT /api/nutrition/targets`).

### 3.5 Budget
- **Transactions list** (`GET /api/budget/transactions?from=&to=&type=`): filterable, groupable by category or date. Income shown distinctly from expenses (color coding: green/red or similar, but don't rely on color alone — use +/- prefixes too).
- **Add transaction**: category picker (`GET /api/budget/categories?kind=`), amount, date, optional description, income/expense toggle.
- **Monthly summary** (`GET /api/budget/summary?month=`): total income vs expenses, spend-by-category breakdown (bar chart or donut), and per-category budget progress bars using the `budgets` array (spend vs `monthly_limit`, flag categories that are over).
- **Budgets settings**: set/edit monthly limits per category (`POST /api/budget/budgets`), supports a `month: "recurring"` option that applies every month unless overridden.

### 3.6 Goals
- Simple CRUD list, filterable by `domain` (fitness/nutrition/budget) and `status`. Each goal: `type` (free text describing what it is, e.g. "target_weight", "weekly_workouts", "monthly_savings"), `target_value`, `current_value`, optional `deadline`. Render as progress bars; allow marking `status` as `achieved`/`abandoned`.

---

## 4. Design bar — be better than pocketuni.in

Specific, non-negotiable bar to clear:

1. **Typography-led, not box-led.** Avoid heavy bordered cards everywhere — use whitespace, subtle shadows, and type hierarchy to separate sections instead of boxing everything.
2. **One consistent numeric/data visual language.** Progress rings for "X of Y today" (calories, budget-this-month), simple line charts for trends (weight, spend over time), consistent color meaning across the whole app (e.g. same green = "on track" everywhere, not just in one module).
3. **Fast primary actions.** Logging a meal, a set, or an expense should be reachable in ≤2 taps from anywhere (persistent quick-add / FAB), not buried in a nested "add new" flow.
4. **Real empty and loading states**, not blank screens or generic spinners — skeleton screens matching final layout.
5. **Dark mode from day one**, not bolted on later — this is a daily-use tracking app, people open it at night.
6. **Mobile-first.** Most usage (logging a meal or a set at the gym) happens on a phone. Design mobile layouts first, then scale up to desktop/tablet.
7. **Micro-feedback on every log action** — a toast/checkmark/haptic-style confirmation when a set/meal/expense is saved, so logging feels satisfying and instantaneous, never uncertain.
8. **No dead ends.** Every list (workouts, meals, transactions) needs a clear "add" affordance visible even when empty.

---

## 5. Non-goals for this pass

- No social features (feeds, friends, sharing) — single-user experience only.
- No payment/subscription UI — the app is free at this stage.
- No native mobile app — responsive web only for now.
- No AI/auto-suggestions (e.g. auto-detecting food from photos) — manual logging only.

---

## 6. Open API reference

Full endpoint list and request/response shapes: see `README.md` in this repo, and the route source under `src/routes/` if exact field names are needed (`workouts.ts`, `nutrition.ts`, `budget.ts`, `goals.ts`, `dashboard.ts`, `auth.ts`). The database schema (`migrations/0001_init.sql`) is the source of truth for every field name and type.
