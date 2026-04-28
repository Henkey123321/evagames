import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env, AuthUser } from "./types.js";
import { requireAuth } from "./middleware/auth.js";

import authRoutes from "./routes/auth.js";
import siteConfigRoutes from "./routes/site-config.js";
import gamesRoutes from "./routes/games.js";
import designTokensRoutes from "./routes/design-tokens.js";
import footerLinksRoutes from "./routes/footer-links.js";
import bodyArtRoutes from "./routes/body-art.js";
import historyRoutes from "./routes/history.js";
import uploadRoutes from "./routes/upload.js";
import publishRoutes from "./routes/publish.js";

type Variables = { user: AuthUser };
const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// ── Global middleware ──
app.use("/api/*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
}));

// ── Public routes (no auth) ──
app.route("/api/auth", authRoutes);

// ── Protected routes ──
app.use("/api/*", requireAuth);
app.route("/api/site-config", siteConfigRoutes);
app.route("/api/games", gamesRoutes);
app.route("/api/design-tokens", designTokensRoutes);
app.route("/api/footer-links", footerLinksRoutes);
app.route("/api/body-art", bodyArtRoutes);
app.route("/api/history", historyRoutes);
app.route("/api/upload", uploadRoutes);
app.route("/api/publish", publishRoutes);

// Admin SPA fallback — Wrangler [assets] serves static files from public/.
// Client-side routing is handled by the SPA itself.

export default app;
