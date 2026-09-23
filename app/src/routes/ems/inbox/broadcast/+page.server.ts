import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { audit } from '$lib/server/activity';
import { requireStaff } from '$lib/server/guards';
import { MESSAGE_MAX, broadcast, recentBroadcasts } from '$lib/server/messages';
import { getLists } from '$lib/server/people';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	requireStaff(locals, url, 'messages');
	const [lists, recent] = await Promise.all([getLists(locals.db), recentBroadcasts(locals.db)]);
	return { lists, recent };
};

const schema = z.object({
	body: z
		.string()
		.trim()
		.min(1, 'Write a message first')
		.max(MESSAGE_MAX, 'That message is too long'),
	target: z.string().min(1)
});

export const actions: Actions = {
	default: async ({ request, locals, url }) => {
		const me = requireStaff(locals, url, 'messages');
		const parsed = schema.safeParse(Object.fromEntries(await request.formData()));
		if (!parsed.success) return fail(400, { error: parsed.error.issues[0].message });

		let target: 'all' | { listId: string; listName: string } = 'all';
		if (parsed.data.target !== 'all') {
			const list = (await getLists(locals.db)).find((l) => l.id === parsed.data.target);
			if (!list) return fail(400, { error: 'That list no longer exists' });
			target = { listId: list.id, listName: list.name };
		}

		const sent = await broadcast(locals.db, { staffId: me.id, body: parsed.data.body, target });
		await audit(locals.db, me.id, 'broadcast_sent', 'broadcast', null, {
			target: target === 'all' ? 'all' : target.listName,
			recipients: sent
		});
		return { sent };
	}
};
