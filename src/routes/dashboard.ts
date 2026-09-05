import { Hono } from "hono";
import { requireAuth } from "../middleware";
import type { AppEnv } from "../types";

const dashboard = new Hono<AppEnv>();
dashboard.use("*", requireAuth);

// GET /api/dashboard - one-shot summary for the home screen
dashboard.get("/", async (c) => {
  const userId = c.get("userId");
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const monthPrefix = `${month}%`;
  const sevenDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [
    nutritionToday,
    nutritionTargets,
    workoutsThisWeek,
    latestMetric,
    budgetTotals,
    activeGoals,
  ] = await Promise.all([
    c.env.DB.prepare(
      `SELECT COALESCE(SUM(calories),0) AS calories, COALESCE(SUM(protein),0) AS protein,
              COALESCE(SUM(carbs),0) AS carbs, COALESCE(SUM(fat),0) AS fat
       FROM nutrition_logs WHERE user_id = ? AND date = ?`
    )
      .bind(userId, today)
      .first(),
    c.env.DB.prepare("SELECT * FROM nutrition_targets WHERE user_id = ?").bind(userId).first(),
    c.env.DB.prepare(
      "SELECT COUNT(*) AS count FROM workouts WHERE user_id = ? AND date >= ?"
    )
      .bind(userId, sevenDaysAgo)
      .first(),
    c.env.DB.prepare(
      "SELECT * FROM body_metrics WHERE user_id = ? ORDER BY date DESC LIMIT 1"
    )
      .bind(userId)
      .first(),
    c.env.DB.prepare(
      `SELECT
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expenses
       FROM transactions WHERE user_id = ? AND date LIKE ?`
    )
      .bind(userId, monthPrefix)
      .first(),
    c.env.DB.prepare(
      "SELECT * FROM goals WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 5"
    )
      .bind(userId)
      .all(),
  ]);

  return c.json({
    date: today,
    nutrition: { today: nutritionToday, targets: nutritionTargets ?? null },
    fitness: { workouts_last_7_days: (workoutsThisWeek as { count: number } | null)?.count ?? 0, latest_metric: latestMetric ?? null },
    budget: { month, ...(budgetTotals as object) },
    goals: activeGoals.results,
  });
});

export default dashboard;
