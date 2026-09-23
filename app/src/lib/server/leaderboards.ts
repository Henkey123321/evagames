import { and, desc, eq, max, min, ne, sql } from 'drizzle-orm';
import type { Db } from './db';
import { plays, users } from './db/schema';

const TOP = 10;

/** Best score per opted-in fan for one preset. `order` follows the game's scoreOrder. */
export async function presetLeaderboard(
	db: Db,
	presetId: string,
	order: 'asc' | 'desc',
	completedOnly: boolean
) {
	const best = order === 'desc' ? max(plays.score) : min(plays.score);
	const rows = await db
		.select({ userId: users.id, name: users.displayName, score: best })
		.from(plays)
		.innerJoin(users, eq(plays.userId, users.id))
		.where(
			and(
				eq(plays.presetId, presetId),
				eq(plays.status, 'finished'),
				ne(plays.verification, 'rejected'),
				completedOnly ? eq(plays.completed, true) : undefined,
				eq(users.leaderboardOptIn, true),
				sql`${users.disabledAt} IS NULL`
			)
		)
		.groupBy(users.id)
		.orderBy(order === 'desc' ? desc(best) : best)
		.limit(TOP);
	return rows.filter((r) => r.score !== null);
}

/** Opted-in fans by total points. */
export async function pointsLeaderboard(db: Db, limit = 25) {
	return db
		.select({ userId: users.id, name: users.displayName, points: users.points })
		.from(users)
		.where(
			and(
				eq(users.role, 'player'),
				eq(users.leaderboardOptIn, true),
				sql`${users.disabledAt} IS NULL`,
				sql`${users.points} > 0`
			)
		)
		.orderBy(desc(users.points))
		.limit(limit);
}
