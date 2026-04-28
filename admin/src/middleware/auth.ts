import { createMiddleware } from "hono/factory";
import { verifyJWT } from "../auth/crypto.js";
import type { Env, AuthUser } from "../types.js";

type Variables = { user: AuthUser };

/**
 * JWT auth middleware. Extracts Bearer token, verifies it,
 * and attaches the user to the Hono context.
 */
export const requireAuth = createMiddleware<{ Bindings: Env; Variables: Variables }>(
  async (c, next) => {
    const header = c.req.header("Authorization");
    if (!header?.startsWith("Bearer ")) {
      return c.json({ error: "Missing or invalid Authorization header" }, 401);
    }

    const token = header.slice(7);
    const secret = c.env.JWT_SECRET || "dev-secret-change-in-production";
    const payload = await verifyJWT(token, secret);

    if (!payload) {
      return c.json({ error: "Invalid or expired token" }, 401);
    }

    c.set("user", {
      id: payload.sub,
      email: payload.email,
      display_name: payload.email, // Will be enriched from DB if needed
      role: payload.role,
    });

    await next();
  },
);
