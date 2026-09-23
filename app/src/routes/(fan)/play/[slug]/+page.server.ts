import { error, redirect } from '@sveltejs/kit';
import { getPresetBySlug, presetAccess, resolveConfig } from '$lib/server/games';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals, url }) => {
	const preset = await getPresetBySlug(locals.db, params.slug);
	if (!preset) error(404, 'Game not found');

	const access = presetAccess(preset, locals.user);
	if (!access.ok) {
		if (access.reason === 'login') redirect(303, `/login?next=${encodeURIComponent(url.pathname)}`);
		error(404, 'Game not found');
	}

	return {
		game: {
			slug: preset.slug,
			type: preset.type,
			title: preset.title,
			instructions: preset.instructions,
			artLeft: preset.artLeft,
			artRight: preset.artRight,
			config: resolveConfig(preset)
		}
	};
};
