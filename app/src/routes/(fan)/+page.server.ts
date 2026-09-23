import { listHubPresets } from '$lib/server/games';
import { activeForFan } from '$lib/server/assignments';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const [presets, forYou] = await Promise.all([
		listHubPresets(locals.db),
		locals.user?.role === 'player' ? activeForFan(locals.db, locals.user.id) : []
	]);
	return {
		forYou,
		tiles: presets.map((p) => ({
			slug: p.slug,
			title: p.title,
			label: p.hubState === 'coming_soon' ? 'Coming Soon' : p.hubLabel,
			available: p.hubState === 'available',
			membersOnly: p.visibility === 'members'
		}))
	};
};
