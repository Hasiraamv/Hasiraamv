-- Track whether each logged set has been completed (checked off during a workout)
ALTER TABLE workout_sets ADD COLUMN completed INTEGER NOT NULL DEFAULT 0;
