-- Fit Pocket initial schema
-- Cloudflare D1 (SQLite dialect)

CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ===================== FITNESS =====================

CREATE TABLE exercises (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE, -- NULL = global/system exercise library
    name TEXT NOT NULL,
    category TEXT, -- e.g. strength, cardio, mobility
    muscle_group TEXT, -- e.g. chest, back, legs, core
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE workouts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    date TEXT NOT NULL, -- ISO date (YYYY-MM-DD)
    notes TEXT,
    duration_minutes INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE workout_sets (
    id TEXT PRIMARY KEY,
    workout_id TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    exercise_id TEXT REFERENCES exercises(id),
    exercise_name TEXT NOT NULL, -- denormalized snapshot in case exercise is edited/deleted
    set_order INTEGER NOT NULL DEFAULT 1,
    reps INTEGER,
    weight_kg REAL,
    duration_seconds INTEGER, -- for cardio/timed exercises
    distance_km REAL,
    rpe REAL, -- rate of perceived exertion, optional
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE body_metrics (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date TEXT NOT NULL, -- ISO date
    weight_kg REAL,
    body_fat_pct REAL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, date)
);

-- ===================== NUTRITION =====================

CREATE TABLE foods (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE, -- NULL = global/system food library
    name TEXT NOT NULL,
    calories_per_100g REAL NOT NULL,
    protein_per_100g REAL NOT NULL DEFAULT 0,
    carbs_per_100g REAL NOT NULL DEFAULT 0,
    fat_per_100g REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE nutrition_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    food_id TEXT REFERENCES foods(id),
    food_name TEXT NOT NULL, -- denormalized snapshot
    date TEXT NOT NULL, -- ISO date
    meal_type TEXT NOT NULL DEFAULT 'other', -- breakfast | lunch | dinner | snack | other
    quantity_g REAL NOT NULL DEFAULT 100,
    calories REAL NOT NULL,
    protein REAL NOT NULL DEFAULT 0,
    carbs REAL NOT NULL DEFAULT 0,
    fat REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE nutrition_targets (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    daily_calories REAL,
    daily_protein REAL,
    daily_carbs REAL,
    daily_fat REAL,
    daily_water_ml REAL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ===================== BUDGET / EXPENSES =====================

CREATE TABLE expense_categories (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE, -- NULL = default system category
    name TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'expense', -- expense | income
    icon TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id TEXT REFERENCES expense_categories(id),
    category_name TEXT NOT NULL, -- denormalized snapshot
    type TEXT NOT NULL DEFAULT 'expense', -- expense | income
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    date TEXT NOT NULL, -- ISO date
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE budgets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id TEXT REFERENCES expense_categories(id),
    category_name TEXT NOT NULL,
    monthly_limit REAL NOT NULL,
    month TEXT NOT NULL, -- 'YYYY-MM', recurring budgets use month = 'recurring'
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, category_name, month)
);

-- ===================== GOALS (cross-cutting) =====================

CREATE TABLE goals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    domain TEXT NOT NULL, -- fitness | nutrition | budget
    type TEXT NOT NULL, -- e.g. target_weight, weekly_workouts, monthly_savings
    target_value REAL NOT NULL,
    current_value REAL NOT NULL DEFAULT 0,
    deadline TEXT, -- ISO date, optional
    status TEXT NOT NULL DEFAULT 'active', -- active | achieved | abandoned
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ===================== INDEXES =====================

CREATE INDEX idx_workouts_user_date ON workouts(user_id, date);
CREATE INDEX idx_workout_sets_workout ON workout_sets(workout_id);
CREATE INDEX idx_body_metrics_user_date ON body_metrics(user_id, date);
CREATE INDEX idx_nutrition_logs_user_date ON nutrition_logs(user_id, date);
CREATE INDEX idx_transactions_user_date ON transactions(user_id, date);
CREATE INDEX idx_budgets_user_month ON budgets(user_id, month);
CREATE INDEX idx_goals_user_domain ON goals(user_id, domain);
