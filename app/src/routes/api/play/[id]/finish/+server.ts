import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { finishPlay, type Player } from '$lib/server/games';
import { getGuestId } from '$lib/server/guest';
import type { RequestHandler } from './$types';

const body = z.object({ result: z.unknown() });

export const POST: RequestHandler = async ({ params, request, locals, cookies }) => {
	const parsed = body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) error(400, 'Invalid request');

	let player: Player;
	if (locals.user) player = { userId: locals.user.id };
	else {
		const guestId = getGuestId(cookies);
		if (!guestId) error(404, 'Play not found');
		player = { guestId };
	}

	const outcome = await finishPlay(locals.db, params.id, player, parsed.data.result);
	if (!outcome.ok) {
		if (outcome.error === 'not_found') error(404, 'Play not found');
		if (outcome.error === 'already_finished') error(409, 'Play already finished');
		error(400, outcome.detail ?? 'Invalid result');
	}
	return json(outcome.response);
};
