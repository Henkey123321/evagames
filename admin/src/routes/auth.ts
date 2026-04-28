import { Hono } from "hono";
import { generateSalt, hashPassword, verifyPassword, signJWT } from "../auth/crypto.js";
import type { Env, UserRow } from "../types.js";

const auth = new Hono<{ Bindings: Env }>();

// POST /api/auth/login
auth.post("/login", async (c) => {
  const { email, password } = await c.req.json<{ email: string; password: string }>();
  if (!email || !password) {
    return c.json({ error: "Email and password are required." }, 400);
  }

  const user = await c.env.DB.prepare("SELECT * FROM users WHERE email = ?")
    .bind(email.toLowerCase().trim())
    .first<UserRow>();

  if (!user) {
    return c.json({ error: "Invalid email or password." }, 401);
  }

  const valid = await verifyPassword(password, user.salt, user.password_hash);
  if (!valid) {
    return c.json({ error: "Invalid email or password." }, 401);
  }

  const secret = c.env.JWT_SECRET || "dev-secret-change-in-production";
  const token = await signJWT({ sub: user.id, email: user.email, role: user.role }, secret);

  return c.json({
    token,
    user: { id: user.id, email: user.email, display_name: user.display_name, role: user.role },
  });
});

// POST /api/auth/register  (first-user setup or admin invite)
auth.post("/register", async (c) => {
  const { email, password, display_name } = await c.req.json<{
    email: string;
    password: string;
    display_name: string;
  }>();

  if (!email || !password || !display_name) {
    return c.json({ error: "Email, password, and display name are required." }, 400);
  }
  if (password.length < 8) {
    return c.json({ error: "Password must be at least 8 characters." }, 400);
  }

  // Check if any users exist — first user gets auto-created, subsequent need auth
  const count = await c.env.DB.prepare("SELECT COUNT(*) as cnt FROM users").first<{ cnt: number }>();
  if (count && count.cnt > 0) {
    // For now, only allow registration if no users exist (first-time setup)
    // Future: require admin auth to invite new users
    return c.json({ error: "Registration is closed. Ask an admin to invite you." }, 403);
  }

  const salt = generateSalt();
  const hash = await hashPassword(password, salt);

  await c.env.DB.prepare(
    "INSERT INTO users (email, display_name, password_hash, salt, role) VALUES (?, ?, ?, ?, 'admin')",
  )
    .bind(email.toLowerCase().trim(), display_name.trim(), hash, salt)
    .run();

  const user = await c.env.DB.prepare("SELECT * FROM users WHERE email = ?")
    .bind(email.toLowerCase().trim())
    .first<UserRow>();

  const secret = c.env.JWT_SECRET || "dev-secret-change-in-production";
  const token = await signJWT({ sub: user!.id, email: user!.email, role: user!.role }, secret);

  return c.json({
    token,
    user: { id: user!.id, email: user!.email, display_name: user!.display_name, role: user!.role },
  }, 201);
});

// GET /api/auth/me
auth.get("/me", async (c) => {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return c.json({ error: "Not authenticated" }, 401);
  }

  const secret = c.env.JWT_SECRET || "dev-secret-change-in-production";
  const { verifyJWT } = await import("../auth/crypto.js");
  const payload = await verifyJWT(header.slice(7), secret);
  if (!payload) return c.json({ error: "Invalid token" }, 401);

  const user = await c.env.DB.prepare("SELECT id, email, display_name, role FROM users WHERE id = ?")
    .bind(payload.sub)
    .first();

  if (!user) return c.json({ error: "User not found" }, 404);
  return c.json({ user });
});

// GET /api/auth/setup-required
auth.get("/setup-required", async (c) => {
  const count = await c.env.DB.prepare("SELECT COUNT(*) as cnt FROM users").first<{ cnt: number }>();
  return c.json({ setupRequired: !count || count.cnt === 0 });
});

export default auth;
