import { pointsLeaderboard } from '$lib/server/leaderboards';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	return { rows: await pointsLeaderboard(locals.db) };
};
