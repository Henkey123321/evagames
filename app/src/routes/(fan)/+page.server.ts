import { listHubPresets } from '$lib/server/games';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const presets = await listHubPresets(locals.db);
	return {
		tiles: presets.map((p) => ({
			slug: p.slug,
			title: p.title,
			label: p.hubState === 'coming_soon' ? 'Coming Soon' : p.hubLabel,
			available: p.hubState === 'available',
			membersOnly: p.visibility === 'members'
		}))
	};
};
