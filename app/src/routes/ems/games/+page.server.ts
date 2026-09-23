import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { audit } from '$lib/server/activity';
import { requireStaff } from '$lib/server/guards';
import { createPreset, listPresets } from '$lib/server/games-admin';
import { gameManifests } from '$lib/games/registry';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	requireStaff(locals, url, 'games');
	return {
		presets: await listPresets(locals.db),
		types: [...gameManifests.values()].map((m) => ({
			type: m.type,
			name: m.name,
			description: m.description
		}))
	};
};

export const actions: Actions = {
	create: async ({ request, locals, url }) => {
		const me = requireStaff(locals, url, 'games');
		const parsed = z
			.object({
				type: z.string().refine((t) => gameManifests.has(t), 'Pick a game type'),
				title: z.string().trim().min(1, 'Give the game a name').max(60)
			})
			.safeParse(Object.fromEntries(await request.formData()));
		if (!parsed.success) return fail(400, { error: parsed.error.issues[0].message });
		const id = await createPreset(locals.db, parsed.data.type, parsed.data.title, me.id);
		await audit(locals.db, me.id, 'game_created', 'game_preset', id, parsed.data);
		redirect(303, `/ems/games/${id}?created=1`);
	}
};
