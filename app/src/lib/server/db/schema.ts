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
		/** Last fan activity (play, message, profile change); drives EMS "newest first" ordering. */
		lastActivityAt: integer('last_activity_at', { mode: 'timestamp_ms' }),
		/** Cached sum of points_ledger for this user. */
		points: integer('points').notNull().default(0),
		createdAt: createdAt()
	},
	(t) => [
		uniqueIndex('users_username_uq').on(t.username),
		index('users_role_idx').on(t.role),
		index('users_activity_idx').on(t.lastActivityAt)
	]
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

/* ── Points, badges, rewards ─────────────────────────────────────────── */

/** Every points change, so totals are auditable. `(user, reason, ref)` is unique for one-off awards. */
export const pointsLedger = sqliteTable(
	'points_ledger',
	{
		id: id(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		delta: integer('delta').notNull(),
		/** 'first_completion' | 'assignment' | 'manual' */
		reason: text('reason').notNull(),
		/** What it was for (preset id, assignment id); null for manual grants. */
		ref: text('ref'),
		note: text('note'),
		createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
		createdAt: createdAt()
	},
	(t) => [
		index('points_user_idx').on(t.userId, t.createdAt),
		uniqueIndex('points_once_uq').on(t.userId, t.reason, t.ref)
	]
);

export const BADGE_RULES = ['manual', 'completions', 'points', 'completed_preset'] as const;
export type BadgeRule = (typeof BADGE_RULES)[number];

export const badges = sqliteTable('badges', {
	id: id(),
	name: text('name').notNull(),
	description: text('description').notNull().default(''),
	/** Short mark shown on the badge (an emoji or 1–3 letters). */
	mark: text('mark').notNull().default('★'),
	rule: text('rule', { enum: BADGE_RULES }).notNull().default('manual'),
	/** Count / points threshold for 'completions' and 'points'. */
	threshold: integer('threshold'),
	presetId: text('preset_id').references(() => gamePresets.id, { onDelete: 'set null' }),
	createdAt: createdAt(),
	archivedAt: integer('archived_at', { mode: 'timestamp_ms' })
});

export const userBadges = sqliteTable(
	'user_badges',
	{
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		badgeId: text('badge_id')
			.notNull()
			.references(() => badges.id, { onDelete: 'cascade' }),
		awardedBy: text('awarded_by').references(() => users.id, { onDelete: 'set null' }),
		awardedAt: createdAt()
	},
	(t) => [primaryKey({ columns: [t.userId, t.badgeId] })]
);

export const REWARD_KINDS = ['link', 'task', 'game', 'manual', 'media'] as const;
export type RewardKind = (typeof REWARD_KINDS)[number];

export const PROOF_KINDS = ['none', 'text', 'image', 'text_image'] as const;
export type ProofKind = (typeof PROOF_KINDS)[number];

/** Kind-specific reward content. */
export interface RewardContent {
	/** link: a URL and/or a code revealed on unlock. */
	url?: string;
	code?: string;
	/** task: instructions and what proof Eva wants back. */
	instructions?: string;
	proof?: ProofKind;
	/** game: the (usually hidden) preset this unlocks. */
	presetId?: string;
	/** manual: note to staff about what to send. */
	staffNote?: string;
	/** media: asset ids (media library, Phase 3 part 4). */
	assetIds?: string[];
}

export const rewards = sqliteTable('rewards', {
	id: id(),
	name: text('name').notNull(),
	kind: text('kind', { enum: REWARD_KINDS }).notNull(),
	/** Fan-facing text shown with the reward. */
	message: text('message').notNull().default(''),
	content: text('content', { mode: 'json' }).$type<RewardContent>().notNull().default({}),
	/** Eva approves each unlock before the fan sees it. */
	requiresApproval: integer('requires_approval', { mode: 'boolean' }).notNull().default(false),
	createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
	createdAt: createdAt(),
	archivedAt: integer('archived_at', { mode: 'timestamp_ms' })
});

export const TRIGGER_TYPES = ['preset_completed', 'points_reached', 'badge_earned'] as const;
export type TriggerType = (typeof TRIGGER_TYPES)[number];

/** When a reward unlocks automatically. Each trigger fires at most once per fan. */
export const rewardTriggers = sqliteTable(
	'reward_triggers',
	{
		id: id(),
		rewardId: text('reward_id')
			.notNull()
			.references(() => rewards.id, { onDelete: 'cascade' }),
		type: text('type', { enum: TRIGGER_TYPES }).notNull(),
		presetId: text('preset_id').references(() => gamePresets.id, { onDelete: 'cascade' }),
		threshold: integer('threshold'),
		badgeId: text('badge_id').references(() => badges.id, { onDelete: 'cascade' }),
		createdAt: createdAt()
	},
	(t) => [index('reward_triggers_type_idx').on(t.type)]
);

export const USER_REWARD_STATUSES = [
	'pending_approval',
	'unlocked',
	'awaiting_fulfilment',
	'submitted',
	'done',
	'declined'
] as const;
export type UserRewardStatus = (typeof USER_REWARD_STATUSES)[number];

export const userRewards = sqliteTable(
	'user_rewards',
	{
		id: id(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		rewardId: text('reward_id')
			.notNull()
			.references(() => rewards.id, { onDelete: 'cascade' }),
		status: text('status', { enum: USER_REWARD_STATUSES }).notNull(),
		/** 'trigger:<id>', 'assignment:<id>' or 'manual:<uuid>': unique per user so triggers fire once. */
		source: text('source').notNull(),
		grantedBy: text('granted_by').references(() => users.id, { onDelete: 'set null' }),
		/** Fan's task proof. */
		proofText: text('proof_text'),
		proofAssetId: text('proof_asset_id'),
		/** Staff note back to the fan (on decline/approval). */
		staffReply: text('staff_reply'),
		resolvedBy: text('resolved_by').references(() => users.id, { onDelete: 'set null' }),
		resolvedAt: integer('resolved_at', { mode: 'timestamp_ms' }),
		createdAt: createdAt(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`)
	},
	(t) => [
		uniqueIndex('user_rewards_source_uq').on(t.userId, t.rewardId, t.source),
		index('user_rewards_status_idx').on(t.status, t.updatedAt),
		index('user_rewards_user_idx').on(t.userId, t.createdAt)
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

/* ── EMS: organising people ─────────────────────────────────────────── */

/** Eva's own folders ("VIPs", "New", …). A fan can be in several. */
export const lists = sqliteTable('lists', {
	id: id(),
	name: text('name').notNull(),
	sortOrder: integer('sort_order').notNull().default(0),
	createdAt: createdAt()
});

export const listMembers = sqliteTable(
	'list_members',
	{
		listId: text('list_id')
			.notNull()
			.references(() => lists.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		addedAt: createdAt()
	},
	(t) => [
		primaryKey({ columns: [t.listId, t.userId] }),
		index('list_members_user_idx').on(t.userId)
	]
);

/** Per staff member: favourites are pinned above everyone else. */
export const favorites = sqliteTable(
	'favorites',
	{
		staffId: text('staff_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		createdAt: createdAt()
	},
	(t) => [primaryKey({ columns: [t.staffId, t.userId] })]
);

/** Private notes about a fan, visible to staff only. */
export const staffNotes = sqliteTable(
	'staff_notes',
	{
		id: id(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		authorId: text('author_id').references(() => users.id, { onDelete: 'set null' }),
		body: text('body').notNull(),
		createdAt: createdAt()
	},
	(t) => [index('staff_notes_user_idx').on(t.userId, t.createdAt)]
);

/* ── Messages ───────────────────────────────────────────────────────── */

/** One conversation per fan, between that fan and "Eva" (any staff with messages permission). */
export const conversations = sqliteTable(
	'conversations',
	{
		id: id(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		lastMessageAt: integer('last_message_at', { mode: 'timestamp_ms' }).notNull(),
		lastMessagePreview: text('last_message_preview').notNull().default(''),
		lastFromStaff: integer('last_from_staff', { mode: 'boolean' }).notNull().default(false),
		unreadForStaff: integer('unread_for_staff').notNull().default(0),
		unreadForFan: integer('unread_for_fan').notNull().default(0),
		createdAt: createdAt()
	},
	(t) => [
		uniqueIndex('conversations_user_uq').on(t.userId),
		index('conversations_last_idx').on(t.lastMessageAt)
	]
);

export const messages = sqliteTable(
	'messages',
	{
		id: id(),
		conversationId: text('conversation_id')
			.notNull()
			.references(() => conversations.id, { onDelete: 'cascade' }),
		/** Null when the sending staff account was deleted. */
		senderId: text('sender_id').references(() => users.id, { onDelete: 'set null' }),
		fromStaff: integer('from_staff', { mode: 'boolean' }).notNull(),
		body: text('body').notNull(),
		/** Set when the message was part of a broadcast. */
		broadcastId: text('broadcast_id'),
		createdAt: createdAt()
	},
	(t) => [index('messages_conversation_idx').on(t.conversationId, t.createdAt)]
);

export const broadcasts = sqliteTable('broadcasts', {
	id: id(),
	authorId: text('author_id').references(() => users.id, { onDelete: 'set null' }),
	body: text('body').notNull(),
	/** 'all' or a list id. */
	target: text('target').notNull(),
	targetLabel: text('target_label').notNull(),
	recipientCount: integer('recipient_count').notNull(),
	createdAt: createdAt()
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
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Reward = typeof rewards.$inferSelect;
export type Badge = typeof badges.$inferSelect;
export type UserReward = typeof userRewards.$inferSelect;
