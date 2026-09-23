import { error, fail, redirect } from '@sveltejs/kit';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { audit } from '$lib/server/activity';
import { sendAssignment } from '$lib/server/assignments';
import { gamePresets, rewards, users } from '$lib/server/db/schema';
import { requireStaff } from '$lib/server/guards';
import { createPreset, updatePreset } from '$lib/server/games-admin';
import { getLists } from '$lib/server/people';
import { getManifest } from '$lib/games/registry';
import { diffConfig, readEditorForm, readTargets } from '$lib/games/sdk/editor';
import type { Actions, PageServerLoad } from './$types';

async function loadPreset(db: App.Locals['db'], id: string) {
	const preset = await db.select().from(gamePresets).where(eq(gamePresets.id, id)).get();
	if (!preset) error(404, 'Game not found');
	const manifest = getManifest(preset.type);
	if (!manifest) error(500, `Unknown game type ${preset.type}`);
	return { preset, manifest };
}

export const load: PageServerLoad = async ({ locals, url, params }) => {
	requireStaff(locals, url, 'games');
	const { preset, manifest } = await loadPreset(locals.db, params.id);

	// ?to=<userId>: preselect a fan (e.g. from their People page).
	const to = url.searchParams.getAll('to').slice(0, 20);
	const [lists, rewardList, preselected] = await Promise.all([
		getLists(locals.db),
		locals.db
			.select({ id: rewards.id, name: rewards.name })
			.from(rewards)
			.where(isNull(rewards.archivedAt)),
		to.length
			? locals.db
					.select({ id: users.id, displayName: users.displayName, username: users.usernameDisplay })
					.from(users)
					.where(and(inArray(users.id, to), eq(users.role, 'player')))
			: []
	]);

	return {
		preset: { id: preset.id, title: preset.title, slug: preset.slug },
		typeName: manifest.name,
		fields: manifest.editor,
		values: manifest.configSchema.parse(preset.config ?? {}) as Record<string, unknown>,
		targets: manifest.targets.map(({ key, label, unit, min, max }) => ({
			key,
			label,
			unit,
			min,
			max
		})),
		lists,
		rewards: rewardList,
		preselected
	};
};

const sendForm = z.object({
	title: z.string().trim().min(1, 'Give it a title').max(80),
	message: z.string().trim().max(2000).default(''),
	listId: z.string().optional(),
	deadlineIso: z.string().optional(),
	maxAttempts: z.string().optional(),
	points: z.coerce.number().int().min(0).max(100_000).default(0),
	rewardId: z.string().optional(),
	saveAs: z.string().trim().max(60).optional()
});

export const actions: Actions = {
	default: async ({ request, locals, url, params }) => {
		const me = requireStaff(locals, url, 'games');
		const { preset, manifest } = await loadPreset(locals.db, params.id);
		const form = await request.formData();
		const parsed = sendForm.safeParse(Object.fromEntries(form));
		if (!parsed.success) return fail(400, { error: parsed.error.issues[0].message });
		const f = parsed.data;

		const userIds = form
			.getAll('ids')
			.map(String)
			.filter((id) => /^[0-9a-f-]{36}$/.test(id));
		const listId = f.listId || null;
		if (userIds.length === 0 && !listId) return fail(400, { error: 'Choose who to send it to' });

		const base = manifest.configSchema.parse(preset.config ?? {}) as Record<string, unknown>;
		const next = { ...base, ...readEditorForm(manifest.editor, form) };
		const checked = manifest.configSchema.safeParse(next);
		if (!checked.success) {
			const field = manifest.editor.find((x) => x.key === checked.error.issues[0].path[0]);
			return fail(400, {
				error: `${field?.label ?? 'A setting'}: ${checked.error.issues[0].message}`
			});
		}

		let deadline: Date | null = null;
		if (f.deadlineIso) {
			deadline = new Date(f.deadlineIso);
			if (Number.isNaN(deadline.getTime()))
				return fail(400, { error: 'That deadline is not a valid date' });
			if (deadline.getTime() < Date.now() + 5 * 60 * 1000) {
				return fail(400, { error: 'Set the deadline at least a few minutes from now' });
			}
		}
		const maxAttempts = f.maxAttempts
			? Math.min(100, Math.max(1, Math.round(Number(f.maxAttempts))))
			: null;
		if (f.maxAttempts && !Number.isFinite(maxAttempts))
			return fail(400, { error: 'Attempts must be a number' });

		const overrides = diffConfig(base, checked.data as Record<string, unknown>);
		const sent = await sendAssignment(
			locals.db,
			{
				presetId: preset.id,
				title: f.title,
				message: f.message,
				configOverrides: overrides,
				targets: readTargets(manifest.targets, form),
				deadline,
				maxAttempts,
				points: f.points,
				rewardId: f.rewardId || null,
				createdBy: me.id,
				userIds,
				listId
			},
			preset.slug
		);

		// Optionally keep these settings as a new hidden version of the game.
		if (f.saveAs) {
			const id = await createPreset(locals.db, preset.type, f.saveAs, me.id);
			await updatePreset(locals.db, id, {
				title: f.saveAs,
				slug: f.saveAs,
				instructions: preset.instructions,
				visibility: 'hidden',
				hubState: 'off',
				hubLabel: preset.hubLabel,
				pointsOnComplete: 0,
				leaderboardEnabled: false,
				artLeft: preset.artLeft,
				artRight: preset.artRight,
				config: { ...(preset.config ?? {}), ...overrides }
			});
		}

		await audit(locals.db, me.id, 'game_sent', 'assignment', sent.id, {
			title: f.title,
			recipients: sent.recipients
		});
		redirect(303, `/ems/sent/${sent.id}?sent=${sent.recipients}`);
	}
};
