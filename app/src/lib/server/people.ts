import {
	and,
	asc,
	count,
	desc,
	eq,
	inArray,
	isNotNull,
	isNull,
	like,
	or,
	sql,
	type SQL
} from 'drizzle-orm';
import type { Db } from './db';
import {
	activity,
	favorites,
	gamePresets,
	listMembers,
	lists,
	plays,
	recoveryCodes,
	staffNotes,
	users
} from './db/schema';
import { recoveryCode, normalizeRecoveryCode, sha256Hex } from './crypto';
import { invalidateUserSessions } from './auth';

export const PEOPLE_PAGE_SIZE = 50;

export type PeopleFilter = 'all' | 'unverified' | 'has_handle' | 'active_week' | 'disabled';

export const PEOPLE_FILTERS: { id: PeopleFilter; label: string }[] = [
	{ id: 'all', label: 'Everyone' },
	{ id: 'active_week', label: 'Active this week' },
	{ id: 'has_handle', label: 'Has OF / LF name' },
	{ id: 'unverified', label: 'Needs verifying' },
	{ id: 'disabled', label: 'Disabled' }
];

const needsVerification = or(
	and(isNotNull(users.onlyfansHandle), isNull(users.onlyfansVerifiedAt)),
	and(isNotNull(users.loyalfansHandle), isNull(users.loyalfansVerifiedAt))
);

/** Fans for the People view: favourites pinned first, then most recent activity. */
export async function listPeople(
	db: Db,
	staffId: string,
	opts: {
		listId?: string;
		favoritesOnly?: boolean;
		q?: string;
		filter?: PeopleFilter;
		page?: number;
	}
) {
	const where: (SQL | undefined)[] = [eq(users.role, 'player')];
	const filter = opts.filter ?? 'all';
	if (filter === 'disabled') where.push(isNotNull(users.disabledAt));
	else where.push(isNull(users.disabledAt));
	if (filter === 'unverified') where.push(needsVerification);
	if (filter === 'has_handle')
		where.push(or(isNotNull(users.onlyfansHandle), isNotNull(users.loyalfansHandle)));
	if (filter === 'active_week') {
		where.push(sql`${users.lastActivityAt} > ${Date.now() - 7 * 24 * 60 * 60 * 1000}`);
	}
	if (opts.q) {
		const term = `%${opts.q.toLowerCase().replace(/[%_]/g, '')}%`;
		where.push(
			or(
				like(users.username, term),
				like(sql`lower(${users.displayName})`, term),
				like(sql`lower(${users.onlyfansHandle})`, term),
				like(sql`lower(${users.loyalfansHandle})`, term)
			)
		);
	}
	if (opts.listId) {
		where.push(
			inArray(
				users.id,
				db
					.select({ id: listMembers.userId })
					.from(listMembers)
					.where(eq(listMembers.listId, opts.listId))
			)
		);
	}
	if (opts.favoritesOnly) where.push(isNotNull(favorites.userId));

	const page = Math.max(1, opts.page ?? 1);
	const isFavorite = sql<number>`${favorites.userId} IS NOT NULL`;
	const rows = await db
		.select({
			id: users.id,
			username: users.usernameDisplay,
			displayName: users.displayName,
			onlyfansHandle: users.onlyfansHandle,
			onlyfansVerified: sql<number>`${users.onlyfansVerifiedAt} IS NOT NULL`,
			loyalfansHandle: users.loyalfansHandle,
			loyalfansVerified: sql<number>`${users.loyalfansVerifiedAt} IS NOT NULL`,
			lastActivityAt: users.lastActivityAt,
			createdAt: users.createdAt,
			favorite: isFavorite
		})
		.from(users)
		.leftJoin(favorites, and(eq(favorites.userId, users.id), eq(favorites.staffId, staffId)))
		.where(and(...where))
		.orderBy(desc(isFavorite), desc(users.lastActivityAt), desc(users.createdAt))
		.limit(PEOPLE_PAGE_SIZE + 1)
		.offset((page - 1) * PEOPLE_PAGE_SIZE);

	const people = rows.slice(0, PEOPLE_PAGE_SIZE).map((r) => ({
		...r,
		favorite: Boolean(r.favorite),
		onlyfansVerified: Boolean(r.onlyfansVerified),
		loyalfansVerified: Boolean(r.loyalfansVerified)
	}));

	// List chips for the visible rows, in one query.
	const memberships = people.length
		? await db
				.select({ userId: listMembers.userId, listId: lists.id, name: lists.name })
				.from(listMembers)
				.innerJoin(lists, eq(listMembers.listId, lists.id))
				.where(
					inArray(
						listMembers.userId,
						people.map((p) => p.id)
					)
				)
		: [];

	return {
		people: people.map((p) => ({
			...p,
			lists: memberships
				.filter((m) => m.userId === p.id)
				.map((m) => ({ id: m.listId, name: m.name }))
		})),
		hasMore: rows.length > PEOPLE_PAGE_SIZE,
		page
	};
}

/* ── Lists ──────────────────────────────────────────────────────────── */

export async function getLists(db: Db) {
	return db
		.select({ id: lists.id, name: lists.name, members: count(listMembers.userId) })
		.from(lists)
		.leftJoin(listMembers, eq(listMembers.listId, lists.id))
		.groupBy(lists.id)
		.orderBy(asc(lists.sortOrder), asc(lists.name));
}

export async function createList(db: Db, name: string) {
	const max = await db
		.select({ n: sql<number>`coalesce(max(${lists.sortOrder}), 0)` })
		.from(lists)
		.get();
	return db
		.insert(lists)
		.values({ name, sortOrder: (max?.n ?? 0) + 1 })
		.returning({ id: lists.id })
		.get();
}

export async function renameList(db: Db, id: string, name: string) {
	await db.update(lists).set({ name }).where(eq(lists.id, id));
}

export async function deleteList(db: Db, id: string) {
	await db.delete(lists).where(eq(lists.id, id));
}

export async function addToList(db: Db, listId: string, userIds: string[]) {
	if (userIds.length === 0) return;
	await db
		.insert(listMembers)
		.values(userIds.map((userId) => ({ listId, userId })))
		.onConflictDoNothing();
}

export async function removeFromList(db: Db, listId: string, userIds: string[]) {
	if (userIds.length === 0) return;
	await db
		.delete(listMembers)
		.where(and(eq(listMembers.listId, listId), inArray(listMembers.userId, userIds)));
}

/** Moves people out of `fromListId` (when given) and into `toListId`. */
export async function moveToList(db: Db, userIds: string[], toListId: string, fromListId?: string) {
	await addToList(db, toListId, userIds);
	if (fromListId && fromListId !== toListId) await removeFromList(db, fromListId, userIds);
}

/* ── Favourites ─────────────────────────────────────────────────────── */

export async function setFavorite(db: Db, staffId: string, userIds: string[], favorite: boolean) {
	if (userIds.length === 0) return;
	if (favorite) {
		await db
			.insert(favorites)
			.values(userIds.map((userId) => ({ staffId, userId })))
			.onConflictDoNothing();
	} else {
		await db
			.delete(favorites)
			.where(and(eq(favorites.staffId, staffId), inArray(favorites.userId, userIds)));
	}
}

/** True when the id belongs to a fan account (not staff/owner). */
export async function isPlayer(db: Db, userId: string) {
	const row = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).get();
	return row?.role === 'player';
}

/* ── One person ─────────────────────────────────────────────────────── */

export async function getPerson(db: Db, staffId: string, userId: string) {
	const user = await db
		.select()
		.from(users)
		.where(and(eq(users.id, userId), eq(users.role, 'player')))
		.get();
	if (!user) return null;

	const [fav, memberOf, notes, recentActivity, playStats, recentPlays] = await Promise.all([
		db
			.select({ id: favorites.userId })
			.from(favorites)
			.where(and(eq(favorites.staffId, staffId), eq(favorites.userId, userId)))
			.get(),
		db
			.select({ id: lists.id, name: lists.name })
			.from(listMembers)
			.innerJoin(lists, eq(listMembers.listId, lists.id))
			.where(eq(listMembers.userId, userId)),
		db
			.select({
				id: staffNotes.id,
				body: staffNotes.body,
				createdAt: staffNotes.createdAt,
				authorName: users.displayName
			})
			.from(staffNotes)
			.leftJoin(users, eq(staffNotes.authorId, users.id))
			.where(eq(staffNotes.userId, userId))
			.orderBy(desc(staffNotes.createdAt)),
		db
			.select({
				id: activity.id,
				kind: activity.kind,
				data: activity.data,
				createdAt: activity.createdAt
			})
			.from(activity)
			.where(eq(activity.userId, userId))
			.orderBy(desc(activity.createdAt))
			.limit(30),
		db
			.select({
				played: count(plays.id),
				completed: sql<number>`sum(case when ${plays.completed} then 1 else 0 end)`
			})
			.from(plays)
			.where(and(eq(plays.userId, userId), eq(plays.status, 'finished')))
			.get(),
		db
			.select({
				id: plays.id,
				title: gamePresets.title,
				score: plays.score,
				completed: plays.completed,
				verification: plays.verification,
				durationMs: plays.durationMs,
				result: plays.result,
				type: gamePresets.type,
				finishedAt: plays.finishedAt
			})
			.from(plays)
			.innerJoin(gamePresets, eq(plays.presetId, gamePresets.id))
			.where(and(eq(plays.userId, userId), eq(plays.status, 'finished')))
			.orderBy(desc(plays.finishedAt))
			.limit(20)
	]);

	return {
		user: {
			id: user.id,
			username: user.usernameDisplay,
			displayName: user.displayName,
			onlyfansHandle: user.onlyfansHandle,
			onlyfansVerifiedAt: user.onlyfansVerifiedAt,
			loyalfansHandle: user.loyalfansHandle,
			loyalfansVerifiedAt: user.loyalfansVerifiedAt,
			leaderboardOptIn: user.leaderboardOptIn,
			disabledAt: user.disabledAt,
			lastSeenAt: user.lastSeenAt,
			lastActivityAt: user.lastActivityAt,
			createdAt: user.createdAt
		},
		favorite: !!fav,
		lists: memberOf,
		notes,
		activity: recentActivity,
		stats: { played: playStats?.played ?? 0, completed: playStats?.completed ?? 0 },
		plays: recentPlays
	};
}

export async function setHandleVerified(
	db: Db,
	userId: string,
	platform: 'onlyfans' | 'loyalfans',
	verified: boolean
) {
	const value = verified ? new Date() : null;
	await db
		.update(users)
		.set(platform === 'onlyfans' ? { onlyfansVerifiedAt: value } : { loyalfansVerifiedAt: value })
		.where(and(eq(users.id, userId), eq(users.role, 'player')));
}

export async function addNote(db: Db, userId: string, authorId: string, body: string) {
	await db.insert(staffNotes).values({ userId, authorId, body });
}

export async function deleteNote(db: Db, noteId: string, userId: string) {
	await db.delete(staffNotes).where(and(eq(staffNotes.id, noteId), eq(staffNotes.userId, userId)));
}

/**
 * A one-time reset code valid for 48 hours. Only issued for accounts of the expected role,
 * so a staff member can never mint a code for the owner (or another staff account).
 * Returns null when the account doesn't exist or has a different role.
 */
export async function issueResetCode(
	db: Db,
	userId: string,
	staffId: string,
	expectedRole: 'player' | 'staff' = 'player'
) {
	const target = await db
		.select({ role: users.role })
		.from(users)
		.where(eq(users.id, userId))
		.get();
	if (!target || target.role !== expectedRole) return null;
	const code = recoveryCode();
	await db.insert(recoveryCodes).values({
		userId,
		kind: 'staff_reset',
		codeHash: await sha256Hex(normalizeRecoveryCode(code)),
		createdBy: staffId,
		expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000)
	});
	return code;
}

export async function setDisabled(db: Db, userId: string, disabled: boolean) {
	const changed = await db
		.update(users)
		.set({ disabledAt: disabled ? new Date() : null })
		.where(and(eq(users.id, userId), eq(users.role, 'player')))
		.returning({ id: users.id });
	// Only sign out an account we actually disabled.
	if (disabled && changed.length > 0) await invalidateUserSessions(db, userId);
	return changed.length > 0;
}
