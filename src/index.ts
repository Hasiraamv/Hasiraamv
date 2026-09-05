import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AppEnv } from "./types";
import auth from "./routes/auth";
import workouts from "./routes/workouts";
import nutrition from "./routes/nutrition";
import budget from "./routes/budget";
import goals from "./routes/goals";
import dashboard from "./routes/dashboard";
import ai from "./routes/ai";

const app = new Hono<AppEnv>();

app.use(
  "/api/*",
  cors({
    origin: ["https://fitpocket.in", "http://localhost:3000", "http://localhost:5173"],
    credentials: true,
  })
);

app.get("/", (c) => c.json({ name: "Fit Pocket API", status: "ok" }));
app.get("/api/health", (c) => c.json({ status: "ok", time: new Date().toISOString() }));

app.route("/api/auth", auth);
app.route("/api/workouts", workouts);
app.route("/api/nutrition", nutrition);
app.route("/api/budget", budget);
app.route("/api/goals", goals);
app.route("/api/dashboard", dashboard);
app.route("/api/ai", ai);

app.notFound((c) => c.json({ error: "not found" }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "internal server error" }, 500);
});

export default app;
