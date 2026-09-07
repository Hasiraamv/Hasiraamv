import { Hono } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import {
  hashPassword,
  verifyPassword,
  createToken,
  generateId,
  generateResetToken,
  sha256Hex,
} from "../auth";
import { verifyGoogleIdToken } from "../google";
import { sendEmail } from "../email";
import { requireAuth } from "../middleware";
import type { AppEnv } from "../types";

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

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

// POST /api/auth/google { credential: <Google ID token from Google Identity Services> }
auth.post("/google", async (c) => {
  const body = await c.req.json<{ credential?: string }>();
  if (!body.credential) return c.json({ error: "credential is required" }, 400);

  let payload;
  try {
    payload = await verifyGoogleIdToken(body.credential, c.env.GOOGLE_CLIENT_ID);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "invalid Google credential" }, 401);
  }

  const email = payload.email.toLowerCase();

  let user = await c.env.DB.prepare("SELECT id, email, name FROM users WHERE google_id = ? OR email = ?")
    .bind(payload.sub, email)
    .first<{ id: string; email: string; name: string }>();

  if (!user) {
    const id = generateId("user");
    // Google-only accounts never use password login; store an unusable random hash.
    const placeholderPassword = await hashPassword(crypto.randomUUID() + crypto.randomUUID());
    await c.env.DB.prepare(
      "INSERT INTO users (id, email, password_hash, name, google_id) VALUES (?, ?, ?, ?, ?)"
    )
      .bind(id, email, placeholderPassword, payload.name || email.split("@")[0], payload.sub)
      .run();
    user = { id, email, name: payload.name || email.split("@")[0] };
  } else {
    await c.env.DB.prepare("UPDATE users SET google_id = ? WHERE id = ? AND google_id IS NULL")
      .bind(payload.sub, user.id)
      .run();
  }

  const token = await createToken(user.id, c.env.JWT_SECRET);
  setCookie(c, "fitpocket_session", token, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return c.json({ token, user });
});

// POST /api/auth/forgot-password { email }
// Always responds { ok: true } regardless of whether the account exists,
// so this endpoint can't be used to enumerate registered emails.
auth.post("/forgot-password", async (c) => {
  const body = await c.req.json<{ email?: string }>();
  const email = body.email?.trim().toLowerCase();
  if (!email) return c.json({ error: "email is required" }, 400);

  const user = await c.env.DB.prepare("SELECT id, name FROM users WHERE email = ?")
    .bind(email)
    .first<{ id: string; name: string }>();

  if (user) {
    const token = generateResetToken();
    const tokenHash = await sha256Hex(token);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString();

    await c.env.DB.prepare(
      "INSERT INTO password_resets (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)"
    )
      .bind(generateId("reset"), user.id, tokenHash, expiresAt)
      .run();

    const resetUrl = `${c.env.FRONTEND_URL}/#reset=${token}`;
    try {
      await sendEmail(c.env, {
        to: email,
        subject: "Reset your FitPocket password",
        html: `
          <p>Hi ${user.name || "there"},</p>
          <p>Someone requested a password reset for your FitPocket account. This link expires in 30 minutes.</p>
          <p><a href="${resetUrl}">Reset your password</a></p>
          <p>If you didn't request this, you can safely ignore this email.</p>
        `,
      });
    } catch (e) {
      console.error("Failed to send password reset email", e);
    }
  }

  return c.json({ ok: true });
});

// POST /api/auth/reset-password { token, password }
auth.post("/reset-password", async (c) => {
  const body = await c.req.json<{ token?: string; password?: string }>();
  const { token, password } = body;
  if (!token || !password) return c.json({ error: "token and password are required" }, 400);
  if (password.length < 8) return c.json({ error: "password must be at least 8 characters" }, 400);

  const tokenHash = await sha256Hex(token);
  const reset = await c.env.DB.prepare(
    "SELECT id, user_id, expires_at, used_at FROM password_resets WHERE token_hash = ?"
  )
    .bind(tokenHash)
    .first<{ id: string; user_id: string; expires_at: string; used_at: string | null }>();

  if (!reset || reset.used_at || new Date(reset.expires_at).getTime() < Date.now()) {
    return c.json({ error: "this reset link is invalid or has expired" }, 400);
  }

  const passwordHash = await hashPassword(password);
  await c.env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?")
    .bind(passwordHash, reset.user_id)
    .run();
  await c.env.DB.prepare("UPDATE password_resets SET used_at = datetime('now') WHERE id = ?")
    .bind(reset.id)
    .run();

  return c.json({ ok: true });
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
