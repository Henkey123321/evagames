-- Goddess's Dashboard — Initial Schema
-- All tables store the "current/draft" state.
-- Publishing snapshots the state and generates the static site.

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  permissions TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS site_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  template_id TEXT NOT NULL,
  title TEXT NOT NULL,
  tile_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','coming_soon','reserved')),
  status_label TEXT NOT NULL DEFAULT 'Play',
  sort_order INTEGER NOT NULL DEFAULT 0,
  tile_css_class TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS game_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  setting_key TEXT NOT NULL,
  setting_value TEXT NOT NULL DEFAULT '',
  UNIQUE(game_id, setting_key)
);

CREATE TABLE IF NOT EXISTS game_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  slot_key TEXT NOT NULL,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'image/png',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS design_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_name TEXT NOT NULL UNIQUE,
  token_value TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'palette' CHECK (category IN ('palette','semantic','typography')),
  label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS footer_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  icon_filename TEXT NOT NULL DEFAULT '',
  group_name TEXT NOT NULL DEFAULT 'store' CHECK (group_name IN ('store','social')),
  extra_css_class TEXT DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS body_art (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page_ref TEXT NOT NULL,
  position TEXT NOT NULL CHECK (position IN ('left','right')),
  image_filename TEXT NOT NULL,
  UNIQUE(page_ref, position)
);

CREATE TABLE IF NOT EXISTS edit_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create','update','delete','publish')),
  diff_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS publish_status (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_published_at TEXT,
  last_modified_at TEXT NOT NULL DEFAULT (datetime('now')),
  published_by INTEGER REFERENCES users(id),
  snapshot_hash TEXT DEFAULT ''
);

-- Ensure publish_status always has exactly one row
INSERT OR IGNORE INTO publish_status (id, last_modified_at) VALUES (1, datetime('now'));
