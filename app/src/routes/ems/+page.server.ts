import { activityFeed, needsYou, overviewStats, playsByDay } from '$lib/server/dashboard';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent }) => {
	const { user, access } = await parent();
	const [queue, stats, days, feed] = await Promise.all([
		access.people || access.messages ? needsYou(locals.db, user.id) : null,
		access.analytics ? overviewStats(locals.db) : null,
		access.analytics ? playsByDay(locals.db) : null,
		access.people ? activityFeed(locals.db) : []
	]);
	return {
		queue: queue && {
			unread: access.messages ? queue.unread : [],
			unverified: access.people ? queue.unverified : []
		},
		stats,
		days,
		feed
	};
};
