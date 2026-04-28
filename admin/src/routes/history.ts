import { Hono } from "hono";
import type { Env, AuthUser, EditHistoryRow } from "../types.js";

type Vars = { user: AuthUser };
const history = new Hono<{ Bindings: Env; Variables: Vars }>();

// GET /api/history
history.get("/", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") || 50), 200);
  const offset = Number(c.req.query("offset") || 0);

  const rows = await c.env.DB.prepare(
    `SELECT h.*, u.display_name as user_name
     FROM edit_history h
     LEFT JOIN users u ON h.user_id = u.id
     ORDER BY h.created_at DESC
     LIMIT ? OFFSET ?`,
  ).bind(limit, offset).all();

  return c.json({ history: rows.results });
});

export default history;
