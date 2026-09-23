import { dev } from '$app/environment';
import type { Cookies } from '@sveltejs/kit';

export const AGE_COOKIE = 'eva_age_ok';

/** Paths reachable without passing the 18+ gate. */
const EXEMPT = [
	'/gate',
	'/privacy',
	'/api/',
	'/robots.txt',
	'/manifest.webmanifest',
	'/service-worker.js'
];

export function isGateExempt(pathname: string) {
	return EXEMPT.some((p) => (p.endsWith('/') ? pathname.startsWith(p) : pathname === p));
}

export function setAgeCookie(cookies: Cookies) {
	cookies.set(AGE_COOKIE, '1', {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev,
		maxAge: 60 * 60 * 24 * 365
	});
}

/** Only allow same-site relative redirects after the gate / login. */
export function safeNext(next: string | null | undefined, fallback = '/') {
	if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\'))
		return fallback;
	return next;
}
