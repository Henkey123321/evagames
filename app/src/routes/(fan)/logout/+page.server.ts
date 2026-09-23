import { redirect } from '@sveltejs/kit';
import { SESSION_COOKIE, clearSessionCookie, invalidateSession } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

// Signing out is POST-only so links/prefetching can't log people out.
export const load: PageServerLoad = () => redirect(303, '/');

export const actions: Actions = {
	default: async ({ locals, cookies }) => {
		const token = cookies.get(SESSION_COOKIE);
		if (token) await invalidateSession(locals.db, token);
		clearSessionCookie(cookies);
		redirect(303, '/');
	}
};
