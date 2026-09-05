import { Hono } from "hono";
import { requireAuth } from "../middleware";
import { generateId } from "../auth";
import type { AppEnv } from "../types";

const workouts = new Hono<AppEnv>();
workouts.use("*", requireAuth);

type SetInput = {
  exercise_id?: string;
  exercise_name: string;
  set_order?: number;
  reps?: number;
  weight_kg?: number;
  duration_seconds?: number;
  distance_km?: number;
  rpe?: number;
};

// GET /api/workouts?from=YYYY-MM-DD&to=YYYY-MM-DD
workouts.get("/", async (c) => {
  const userId = c.get("userId");
  const from = c.req.query("from");
  const to = c.req.query("to");

  let query = "SELECT * FROM workouts WHERE user_id = ?";
  const params: unknown[] = [userId];
  if (from) {
    query += " AND date >= ?";
    params.push(from);
  }
  if (to) {
    query += " AND date <= ?";
    params.push(to);
  }
  query += " ORDER BY date DESC, created_at DESC";

  const { results } = await c.env.DB.prepare(query).bind(...params).all();
  return c.json({ workouts: results });
});

// GET /api/workouts/:id (with sets)
workouts.get("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const workout = await c.env.DB.prepare("SELECT * FROM workouts WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .first();
  if (!workout) return c.json({ error: "not found" }, 404);

  const { results: sets } = await c.env.DB.prepare(
    "SELECT * FROM workout_sets WHERE workout_id = ? ORDER BY set_order ASC"
  )
    .bind(id)
    .all();

  return c.json({ workout, sets });
});

// POST /api/workouts { name, date, notes?, duration_minutes?, sets: [...] }
workouts.post("/", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<{
    name?: string;
    date?: string;
    notes?: string;
    duration_minutes?: number;
    sets?: SetInput[];
  }>();

  if (!body.name || !body.date) {
    return c.json({ error: "name and date are required" }, 400);
  }

  const id = generateId("workout");
  await c.env.DB.prepare(
    "INSERT INTO workouts (id, user_id, name, date, notes, duration_minutes) VALUES (?, ?, ?, ?, ?, ?)"
  )
    .bind(id, userId, body.name, body.date, body.notes ?? null, body.duration_minutes ?? null)
    .run();

  if (body.sets?.length) {
    const stmts = body.sets.map((s, idx) =>
      c.env.DB.prepare(
        `INSERT INTO workout_sets
          (id, workout_id, exercise_id, exercise_name, set_order, reps, weight_kg, duration_seconds, distance_km, rpe)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        generateId("set"),
        id,
        s.exercise_id ?? null,
        s.exercise_name,
        s.set_order ?? idx + 1,
        s.reps ?? null,
        s.weight_kg ?? null,
        s.duration_seconds ?? null,
        s.distance_km ?? null,
        s.rpe ?? null
      )
    );
    await c.env.DB.batch(stmts);
  }

  return c.json({ id }, 201);
});

// PUT /api/workouts/:id { name?, date?, notes?, duration_minutes? }
workouts.put("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = await c.req.json<{
    name?: string;
    date?: string;
    notes?: string;
    duration_minutes?: number;
  }>();

  const existing = await c.env.DB.prepare("SELECT id FROM workouts WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .first();
  if (!existing) return c.json({ error: "not found" }, 404);

  await c.env.DB.prepare(
    `UPDATE workouts SET
      name = COALESCE(?, name),
      date = COALESCE(?, date),
      notes = COALESCE(?, notes),
      duration_minutes = COALESCE(?, duration_minutes),
      updated_at = datetime('now')
     WHERE id = ? AND user_id = ?`
  )
    .bind(body.name ?? null, body.date ?? null, body.notes ?? null, body.duration_minutes ?? null, id, userId)
    .run();

  return c.json({ ok: true });
});

// DELETE /api/workouts/:id
workouts.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const result = await c.env.DB.prepare("DELETE FROM workouts WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .run();
  if (result.meta.changes === 0) return c.json({ error: "not found" }, 404);
  return c.json({ ok: true });
});

// PUT /api/workouts/:id/sets - replace all sets for a workout
workouts.put("/:id/sets", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = await c.req.json<{ sets: SetInput[] }>();

  const workout = await c.env.DB.prepare("SELECT id FROM workouts WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .first();
  if (!workout) return c.json({ error: "not found" }, 404);

  await c.env.DB.prepare("DELETE FROM workout_sets WHERE workout_id = ?").bind(id).run();

  if (body.sets?.length) {
    const stmts = body.sets.map((s, idx) =>
      c.env.DB.prepare(
        `INSERT INTO workout_sets
          (id, workout_id, exercise_id, exercise_name, set_order, reps, weight_kg, duration_seconds, distance_km, rpe)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        generateId("set"),
        id,
        s.exercise_id ?? null,
        s.exercise_name,
        s.set_order ?? idx + 1,
        s.reps ?? null,
        s.weight_kg ?? null,
        s.duration_seconds ?? null,
        s.distance_km ?? null,
        s.rpe ?? null
      )
    );
    await c.env.DB.batch(stmts);
  }

  return c.json({ ok: true });
});

// PUT /api/workouts/:id/sets/:setId/complete { completed: boolean }
workouts.put("/:id/sets/:setId/complete", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const setId = c.req.param("setId");
  const body = await c.req.json<{ completed?: boolean }>();

  const workout = await c.env.DB.prepare("SELECT id FROM workouts WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .first();
  if (!workout) return c.json({ error: "not found" }, 404);

  const result = await c.env.DB.prepare(
    "UPDATE workout_sets SET completed = ? WHERE id = ? AND workout_id = ?"
  )
    .bind(body.completed ? 1 : 0, setId, id)
    .run();
  if (result.meta.changes === 0) return c.json({ error: "set not found" }, 404);

  return c.json({ ok: true });
});

// GET /api/workouts/exercises/library?q=search
workouts.get("/exercises/library", async (c) => {
  const userId = c.get("userId");
  const q = c.req.query("q");
  let query = "SELECT * FROM exercises WHERE (user_id = ? OR user_id IS NULL)";
  const params: unknown[] = [userId];
  if (q) {
    query += " AND name LIKE ?";
    params.push(`%${q}%`);
  }
  query += " ORDER BY name ASC";
  const { results } = await c.env.DB.prepare(query).bind(...params).all();
  return c.json({ exercises: results });
});

// POST /api/workouts/exercises/library - create custom exercise
workouts.post("/exercises/library", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<{ name?: string; category?: string; muscle_group?: string }>();
  if (!body.name) return c.json({ error: "name is required" }, 400);

  const id = generateId("ex");
  await c.env.DB.prepare(
    "INSERT INTO exercises (id, user_id, name, category, muscle_group) VALUES (?, ?, ?, ?, ?)"
  )
    .bind(id, userId, body.name, body.category ?? null, body.muscle_group ?? null)
    .run();

  return c.json({ id }, 201);
});

// ---- Body metrics ----

// GET /api/workouts/metrics?from=&to=
workouts.get("/metrics/log", async (c) => {
  const userId = c.get("userId");
  const from = c.req.query("from");
  const to = c.req.query("to");

  let query = "SELECT * FROM body_metrics WHERE user_id = ?";
  const params: unknown[] = [userId];
  if (from) {
    query += " AND date >= ?";
    params.push(from);
  }
  if (to) {
    query += " AND date <= ?";
    params.push(to);
  }
  query += " ORDER BY date ASC";

  const { results } = await c.env.DB.prepare(query).bind(...params).all();
  return c.json({ metrics: results });
});

// POST /api/workouts/metrics - upsert by date
workouts.post("/metrics/log", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<{ date?: string; weight_kg?: number; body_fat_pct?: number; notes?: string }>();
  if (!body.date) return c.json({ error: "date is required" }, 400);

  const id = generateId("metric");
  await c.env.DB.prepare(
    `INSERT INTO body_metrics (id, user_id, date, weight_kg, body_fat_pct, notes)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, date) DO UPDATE SET
       weight_kg = excluded.weight_kg,
       body_fat_pct = excluded.body_fat_pct,
       notes = excluded.notes`
  )
    .bind(id, userId, body.date, body.weight_kg ?? null, body.body_fat_pct ?? null, body.notes ?? null)
    .run();

  return c.json({ ok: true });
});

export default workouts;
