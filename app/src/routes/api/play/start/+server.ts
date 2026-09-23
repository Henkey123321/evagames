import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { hasGameUnlock } from '$lib/server/rewards';
import { getPresetBySlug, presetAccess, startPlay, type Player } from '$lib/server/games';
import { ensureGuestId } from '$lib/server/guest';
import { clientIp, rateLimit } from '$lib/server/guards';
import type { RequestHandler } from './$types';

const body = z.object({ slug: z.string().min(1).max(80) });

export const POST: RequestHandler = async ({ request, locals, cookies }) => {
	const parsed = body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) error(400, 'Invalid request');

	const who = locals.user?.id ?? clientIp(request);
	if (!(await rateLimit(locals.db, `play:${who}`, 120, 10 * 60 * 1000)))
		error(429, 'Too many games started');

	const preset = await getPresetBySlug(locals.db, parsed.data.slug);
	if (!preset) error(404, 'Game not found');
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
