import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { verifyToken } from "./auth";
import type { AppEnv } from "./types";

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const cookieToken = getCookie(c, "fitpocket_session");
  const token = bearerToken || cookieToken;

  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userId = await verifyToken(token, c.env.JWT_SECRET);
  if (!userId) {
    return c.json({ error: "Invalid or expired session" }, 401);
  }

  c.set("userId", userId);
  await next();
});
