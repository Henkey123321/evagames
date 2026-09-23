import { fail, redirect } from '@sveltejs/kit';
import { findUserByUsername, setPassword } from '$lib/server/accounts';
import {
	consumeRecoveryCode,
	createSession,
	invalidateUserSessions,
	remainingRecoveryCodes,
	setSessionCookie
} from '$lib/server/auth';
import { clientIp, rateLimit } from '$lib/server/guards';
import { fieldErrors, recoverForm } from '$lib/validation';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	if (locals.user) redirect(303, '/account');
};

export const actions: Actions = {
	default: async ({ request, locals, cookies }) => {
		const form = await request.formData();
		const values = { username: String(form.get('username') ?? '') };
		const parsed = recoverForm.safeParse(Object.fromEntries(form));
		if (!parsed.success) return fail(400, { values, errors: fieldErrors(parsed.error) });

		if (!(await rateLimit(locals.db, `recover:${clientIp(request)}`, 10, 60 * 60 * 1000))) {
			return fail(429, { values, errors: { form: 'Too many attempts. Try again in an hour.' } });
		}

		const invalid = {
			values,
			errors: { form: 'That username and code do not match an unused code.' }
		};
		const user = await findUserByUsername(locals.db, parsed.data.username);
		if (!user || user.disabledAt) return fail(400, invalid);
		if (!(await consumeRecoveryCode(locals.db, user.id, parsed.data.code)))
			return fail(400, invalid);

		await setPassword(locals.db, user.id, parsed.data.password);
		await invalidateUserSessions(locals.db, user.id);
		const session = await createSession(locals.db, user.id);
		setSessionCookie(cookies, session.token, session.expiresAt);

		const remaining = await remainingRecoveryCodes(locals.db, user.id);
		redirect(303, `/account?recovered=${remaining}`);
	}
};
