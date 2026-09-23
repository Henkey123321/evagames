import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { audit } from '$lib/server/activity';
import { requireStaff } from '$lib/server/guards';
import { notifyUser } from '$lib/server/push';
import {
	listRewards,
	resolveUserReward,
	rewardQueue,
	type QueueDecision
} from '$lib/server/rewards-admin';
import type { Actions, PageServerLoad } from './$types';

const DECISIONS = ['approve', 'decline', 'fulfil', 'accept_proof', 'reject_proof'] as const;

const NOTIFY: Partial<Record<QueueDecision, (name: string) => string>> = {
	approve: (n) => `Your reward "${n}" is unlocked.`,
	accept_proof: (n) => `Eva accepted your proof for "${n}".`,
	reject_proof: (n) => `Eva wants you to try "${n}" again.`,
	fulfil: (n) => `"${n}" is on its way.`
};

export const load: PageServerLoad = async ({ locals, url }) => {
	requireStaff(locals, url, 'rewards');
	const view = url.searchParams.get('view') === 'library' ? 'library' : 'queue';
	const [queue, library] = await Promise.all([rewardQueue(locals.db), listRewards(locals.db)]);
	return { view, queue, library };
};

export const actions: Actions = {
	resolve: async ({ request, locals, url, platform }) => {
		const me = requireStaff(locals, url, 'rewards');
		const parsed = z
			.object({
				id: z.string().min(1),
				decision: z.enum(DECISIONS),
				reply: z.string().trim().max(1000).optional()
			})
			.safeParse(Object.fromEntries(await request.formData()));
		if (!parsed.success) return fail(400, { error: 'Something was missing. Try again.' });
		const { id, decision, reply } = parsed.data;

		const result = await resolveUserReward(locals.db, id, decision, me.id, reply || undefined);
		if (!result) return fail(409, { error: 'That was already handled.' });
		await audit(locals.db, me.id, `reward_${decision}`, 'user_reward', id, {
			reward: result.rewardName
		});

		const text = NOTIFY[decision]?.(result.rewardName);
		if (text) {
			platform!.ctx.waitUntil(
				notifyUser(locals.db, platform!.env, result.userId, {
					title: 'Eva Games',
					body: text,
					url: '/vault',
					tag: 'vault'
				}).catch(() => undefined)
			);
		}
		return { resolved: id };
	}
};
