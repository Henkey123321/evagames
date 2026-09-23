import { redirect } from '@sveltejs/kit';
import { requireStaff } from '$lib/server/guards';
import type { RequestHandler } from './$types';

/** From a person page: /ems/games/send-to?game=<preset>&to=<fan> → the send form, fan preselected. */
export const GET: RequestHandler = ({ locals, url }) => {
	requireStaff(locals, url, 'games');
	const game = url.searchParams.get('game') ?? '';
	const to = url.searchParams.get('to') ?? '';
	redirect(303, `/ems/games/${encodeURIComponent(game)}/send?to=${encodeURIComponent(to)}`);
};
