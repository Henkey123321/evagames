import { Hono } from "hono";
import type { Env, AuthUser, DesignTokenRow } from "../types.js";

type Vars = { user: AuthUser };
const designTokens = new Hono<{ Bindings: Env; Variables: Vars }>();

// GET /api/design-tokens
designTokens.get("/", async (c) => {
  const rows = await c.env.DB.prepare("SELECT * FROM design_tokens ORDER BY category, id")
    .all<DesignTokenRow>();
  return c.json({ tokens: rows.results });
});

// PUT /api/design-tokens/:id
designTokens.put("/:id", async (c) => {
  const user = c.get("user");
  const id = Number(c.req.param("id"));
  const { token_value } = await c.req.json<{ token_value: string }>();
  if (!token_value) return c.json({ error: "token_value required" }, 400);

  await c.env.DB.prepare("UPDATE design_tokens SET token_value = ? WHERE id = ?")
    .bind(token_value, id).run();
  await c.env.DB.prepare("UPDATE publish_status SET last_modified_at = datetime('now') WHERE id = 1").run();
  await c.env.DB.prepare(
    "INSERT INTO edit_history (user_id, entity_type, entity_id, action, diff_json) VALUES (?, 'design_token', ?, 'update', ?)",
  ).bind(user.id, String(id), JSON.stringify({ token_value })).run();

  return c.json({ ok: true });
});

export default designTokens;
