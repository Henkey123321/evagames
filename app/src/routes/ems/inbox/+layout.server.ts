import { requireStaff } from '$lib/server/guards';
import { listConversations } from '$lib/server/messages';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url, depends }) => {
	depends('ems:inbox');
	const me = requireStaff(locals, url, 'messages');
	const unreadOnly = url.searchParams.get('show') === 'unread';
	return {
		conversations: await listConversations(locals.db, me.id, { unreadOnly }),
		unreadOnly
	};
};
