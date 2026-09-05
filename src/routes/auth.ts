import { Hono } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import { hashPassword, verifyPassword, createToken, generateId } from "../auth";
import { requireAuth } from "../middleware";
import type { AppEnv } from "../types";

const auth = new Hono<AppEnv>();

auth.post("/register", async (c) => {
  const body = await c.req.json<{ email?: string; password?: string; name?: string }>();
  const email = body.email?.trim().toLowerCase();
  const password = body.password;
  const name = body.name?.trim();

  if (!email || !password || !name) {
    return c.json({ error: "email, password and name are required" }, 400);
  }
  if (password.length < 8) {
    return c.json({ error: "password must be at least 8 characters" }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ error: "invalid email" }, 400);
  }

  const existing = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?")
    .bind(email)
    .first();
  if (existing) {
    return c.json({ error: "an account with this email already exists" }, 409);
  }

  const id = generateId("user");
  const passwordHash = await hashPassword(password);

  await c.env.DB.prepare(
    "INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)"
  )
    .bind(id, email, passwordHash, name)
    .run();

  const token = await createToken(id, c.env.JWT_SECRET);
  setCookie(c, "fitpocket_session", token, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return c.json({ token, user: { id, email, name } }, 201);
});

auth.post("/login", async (c) => {
  const body = await c.req.json<{ email?: string; password?: string }>();
  const email = body.email?.trim().toLowerCase();
  const password = body.password;

  if (!email || !password) {
    return c.json({ error: "email and password are required" }, 400);
  }

  const user = await c.env.DB.prepare(
    "SELECT id, email, name, password_hash FROM users WHERE email = ?"
  )
    .bind(email)
    .first<{ id: string; email: string; name: string; password_hash: string }>();

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return c.json({ error: "invalid email or password" }, 401);
  }

  const token = await createToken(user.id, c.env.JWT_SECRET);
  setCookie(c, "fitpocket_session", token, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return c.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

auth.post("/logout", (c) => {
  deleteCookie(c, "fitpocket_session", { path: "/" });
  return c.json({ ok: true });
});

auth.get("/me", requireAuth, async (c) => {
  const userId = c.get("userId");
  const user = await c.env.DB.prepare("SELECT id, email, name, created_at FROM users WHERE id = ?")
    .bind(userId)
    .first();
  if (!user) return c.json({ error: "not found" }, 404);
  return c.json({ user });
});

export default auth;
