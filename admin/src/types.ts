export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  GITHUB_TOKEN: string;
  GITHUB_REPO: string;
  GITHUB_BRANCH: string;
}

// ── Database row types ──

export interface UserRow {
  id: number;
  email: string;
  display_name: string;
  password_hash: string;
  salt: string;
  role: "admin" | "editor" | "viewer";
  permissions: string; // JSON
  created_at: string;
}

export interface SiteConfigRow {
  key: string;
  value: string;
  updated_at: string;
  updated_by: number | null;
}

export interface GameRow {
  id: number;
  slug: string;
  template_id: string;
  title: string;
  tile_number: string;
  status: "available" | "coming_soon" | "reserved";
  status_label: string;
  sort_order: number;
  tile_css_class: string;
  created_at: string;
  updated_at: string;
  updated_by: number | null;
}

export interface GameSettingRow {
  id: number;
  game_id: number;
  setting_key: string;
  setting_value: string;
}

export interface GameAssetRow {
  id: number;
  game_id: number;
  slot_key: string;
  filename: string;
  original_name: string;
  mime_type: string;
  sort_order: number;
}

export interface DesignTokenRow {
  id: number;
  token_name: string;
  token_value: string;
  category: "palette" | "semantic" | "typography";
  label: string;
}

export interface FooterLinkRow {
  id: number;
  label: string;
  url: string;
  icon_filename: string;
  group_name: "store" | "social";
  extra_css_class: string;
  sort_order: number;
}

export interface BodyArtRow {
  id: number;
  page_ref: string;
  position: "left" | "right";
  image_filename: string;
}

export interface EditHistoryRow {
  id: number;
  user_id: number | null;
  entity_type: string;
  entity_id: string;
  action: "create" | "update" | "delete" | "publish";
  diff_json: string;
  created_at: string;
}

export interface PublishStatusRow {
  id: number;
  last_published_at: string | null;
  last_modified_at: string;
  published_by: number | null;
  snapshot_hash: string;
}

// ── Game template types ──

export interface SettingDefinition {
  key: string;
  label: string;
  description: string;
  type: "text" | "number" | "boolean" | "select" | "textarea" | "color" | "json";
  default: unknown;
  options?: { value: string; label: string }[]; // for "select" type
  validation?: { min?: number; max?: number; pattern?: string; required?: boolean };
  advanced: boolean;
  group: string;
}

export interface AssetSlotDefinition {
  key: string;
  label: string;
  description: string;
  accept: string;
  cropAspectRatio?: number; // 1 for 1:1, undefined for free
  required: boolean;
  multiple: boolean;
}

export interface GameTemplate {
  id: string;
  name: string;
  version: string;
  description: string;
  settings: SettingDefinition[];
  assetSlots: AssetSlotDefinition[];
}

// ── Auth types ──

export interface JWTPayload {
  sub: number; // user id
  email: string;
  role: string;
  iat: number;
  exp: number;
}

export interface AuthUser {
  id: number;
  email: string;
  display_name: string;
  role: string;
}
