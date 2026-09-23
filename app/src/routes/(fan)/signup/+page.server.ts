import { fail, redirect } from '@sveltejs/kit';
import { claimGuestPlays, createAccount, findUserByUsername } from '$lib/server/accounts';
import { createSession, setSessionCookie } from '$lib/server/auth';
import { safeNext, setAgeCookie } from '$lib/server/age-gate';
import { clientIp, rateLimit, verifyTurnstile } from '$lib/server/guards';
import { getGuestId } from '$lib/server/guest';
import { fieldErrors, signupForm } from '$lib/validation';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, platform }) => {
	if (locals.user) redirect(303, '/account');
	return { turnstileSiteKey: platform!.env.TURNSTILE_SITE_KEY };
};

export const actions: Actions = {
	default: async ({ request, locals, cookies, url, platform }) => {
		const form = await request.formData();
		const values = { username: String(form.get('username') ?? '') };
		const parsed = signupForm.safeParse(Object.fromEntries(form));
		if (!parsed.success) return fail(400, { values, errors: fieldErrors(parsed.error) });

		const ip = clientIp(request);
		if (!(await rateLimit(locals.db, `signup:${ip}`, 5, 60 * 60 * 1000))) {
			return fail(429, {
				values,
				errors: { form: 'Too many new accounts from here. Try again in an hour.' }
			});
		}
		if (
			!(await verifyTurnstile(
				platform!.env.TURNSTILE_SECRET,
				form.get('cf-turnstile-response'),
				ip
			))
		) {
			return fail(400, { values, errors: { form: 'Please complete the check below.' } });
		}
		if (await findUserByUsername(locals.db, parsed.data.username)) {
			return fail(400, { values, errors: { username: 'That username is taken' } });
		}

		const created = await createAccount(locals.db, parsed.data);
		if (!created) return fail(400, { values, errors: { username: 'That username is taken' } });

		const session = await createSession(locals.db, created.user.id);
		setSessionCookie(cookies, session.token, session.expiresAt);
		setAgeCookie(cookies);
		await claimGuestPlays(locals.db, getGuestId(cookies), created.user.id);

		// Stay on this page once to show the recovery codes, then continue.
		return {
			created: true,
			codes: created.codes,
			next: safeNext(url.searchParams.get('next'), '/account')
		};
	}
};
