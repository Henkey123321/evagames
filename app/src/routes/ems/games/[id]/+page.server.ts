import { error, fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { audit } from '$lib/server/activity';
import { gamePresets, HUB_STATES, VISIBILITIES } from '$lib/server/db/schema';
import { requireStaff } from '$lib/server/guards';
import { ART_OPTIONS, deletePreset, duplicatePreset, updatePreset } from '$lib/server/games-admin';
import { getManifest } from '$lib/games/registry';
import { readEditorForm } from '$lib/games/sdk/editor';
import type { Actions, PageServerLoad } from './$types';

const art = z
	.string()
	.optional()
	.transform((v) => (v && ART_OPTIONS.some((a) => a.value === v) ? v : null));

const presetForm = z.object({
	title: z.string().trim().min(1, 'Give the game a name').max(60),
	slug: z.string().trim().max(60).default(''),
	instructions: z.string().trim().max(600).default(''),
	visibility: z.enum(VISIBILITIES),
	hubState: z.enum(HUB_STATES),
	hubLabel: z.string().trim().min(1).max(24).default('Play'),
	pointsOnComplete: z.coerce.number().int().min(0).max(100_000),
	leaderboardEnabled: z
		.string()
		.optional()
		.transform((v) => v === 'on'),
	artLeft: art,
	artRight: art
});

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
	return {
		preset,
		typeName: manifest.name,
		fields: manifest.editor,
		values: manifest.configSchema.parse(preset.config ?? {}) as Record<string, unknown>,
		art: ART_OPTIONS
	};
};

export const actions: Actions = {
	save: async ({ request, locals, url, params }) => {
		const me = requireStaff(locals, url, 'games');
		const { preset, manifest } = await loadPreset(locals.db, params.id);
		const form = await request.formData();
		const parsed = presetForm.safeParse(Object.fromEntries(form));
		if (!parsed.success) return fail(400, { error: parsed.error.issues[0].message });

		// Keep settings the editor doesn't show (e.g. uploaded images) and validate the rest.
		const config = { ...(preset.config ?? {}), ...readEditorForm(manifest.editor, form) };
		const checked = manifest.configSchema.safeParse(config);
		if (!checked.success) {
			const issue = checked.error.issues[0];
			const field = manifest.editor.find((f) => f.key === issue.path[0]);
			return fail(400, { error: `${field?.label ?? 'A setting'}: ${issue.message}` });
		}

		const problem = await updatePreset(locals.db, preset.id, { ...parsed.data, config });
		if (problem) return fail(400, { error: problem });
		await audit(locals.db, me.id, 'game_updated', 'game_preset', preset.id, {
			title: parsed.data.title
		});
		return { saved: true };
	},

	duplicate: async ({ locals, url, params }) => {
		const me = requireStaff(locals, url, 'games');
		const { preset } = await loadPreset(locals.db, params.id);
		const id = await duplicatePreset(locals.db, preset, me.id);
		await audit(locals.db, me.id, 'game_duplicated', 'game_preset', id, { from: preset.id });
		redirect(303, `/ems/games/${id}?created=1`);
	},

	delete: async ({ locals, url, params }) => {
		const me = requireStaff(locals, url, 'games');
		const { preset } = await loadPreset(locals.db, params.id);
		if (!(await deletePreset(locals.db, preset.id))) {
			return fail(400, {
				error:
					'This game has been played, so it can only be hidden: set "On the hub" to "Not on the hub".'
			});
		}
		await audit(locals.db, me.id, 'game_deleted', 'game_preset', preset.id, {
			title: preset.title
		});
		redirect(303, '/ems/games');
	}
};
