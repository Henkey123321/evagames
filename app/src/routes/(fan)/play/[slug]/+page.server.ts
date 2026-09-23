import { error, redirect } from '@sveltejs/kit';
import { hasGameUnlock } from '$lib/server/rewards';
import { getPresetBySlug, presetAccess, resolveConfig } from '$lib/server/games';
import { presetLeaderboard } from '$lib/server/leaderboards';
import { getManifest } from '$lib/games/registry';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals, url }) => {
	const preset = await getPresetBySlug(locals.db, params.slug);
	if (!preset) error(404, 'Game not found');

	const unlocked =
		preset.visibility === 'hidden' && locals.user
			? await hasGameUnlock(locals.db, locals.user.id, preset.id)
			: false;
	const access = presetAccess(preset, locals.user, { unlocked });
	if (!access.ok) {
		if (access.reason === 'login') redirect(303, `/login?next=${encodeURIComponent(url.pathname)}`);
		error(404, 'Game not found');
	}

	const manifest = getManifest(preset.type)!;
	const board = preset.leaderboardEnabled
		? (
				await presetLeaderboard(
					locals.db,
					preset.id,
					manifest.scoreOrder,
					manifest.rankCompletedOnly
				)
			).map((r) => ({
				name: r.name,
				isMe: r.userId === locals.user?.id,
				score: manifest.formatScore ? manifest.formatScore(r.score!) : String(r.score)
			}))
		: null;

	return {
		leaderboard: board,
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
