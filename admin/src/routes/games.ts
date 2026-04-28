import { Hono } from "hono";
import type { Env, AuthUser, GameRow, GameSettingRow, GameAssetRow } from "../types.js";
import { gameTemplates, getTemplate } from "../generator/registry.js";

type Vars = { user: AuthUser };
const games = new Hono<{ Bindings: Env; Variables: Vars }>();

// GET /api/games — list all games
games.get("/", async (c) => {
  const rows = await c.env.DB.prepare("SELECT * FROM games ORDER BY sort_order ASC").all<GameRow>();
  return c.json({ games: rows.results });
});

// GET /api/games/templates — list available templates
games.get("/templates", async (c) => {
  const templates = Object.values(gameTemplates).map((t) => ({
    id: t.id, name: t.name, description: t.description, version: t.version,
  }));
  return c.json({ templates });
});

// GET /api/games/:slug
games.get("/:slug", async (c) => {
  const slug = c.req.param("slug");
  const game = await c.env.DB.prepare("SELECT * FROM games WHERE slug = ?").bind(slug).first<GameRow>();
  if (!game) return c.json({ error: "Game not found" }, 404);

  const settings = await c.env.DB.prepare("SELECT * FROM game_settings WHERE game_id = ?")
    .bind(game.id).all<GameSettingRow>();
  const assets = await c.env.DB.prepare("SELECT * FROM game_assets WHERE game_id = ? ORDER BY sort_order")
    .bind(game.id).all<GameAssetRow>();
  const template = getTemplate(game.template_id);

  return c.json({ game, settings: settings.results, assets: assets.results, template });
});

// POST /api/games — create new game from template
games.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json<{
    slug: string; template_id: string; title: string; tile_number: string;
    status?: string; status_label?: string;
  }>();

  const template = getTemplate(body.template_id);
  if (!template) return c.json({ error: "Unknown template: " + body.template_id }, 400);
  if (!body.slug || !body.title) return c.json({ error: "Slug and title are required." }, 400);

  // Get max sort_order
  const maxOrder = await c.env.DB.prepare("SELECT MAX(sort_order) as m FROM games").first<{ m: number | null }>();
  const nextOrder = (maxOrder?.m ?? 0) + 1;

  const result = await c.env.DB.prepare(
    `INSERT INTO games (slug, template_id, title, tile_number, status, status_label, sort_order, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    body.slug, body.template_id, body.title, body.tile_number || String(nextOrder).padStart(2, "0"),
    body.status || "available", body.status_label || "Play", nextOrder, user.id,
  ).run();

  const gameId = result.meta.last_row_id;

  // Insert default settings from template
  for (const setting of template.settings) {
    await c.env.DB.prepare("INSERT INTO game_settings (game_id, setting_key, setting_value) VALUES (?, ?, ?)")
      .bind(gameId, setting.key, JSON.stringify(setting.default)).run();
  }

  await c.env.DB.prepare("UPDATE publish_status SET last_modified_at = datetime('now') WHERE id = 1").run();
  await c.env.DB.prepare(
    "INSERT INTO edit_history (user_id, entity_type, entity_id, action, diff_json) VALUES (?, 'game', ?, 'create', ?)",
  ).bind(user.id, String(gameId), JSON.stringify(body)).run();

  return c.json({ id: gameId, slug: body.slug }, 201);
});

// PUT /api/games/:slug — update game metadata
games.put("/:slug", async (c) => {
  const user = c.get("user");
  const slug = c.req.param("slug");
  const body = await c.req.json<Partial<GameRow>>();

  const game = await c.env.DB.prepare("SELECT id FROM games WHERE slug = ?").bind(slug).first<{ id: number }>();
  if (!game) return c.json({ error: "Game not found" }, 404);

  const fields: string[] = [];
  const values: unknown[] = [];
  for (const key of ["title", "tile_number", "status", "status_label", "sort_order", "tile_css_class"] as const) {
    if (body[key] !== undefined) { fields.push(`${key} = ?`); values.push(body[key]); }
  }
  if (fields.length === 0) return c.json({ error: "No fields to update" }, 400);

  fields.push("updated_at = datetime('now')", "updated_by = ?");
  values.push(user.id, game.id);

  await c.env.DB.prepare(`UPDATE games SET ${fields.join(", ")} WHERE id = ?`).bind(...values).run();
  await c.env.DB.prepare("UPDATE publish_status SET last_modified_at = datetime('now') WHERE id = 1").run();

  return c.json({ ok: true });
});

// PUT /api/games/:slug/settings — update game settings
games.put("/:slug/settings", async (c) => {
  const user = c.get("user");
  const slug = c.req.param("slug");
  const { settings } = await c.req.json<{ settings: Record<string, unknown> }>();

  const game = await c.env.DB.prepare("SELECT id FROM games WHERE slug = ?").bind(slug).first<{ id: number }>();
  if (!game) return c.json({ error: "Game not found" }, 404);

  const stmt = c.env.DB.prepare(
    `INSERT INTO game_settings (game_id, setting_key, setting_value) VALUES (?, ?, ?)
     ON CONFLICT(game_id, setting_key) DO UPDATE SET setting_value = excluded.setting_value`,
  );

  const batch = Object.entries(settings).map(([key, value]) =>
    stmt.bind(game.id, key, JSON.stringify(value)),
  );
  if (batch.length > 0) await c.env.DB.batch(batch);

  await c.env.DB.prepare("UPDATE publish_status SET last_modified_at = datetime('now') WHERE id = 1").run();
  await c.env.DB.prepare(
    "INSERT INTO edit_history (user_id, entity_type, entity_id, action, diff_json) VALUES (?, 'game_settings', ?, 'update', ?)",
  ).bind(user.id, slug, JSON.stringify(settings)).run();

  return c.json({ ok: true });
});

// DELETE /api/games/:slug
games.delete("/:slug", async (c) => {
  const user = c.get("user");
  const slug = c.req.param("slug");
  const game = await c.env.DB.prepare("SELECT id FROM games WHERE slug = ?").bind(slug).first<{ id: number }>();
  if (!game) return c.json({ error: "Game not found" }, 404);

  await c.env.DB.prepare("DELETE FROM games WHERE id = ?").bind(game.id).run();
  await c.env.DB.prepare("UPDATE publish_status SET last_modified_at = datetime('now') WHERE id = 1").run();
  await c.env.DB.prepare(
    "INSERT INTO edit_history (user_id, entity_type, entity_id, action) VALUES (?, 'game', ?, 'delete')",
  ).bind(user.id, slug).run();

  return c.json({ ok: true });
});

// POST /api/games/:slug/reorder
games.post("/reorder", async (c) => {
  const { order } = await c.req.json<{ order: string[] }>(); // array of slugs
  const batch = order.map((slug, i) =>
    c.env.DB.prepare("UPDATE games SET sort_order = ? WHERE slug = ?").bind(i + 1, slug),
  );
  if (batch.length > 0) await c.env.DB.batch(batch);
  await c.env.DB.prepare("UPDATE publish_status SET last_modified_at = datetime('now') WHERE id = 1").run();
  return c.json({ ok: true });
});

export default games;
