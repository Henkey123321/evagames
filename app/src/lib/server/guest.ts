import { dev } from '$app/environment';
import type { Cookies } from '@sveltejs/kit';

export const GUEST_COOKIE = 'eva_guest';

export function getGuestId(cookies: Cookies): string | undefined {
	const id = cookies.get(GUEST_COOKIE);
	return id && /^[0-9a-f-]{36}$/.test(id) ? id : undefined;
}

/** Anonymous id for guest plays, merged into an account on signup/login. */
export function ensureGuestId(cookies: Cookies): string {
	const existing = getGuestId(cookies);
	if (existing) return existing;
	const id = crypto.randomUUID();
	cookies.set(GUEST_COOKIE, id, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev,
		maxAge: 60 * 60 * 24 * 180
	});
	return id;
}
