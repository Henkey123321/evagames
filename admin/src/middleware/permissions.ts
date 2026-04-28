/**
 * Permissions system — prepared for future role-based access.
 * Currently everyone is admin with full access.
 * When roles are enabled, this module enforces granular permissions.
 */

export type Permission =
  | "games.read" | "games.write" | "games.delete"
  | "site_config.read" | "site_config.write"
  | "design_tokens.read" | "design_tokens.write"
  | "footer_links.read" | "footer_links.write"
  | "body_art.read" | "body_art.write"
  | "users.read" | "users.write"
  | "publish"
  | "history.read";

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: [
    "games.read", "games.write", "games.delete",
    "site_config.read", "site_config.write",
    "design_tokens.read", "design_tokens.write",
    "footer_links.read", "footer_links.write",
    "body_art.read", "body_art.write",
    "users.read", "users.write",
    "publish",
    "history.read",
  ],
  editor: [
    "games.read", "games.write",
    "site_config.read",
    "design_tokens.read",
    "footer_links.read", "footer_links.write",
    "body_art.read", "body_art.write",
    "publish",
    "history.read",
  ],
  viewer: [
    "games.read",
    "site_config.read",
    "design_tokens.read",
    "footer_links.read",
    "body_art.read",
    "history.read",
  ],
};

export function hasPermission(role: string, permission: Permission): boolean {
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return false;
  return perms.includes(permission);
}

export function getAllPermissions(role: string): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}
