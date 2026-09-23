import { getFooterLinks, getSettings } from '$lib/server/site';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	const [footerLinks, settings] = await Promise.all([
		getFooterLinks(locals.db),
		getSettings(locals.db)
	]);
	return { user: locals.user, footerLinks, settings };
};
