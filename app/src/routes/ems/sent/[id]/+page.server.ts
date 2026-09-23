import { error, fail } from '@sveltejs/kit';
import { audit } from '$lib/server/activity';
import { requireStaff } from '$lib/server/guards';
import { assignmentDetail, cancelAssignment, setDeadline } from '$lib/server/assignments';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url, params }) => {
	requireStaff(locals, url, 'games');
	const detail = await assignmentDetail(locals.db, params.id);
	if (!detail) error(404, 'Sent game not found');
	return { detail, justSent: url.searchParams.get('sent') };
};

export const actions: Actions = {
	deadline: async ({ request, locals, url, params }) => {
		const me = requireStaff(locals, url, 'games');
		const iso = String((await request.formData()).get('deadlineIso') ?? '');
		const deadline = iso ? new Date(iso) : null;
		if (deadline && (Number.isNaN(deadline.getTime()) || deadline.getTime() < Date.now())) {
			return fail(400, { error: 'Pick a time in the future' });
		}
		await setDeadline(locals.db, params.id, deadline);
		await audit(locals.db, me.id, 'sent_game_deadline', 'assignment', params.id, {
			deadline: iso || null
		});
		return { saved: true };
	},

	cancel: async ({ locals, url, params }) => {
		const me = requireStaff(locals, url, 'games');
		await cancelAssignment(locals.db, params.id);
		await audit(locals.db, me.id, 'sent_game_cancelled', 'assignment', params.id);
		return { saved: true };
	}
};
