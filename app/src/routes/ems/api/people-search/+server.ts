import { error, json } from '@sveltejs/kit';
import { and, eq, isNull, like, or, sql } from 'drizzle-orm';
import { can } from '$lib/server/auth';
import { users } from '$lib/server/db/schema';
import { requireStaff } from '$lib/server/guards';
import type { RequestHandler } from './$types';

/** Fan lookup for pickers (e.g. choosing who to send a game to). */
export const GET: RequestHandler = async ({ locals, url }) => {
	const me = requireStaff(locals, url);
	if (!can(me, 'people') && !can(me, 'games')) error(403, 'Not allowed');
	const q = (url.searchParams.get('q') ?? '')
		.trim()
		.toLowerCase()
		.replace(/[%_]/g, '')
		.slice(0, 40);
	if (q.length < 1) return json([]);
	const term = `%${q}%`;
	const rows = await locals.db
		.select({ id: users.id, displayName: users.displayName, username: users.usernameDisplay })
		.from(users)
		.where(
			and(
				eq(users.role, 'player'),
				isNull(users.disabledAt),
				or(
					like(users.username, term),
					like(sql`lower(${users.displayName})`, term),
					like(sql`lower(${users.onlyfansHandle})`, term),
					like(sql`lower(${users.loyalfansHandle})`, term)
				)
			)
		)
		.limit(8);
	return json(rows);
};
