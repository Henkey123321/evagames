import { error, json } from '@sveltejs/kit';
import { notifyUser } from '$lib/server/push';
import { rateLimit } from '$lib/server/guards';
import type { RequestHandler } from './$types';

/** Sends a test notification to the signed-in user's own devices. */
export const POST: RequestHandler = async ({ locals, platform }) => {
	if (!locals.user) error(401, 'Not signed in');
	if (!(await rateLimit(locals.db, `push-test:${locals.user.id}`, 5, 60 * 60 * 1000))) {
		error(429, 'Try again later');
	}
	const result = await notifyUser(locals.db, platform!.env, locals.user.id, {
		title: 'Eva Games',
		body: 'Notifications are on. You will hear from me here.',
		url: '/account',
		tag: 'test'
	});
	return json(result);
};
