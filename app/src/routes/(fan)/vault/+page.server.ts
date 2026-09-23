import { error, fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { users } from '$lib/server/db/schema';
import { rateLimit, requireUser } from '$lib/server/guards';
import { pointsHistory } from '$lib/server/rewards';
import { badgesFor, submitProof, vaultFor } from '$lib/server/rewards-admin';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const me = requireUser(locals, url);
	if (me.role !== 'player') error(404, 'The vault is for fans');
	const [items, earned, history, user] = await Promise.all([
		vaultFor(locals.db, me.id),
		badgesFor(locals.db, me.id),
		pointsHistory(locals.db, me.id, 10),
		locals.db.select({ points: users.points }).from(users).where(eq(users.id, me.id)).get()
	]);
	return { items, badges: earned, history, points: user?.points ?? 0 };
};

export const actions: Actions = {
	proof: async ({ request, locals, url }) => {
		const me = requireUser(locals, url);
		const parsed = z
			.object({
				id: z.string().min(1),
				text: z.string().trim().min(1, 'Write your proof first').max(4000, 'That is too long')
			})
			.safeParse(Object.fromEntries(await request.formData()));
		if (!parsed.success) return fail(400, { error: parsed.error.issues[0].message });
		if (!(await rateLimit(locals.db, `proof:${me.id}`, 20, 60 * 60 * 1000))) {
			return fail(429, { error: 'Too many submissions. Try again later.' });
		}
		const ok = await submitProof(locals.db, me.id, parsed.data.id, parsed.data.text);
		if (!ok) return fail(400, { error: 'This task is not waiting for proof any more.' });
		return { sent: parsed.data.id };
	}
};
