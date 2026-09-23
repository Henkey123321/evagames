import { and, count, desc, eq, gt, gte, isNotNull, isNull, or, sql } from 'drizzle-orm';
import type { Db } from './db';
import { activity, conversations, favorites, plays, users } from './db/schema';

const DAY = 24 * 60 * 60 * 1000;

/** What Eva should look at first: unread threads and handles waiting for verification. */
export async function needsYou(db: Db, staffId: string) {
	const isFavorite = sql<number>`${favorites.userId} IS NOT NULL`;
	const [unread, unverified] = await Promise.all([
		db
			.select({
				userId: users.id,
				displayName: users.displayName,
				preview: conversations.lastMessagePreview,
				unread: conversations.unreadForStaff,
				at: conversations.lastMessageAt,
				favorite: isFavorite
			})
			.from(conversations)
			.innerJoin(users, eq(conversations.userId, users.id))
			.leftJoin(favorites, and(eq(favorites.userId, users.id), eq(favorites.staffId, staffId)))
			.where(gt(conversations.unreadForStaff, 0))
			.orderBy(desc(isFavorite), desc(conversations.lastMessageAt))
			.limit(8),
		db
			.select({
				userId: users.id,
				displayName: users.displayName,
				onlyfansHandle: users.onlyfansHandle,
				onlyfansVerifiedAt: users.onlyfansVerifiedAt,
				loyalfansHandle: users.loyalfansHandle,
				loyalfansVerifiedAt: users.loyalfansVerifiedAt,
				at: users.lastActivityAt,
				favorite: isFavorite
			})
			.from(users)
			.leftJoin(favorites, and(eq(favorites.userId, users.id), eq(favorites.staffId, staffId)))
			.where(
				and(
					eq(users.role, 'player'),
					isNull(users.disabledAt),
					or(
						and(isNotNull(users.onlyfansHandle), isNull(users.onlyfansVerifiedAt)),
						and(isNotNull(users.loyalfansHandle), isNull(users.loyalfansVerifiedAt))
					)
				)
			)
			.orderBy(desc(isFavorite), desc(users.lastActivityAt))
			.limit(8)
	]);

	return {
		unread: unread.map((r) => ({ ...r, favorite: Boolean(r.favorite) })),
		unverified: unverified.map((r) => ({
			userId: r.userId,
			displayName: r.displayName,
			at: r.at,
			favorite: Boolean(r.favorite),
			handles: [
				r.onlyfansHandle && !r.onlyfansVerifiedAt
					? { platform: 'OnlyFans', handle: r.onlyfansHandle }
					: null,
				r.loyalfansHandle && !r.loyalfansVerifiedAt
					? { platform: 'LoyalFans', handle: r.loyalfansHandle }
					: null
			].filter((h) => h !== null)
		}))
	};
}

export async function overviewStats(db: Db) {
	const now = Date.now();
	const week = new Date(now - 7 * DAY);
	const [fans, newFans, activeFans, playsWeek, completionsWeek] = await Promise.all([
		db
			.select({ n: count() })
			.from(users)
			.where(and(eq(users.role, 'player'), isNull(users.disabledAt)))
			.get(),
		db
			.select({ n: count() })
			.from(users)
			.where(and(eq(users.role, 'player'), gte(users.createdAt, week)))
			.get(),
		db
			.select({ n: count() })
			.from(users)
			.where(and(eq(users.role, 'player'), gte(users.lastActivityAt, week)))
			.get(),
		db
			.select({ n: count() })
			.from(plays)
			.where(and(eq(plays.status, 'finished'), gte(plays.startedAt, week)))
			.get(),
		db
			.select({ n: count() })
			.from(plays)
			.where(and(eq(plays.completed, true), gte(plays.startedAt, week)))
			.get()
	]);
	return {
		fans: fans?.n ?? 0,
		newFans: newFans?.n ?? 0,
		activeFans: activeFans?.n ?? 0,
		plays: playsWeek?.n ?? 0,
		completions: completionsWeek?.n ?? 0
	};
}

/** Plays per day for the last 14 days (finished rounds, all players incl. guests). */
export async function playsByDay(db: Db) {
	const since = Date.now() - 13 * DAY;
	const start = new Date(since - (since % DAY));
	// D1 binds JS numbers as REAL, so cast to get whole-day buckets rather than one per row.
	const dayKey = sql<number>`CAST(${plays.startedAt} / ${sql.raw(String(DAY))} AS INTEGER)`;
	const rows = await db
		.select({
			day: dayKey,
			played: count(),
			completed: sql<number>`sum(case when ${plays.completed} then 1 else 0 end)`
		})
		.from(plays)
		.where(and(eq(plays.status, 'finished'), gte(plays.startedAt, start)))
		.groupBy(dayKey);
	const byDay = new Map(rows.map((r) => [Math.floor(r.day), r]));
	return Array.from({ length: 14 }, (_, i) => {
		const day = Math.floor(start.getTime() / DAY) + i;
		const r = byDay.get(day);
		return { date: new Date(day * DAY), played: r?.played ?? 0, completed: r?.completed ?? 0 };
	});
}

export async function activityFeed(db: Db, limit = 25) {
	return db
		.select({
			id: activity.id,
			kind: activity.kind,
			data: activity.data,
			createdAt: activity.createdAt,
			userId: users.id,
			displayName: users.displayName
		})
		.from(activity)
		.innerJoin(users, eq(activity.userId, users.id))
		.orderBy(desc(activity.createdAt))
		.limit(limit);
}
