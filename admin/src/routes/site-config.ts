import { Hono } from "hono";
import type { Env, AuthUser, SiteConfigRow } from "../types.js";

type Vars = { user: AuthUser };
const siteConfig = new Hono<{ Bindings: Env; Variables: Vars }>();

// GET /api/site-config
siteConfig.get("/", async (c) => {
  const rows = await c.env.DB.prepare("SELECT key, value, updated_at FROM site_config")
    .all<SiteConfigRow>();
  const config: Record<string, string> = {};
  for (const row of rows.results) config[row.key] = row.value;
  return c.json({ config });
});

// PUT /api/site-config
siteConfig.put("/", async (c) => {
  const user = c.get("user");
  const { config } = await c.req.json<{ config: Record<string, string> }>();

  const stmt = c.env.DB.prepare(
    `INSERT INTO site_config (key, value, updated_at, updated_by) VALUES (?, ?, datetime('now'), ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
  );

  const batch = Object.entries(config).map(([key, value]) => stmt.bind(key, value, user.id));
  if (batch.length > 0) await c.env.DB.batch(batch);

  // Mark content as modified
  await c.env.DB.prepare("UPDATE publish_status SET last_modified_at = datetime('now') WHERE id = 1").run();

  // Log edit
  await c.env.DB.prepare(
    "INSERT INTO edit_history (user_id, entity_type, entity_id, action, diff_json) VALUES (?, 'site_config', 'all', 'update', ?)",
  ).bind(user.id, JSON.stringify(config)).run();

  return c.json({ ok: true });
});

export default siteConfig;
