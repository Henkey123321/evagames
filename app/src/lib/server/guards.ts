import { error, redirect } from '@sveltejs/kit';
import { eq, sql } from 'drizzle-orm';
import type { Db } from './db';
import { rateLimits } from './db/schema';
import { can, isStaff, type SessionUser } from './auth';
import type { Permission } from './db/schema';

export function requireUser(locals: App.Locals, url: URL): SessionUser {
	if (!locals.user) redirect(303, `/login?next=${encodeURIComponent(url.pathname + url.search)}`);
	return locals.user;
}

export function requireStaff(locals: App.Locals, url: URL, permission?: Permission): SessionUser {
	const user = requireUser(locals, url);
	if (!isStaff(user)) error(404, 'Not found');
	if (permission && !can(user, permission)) error(403, 'You do not have access to this area');
	return user;
}

/**
 * Fixed-window rate limit backed by D1. Returns false when the limit is exceeded.
 * Good enough for auth endpoints; not meant for high-volume traffic.
 */
export async function rateLimit(
	db: Db,
	key: string,
	limit: number,
	windowMs: number
): Promise<boolean> {
	const now = Date.now();
	const windowStart = now - (now % windowMs);
	const row = await db
		.insert(rateLimits)
		.values({ key, windowStart, count: 1 })
		.onConflictDoUpdate({
			target: rateLimits.key,
			set: {
				count: sql`CASE WHEN ${rateLimits.windowStart} = ${windowStart} THEN ${rateLimits.count} + 1 ELSE 1 END`,
				windowStart
			}
		})
		.returning({ count: rateLimits.count })
		.get();
	return (row?.count ?? 1) <= limit;
}

export async function clearRateLimit(db: Db, key: string) {
	await db.delete(rateLimits).where(eq(rateLimits.key, key));
}

export function clientIp(request: Request): string {
	return request.headers.get('cf-connecting-ip') ?? '127.0.0.1';
}

/** Verifies a Cloudflare Turnstile token. Passes automatically when no secret is configured. */
export async function verifyTurnstile(
	secret: string | undefined,
	token: FormDataEntryValue | null,
	ip: string
) {
	if (!secret) return true;
	if (typeof token !== 'string' || !token) return false;
	const body = new FormData();
	body.append('secret', secret);
	body.append('response', token);
	body.append('remoteip', ip);
	const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
		method: 'POST',
		body
	});
	const data = (await res.json()) as { success?: boolean };
	return data.success === true;
}
