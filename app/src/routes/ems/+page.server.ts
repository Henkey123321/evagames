import { and, count, eq, gte } from 'drizzle-orm';
import { plays, users } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

/** Minimal overview until the full EMS lands in Phase 2. */
export const load: PageServerLoad = async ({ locals }) => {
	const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
	const [fans, newFans, playsWeek, completionsWeek] = await Promise.all([
		locals.db.select({ n: count() }).from(users).where(eq(users.role, 'player')).get(),
		locals.db
			.select({ n: count() })
			.from(users)
			.where(and(eq(users.role, 'player'), gte(users.createdAt, weekAgo)))
			.get(),
		locals.db.select({ n: count() }).from(plays).where(gte(plays.startedAt, weekAgo)).get(),
		locals.db
			.select({ n: count() })
			.from(plays)
			.where(and(eq(plays.completed, true), gte(plays.startedAt, weekAgo)))
			.get()
	]);
	return {
		stats: [
			{ label: 'Fans', value: fans?.n ?? 0 },
			{ label: 'New fans · 7 days', value: newFans?.n ?? 0 },
			{ label: 'Games played · 7 days', value: playsWeek?.n ?? 0 },
			{ label: 'Completions · 7 days', value: completionsWeek?.n ?? 0 }
		]
	};
};
