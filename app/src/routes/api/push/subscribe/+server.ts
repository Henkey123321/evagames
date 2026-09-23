import { error, json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { pushSubscriptions } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

const subscription = z.object({
	endpoint: z.url().startsWith('https://'),
	keys: z.object({ p256dh: z.string().min(80).max(100), auth: z.string().min(16).max(32) })
});

/** Saves (or moves to this user) a browser push subscription. */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'Sign in to turn on notifications');
	const parsed = subscription.safeParse(await request.json().catch(() => null));
	if (!parsed.success) error(400, 'Invalid subscription');
	const { endpoint, keys } = parsed.data;

	await locals.db
		.insert(pushSubscriptions)
		.values({ userId: locals.user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth })
		.onConflictDoUpdate({
			target: pushSubscriptions.endpoint,
			set: { userId: locals.user.id, p256dh: keys.p256dh, auth: keys.auth, failureCount: 0 }
		});
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'Not signed in');
	const parsed = z
		.object({ endpoint: z.string() })
		.safeParse(await request.json().catch(() => null));
	if (!parsed.success) error(400, 'Invalid request');
	await locals.db
		.delete(pushSubscriptions)
		.where(
			and(
				eq(pushSubscriptions.endpoint, parsed.data.endpoint),
				eq(pushSubscriptions.userId, locals.user.id)
			)
		);
	return json({ ok: true });
};
