import { fail } from '@sveltejs/kit';
import { asc } from 'drizzle-orm';
import { z } from 'zod';
import { audit } from '$lib/server/activity';
import { BADGE_RULES, gamePresets } from '$lib/server/db/schema';
import { requireStaff } from '$lib/server/guards';
import { archiveBadge, listBadges, saveBadge } from '$lib/server/rewards-admin';
import type { Actions, PageServerLoad } from './$types';

const badgeForm = z
	.object({
		id: z.string().optional(),
		name: z.string().trim().min(1, 'Give the badge a name').max(40),
		description: z.string().trim().max(200).default(''),
		mark: z.string().trim().min(1, 'Add a mark: an emoji or up to 3 letters').max(8),
		rule: z.enum(BADGE_RULES),
		threshold: z.coerce.number().int().min(1).max(1_000_000).optional(),
		presetId: z.string().optional()
	})
	.superRefine((b, ctx) => {
		if ((b.rule === 'completions' || b.rule === 'points') && !b.threshold) {
			ctx.addIssue({ code: 'custom', path: ['threshold'], message: 'Enter the number needed' });
		}
		if (b.rule === 'completed_preset' && !b.presetId) {
			ctx.addIssue({ code: 'custom', path: ['presetId'], message: 'Pick the game' });
		}
	});

export const load: PageServerLoad = async ({ locals, url }) => {
	requireStaff(locals, url, 'rewards');
	const [badgeList, presets] = await Promise.all([
		listBadges(locals.db),
		locals.db
			.select({ id: gamePresets.id, title: gamePresets.title })
			.from(gamePresets)
			.orderBy(asc(gamePresets.title))
	]);
	return { badges: badgeList, presets };
};

export const actions: Actions = {
	save: async ({ request, locals, url }) => {
		const me = requireStaff(locals, url, 'rewards');
		const parsed = badgeForm.safeParse(Object.fromEntries(await request.formData()));
		if (!parsed.success) return fail(400, { error: parsed.error.issues[0].message });
		const { id, ...b } = parsed.data;
		await saveBadge(locals.db, id || null, {
			name: b.name,
			description: b.description,
			mark: b.mark,
			rule: b.rule,
			threshold: b.rule === 'completions' || b.rule === 'points' ? (b.threshold ?? null) : null,
			presetId: b.rule === 'completed_preset' ? (b.presetId ?? null) : null
		});
		await audit(locals.db, me.id, id ? 'badge_updated' : 'badge_created', 'badge', id ?? null, {
			name: b.name
		});
		return { saved: true };
	},

	archive: async ({ request, locals, url }) => {
		const me = requireStaff(locals, url, 'rewards');
		const id = String((await request.formData()).get('id'));
		await archiveBadge(locals.db, id);
		await audit(locals.db, me.id, 'badge_archived', 'badge', id);
		return { saved: true };
	}
};
