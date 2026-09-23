import { activityFeed, needsYou, overviewStats, playsByDay } from '$lib/server/dashboard';
import { rewardQueue } from '$lib/server/rewards-admin';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent }) => {
	const { user, access } = await parent();
	const [queue, rewards, stats, days, feed] = await Promise.all([
		access.people || access.messages || access.rewards ? needsYou(locals.db, user.id) : null,
		access.rewards ? rewardQueue(locals.db) : [],
		access.analytics ? overviewStats(locals.db) : null,
		access.analytics ? playsByDay(locals.db) : null,
		access.people ? activityFeed(locals.db) : []
	]);
	return {
		queue: queue && {
			unread: access.messages ? queue.unread : [],
			unverified: access.people ? queue.unverified : [],
			rewards: rewards.slice(0, 8).map((r) => ({
				id: r.id,
				userId: r.userId,
				displayName: r.displayName,
				rewardName: r.rewardName,
				status: r.status,
				at: r.updatedAt
			}))
		},
		stats,
		days,
		feed
	};
};
