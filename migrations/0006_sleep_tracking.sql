CREATE TABLE sleep_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    hours REAL NOT NULL,
    quality TEXT, -- 'poor' | 'okay' | 'good' | 'great', optional
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, date)
);

CREATE INDEX idx_sleep_logs_user_date ON sleep_logs(user_id, date);

ALTER TABLE nutrition_targets ADD COLUMN daily_sleep_hours REAL;
