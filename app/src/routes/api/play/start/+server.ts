import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { hasGameUnlock } from '$lib/server/rewards';
import { assignmentForFan, startAssignmentAttempt } from '$lib/server/assignments';
import { getPresetBySlug, presetAccess, startPlay, type Player } from '$lib/server/games';
import { ensureGuestId } from '$lib/server/guest';
import { clientIp, rateLimit } from '$lib/server/guards';
import type { RequestHandler } from './$types';

const body = z.object({
	slug: z.string().min(1).max(80),
	assignmentId: z.string().max(60).optional()
});

export const POST: RequestHandler = async ({ request, locals, cookies }) => {
	const parsed = body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) error(400, 'Invalid request');
	const { slug, assignmentId } = parsed.data;

	const who = locals.user?.id ?? clientIp(request);
	if (!(await rateLimit(locals.db, `play:${who}`, 120, 10 * 60 * 1000)))
		error(429, 'Too many games started');

	const preset = await getPresetBySlug(locals.db, slug);
	if (!preset) error(404, 'Game not found');

	// A game Eva sent: counts an attempt and plays with her settings.
	if (assignmentId) {
		if (!locals.user) error(401, 'Sign in to play this game');
		const sent = await assignmentForFan(locals.db, assignmentId, locals.user.id);
		if (!sent || sent.preset.id !== preset.id) error(404, 'Game not found');
		if (!(await startAssignmentAttempt(locals.db, assignmentId, locals.user.id))) {
			error(403, 'This game is no longer available to play');
		}
		const playId = await startPlay(locals.db, preset, { userId: locals.user.id }, assignmentId);
		return json({ playId });
	}

	const unlocked =
		preset.visibility === 'hidden' && locals.user
			? await hasGameUnlock(locals.db, locals.user.id, preset.id)
			: false;
	const access = presetAccess(preset, locals.user, { unlocked });
	if (!access.ok) error(access.reason === 'login' ? 401 : 403, 'This game is not available');

	const player: Player = locals.user
		? { userId: locals.user.id }
		: { guestId: ensureGuestId(cookies) };
	return json({ playId: await startPlay(locals.db, preset, player) });
};
