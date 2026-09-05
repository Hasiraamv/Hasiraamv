import { Hono } from "hono";
import { requireAuth } from "../middleware";
import { generateId } from "../auth";
import type { AppEnv } from "../types";

const nutrition = new Hono<AppEnv>();
nutrition.use("*", requireAuth);

// GET /api/nutrition/foods?q=search
nutrition.get("/foods", async (c) => {
  const userId = c.get("userId");
  const q = c.req.query("q");
  let query = "SELECT * FROM foods WHERE (user_id = ? OR user_id IS NULL)";
  const params: unknown[] = [userId];
  if (q) {
    query += " AND name LIKE ?";
    params.push(`%${q}%`);
  }
  query += " ORDER BY name ASC LIMIT 50";
  const { results } = await c.env.DB.prepare(query).bind(...params).all();
  return c.json({ foods: results });
});

// POST /api/nutrition/foods - create custom food
nutrition.post("/foods", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<{
    name?: string;
    calories_per_100g?: number;
    protein_per_100g?: number;
    carbs_per_100g?: number;
    fat_per_100g?: number;
  }>();
  if (!body.name || body.calories_per_100g == null) {
    return c.json({ error: "name and calories_per_100g are required" }, 400);
  }

  const id = generateId("food");
  await c.env.DB.prepare(
    `INSERT INTO foods (id, user_id, name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      userId,
      body.name,
      body.calories_per_100g,
      body.protein_per_100g ?? 0,
      body.carbs_per_100g ?? 0,
      body.fat_per_100g ?? 0
    )
    .run();

  return c.json({ id }, 201);
});

// GET /api/nutrition/logs?date=YYYY-MM-DD  (or from/to range)
nutrition.get("/logs", async (c) => {
  const userId = c.get("userId");
  const date = c.req.query("date");
  const from = c.req.query("from");
  const to = c.req.query("to");

  let query = "SELECT * FROM nutrition_logs WHERE user_id = ?";
  const params: unknown[] = [userId];
  if (date) {
    query += " AND date = ?";
    params.push(date);
  } else {
    if (from) {
      query += " AND date >= ?";
      params.push(from);
    }
    if (to) {
      query += " AND date <= ?";
      params.push(to);
    }
  }
  query += " ORDER BY date DESC, created_at ASC";

  const { results } = await c.env.DB.prepare(query).bind(...params).all();
  return c.json({ logs: results });
});

// POST /api/nutrition/logs
// Either pass food_id + quantity_g (macros computed server-side),
// or pass food_name + calories/protein/carbs/fat directly for a manual entry.
nutrition.post("/logs", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<{
    food_id?: string;
    food_name?: string;
    date?: string;
    meal_type?: string;
    quantity_g?: number;
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  }>();

  if (!body.date) return c.json({ error: "date is required" }, 400);

  let { food_name, calories, protein, carbs, fat } = body;
  const quantity_g = body.quantity_g ?? 100;

  if (body.food_id) {
    const food = await c.env.DB.prepare(
      "SELECT * FROM foods WHERE id = ? AND (user_id = ? OR user_id IS NULL)"
    )
      .bind(body.food_id, userId)
      .first<{
        name: string;
        calories_per_100g: number;
        protein_per_100g: number;
        carbs_per_100g: number;
        fat_per_100g: number;
      }>();
    if (!food) return c.json({ error: "food not found" }, 404);

    const factor = quantity_g / 100;
    food_name = food.name;
    calories = food.calories_per_100g * factor;
    protein = food.protein_per_100g * factor;
    carbs = food.carbs_per_100g * factor;
    fat = food.fat_per_100g * factor;
  }

  if (!food_name || calories == null) {
    return c.json({ error: "food_id, or food_name + calories, is required" }, 400);
  }

  const id = generateId("log");
  await c.env.DB.prepare(
    `INSERT INTO nutrition_logs
      (id, user_id, food_id, food_name, date, meal_type, quantity_g, calories, protein, carbs, fat)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      userId,
      body.food_id ?? null,
      food_name,
      body.date,
      body.meal_type ?? "other",
      quantity_g,
      calories,
      protein ?? 0,
      carbs ?? 0,
      fat ?? 0
    )
    .run();

  return c.json({ id }, 201);
});

// DELETE /api/nutrition/logs/:id
nutrition.delete("/logs/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const result = await c.env.DB.prepare("DELETE FROM nutrition_logs WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .run();
  if (result.meta.changes === 0) return c.json({ error: "not found" }, 404);
  return c.json({ ok: true });
});

// GET /api/nutrition/summary?date=YYYY-MM-DD - totals vs targets for a day
nutrition.get("/summary", async (c) => {
  const userId = c.get("userId");
  const date = c.req.query("date") ?? new Date().toISOString().slice(0, 10);

  const totals = await c.env.DB.prepare(
    `SELECT
      COALESCE(SUM(calories), 0) AS calories,
      COALESCE(SUM(protein), 0) AS protein,
      COALESCE(SUM(carbs), 0) AS carbs,
      COALESCE(SUM(fat), 0) AS fat
     FROM nutrition_logs WHERE user_id = ? AND date = ?`
  )
    .bind(userId, date)
    .first();

  const targets = await c.env.DB.prepare("SELECT * FROM nutrition_targets WHERE user_id = ?")
    .bind(userId)
    .first();

  return c.json({ date, totals, targets: targets ?? null });
});

// PUT /api/nutrition/targets
nutrition.put("/targets", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<{
    daily_calories?: number;
    daily_protein?: number;
    daily_carbs?: number;
    daily_fat?: number;
    daily_water_ml?: number;
  }>();

  await c.env.DB.prepare(
    `INSERT INTO nutrition_targets (user_id, daily_calories, daily_protein, daily_carbs, daily_fat, daily_water_ml)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       daily_calories = excluded.daily_calories,
       daily_protein = excluded.daily_protein,
       daily_carbs = excluded.daily_carbs,
       daily_fat = excluded.daily_fat,
       daily_water_ml = excluded.daily_water_ml,
       updated_at = datetime('now')`
  )
    .bind(
      userId,
      body.daily_calories ?? null,
      body.daily_protein ?? null,
      body.daily_carbs ?? null,
      body.daily_fat ?? null,
      body.daily_water_ml ?? null
    )
    .run();

  return c.json({ ok: true });
});

export default nutrition;
