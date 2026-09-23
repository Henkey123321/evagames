import { asc, count, eq } from 'drizzle-orm';
import type { Db } from './db';
import { gamePresets, plays, type GamePreset, type HubState, type Visibility } from './db/schema';
import { getManifest } from '$lib/games/registry';

/** Artwork that ships with the site. Uploads arrive with the media library. */
export const ART_OPTIONS = [
	{ value: '/brand/body-left.png', label: 'Hub, left figure' },
	{ value: '/brand/body-right.png', label: 'Hub, right figure' },
	{ value: '/games/2048/body-left.png', label: '2048, left figure' },
	{ value: '/games/2048/body-right.png', label: '2048, right figure' },
	{ value: '/games/memory/body-left.png', label: 'Memory, left figure' },
	{ value: '/games/memory/body-right.png', label: 'Memory, right figure' }
];

export function slugify(text: string) {
	return (
		text
			.toLowerCase()
			.normalize('NFKD')
			.replace(/[̀-ͯ]/g, '')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 48) || 'game'
	);
}

async function uniqueSlug(db: Db, base: string, exceptId?: string) {
	let slug = slugify(base);
	for (let n = 2; n < 100; n += 1) {
		const taken = await db
			.select({ id: gamePresets.id })
			.from(gamePresets)
			.where(eq(gamePresets.slug, slug))
			.get();
		if (!taken || taken.id === exceptId) return slug;
		slug = `${slugify(base).slice(0, 44)}-${n}`;
	}
	return `${slugify(base).slice(0, 40)}-${crypto.randomUUID().slice(0, 6)}`;
}

export async function listPresets(db: Db) {
	const [rows, counts] = await Promise.all([
		db.select().from(gamePresets).orderBy(asc(gamePresets.hubOrder), asc(gamePresets.title)),
		db
			.select({ presetId: plays.presetId, n: count() })
			.from(plays)
			.where(eq(plays.status, 'finished'))
			.groupBy(plays.presetId)
	]);
	const played = new Map(counts.map((c) => [c.presetId, c.n]));
	return rows.map((p) => ({
		...p,
		typeName: getManifest(p.type)?.name ?? p.type,
		plays: played.get(p.id) ?? 0
	}));
}

export async function createPreset(db: Db, type: string, title: string, createdBy: string) {
	const manifest = getManifest(type);
	if (!manifest) throw new Error(`Unknown game type ${type}`);
	const art = type === '2048' || type === 'memory' ? `/games/${type}` : '/brand';
	const row = await db
		.insert(gamePresets)
		.values({
			type,
			title,
			slug: await uniqueSlug(db, title),
			instructions: manifest.description,
			config: {},
			// New games start hidden so Eva can finish them before fans see them.
			visibility: 'hidden',
			hubState: 'off',
			hubOrder: 99,
			artLeft: `${art}/body-left.png`,
			artRight: `${art}/body-right.png`,
			createdBy
		})
		.returning({ id: gamePresets.id })
		.get();
	return row.id;
}

export async function duplicatePreset(db: Db, source: GamePreset, createdBy: string) {
	const { id: _id, slug: _slug, createdAt: _c, updatedAt: _u, ...rest } = source;
	const title = `${source.title} (copy)`;
	const row = await db
		.insert(gamePresets)
		.values({
			...rest,
			title,
			slug: await uniqueSlug(db, title),
			visibility: 'hidden',
			hubState: 'off',
			createdBy
		})
		.returning({ id: gamePresets.id })
		.get();
	return row.id;
}

export interface PresetUpdate {
	title: string;
	slug: string;
	instructions: string;
	visibility: Visibility;
	hubState: HubState;
	hubLabel: string;
	pointsOnComplete: number;
	leaderboardEnabled: boolean;
	artLeft: string | null;
	artRight: string | null;
	config: Record<string, unknown>;
}

/** Returns an error message, or null on success. */
export async function updatePreset(db: Db, id: string, input: PresetUpdate) {
	const slug = slugify(input.slug || input.title);
	const clash = await db
		.select({ id: gamePresets.id })
		.from(gamePresets)
		.where(eq(gamePresets.slug, slug))
		.get();
	if (clash && clash.id !== id) return 'Another game already uses that web address';
	await db
		.update(gamePresets)
		.set({ ...input, slug, updatedAt: new Date() })
		.where(eq(gamePresets.id, id));
	return null;
}

/** Deleting would erase fans' history, so games that have been played can only be hidden. */
export async function deletePreset(db: Db, id: string) {
	const played = await db.select({ n: count() }).from(plays).where(eq(plays.presetId, id)).get();
	if ((played?.n ?? 0) > 0) return false;
	await db.delete(gamePresets).where(eq(gamePresets.id, id));
	return true;
}
