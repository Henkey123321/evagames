import { Hono } from "hono";
import type { Env, AuthUser, FooterLinkRow } from "../types.js";

type Vars = { user: AuthUser };
const footerLinks = new Hono<{ Bindings: Env; Variables: Vars }>();

// GET /api/footer-links
footerLinks.get("/", async (c) => {
  const rows = await c.env.DB.prepare("SELECT * FROM footer_links ORDER BY group_name, sort_order")
    .all<FooterLinkRow>();
  return c.json({ links: rows.results });
});

// POST /api/footer-links
footerLinks.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json<Omit<FooterLinkRow, "id">>();
  if (!body.label || !body.url) return c.json({ error: "Label and URL required." }, 400);

  const maxOrder = await c.env.DB.prepare(
    "SELECT MAX(sort_order) as m FROM footer_links WHERE group_name = ?",
  ).bind(body.group_name || "store").first<{ m: number | null }>();

  const result = await c.env.DB.prepare(
    "INSERT INTO footer_links (label, url, icon_filename, group_name, extra_css_class, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
  ).bind(body.label, body.url, body.icon_filename || "", body.group_name || "store", body.extra_css_class || "", (maxOrder?.m ?? 0) + 1).run();

  await c.env.DB.prepare("UPDATE publish_status SET last_modified_at = datetime('now') WHERE id = 1").run();
  await c.env.DB.prepare(
    "INSERT INTO edit_history (user_id, entity_type, entity_id, action, diff_json) VALUES (?, 'footer_link', ?, 'create', ?)",
  ).bind(user.id, String(result.meta.last_row_id), JSON.stringify(body)).run();

  return c.json({ id: result.meta.last_row_id }, 201);
});

// PUT /api/footer-links/:id
footerLinks.put("/:id", async (c) => {
  const user = c.get("user");
  const id = Number(c.req.param("id"));
  const body = await c.req.json<Partial<FooterLinkRow>>();

  const fields: string[] = [];
  const values: unknown[] = [];
  for (const key of ["label", "url", "icon_filename", "group_name", "extra_css_class", "sort_order"] as const) {
    if (body[key] !== undefined) { fields.push(`${key} = ?`); values.push(body[key]); }
  }
  if (fields.length === 0) return c.json({ error: "Nothing to update" }, 400);
  values.push(id);

  await c.env.DB.prepare(`UPDATE footer_links SET ${fields.join(", ")} WHERE id = ?`).bind(...values).run();
  await c.env.DB.prepare("UPDATE publish_status SET last_modified_at = datetime('now') WHERE id = 1").run();
  return c.json({ ok: true });
});

// DELETE /api/footer-links/:id
footerLinks.delete("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  await c.env.DB.prepare("DELETE FROM footer_links WHERE id = ?").bind(id).run();
  await c.env.DB.prepare("UPDATE publish_status SET last_modified_at = datetime('now') WHERE id = 1").run();
  await c.env.DB.prepare(
    "INSERT INTO edit_history (user_id, entity_type, entity_id, action) VALUES (?, 'footer_link', ?, 'delete')",
  ).bind(user.id, id).run();
  return c.json({ ok: true });
});

// POST /api/footer-links/reorder
footerLinks.post("/reorder", async (c) => {
  const { order } = await c.req.json<{ order: number[] }>();
  const batch = order.map((id, i) =>
    c.env.DB.prepare("UPDATE footer_links SET sort_order = ? WHERE id = ?").bind(i + 1, id),
  );
  if (batch.length > 0) await c.env.DB.batch(batch);
  await c.env.DB.prepare("UPDATE publish_status SET last_modified_at = datetime('now') WHERE id = 1").run();
  return c.json({ ok: true });
});

export default footerLinks;
