import { Hono } from "hono";
import { requireAuth } from "../middleware";
import { generateId } from "../auth";
import type { AppEnv } from "../types";

const budget = new Hono<AppEnv>();
budget.use("*", requireAuth);

// ---- Categories ----

// GET /api/budget/categories?kind=expense|income
budget.get("/categories", async (c) => {
  const userId = c.get("userId");
  const kind = c.req.query("kind");
  let query = "SELECT * FROM expense_categories WHERE (user_id = ? OR user_id IS NULL)";
  const params: unknown[] = [userId];
  if (kind) {
    query += " AND kind = ?";
    params.push(kind);
  }
  query += " ORDER BY name ASC";
  const { results } = await c.env.DB.prepare(query).bind(...params).all();
  return c.json({ categories: results });
});

// POST /api/budget/categories
budget.post("/categories", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<{ name?: string; kind?: string; icon?: string }>();
  if (!body.name) return c.json({ error: "name is required" }, 400);

  const id = generateId("cat");
  await c.env.DB.prepare(
    "INSERT INTO expense_categories (id, user_id, name, kind, icon) VALUES (?, ?, ?, ?, ?)"
  )
    .bind(id, userId, body.name, body.kind ?? "expense", body.icon ?? null)
    .run();

  return c.json({ id }, 201);
});

// ---- Transactions ----

// GET /api/budget/transactions?from=&to=&type=&category_id=
budget.get("/transactions", async (c) => {
  const userId = c.get("userId");
  const from = c.req.query("from");
  const to = c.req.query("to");
  const type = c.req.query("type");
  const categoryId = c.req.query("category_id");

  let query = "SELECT * FROM transactions WHERE user_id = ?";
  const params: unknown[] = [userId];
  if (from) {
    query += " AND date >= ?";
    params.push(from);
  }
  if (to) {
    query += " AND date <= ?";
    params.push(to);
  }
  if (type) {
    query += " AND type = ?";
    params.push(type);
  }
  if (categoryId) {
    query += " AND category_id = ?";
    params.push(categoryId);
  }
  query += " ORDER BY date DESC, created_at DESC";

  const { results } = await c.env.DB.prepare(query).bind(...params).all();
  return c.json({ transactions: results });
});

// POST /api/budget/transactions
budget.post("/transactions", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<{
    category_id?: string;
    category_name?: string;
    type?: string;
    amount?: number;
    currency?: string;
    date?: string;
    description?: string;
  }>();

  if (body.amount == null || !body.date || !(body.category_id || body.category_name)) {
    return c.json({ error: "amount, date and category_id (or category_name) are required" }, 400);
  }

  let categoryName = body.category_name;
  if (body.category_id) {
    const cat = await c.env.DB.prepare(
      "SELECT name FROM expense_categories WHERE id = ? AND (user_id = ? OR user_id IS NULL)"
    )
      .bind(body.category_id, userId)
      .first<{ name: string }>();
    if (!cat) return c.json({ error: "category not found" }, 404);
    categoryName = cat.name;
  }

  const id = generateId("txn");
  await c.env.DB.prepare(
    `INSERT INTO transactions (id, user_id, category_id, category_name, type, amount, currency, date, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      userId,
      body.category_id ?? null,
      categoryName,
      body.type ?? "expense",
      body.amount,
      body.currency ?? "INR",
      body.date,
      body.description ?? null
    )
    .run();

  return c.json({ id }, 201);
});

// PUT /api/budget/transactions/:id
budget.put("/transactions/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = await c.req.json<{
    amount?: number;
    date?: string;
    description?: string;
    category_id?: string;
    category_name?: string;
    type?: string;
  }>();

  const existing = await c.env.DB.prepare("SELECT id FROM transactions WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .first();
  if (!existing) return c.json({ error: "not found" }, 404);

  await c.env.DB.prepare(
    `UPDATE transactions SET
      amount = COALESCE(?, amount),
      date = COALESCE(?, date),
      description = COALESCE(?, description),
      category_id = COALESCE(?, category_id),
      category_name = COALESCE(?, category_name),
      type = COALESCE(?, type)
     WHERE id = ? AND user_id = ?`
  )
    .bind(
      body.amount ?? null,
      body.date ?? null,
      body.description ?? null,
      body.category_id ?? null,
      body.category_name ?? null,
      body.type ?? null,
      id,
      userId
    )
    .run();

  return c.json({ ok: true });
});

// DELETE /api/budget/transactions/:id
budget.delete("/transactions/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const result = await c.env.DB.prepare("DELETE FROM transactions WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .run();
  if (result.meta.changes === 0) return c.json({ error: "not found" }, 404);
  return c.json({ ok: true });
});

// ---- Budgets (monthly limits per category) ----

// GET /api/budget/budgets?month=YYYY-MM
budget.get("/budgets", async (c) => {
  const userId = c.get("userId");
  const month = c.req.query("month");
  let query = "SELECT * FROM budgets WHERE user_id = ?";
  const params: unknown[] = [userId];
  if (month) {
    query += " AND (month = ? OR month = 'recurring')";
    params.push(month);
  }
  query += " ORDER BY category_name ASC";
  const { results } = await c.env.DB.prepare(query).bind(...params).all();
  return c.json({ budgets: results });
});

// POST /api/budget/budgets - upsert a budget for a category+month
budget.post("/budgets", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<{
    category_id?: string;
    category_name?: string;
    monthly_limit?: number;
    month?: string; // 'YYYY-MM' or 'recurring'
  }>();

  if (!body.category_name || body.monthly_limit == null || !body.month) {
    return c.json({ error: "category_name, monthly_limit and month are required" }, 400);
  }

  const id = generateId("budget");
  await c.env.DB.prepare(
    `INSERT INTO budgets (id, user_id, category_id, category_name, monthly_limit, month)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, category_name, month) DO UPDATE SET
       monthly_limit = excluded.monthly_limit,
       category_id = excluded.category_id`
  )
    .bind(id, userId, body.category_id ?? null, body.category_name, body.monthly_limit, body.month)
    .run();

  return c.json({ ok: true });
});

// DELETE /api/budget/budgets/:id
budget.delete("/budgets/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const result = await c.env.DB.prepare("DELETE FROM budgets WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .run();
  if (result.meta.changes === 0) return c.json({ error: "not found" }, 404);
  return c.json({ ok: true });
});

// GET /api/budget/summary?month=YYYY-MM - income, expenses, per-category spend vs budget
budget.get("/summary", async (c) => {
  const userId = c.get("userId");
  const month = c.req.query("month") ?? new Date().toISOString().slice(0, 7);
  const monthPrefix = `${month}%`;

  const totals = await c.env.DB.prepare(
    `SELECT
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS income,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expenses
     FROM transactions WHERE user_id = ? AND date LIKE ?`
  )
    .bind(userId, monthPrefix)
    .first();

  const { results: byCategory } = await c.env.DB.prepare(
    `SELECT category_name, type, COALESCE(SUM(amount), 0) AS total
     FROM transactions WHERE user_id = ? AND date LIKE ?
     GROUP BY category_name, type
     ORDER BY total DESC`
  )
    .bind(userId, monthPrefix)
    .all();

  const { results: budgets } = await c.env.DB.prepare(
    "SELECT * FROM budgets WHERE user_id = ? AND (month = ? OR month = 'recurring')"
  )
    .bind(userId, month)
    .all();

  return c.json({ month, totals, by_category: byCategory, budgets });
});

export default budget;
