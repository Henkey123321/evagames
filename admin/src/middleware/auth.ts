import { createMiddleware } from "hono/factory";
import { verifyJWT } from "../auth/crypto.js";
import type { AuthUser, Env } from "../types.js";

type Variables = { user: AuthUser };

/**
 * JWT auth middleware. Extracts Bearer token, verifies it,
 * and attaches the user to the Hono context.
 */
export const requireAuth = createMiddleware<{
	Bindings: Env;
	Variables: Variables;
}>(async (c, next) => {
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

	const user = await c.env.DB.prepare(
		"SELECT id, email, display_name, role FROM users WHERE id = ?",
	)
		.bind(payload.sub)
		.first<AuthUser>();

	if (!user) {
		return c.json({ error: "User not found" }, 401);
	}

	c.set("user", user);

	await next();
});
