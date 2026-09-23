import { getFooterLinks, getSettings } from '$lib/server/site';
import { unreadForFan } from '$lib/server/messages';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, depends }) => {
	depends('fan:inbox');
	const [footerLinks, settings, unread] = await Promise.all([
		getFooterLinks(locals.db),
		getSettings(locals.db),
		locals.user?.role === 'player' ? unreadForFan(locals.db, locals.user.id) : 0
	]);
	return { user: locals.user, footerLinks, settings, unread };
};
