import { Hono } from "hono";
import { generateSalt, hashPassword } from "../auth/crypto.js";
import type { AuthUser, Env, UserRow } from "../types.js";

type Vars = { user: AuthUser };
const users = new Hono<{ Bindings: Env; Variables: Vars }>();

function requireAdmin(user: AuthUser) {
	return user.role === "admin";
}

users.get("/", async (c) => {
	if (!requireAdmin(c.get("user")))
		return c.json({ error: "Admin role required" }, 403);
	const rows = await c.env.DB.prepare(
		"SELECT id, email, display_name, role, created_at FROM users ORDER BY created_at ASC",
	).all<
		Pick<UserRow, "id" | "email" | "display_name" | "role" | "created_at">
	>();
	return c.json({ users: rows.results });
});

users.post("/", async (c) => {
	if (!requireAdmin(c.get("user")))
		return c.json({ error: "Admin role required" }, 403);
	const body = await c.req.json<{
		email: string;
		password: string;
		display_name: string;
		role: string;
	}>();
	if (!body.email || !body.password || !body.display_name) {
		return c.json(
			{ error: "Email, password, and display name are required." },
			400,
		);
	}
	if (body.password.length < 8)
		return c.json({ error: "Password must be at least 8 characters." }, 400);
	const role = ["admin", "editor", "viewer"].includes(body.role)
		? body.role
		: "editor";
	const salt = generateSalt();
	const passwordHash = await hashPassword(body.password, salt);
	const result = await c.env.DB.prepare(
		"INSERT INTO users (email, display_name, password_hash, salt, role) VALUES (?, ?, ?, ?, ?)",
	)
		.bind(
			body.email.toLowerCase().trim(),
			body.display_name.trim(),
			passwordHash,
			salt,
			role,
		)
		.run();
	await c.env.DB.prepare(
		"INSERT INTO edit_history (user_id, entity_type, entity_id, action, diff_json) VALUES (?, 'user', ?, 'create', ?)",
	)
		.bind(
			c.get("user").id,
			String(result.meta.last_row_id),
			JSON.stringify({ email: body.email, role }),
		)
		.run();
	return c.json({ id: result.meta.last_row_id }, 201);
});

users.put("/:id", async (c) => {
	if (!requireAdmin(c.get("user")))
		return c.json({ error: "Admin role required" }, 403);
	const id = Number(c.req.param("id"));
	const body = await c.req.json<{ display_name?: string; role?: string }>();
	const fields: string[] = [];
	const values: unknown[] = [];
	if (body.display_name !== undefined) {
		fields.push("display_name = ?");
		values.push(body.display_name.trim());
	}
	if (body.role !== undefined) {
		if (!["admin", "editor", "viewer"].includes(body.role))
			return c.json({ error: "Invalid role" }, 400);
		fields.push("role = ?");
		values.push(body.role);
	}
	if (!fields.length) return c.json({ error: "Nothing to update" }, 400);
	values.push(id);
	await c.env.DB.prepare(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`)
		.bind(...values)
		.run();
	await c.env.DB.prepare(
		"INSERT INTO edit_history (user_id, entity_type, entity_id, action, diff_json) VALUES (?, 'user', ?, 'update', ?)",
	)
		.bind(c.get("user").id, String(id), JSON.stringify(body))
		.run();
	return c.json({ ok: true });
});

export default users;
