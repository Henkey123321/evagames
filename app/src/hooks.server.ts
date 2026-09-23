import { redirect, type Handle } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import {
	SESSION_COOKIE,
	clearSessionCookie,
	setSessionCookie,
	validateSession
} from '$lib/server/auth';
import { touchLastSeen } from '$lib/server/accounts';
import { AGE_COOKIE, isGateExempt } from '$lib/server/age-gate';

const LAST_SEEN_THROTTLE_MS = 5 * 60 * 1000;

export const handle: Handle = async ({ event, resolve }) => {
	const env = event.platform?.env;
	if (!env?.DB) throw new Error('D1 binding "DB" is missing: check wrangler.jsonc');
	event.locals.db = getDb(env.DB);
	event.locals.user = null;

	const token = event.cookies.get(SESSION_COOKIE);
	if (token) {
		const session = await validateSession(event.locals.db, token);
		if (session) {
			event.locals.user = session.user;
			if (session.renewedUntil) setSessionCookie(event.cookies, token, session.renewedUntil);
			if (
				!session.lastSeenAt ||
				Date.now() - session.lastSeenAt.getTime() > LAST_SEEN_THROTTLE_MS
			) {
				event.platform?.ctx.waitUntil(touchLastSeen(event.locals.db, session.user.id));
			}
		} else {
			clearSessionCookie(event.cookies);
		}
	}

	event.locals.ageConfirmed = event.cookies.get(AGE_COOKIE) === '1' || event.locals.user !== null;

	const { pathname, search } = event.url;
	if (!event.locals.ageConfirmed && event.request.method === 'GET' && !isGateExempt(pathname)) {
		redirect(303, `/gate?next=${encodeURIComponent(pathname + search)}`);
	}

	const response = await resolve(event);
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	return response;
};
