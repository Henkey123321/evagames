import { error, fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { createAccount } from '$lib/server/accounts';
import { createSession, setSessionCookie } from '$lib/server/auth';
import { audit } from '$lib/server/activity';
import { timingSafeEqual } from '$lib/server/crypto';
import { users } from '$lib/server/db/schema';
import { clientIp, rateLimit } from '$lib/server/guards';
import { fieldErrors, signupForm } from '$lib/validation';
import type { Actions, PageServerLoad } from './$types';
import type { Db } from '$lib/server/db';

/**
 * One-time creation of Eva's owner account. Needs the SETUP_TOKEN secret and
 * disappears (404) as soon as an owner exists.
 */
async function ownerExists(db: Db) {
	return !!(await db.select({ id: users.id }).from(users).where(eq(users.role, 'owner')).get());
}

function tokenMatches(expected: string | undefined, given: string | null) {
	if (!expected || !given) return false;
	const enc = new TextEncoder();
	return timingSafeEqual(enc.encode(expected), enc.encode(given));
}

export const load: PageServerLoad = async ({ locals, url, platform }) => {
	if (await ownerExists(locals.db)) error(404, 'Not found');
	if (!tokenMatches(platform!.env.SETUP_TOKEN, url.searchParams.get('token')))
		error(404, 'Not found');
	return {};
};

export const actions: Actions = {
	default: async ({ request, locals, cookies, url, platform }) => {
		if (!(await rateLimit(locals.db, `setup:${clientIp(request)}`, 10, 60 * 60 * 1000)))
			error(429, 'Too many attempts');
		if (await ownerExists(locals.db)) error(404, 'Not found');
		if (!tokenMatches(platform!.env.SETUP_TOKEN, url.searchParams.get('token')))
			error(404, 'Not found');

		const form = await request.formData();
		const values = {
			username: String(form.get('username') ?? ''),
			displayName: String(form.get('displayName') ?? '')
		};
		const parsed = signupForm.safeParse({ ...Object.fromEntries(form), age: 'on' });
		if (!parsed.success) return fail(400, { values, errors: fieldErrors(parsed.error) });

		const created = await createAccount(locals.db, {
			...parsed.data,
			role: 'owner',
			displayName: values.displayName.trim() || 'Eva'
		});
		if (!created) return fail(400, { values, errors: { username: 'That username is taken' } });

		await audit(locals.db, created.user.id, 'owner_created', 'user', created.user.id);
		const session = await createSession(locals.db, created.user.id);
		setSessionCookie(cookies, session.token, session.expiresAt);
		return { created: true, codes: created.codes };
	}
};
