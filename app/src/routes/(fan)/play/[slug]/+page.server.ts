import { error, redirect } from '@sveltejs/kit';
import { hasGameUnlock } from '$lib/server/rewards';
import { assignmentConfig, assignmentForFan, targetLines } from '$lib/server/assignments';
import { getPresetBySlug, presetAccess, resolveConfig } from '$lib/server/games';
import { presetLeaderboard } from '$lib/server/leaderboards';
import { getManifest } from '$lib/games/registry';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals, url }) => {
	const preset = await getPresetBySlug(locals.db, params.slug);
	if (!preset) error(404, 'Game not found');

	// ?a=<id>: a game Eva sent this fan, played with her settings and rules.
	const assignmentId = url.searchParams.get('a');
	let sent: Awaited<ReturnType<typeof assignmentForFan>> = null;
	if (assignmentId) {
		if (!locals.user) redirect(303, `/login?next=${encodeURIComponent(url.pathname + url.search)}`);
		sent = await assignmentForFan(locals.db, assignmentId, locals.user.id);
		if (!sent || sent.preset.id !== preset.id) error(404, 'Game not found');
	}

	const unlocked =
		!!sent ||
		(preset.visibility === 'hidden' && locals.user
			? await hasGameUnlock(locals.db, locals.user.id, preset.id)
			: false);
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
		leaderboard: sent ? null : board,
		assignment: sent && {
			id: sent.a.id,
			title: sent.a.title,
			message: sent.a.message,
			deadline: sent.a.deadline,
			attemptsLeft: sent.attemptsLeft,
			status: sent.status,
			playable: sent.playable,
			targets: [
				manifest.describeGoal(assignmentConfig(preset, sent.a)),
				...targetLines(preset.type, sent.a.targets)
			],
			points: sent.a.points
		},
		game: {
			slug: preset.slug,
			type: preset.type,
			title: preset.title,
			instructions: preset.instructions,
			artLeft: preset.artLeft,
			artRight: preset.artRight,
			config: sent ? assignmentConfig(preset, sent.a) : resolveConfig(preset)
		}
	};
};
