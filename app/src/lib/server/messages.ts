import { and, asc, desc, eq, gt, inArray, isNotNull, sql } from 'drizzle-orm';
import type { Db } from './db';
import {
	broadcasts,
	conversations,
	favorites,
	listMembers,
	messages,
	staffPermissions,
	users
} from './db/schema';
import { logActivity } from './activity';
import { notifyUser } from './push';

export const MESSAGE_MAX = 4000;
const PREVIEW_LENGTH = 140;

const preview = (body: string) => body.replace(/\s+/g, ' ').trim().slice(0, PREVIEW_LENGTH);

async function getOrCreateConversation(db: Db, userId: string) {
	const existing = await db
		.select()
		.from(conversations)
		.where(eq(conversations.userId, userId))
		.get();
	if (existing) return existing;
	return (
		(await db
			.insert(conversations)
			.values({ userId, lastMessageAt: new Date() })
			.onConflictDoNothing()
			.returning()
			.get()) ??
		(await db.select().from(conversations).where(eq(conversations.userId, userId)).get())!
	);
}

/** Staff → fan. Notifies the fan's devices in the background. */
export async function sendStaffMessage(
	db: Db,
	env: Env,
	waitUntil: (p: Promise<unknown>) => void,
	input: { staffId: string; userId: string; body: string; broadcastId?: string }
) {
	const convo = await getOrCreateConversation(db, input.userId);
	const now = new Date();
	await db.batch([
		db.insert(messages).values({
			conversationId: convo.id,
			senderId: input.staffId,
			fromStaff: true,
			body: input.body,
			broadcastId: input.broadcastId ?? null,
			createdAt: now
		}),
		db
			.update(conversations)
			.set({
				lastMessageAt: now,
				lastMessagePreview: preview(input.body),
				lastFromStaff: true,
				unreadForFan: sql`${conversations.unreadForFan} + 1`,
				// Replying counts as reading the fan's messages.
				unreadForStaff: 0
			})
			.where(eq(conversations.id, convo.id))
	]);
	waitUntil(
		notifyUser(db, env, input.userId, {
			title: 'Eva',
			body: preview(input.body),
			url: '/inbox',
			tag: 'inbox'
		}).catch(() => undefined)
	);
}

/** Fan → Eva. Notifies staff who can read messages. */
export async function sendFanMessage(
	db: Db,
	env: Env,
	waitUntil: (p: Promise<unknown>) => void,
	input: { userId: string; displayName: string; body: string }
) {
	const convo = await getOrCreateConversation(db, input.userId);
	const now = new Date();
	await db.batch([
		db.insert(messages).values({
			conversationId: convo.id,
			senderId: input.userId,
			fromStaff: false,
			body: input.body,
			createdAt: now
		}),
		db
			.update(conversations)
			.set({
				lastMessageAt: now,
				lastMessagePreview: preview(input.body),
				lastFromStaff: false,
				unreadForStaff: sql`${conversations.unreadForStaff} + 1`,
				unreadForFan: 0
			})
			.where(eq(conversations.id, convo.id))
	]);
	await logActivity(db, input.userId, 'messaged');

	waitUntil(
		(async () => {
			for (const staffId of await messageStaffIds(db)) {
				await notifyUser(db, env, staffId, {
					title: input.displayName,
					body: preview(input.body),
					url: `/ems/inbox/${input.userId}`,
					tag: `inbox-${input.userId}`
				}).catch(() => undefined);
			}
		})()
	);
}

/** Owner plus staff with the `messages` permission. */
async function messageStaffIds(db: Db) {
	const owners = await db.select({ id: users.id }).from(users).where(eq(users.role, 'owner'));
	const staff = await db
		.select({ id: staffPermissions.userId })
		.from(staffPermissions)
		.where(eq(staffPermissions.permission, 'messages'));
	return [...new Set([...owners, ...staff].map((r) => r.id))];
}

/** Inbox list for staff: favourites first, then unread, then most recent. */
export async function listConversations(
	db: Db,
	staffId: string,
	opts: { unreadOnly?: boolean } = {}
) {
	const rows = await db
		.select({
			userId: conversations.userId,
			displayName: users.displayName,
			username: users.usernameDisplay,
			lastMessageAt: conversations.lastMessageAt,
			preview: conversations.lastMessagePreview,
			lastFromStaff: conversations.lastFromStaff,
			unread: conversations.unreadForStaff,
			favorite: sql<number>`${favorites.userId} IS NOT NULL`
		})
		.from(conversations)
		.innerJoin(users, eq(conversations.userId, users.id))
		.leftJoin(
			favorites,
			and(eq(favorites.userId, conversations.userId), eq(favorites.staffId, staffId))
		)
		.where(opts.unreadOnly ? gt(conversations.unreadForStaff, 0) : undefined)
		.orderBy(desc(sql`${favorites.userId} IS NOT NULL`), desc(conversations.lastMessageAt))
		.limit(200);
	return rows.map((r) => ({ ...r, favorite: Boolean(r.favorite) }));
}

export async function getThread(db: Db, userId: string) {
	const convo = await db.select().from(conversations).where(eq(conversations.userId, userId)).get();
	if (!convo) return { conversation: null, messages: [] };
	const rows = await db
		.select({
			id: messages.id,
			body: messages.body,
			fromStaff: messages.fromStaff,
			createdAt: messages.createdAt,
			broadcast: isNotNull(messages.broadcastId),
			senderName: users.displayName
		})
		.from(messages)
		.leftJoin(users, eq(messages.senderId, users.id))
		.where(eq(messages.conversationId, convo.id))
		.orderBy(asc(messages.createdAt))
		.limit(500);
	return {
		conversation: convo,
		messages: rows.map((m) => ({ ...m, broadcast: Boolean(m.broadcast) }))
	};
}

export async function markReadByStaff(db: Db, userId: string) {
	await db.update(conversations).set({ unreadForStaff: 0 }).where(eq(conversations.userId, userId));
}

export async function markReadByFan(db: Db, userId: string) {
	await db.update(conversations).set({ unreadForFan: 0 }).where(eq(conversations.userId, userId));
}

export async function unreadForFan(db: Db, userId: string) {
	const row = await db
		.select({ n: conversations.unreadForFan })
		.from(conversations)
		.where(eq(conversations.userId, userId))
		.get();
	return row?.n ?? 0;
}

export async function unreadConversationsForStaff(db: Db) {
	const row = await db
		.select({ n: sql<number>`count(*)` })
		.from(conversations)
		.where(gt(conversations.unreadForStaff, 0))
		.get();
	return row?.n ?? 0;
}

export type BroadcastTarget =
	'all' | { listId: string; listName: string } | { assignmentId: string; label: string };

/** SQL selecting the targeted fans' ids as `uid`, plus its parameters. */
function resolveAudience(target: BroadcastTarget) {
	const active = `u.role = 'player' AND u.disabled_at IS NULL`;
	if (target === 'all') {
		return {
			audience: `SELECT u.id AS uid FROM users u WHERE ${active}`,
			audienceParams: [] as string[],
			targetId: 'all',
			targetLabel: 'Everyone'
		};
	}
	if ('listId' in target) {
		return {
			audience: `SELECT lm.user_id AS uid FROM list_members lm JOIN users u ON u.id = lm.user_id
			           WHERE lm.list_id = ? AND ${active}`,
			audienceParams: [target.listId],
			targetId: target.listId,
			targetLabel: target.listName
		};
	}
	return {
		audience: `SELECT ar.user_id AS uid FROM assignment_recipients ar JOIN users u ON u.id = ar.user_id
		           WHERE ar.assignment_id = ? AND ${active}`,
		audienceParams: [target.assignmentId],
		targetId: `assignment:${target.assignmentId}`,
		targetLabel: target.label
	};
}

/**
 * Sends the same message into every targeted fan's thread using a fixed number of
 * set-based statements, so it stays within D1's per-request query limit at any audience size.
 * Broadcasts don't push-notify yet: fanning out web pushes needs a Queue (planned).
 */
export async function broadcast(
	db: Db,
	input: { staffId: string; body: string; target: BroadcastTarget }
) {
	// Raw D1 statements: Drizzle's D1 batch can't carry raw SQL with bound parameters.
	const d1 = db.$client;
	const { audience, audienceParams, targetId, targetLabel } = resolveAudience(input.target);

	const countRow = await d1
		.prepare(`SELECT count(*) AS n FROM (${audience})`)
		.bind(...audienceParams)
		.first<{ n: number }>();
	const recipientCount = countRow?.n ?? 0;
	if (recipientCount === 0) return 0;

	const now = Date.now();
	const broadcastId = crypto.randomUUID();
	const newId = 'lower(hex(randomblob(16)))';

	await d1.batch([
		d1
			.prepare(
				`INSERT INTO broadcasts (id, author_id, body, target, target_label, recipient_count, created_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(broadcastId, input.staffId, input.body, targetId, targetLabel, recipientCount, now),
		d1
			.prepare(
				`INSERT OR IGNORE INTO conversations (id, user_id, last_message_at)
				 SELECT ${newId}, a.uid, ? FROM (${audience}) a`
			)
			.bind(now, ...audienceParams),
		d1
			.prepare(
				`INSERT INTO messages (id, conversation_id, sender_id, from_staff, body, broadcast_id, created_at)
				 SELECT ${newId}, c.id, ?, 1, ?, ?, ?
				 FROM conversations c WHERE c.user_id IN (${audience})`
			)
			.bind(input.staffId, input.body, broadcastId, now, ...audienceParams),
		d1
			.prepare(
				`UPDATE conversations
				 SET last_message_at = ?, last_message_preview = ?, last_from_staff = 1,
				     unread_for_fan = unread_for_fan + 1
				 WHERE user_id IN (${audience})`
			)
			.bind(now, preview(input.body), ...audienceParams)
	]);
	return recipientCount;
}

export async function recentBroadcasts(db: Db, limit = 10) {
	return db
		.select({
			id: broadcasts.id,
			body: broadcasts.body,
			targetLabel: broadcasts.targetLabel,
			recipientCount: broadcasts.recipientCount,
			createdAt: broadcasts.createdAt,
			authorName: users.displayName
		})
		.from(broadcasts)
		.leftJoin(users, eq(broadcasts.authorId, users.id))
		.orderBy(desc(broadcasts.createdAt))
		.limit(limit);
}

/** Unread counts per fan, for People rows. */
export async function unreadByUser(db: Db, userIds: string[]) {
	if (userIds.length === 0) return new Map<string, number>();
	const rows = await db
		.select({ userId: conversations.userId, n: conversations.unreadForStaff })
		.from(conversations)
		.where(and(inArray(conversations.userId, userIds), gt(conversations.unreadForStaff, 0)));
	return new Map(rows.map((r) => [r.userId, r.n]));
}
