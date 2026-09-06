import { Hono } from "hono";
import { requireAuth } from "../middleware";
import { generateId } from "../auth";
import type { AppEnv } from "../types";

const goals = new Hono<AppEnv>();
goals.use("*", requireAuth);

// GET /api/goals?domain=fitness|nutrition|budget&status=active|achieved|abandoned
goals.get("/", async (c) => {
  const userId = c.get("userId");
  const domain = c.req.query("domain");
  const status = c.req.query("status");

  let query = "SELECT * FROM goals WHERE user_id = ?";
  const params: unknown[] = [userId];
  if (domain) {
    query += " AND domain = ?";
    params.push(domain);
  }
  if (status) {
    query += " AND status = ?";
    params.push(status);
  }
  query += " ORDER BY created_at DESC";

  const { results } = await c.env.DB.prepare(query).bind(...params).all();
  return c.json({ goals: results });
});

// POST /api/goals
goals.post("/", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<{
    domain?: string;
    type?: string;
    target_value?: number;
    current_value?: number;
    deadline?: string;
  }>();

  if (!body.domain || !body.type || body.target_value == null) {
    return c.json({ error: "domain, type and target_value are required" }, 400);
  }

  const id = generateId("goal");
  await c.env.DB.prepare(
    `INSERT INTO goals (id, user_id, domain, type, target_value, current_value, deadline)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, userId, body.domain, body.type, body.target_value, body.current_value ?? 0, body.deadline ?? null)
    .run();

  return c.json({ id }, 201);
});

// PUT /api/goals/:id
goals.put("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = await c.req.json<{
    current_value?: number;
    target_value?: number;
    status?: string;
    deadline?: string;
  }>();

  const existing = await c.env.DB.prepare("SELECT id FROM goals WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .first();
  if (!existing) return c.json({ error: "not found" }, 404);

  await c.env.DB.prepare(
    `UPDATE goals SET
      current_value = COALESCE(?, current_value),
      target_value = COALESCE(?, target_value),
      status = COALESCE(?, status),
      deadline = COALESCE(?, deadline),
      updated_at = datetime('now')
     WHERE id = ? AND user_id = ?`
  )
    .bind(body.current_value ?? null, body.target_value ?? null, body.status ?? null, body.deadline ?? null, id, userId)
    .run();

  return c.json({ ok: true });
});

// DELETE /api/goals/:id
goals.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const result = await c.env.DB.prepare("DELETE FROM goals WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .run();
  if (result.meta.changes === 0) return c.json({ error: "not found" }, 404);
  return c.json({ ok: true });
});

export default goals;
