import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { audit } from '$lib/server/activity';
import { HUB_STATES, VISIBILITIES } from '$lib/server/db/schema';
import { requireStaff } from '$lib/server/guards';
import {
	deleteFooterLink,
	getFooterLinks,
	getSettings,
	listHubGames,
	saveFooterLink,
	updateHubGame,
	updateSettings
} from '$lib/server/site';
import type { Actions, PageServerLoad } from './$types';

/** Artwork and icons that ship with the site. Uploads arrive with the media library. */
const ART = [
	{ value: '/brand/body-left.png', label: 'Hub, left figure' },
	{ value: '/brand/body-right.png', label: 'Hub, right figure' },
	{ value: '/games/2048/body-left.png', label: '2048, left figure' },
	{ value: '/games/2048/body-right.png', label: '2048, right figure' },
	{ value: '/games/memory/body-left.png', label: 'Memory, left figure' },
	{ value: '/games/memory/body-right.png', label: 'Memory, right figure' }
];

const ICONS = [
	'onlyfans',
	'loyalfans',
	'iwantclips',
	'clips4sale',
	'bluesky',
	'reddit',
	'x',
	'instagram'
].map((name) => `/icons/${name}.svg`);

const artValue = z
	.string()
	.refine((v) => ART.some((a) => a.value === v), 'Pick artwork from the list');

const hubForm = z.object({
	hubComingSoonTitle: z.string().trim().min(1, 'Add a title for the coming-soon tile').max(60),
	hubComingSoonLabel: z.string().trim().min(1).max(24),
	hubArtLeft: artValue,
	hubArtRight: artValue,
	mainSiteUrl: z.url('Enter a full address, starting with https://').startsWith('https://')
});

const gameForm = z.object({
	id: z.string().min(1),
	hubState: z.enum(HUB_STATES),
	visibility: z.enum(VISIBILITIES),
	hubLabel: z.string().trim().min(1).max(24),
	hubOrder: z.coerce.number().int().min(0).max(999)
});

const linkForm = z.object({
	id: z.string().optional(),
	label: z.string().trim().min(1, 'Add a name').max(40),
	url: z.url('Enter a full address, starting with https://').startsWith('https://'),
	icon: z.string().refine((v) => ICONS.includes(v), 'Pick an icon'),
	group: z.enum(['store', 'social']),
	sortOrder: z.coerce.number().int().min(0).max(999)
});

export const load: PageServerLoad = async ({ locals, url }) => {
	requireStaff(locals, url, 'site');
	const [settings, games, links] = await Promise.all([
		getSettings(locals.db),
		listHubGames(locals.db),
		getFooterLinks(locals.db)
	]);
	return { settings, games, links: [...links.store, ...links.social], art: ART, icons: ICONS };
};

export const actions: Actions = {
	hub: async ({ request, locals, url }) => {
		const me = requireStaff(locals, url, 'site');
		const parsed = hubForm.safeParse(Object.fromEntries(await request.formData()));
		if (!parsed.success)
			return fail(400, { section: 'hub', error: parsed.error.issues[0].message });
		await updateSettings(locals.db, parsed.data);
		await audit(locals.db, me.id, 'site_updated', 'site', 'hub', parsed.data);
		return { section: 'hub', saved: true };
	},

	game: async ({ request, locals, url }) => {
		const me = requireStaff(locals, url, 'site');
		const parsed = gameForm.safeParse(Object.fromEntries(await request.formData()));
		if (!parsed.success)
			return fail(400, { section: 'games', error: parsed.error.issues[0].message });
		const { id, ...input } = parsed.data;
		await updateHubGame(locals.db, id, input);
		await audit(locals.db, me.id, 'hub_game_updated', 'game_preset', id, input);
		return { section: 'games', saved: true, id };
	},

	link: async ({ request, locals, url }) => {
		const me = requireStaff(locals, url, 'site');
		const parsed = linkForm.safeParse(Object.fromEntries(await request.formData()));
		if (!parsed.success)
			return fail(400, { section: 'links', error: parsed.error.issues[0].message });
		const { id, ...input } = parsed.data;
		const extraClass = input.icon.endsWith('iwantclips.svg')
			? 'footer-link-iwc'
			: input.group === 'store'
				? 'footer-link-wide'
				: '';
		await saveFooterLink(locals.db, id || null, { ...input, extraClass });
		await audit(
			locals.db,
			me.id,
			id ? 'footer_link_updated' : 'footer_link_added',
			'footer_link',
			id ?? null,
			input
		);
		return { section: 'links', saved: true, id };
	},

	deleteLink: async ({ request, locals, url }) => {
		const me = requireStaff(locals, url, 'site');
		const id = String((await request.formData()).get('id'));
		await deleteFooterLink(locals.db, id);
		await audit(locals.db, me.id, 'footer_link_deleted', 'footer_link', id);
		return { section: 'links', saved: true };
	}
};
