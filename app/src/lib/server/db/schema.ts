import { sql } from 'drizzle-orm';
import {
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
	uniqueIndex
} from 'drizzle-orm/sqlite-core';

const id = () =>
	text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
	integer('created_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(unixepoch() * 1000)`);

/* ── People ─────────────────────────────────────────────────────────── */

export const ROLES = ['player', 'staff', 'owner'] as const;
export type Role = (typeof ROLES)[number];

export const users = sqliteTable(
	'users',
	{
		id: id(),
		/** Lowercased, used for lookups and uniqueness. */
		username: text('username').notNull(),
		/** As the user typed it, for display. */
		usernameDisplay: text('username_display').notNull(),
		displayName: text('display_name').notNull(),
		passwordHash: text('password_hash').notNull(),
		role: text('role', { enum: ROLES }).notNull().default('player'),
		onlyfansHandle: text('onlyfans_handle'),
		onlyfansVerifiedAt: integer('onlyfans_verified_at', { mode: 'timestamp_ms' }),
		loyalfansHandle: text('loyalfans_handle'),
		loyalfansVerifiedAt: integer('loyalfans_verified_at', { mode: 'timestamp_ms' }),
		ageConfirmedAt: integer('age_confirmed_at', { mode: 'timestamp_ms' }).notNull(),
		leaderboardOptIn: integer('leaderboard_opt_in', { mode: 'boolean' }).notNull().default(false),
		disabledAt: integer('disabled_at', { mode: 'timestamp_ms' }),
		lastSeenAt: integer('last_seen_at', { mode: 'timestamp_ms' }),
		createdAt: createdAt()
	},
	(t) => [uniqueIndex('users_username_uq').on(t.username), index('users_role_idx').on(t.role)]
);

export const sessions = sqliteTable(
	'sessions',
	{
		/** SHA-256 of the session token; the raw token only lives in the cookie. */
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
		createdAt: createdAt()
	},
	(t) => [index('sessions_user_idx').on(t.userId)]
);

export const RECOVERY_KINDS = ['self', 'staff_reset'] as const;

export const recoveryCodes = sqliteTable(
	'recovery_codes',
	{
		id: id(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		codeHash: text('code_hash').notNull(),
		kind: text('kind', { enum: RECOVERY_KINDS }).notNull(),
		createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
		expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),
		usedAt: integer('used_at', { mode: 'timestamp_ms' }),
		createdAt: createdAt()
	},
	(t) => [index('recovery_codes_user_idx').on(t.userId)]
);

export const PERMISSIONS = [
	'people',
	'messages',
	'games',
	'rewards',
	'site',
	'analytics',
	'staff'
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const staffPermissions = sqliteTable(
	'staff_permissions',
	{
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		permission: text('permission', { enum: PERMISSIONS }).notNull()
	},
	(t) => [primaryKey({ columns: [t.userId, t.permission] })]
);

/* ── Games ──────────────────────────────────────────────────────────── */

export const VISIBILITIES = ['public', 'members', 'hidden'] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const HUB_STATES = ['available', 'coming_soon', 'off'] as const;
export type HubState = (typeof HUB_STATES)[number];

/** A game type (plugin) plus saved config: "2048 (classic)", "Devotion lines ×50", … */
export const gamePresets = sqliteTable(
	'game_presets',
	{
		id: id(),
		slug: text('slug').notNull(),
		type: text('type').notNull(),
		title: text('title').notNull(),
		instructions: text('instructions').notNull().default(''),
		/** JSON validated by the plugin's configSchema. */
		config: text('config', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
		visibility: text('visibility', { enum: VISIBILITIES }).notNull().default('public'),
		hubState: text('hub_state', { enum: HUB_STATES }).notNull().default('available'),
		hubOrder: integer('hub_order').notNull().default(0),
		hubLabel: text('hub_label').notNull().default('Play'),
		artLeft: text('art_left'),
		artRight: text('art_right'),
		pointsOnComplete: integer('points_on_complete').notNull().default(0),
		leaderboardEnabled: integer('leaderboard_enabled', { mode: 'boolean' })
			.notNull()
			.default(false),
		createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
		createdAt: createdAt(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`)
	},
	(t) => [uniqueIndex('game_presets_slug_uq').on(t.slug)]
);

export const PLAY_STATUSES = ['started', 'finished'] as const;
export const VERIFICATIONS = ['server', 'plausible', 'rejected'] as const;
export type Verification = (typeof VERIFICATIONS)[number];

/** One round of a game. Guests are tracked by an anonymous cookie id and merged on signup. */
export const plays = sqliteTable(
	'plays',
	{
		id: id(),
		presetId: text('preset_id')
			.notNull()
			.references(() => gamePresets.id, { onDelete: 'cascade' }),
		userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
		guestId: text('guest_id'),
		status: text('status', { enum: PLAY_STATUSES }).notNull().default('started'),
		startedAt: integer('started_at', { mode: 'timestamp_ms' }).notNull(),
		finishedAt: integer('finished_at', { mode: 'timestamp_ms' }),
		durationMs: integer('duration_ms'),
		/** Raw result reported by the game, validated by the plugin's resultSchema. */
		result: text('result', { mode: 'json' }).$type<Record<string, unknown>>(),
		/** Headline number used for sorting and leaderboards (plugin-defined). */
		score: integer('score'),
		completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
		verification: text('verification', { enum: VERIFICATIONS })
	},
	(t) => [
		index('plays_user_idx').on(t.userId, t.startedAt),
		index('plays_guest_idx').on(t.guestId),
		index('plays_preset_idx').on(t.presetId, t.startedAt)
	]
);

/* ── Notifications ──────────────────────────────────────────────────── */

export const pushSubscriptions = sqliteTable(
	'push_subscriptions',
	{
		id: id(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		endpoint: text('endpoint').notNull(),
		p256dh: text('p256dh').notNull(),
		auth: text('auth').notNull(),
		failureCount: integer('failure_count').notNull().default(0),
		createdAt: createdAt()
	},
	(t) => [uniqueIndex('push_endpoint_uq').on(t.endpoint), index('push_user_idx').on(t.userId)]
);

/* ── Site ───────────────────────────────────────────────────────────── */

export const siteSettings = sqliteTable('site_settings', {
	key: text('key').primaryKey(),
	value: text('value', { mode: 'json' }).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(unixepoch() * 1000)`)
});

export const FOOTER_GROUPS = ['store', 'social'] as const;

export const footerLinks = sqliteTable('footer_links', {
	id: id(),
	label: text('label').notNull(),
	url: text('url').notNull(),
	icon: text('icon').notNull(),
	group: text('group', { enum: FOOTER_GROUPS }).notNull(),
	extraClass: text('extra_class').notNull().default(''),
	sortOrder: integer('sort_order').notNull().default(0)
});

/* ── Tracking ───────────────────────────────────────────────────────── */

/** Fan activity feed; drives the EMS "new stuff pops up" ordering. */
export const activity = sqliteTable(
	'activity',
	{
		id: id(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		kind: text('kind').notNull(),
		data: text('data', { mode: 'json' }).$type<Record<string, unknown>>().notNull().default({}),
		createdAt: createdAt()
	},
	(t) => [
		index('activity_user_idx').on(t.userId, t.createdAt),
		index('activity_created_idx').on(t.createdAt)
	]
);

/** Staff actions, for accountability. */
export const auditLog = sqliteTable(
	'audit_log',
	{
		id: id(),
		actorId: text('actor_id').references(() => users.id, { onDelete: 'set null' }),
		action: text('action').notNull(),
		entityType: text('entity_type').notNull(),
		entityId: text('entity_id'),
		data: text('data', { mode: 'json' }).$type<Record<string, unknown>>().notNull().default({}),
		createdAt: createdAt()
	},
	(t) => [index('audit_created_idx').on(t.createdAt)]
);

/** Fixed-window counters for rate limiting auth endpoints. */
export const rateLimits = sqliteTable('rate_limits', {
	key: text('key').primaryKey(),
	windowStart: integer('window_start').notNull(),
	count: integer('count').notNull()
});

export type User = typeof users.$inferSelect;
export type GamePreset = typeof gamePresets.$inferSelect;
export type Play = typeof plays.$inferSelect;
