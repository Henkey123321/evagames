import { error, fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { setPassword } from '$lib/server/accounts';
import { logActivity } from '$lib/server/activity';
import {
	SESSION_COOKIE,
	clearSessionCookie,
	createSession,
	invalidateUserSessions,
	regenerateRecoveryCodes,
	remainingRecoveryCodes,
	setSessionCookie
} from '$lib/server/auth';
import { verifyPassword } from '$lib/server/crypto';
import { users } from '$lib/server/db/schema';
import { recentPlays } from '$lib/server/games';
import { rateLimit, requireUser } from '$lib/server/guards';
import { changePasswordForm, fieldErrors, profileForm } from '$lib/validation';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url, platform }) => {
	const sessionUser = requireUser(locals, url);
	const user = await locals.db.select().from(users).where(eq(users.id, sessionUser.id)).get();
	if (!user) error(404, 'Account not found');

	const [codesLeft, plays] = await Promise.all([
		remainingRecoveryCodes(locals.db, user.id),
		recentPlays(locals.db, user.id)
	]);

	return {
		profile: {
			username: user.usernameDisplay,
			displayName: user.displayName,
			onlyfansHandle: user.onlyfansHandle ?? '',
			onlyfansVerified: !!user.onlyfansVerifiedAt,
			loyalfansHandle: user.loyalfansHandle ?? '',
			loyalfansVerified: !!user.loyalfansVerifiedAt,
			leaderboardOptIn: user.leaderboardOptIn,
			memberSince: user.createdAt
		},
		codesLeft,
		plays,
		vapidPublicKey: platform!.env.VAPID_PUBLIC_KEY,
		recovered: url.searchParams.get('recovered')
	};
};

export const actions: Actions = {
	profile: async ({ request, locals, url }) => {
		const me = requireUser(locals, url);
		const form = await request.formData();
		const parsed = profileForm.safeParse(Object.fromEntries(form));
		if (!parsed.success)
			return fail(400, { action: 'profile' as const, errors: fieldErrors(parsed.error) });

		const current = await locals.db.select().from(users).where(eq(users.id, me.id)).get();
		if (!current) error(404, 'Account not found');
		const { displayName, onlyfansHandle, loyalfansHandle, leaderboardOptIn } = parsed.data;
		const of = onlyfansHandle || null;
		const lf = loyalfansHandle || null;

		await locals.db
			.update(users)
			.set({
				displayName,
				leaderboardOptIn,
				onlyfansHandle: of,
				loyalfansHandle: lf,
				// Changing a handle clears its verification.
				onlyfansVerifiedAt: of === current.onlyfansHandle ? current.onlyfansVerifiedAt : null,
				loyalfansVerifiedAt: lf === current.loyalfansHandle ? current.loyalfansVerifiedAt : null
			})
			.where(eq(users.id, me.id));

		const changedHandles: Record<string, string> = {};
		if (of && of !== current.onlyfansHandle) changedHandles.onlyfans = of;
		if (lf && lf !== current.loyalfansHandle) changedHandles.loyalfans = lf;
		if (Object.keys(changedHandles).length)
			await logActivity(locals.db, me.id, 'handle_added', changedHandles);

		return { action: 'profile' as const, saved: true };
	},

	password: async ({ request, locals, url, cookies }) => {
		const me = requireUser(locals, url);
		const parsed = changePasswordForm.safeParse(Object.fromEntries(await request.formData()));
		if (!parsed.success)
			return fail(400, { action: 'password' as const, errors: fieldErrors(parsed.error) });
		if (!(await rateLimit(locals.db, `password:${me.id}`, 10, 60 * 60 * 1000))) {
			return fail(429, {
				action: 'password' as const,
				errors: { form: 'Too many attempts. Try again later.' }
			});
		}

		const user = await locals.db.select().from(users).where(eq(users.id, me.id)).get();
		if (!user || !(await verifyPassword(parsed.data.current, user.passwordHash))) {
			return fail(400, {
				action: 'password' as const,
				errors: { current: 'That is not your current password' }
			});
		}

		await setPassword(locals.db, me.id, parsed.data.password);
		// Sign out other devices, keep this one.
		await invalidateUserSessions(locals.db, me.id);
		const session = await createSession(locals.db, me.id);
		setSessionCookie(cookies, session.token, session.expiresAt);
		return { action: 'password' as const, saved: true };
	},

	codes: async ({ locals, url }) => {
		const me = requireUser(locals, url);
		const codes = await regenerateRecoveryCodes(locals.db, me.id);
		return { action: 'codes' as const, codes };
	},

	delete: async ({ request, locals, url, cookies }) => {
		const me = requireUser(locals, url);
		if (me.role === 'owner') {
			return fail(400, {
				action: 'delete' as const,
				errors: { form: 'The owner account cannot be deleted here.' }
			});
		}
		const form = await request.formData();
		const user = await locals.db.select().from(users).where(eq(users.id, me.id)).get();
		if (!user || !(await verifyPassword(String(form.get('password') ?? ''), user.passwordHash))) {
			return fail(400, {
				action: 'delete' as const,
				errors: { password: 'That is not your password' }
			});
		}
		// Cascades to sessions, plays, activity, push subscriptions and recovery codes.
		await locals.db.delete(users).where(eq(users.id, me.id));
		if (cookies.get(SESSION_COOKIE)) clearSessionCookie(cookies);
		redirect(303, '/');
	}
};
