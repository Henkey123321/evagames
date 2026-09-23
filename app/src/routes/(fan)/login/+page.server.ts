import { fail, redirect } from '@sveltejs/kit';
import { checkCredentials, claimGuestPlays } from '$lib/server/accounts';
import { createSession, setSessionCookie } from '$lib/server/auth';
import { safeNext } from '$lib/server/age-gate';
import { clearRateLimit, clientIp, rateLimit, verifyTurnstile } from '$lib/server/guards';
import { getGuestId } from '$lib/server/guest';
import { fieldErrors, loginForm } from '$lib/validation';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url, platform }) => {
	if (locals.user) redirect(303, safeNext(url.searchParams.get('next'), '/account'));
	return { turnstileSiteKey: platform!.env.TURNSTILE_SITE_KEY };
};

export const actions: Actions = {
	default: async ({ request, locals, cookies, url, platform }) => {
		const form = await request.formData();
		const values = { username: String(form.get('username') ?? '') };
		const parsed = loginForm.safeParse(Object.fromEntries(form));
		if (!parsed.success) return fail(400, { values, errors: fieldErrors(parsed.error) });

		const ip = clientIp(request);
		const key = `login:${ip}:${parsed.data.username.toLowerCase()}`;
		const ipAllowed = await rateLimit(locals.db, `login-ip:${ip}`, 40, 15 * 60 * 1000);
		if (!ipAllowed || !(await rateLimit(locals.db, key, 8, 15 * 60 * 1000))) {
			return fail(429, {
				values,
				errors: { form: 'Too many attempts. Wait 15 minutes and try again.' }
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

		const user = await checkCredentials(locals.db, parsed.data.username, parsed.data.password);
		if (!user)
			return fail(400, { values, errors: { form: 'That username and password do not match.' } });

		await clearRateLimit(locals.db, key);
		const session = await createSession(locals.db, user.id);
		setSessionCookie(cookies, session.token, session.expiresAt);
		await claimGuestPlays(locals.db, getGuestId(cookies), user.id);

		const fallback = user.role === 'player' ? '/' : '/ems';
		redirect(303, safeNext(url.searchParams.get('next'), fallback));
	}
};
