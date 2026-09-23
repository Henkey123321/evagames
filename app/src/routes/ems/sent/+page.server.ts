import { requireStaff } from '$lib/server/guards';
import { listAssignments } from '$lib/server/assignments';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	requireStaff(locals, url, 'games');
	return { sent: await listAssignments(locals.db) };
};
