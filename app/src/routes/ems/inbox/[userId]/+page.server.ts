import { error, fail } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { favorites, users } from '$lib/server/db/schema';
import { requireStaff } from '$lib/server/guards';
import { MESSAGE_MAX, getThread, markReadByStaff, sendStaffMessage } from '$lib/server/messages';
import type { Actions, PageServerLoad } from './$types';

const body = z
	.string()
	.trim()
	.min(1, 'Write a message first')
	.max(MESSAGE_MAX, 'That message is too long');

export const load: PageServerLoad = async ({ locals, url, params, depends }) => {
	depends('ems:inbox');
	const me = requireStaff(locals, url, 'messages');
	const fan = await locals.db
		.select({
			id: users.id,
			displayName: users.displayName,
			username: users.usernameDisplay,
			onlyfansHandle: users.onlyfansHandle,
			loyalfansHandle: users.loyalfansHandle,
			disabledAt: users.disabledAt
		})
		.from(users)
		.where(and(eq(users.id, params.userId), eq(users.role, 'player')))
		.get();
	if (!fan) error(404, 'Conversation not found');

	const [thread, fav] = await Promise.all([
		getThread(locals.db, fan.id),
		locals.db
			.select({ id: favorites.userId })
			.from(favorites)
			.where(and(eq(favorites.staffId, me.id), eq(favorites.userId, fan.id)))
			.get()
	]);
	const justRead = !!thread.conversation?.unreadForStaff;
	if (justRead) await markReadByStaff(locals.db, fan.id);

	return { fan, favorite: !!fav, messages: thread.messages, justRead };
};

export const actions: Actions = {
	default: async ({ request, locals, url, params, platform }) => {
		const me = requireStaff(locals, url, 'messages');
		const parsed = body.safeParse((await request.formData()).get('body'));
		if (!parsed.success) return fail(400, { error: parsed.error.issues[0].message });

		const fan = await locals.db
			.select({ id: users.id })
			.from(users)
			.where(and(eq(users.id, params.userId), eq(users.role, 'player')))
			.get();
		if (!fan) error(404, 'Conversation not found');

		await sendStaffMessage(locals.db, platform!.env, (p) => platform!.ctx.waitUntil(p), {
			staffId: me.id,
			userId: fan.id,
			body: parsed.data
		});
		return { sent: true };
	}
};
