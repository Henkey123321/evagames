import { Hono } from "hono";
import type { Env, AuthUser, BodyArtRow } from "../types.js";

type Vars = { user: AuthUser };
const bodyArt = new Hono<{ Bindings: Env; Variables: Vars }>();

// GET /api/body-art
bodyArt.get("/", async (c) => {
  const rows = await c.env.DB.prepare("SELECT * FROM body_art ORDER BY page_ref, position")
    .all<BodyArtRow>();
  return c.json({ bodyArt: rows.results });
});

// PUT /api/body-art
bodyArt.put("/", async (c) => {
  const user = c.get("user");
  const { page_ref, position, image_filename } = await c.req.json<{
    page_ref: string; position: string; image_filename: string;
  }>();

  await c.env.DB.prepare(
    `INSERT INTO body_art (page_ref, position, image_filename) VALUES (?, ?, ?)
     ON CONFLICT(page_ref, position) DO UPDATE SET image_filename = excluded.image_filename`,
  ).bind(page_ref, position, image_filename).run();

  await c.env.DB.prepare("UPDATE publish_status SET last_modified_at = datetime('now') WHERE id = 1").run();
  await c.env.DB.prepare(
    "INSERT INTO edit_history (user_id, entity_type, entity_id, action, diff_json) VALUES (?, 'body_art', ?, 'update', ?)",
  ).bind(user.id, `${page_ref}:${position}`, JSON.stringify({ image_filename })).run();

  return c.json({ ok: true });
});

export default bodyArt;
