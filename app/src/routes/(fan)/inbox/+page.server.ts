import { error, fail } from '@sveltejs/kit';
import { z } from 'zod';
import { rateLimit, requireUser } from '$lib/server/guards';
import { MESSAGE_MAX, getThread, markReadByFan, sendFanMessage } from '$lib/server/messages';
import type { Actions, PageServerLoad } from './$types';

const body = z
	.string()
	.trim()
	.min(1, 'Write a message first')
	.max(MESSAGE_MAX, 'That message is too long');

export const load: PageServerLoad = async ({ locals, url, depends }) => {
	depends('fan:inbox');
	const me = requireUser(locals, url);
	if (me.role !== 'player') error(404, 'Staff read messages in the EMS inbox');
	const thread = await getThread(locals.db, me.id);
	if (thread.conversation?.unreadForFan) await markReadByFan(locals.db, me.id);
	return {
		messages: thread.messages.map((m) => ({
			id: m.id,
			body: m.body,
			fromEva: m.fromStaff,
			createdAt: m.createdAt
		}))
	};
};

export const actions: Actions = {
	default: async ({ request, locals, url, platform }) => {
		const me = requireUser(locals, url);
		if (me.role !== 'player') error(404, 'Not found');
		const parsed = body.safeParse((await request.formData()).get('body'));
		if (!parsed.success) return fail(400, { error: parsed.error.issues[0].message });
		if (!(await rateLimit(locals.db, `msg:${me.id}`, 20, 60 * 60 * 1000))) {
			return fail(429, {
				error: 'You have sent a lot of messages. Give Eva a moment to catch up.'
			});
		}
		await sendFanMessage(locals.db, platform!.env, (p) => platform!.ctx.waitUntil(p), {
			userId: me.id,
			displayName: me.displayName,
			body: parsed.data
		});
		return { sent: true };
	}
};
