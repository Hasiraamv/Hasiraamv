import { Hono } from "hono";
import { requireAuth } from "../middleware";
import { generateId } from "../auth";
import type { AppEnv } from "../types";

const ai = new Hono<AppEnv>();
ai.use("*", requireAuth);

// llama-3.1-8b-instruct was deprecated by Cloudflare on 2026-05-30;
// glm-4.7-flash is Cloudflare's recommended replacement for chat/instruct use.
// Typed as a bare `string` (not a literal) so the Ai binding's per-model
// overloads (which expect stricter message unions for pinned models)
// fall back to its generic Record<string, unknown> signature.
const TEXT_MODEL: string = "@cf/zai-org/glm-4.7-flash";
const VISION_MODEL: string = "@cf/meta/llama-3.2-11b-vision-instruct";

/** Models sometimes wrap JSON in prose or markdown fences — pull out the first {...} block. */
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("Model did not return JSON");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

// ---- AI Coach chat ----

// GET /api/ai/coach/history
ai.get("/coach/history", async (c) => {
  const userId = c.get("userId");
  const { results } = await c.env.DB.prepare(
    "SELECT id, role, content, created_at FROM ai_coach_messages WHERE user_id = ? ORDER BY created_at ASC LIMIT 50"
  )
    .bind(userId)
    .all();
  return c.json({ messages: results });
});

// POST /api/ai/coach { message }
ai.post("/coach", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<{ message?: string }>();
  if (!body.message?.trim()) return c.json({ error: "message is required" }, 400);

  const [dashboard, history] = await Promise.all([
    Promise.all([
      c.env.DB.prepare(
        "SELECT COALESCE(SUM(calories),0) AS calories FROM nutrition_logs WHERE user_id = ? AND date = ?"
      )
        .bind(userId, new Date().toISOString().slice(0, 10))
        .first<{ calories: number }>(),
      c.env.DB.prepare("SELECT * FROM nutrition_targets WHERE user_id = ?").bind(userId).first(),
      c.env.DB.prepare(
        "SELECT COUNT(*) AS count FROM workouts WHERE user_id = ? AND date >= date('now', '-6 days')"
      )
        .bind(userId)
        .first<{ count: number }>(),
      c.env.DB.prepare("SELECT * FROM goals WHERE user_id = ? AND status = 'active'").bind(userId).all(),
    ]),
    c.env.DB.prepare(
      "SELECT role, content FROM ai_coach_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 10"
    )
      .bind(userId)
      .all(),
  ]);

  const [caloriesToday, targets, workoutsThisWeek, goals] = dashboard;

  const systemPrompt = `You are PocketBuddy, the in-app AI coach for FitPocket, a fitness/nutrition/budget
tracking app. Be encouraging, specific, and concise (2-4 sentences unless asked for detail). Use the user's real data below.
Never invent numbers that aren't given. If you don't have enough data to answer precisely, say so and suggest
what to log.

Today's calories logged: ${Math.round(caloriesToday?.calories ?? 0)}
Daily calorie target: ${(targets as { daily_calories?: number } | null)?.daily_calories ?? "not set"}
Workouts in the last 7 days: ${workoutsThisWeek?.count ?? 0}
Active goals: ${goals.results.length ? JSON.stringify(goals.results) : "none set"}`;

  const priorMessages = [...history.results].reverse() as { role: string; content: string }[];

  const messages = [
    { role: "system", content: systemPrompt },
    ...priorMessages.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: body.message },
  ];

  const result = await c.env.AI.run(TEXT_MODEL, { messages });
  const reply = (result as { response?: string }).response?.trim() || "Sorry, I couldn't come up with a response.";

  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO ai_coach_messages (id, user_id, role, content) VALUES (?, ?, 'user', ?)").bind(
      generateId("msg"),
      userId,
      body.message
    ),
    c.env.DB.prepare("INSERT INTO ai_coach_messages (id, user_id, role, content) VALUES (?, ?, 'assistant', ?)").bind(
      generateId("msg"),
      userId,
      reply
    ),
  ]);

  return c.json({ reply });
});

// ---- Photo food scan ----

// POST /api/ai/scan-food { image: "data:image/jpeg;base64,..." }
ai.post("/scan-food", async (c) => {
  const body = await c.req.json<{ image?: string }>();
  if (!body.image) return c.json({ error: "image is required" }, 400);

  const messages = [
    {
      role: "system",
      content:
        "You are a nutrition estimator. Look at the food photo and respond with ONLY a JSON object " +
        '(no prose, no markdown) of the shape: {"food_name": string, "quantity_g": number, "calories": number, ' +
        '"protein": number, "carbs": number, "fat": number}. Estimate the visible portion as best you can. ' +
        "If multiple foods are visible, combine them into one entry describing the whole plate.",
    },
    { role: "user", content: "Identify this food and estimate its nutrition." },
  ];

  const result = await c.env.AI.run(VISION_MODEL, { messages, image: body.image });
  const text = (result as { response?: string }).response ?? "";

  try {
    const parsed = extractJson(text) as Record<string, unknown>;
    return c.json({
      food_name: String(parsed.food_name ?? "Unknown food"),
      quantity_g: Number(parsed.quantity_g ?? 100),
      calories: Number(parsed.calories ?? 0),
      protein: Number(parsed.protein ?? 0),
      carbs: Number(parsed.carbs ?? 0),
      fat: Number(parsed.fat ?? 0),
    });
  } catch {
    return c.json({ error: "Could not read that photo — try again with better lighting.", raw: text }, 422);
  }
});

// ---- Plan import (paste a workout/nutrition plan, AI fills it in) ----

// POST /api/ai/import-plan { text }
ai.post("/import-plan", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<{ text?: string }>();
  if (!body.text?.trim()) return c.json({ error: "text is required" }, 400);

  const messages = [
    {
      role: "system",
      content:
        "Extract structured data from the user's fitness/nutrition plan. Respond with ONLY a JSON object " +
        "(no prose, no markdown fences) of this exact shape, omitting any section not present in the plan:\n" +
        `{
  "nutrition_targets": { "daily_calories": number, "daily_protein": number, "daily_carbs": number, "daily_fat": number },
  "goals": [ { "domain": "fitness"|"nutrition"|"budget", "type": string, "target_value": number } ],
  "workouts": [ { "name": string, "day": string, "sets": [ { "exercise_name": string, "reps": number, "weight_kg": number } ] } ]
}` +
        "\nUse null for any numeric field you can't determine. Keep exercise names as written in the plan.",
    },
    { role: "user", content: body.text.slice(0, 8000) },
  ];

  const result = await c.env.AI.run(TEXT_MODEL, { messages });
  const text = (result as { response?: string }).response ?? "";

  let parsed: {
    nutrition_targets?: Record<string, number | null>;
    goals?: { domain: string; type: string; target_value: number }[];
    workouts?: { name: string; day?: string; sets?: { exercise_name: string; reps?: number; weight_kg?: number }[] }[];
  };
  try {
    parsed = extractJson(text) as typeof parsed;
  } catch {
    return c.json({ error: "Could not understand that plan. Try pasting plainer text.", raw: text }, 422);
  }

  const summary = { targets_set: false, goals_created: 0, workouts_created: 0 };
  const today = new Date().toISOString().slice(0, 10);

  if (parsed.nutrition_targets) {
    const t = parsed.nutrition_targets;
    await c.env.DB.prepare(
      `INSERT INTO nutrition_targets (user_id, daily_calories, daily_protein, daily_carbs, daily_fat)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         daily_calories = excluded.daily_calories,
         daily_protein = excluded.daily_protein,
         daily_carbs = excluded.daily_carbs,
         daily_fat = excluded.daily_fat,
         updated_at = datetime('now')`
    )
      .bind(userId, t.daily_calories ?? null, t.daily_protein ?? null, t.daily_carbs ?? null, t.daily_fat ?? null)
      .run();
    summary.targets_set = true;
  }

  if (parsed.goals?.length) {
    const stmts = parsed.goals
      .filter((g) => g.domain && g.type && g.target_value != null)
      .map((g) =>
        c.env.DB.prepare(
          "INSERT INTO goals (id, user_id, domain, type, target_value) VALUES (?, ?, ?, ?, ?)"
        ).bind(generateId("goal"), userId, g.domain, g.type, g.target_value)
      );
    if (stmts.length) {
      await c.env.DB.batch(stmts);
      summary.goals_created = stmts.length;
    }
  }

  if (parsed.workouts?.length) {
    for (const w of parsed.workouts) {
      if (!w.name) continue;
      const workoutId = generateId("workout");
      await c.env.DB.prepare("INSERT INTO workouts (id, user_id, name, date, notes) VALUES (?, ?, ?, ?, ?)")
        .bind(workoutId, userId, w.name, today, w.day ? `Plan day: ${w.day}` : null)
        .run();

      if (w.sets?.length) {
        const setStmts = w.sets.map((s, idx) =>
          c.env.DB.prepare(
            `INSERT INTO workout_sets (id, workout_id, exercise_name, set_order, reps, weight_kg)
             VALUES (?, ?, ?, ?, ?, ?)`
          ).bind(generateId("set"), workoutId, s.exercise_name, idx + 1, s.reps ?? null, s.weight_kg ?? null)
        );
        await c.env.DB.batch(setStmts);
      }
      summary.workouts_created += 1;
    }
  }

  return c.json({ summary });
});

export default ai;
