import { error, fail, redirect } from '@sveltejs/kit';
import { asc, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { audit } from '$lib/server/activity';
import {
	badges,
	gamePresets,
	PROOF_KINDS,
	TRIGGER_TYPES,
	type RewardContent
} from '$lib/server/db/schema';
import { requireStaff } from '$lib/server/guards';
import {
	addTrigger,
	archiveReward,
	getReward,
	listRewards,
	removeTrigger,
	saveReward
} from '$lib/server/rewards-admin';
import type { Actions, PageServerLoad } from './$types';

/** Kinds Eva can create right now; 'media' arrives with the media library. */
const EDITABLE_KINDS = ['link', 'task', 'game', 'manual'] as const;

const rewardForm = z
	.object({
		name: z.string().trim().min(1, 'Give the reward a name').max(80),
		kind: z.enum(EDITABLE_KINDS),
		message: z.string().trim().max(2000).default(''),
		requiresApproval: z
			.string()
			.optional()
			.transform((v) => v === 'on'),
		url: z.string().trim().max(500).optional(),
		code: z.string().trim().max(200).optional(),
		instructions: z.string().trim().max(4000).optional(),
		proof: z.enum(PROOF_KINDS).optional(),
		presetId: z.string().optional(),
		staffNote: z.string().trim().max(1000).optional()
	})
	.superRefine((f, ctx) => {
		const need = (ok: boolean, path: string, message: string) => {
			if (!ok) ctx.addIssue({ code: 'custom', path: [path], message });
		};
		if (f.kind === 'link') {
			need(!!(f.url || f.code), 'url', 'Add a link, a code, or both');
			if (f.url) need(/^https:\/\//.test(f.url), 'url', 'Links must start with https://');
		}
		if (f.kind === 'task') need(!!f.instructions, 'instructions', 'Write what the fan should do');
		if (f.kind === 'game') need(!!f.presetId, 'presetId', 'Pick the game this unlocks');
		if (f.kind === 'task' && f.proof && ['image', 'text_image'].includes(f.proof)) {
			ctx.addIssue({
				code: 'custom',
				path: ['proof'],
				message: 'Image proof arrives with the media library'
			});
		}
	});

function contentFor(f: z.infer<typeof rewardForm>): RewardContent {
	switch (f.kind) {
		case 'link':
			return { url: f.url || undefined, code: f.code || undefined };
		case 'task':
			return { instructions: f.instructions, proof: f.proof ?? 'none' };
		case 'game':
			return { presetId: f.presetId };
		case 'manual':
			return { staffNote: f.staffNote || undefined };
	}
}

const triggerForm = z
	.object({
		type: z.enum(TRIGGER_TYPES),
		presetId: z.string().optional(),
		threshold: z.coerce.number().int().min(1).max(1_000_000).optional(),
		badgeId: z.string().optional()
	})
	.superRefine((t, ctx) => {
		if (t.type === 'preset_completed' && !t.presetId)
			ctx.addIssue({ code: 'custom', path: ['presetId'], message: 'Pick a game' });
		if (t.type === 'points_reached' && !t.threshold)
			ctx.addIssue({ code: 'custom', path: ['threshold'], message: 'Enter a points total' });
		if (t.type === 'badge_earned' && !t.badgeId)
			ctx.addIssue({ code: 'custom', path: ['badgeId'], message: 'Pick a badge' });
	});

export const load: PageServerLoad = async ({ locals, url, params }) => {
	requireStaff(locals, url, 'rewards');
	const [presets, badgeList] = await Promise.all([
		locals.db
			.select({ id: gamePresets.id, title: gamePresets.title, visibility: gamePresets.visibility })
			.from(gamePresets)
			.orderBy(asc(gamePresets.title)),
		locals.db
			.select({ id: badges.id, name: badges.name })
			.from(badges)
			.where(isNull(badges.archivedAt))
	]);

	if (params.id === 'new') return { reward: null, triggers: [], presets, badges: badgeList };

	const reward = (await listRewards(locals.db)).find((r) => r.id === params.id);
	if (!reward) error(404, 'Reward not found');
	return { reward, triggers: reward.triggers, presets, badges: badgeList };
};

export const actions: Actions = {
	save: async ({ request, locals, url, params }) => {
		const me = requireStaff(locals, url, 'rewards');
		const parsed = rewardForm.safeParse(Object.fromEntries(await request.formData()));
		if (!parsed.success) return fail(400, { error: parsed.error.issues[0].message });
		const f = parsed.data;
		const id = await saveReward(
			locals.db,
			params.id === 'new' ? null : params.id,
			{
				name: f.name,
				kind: f.kind,
				message: f.message,
				content: contentFor(f),
				requiresApproval: f.requiresApproval
			},
			me.id
		);
		await audit(
			locals.db,
			me.id,
			params.id === 'new' ? 'reward_created' : 'reward_updated',
			'reward',
			id,
			{ name: f.name }
		);
		if (params.id === 'new') redirect(303, `/ems/rewards/${id}?created=1`);
		return { saved: true };
	},

	addTrigger: async ({ request, locals, url, params }) => {
		const me = requireStaff(locals, url, 'rewards');
		if (!(await getReward(locals.db, params.id))) error(404, 'Reward not found');
		const parsed = triggerForm.safeParse(Object.fromEntries(await request.formData()));
		if (!parsed.success) return fail(400, { error: parsed.error.issues[0].message });
		const t = parsed.data;
		await addTrigger(locals.db, params.id, {
			type: t.type,
			presetId: t.type === 'preset_completed' ? t.presetId : null,
			threshold: t.type === 'points_reached' ? t.threshold : null,
			badgeId: t.type === 'badge_earned' ? t.badgeId : null
		});
		await audit(locals.db, me.id, 'reward_trigger_added', 'reward', params.id, t);
		return { saved: true };
	},

	removeTrigger: async ({ request, locals, url, params }) => {
		requireStaff(locals, url, 'rewards');
		await removeTrigger(locals.db, params.id, String((await request.formData()).get('triggerId')));
		return { saved: true };
	},

	archive: async ({ locals, url, params }) => {
		const me = requireStaff(locals, url, 'rewards');
		await archiveReward(locals.db, params.id);
		await audit(locals.db, me.id, 'reward_archived', 'reward', params.id);
		redirect(303, '/ems/rewards?view=library');
	}
};
