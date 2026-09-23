import { asc, eq } from 'drizzle-orm';
import type { Db } from './db';
import {
	footerLinks,
	gamePresets,
	siteSettings,
	type HubState,
	type Visibility
} from './db/schema';

/** Typed site settings with defaults; stored as JSON rows in `site_settings`. */
export interface SiteSettings {
	hubComingSoonTitle: string;
	hubComingSoonLabel: string;
	hubArtLeft: string;
	hubArtRight: string;
	mainSiteUrl: string;
}

const DEFAULTS: SiteSettings = {
	hubComingSoonTitle: 'More coming soon',
	hubComingSoonLabel: 'Coming Soon',
	hubArtLeft: '/brand/body-left.png',
	hubArtRight: '/brand/body-right.png',
	mainSiteUrl: 'https://evadevil.com/'
};

export async function getSettings(db: Db): Promise<SiteSettings> {
	const rows = await db.select().from(siteSettings);
	const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
	return { ...DEFAULTS, ...stored } as SiteSettings;
}

export async function setSetting<K extends keyof SiteSettings>(
	db: Db,
	key: K,
	value: SiteSettings[K]
) {
	await db
		.insert(siteSettings)
		.values({ key, value, updatedAt: new Date() })
		.onConflictDoUpdate({ target: siteSettings.key, set: { value, updatedAt: new Date() } });
}

export async function getFooterLinks(db: Db) {
	const rows = await db.select().from(footerLinks).orderBy(asc(footerLinks.sortOrder));
	return {
		store: rows.filter((l) => l.group === 'store'),
		social: rows.filter((l) => l.group === 'social')
	};
}

export async function updateSettings(db: Db, values: Partial<SiteSettings>) {
	for (const [key, value] of Object.entries(values)) {
		await setSetting(db, key as keyof SiteSettings, value as string);
	}
}

export interface FooterLinkInput {
	label: string;
	url: string;
	icon: string;
	group: 'store' | 'social';
	sortOrder: number;
	/** Layout tweak for particular icons (e.g. the wide IWantClips logo). */
	extraClass: string;
}

export async function saveFooterLink(db: Db, id: string | null, input: FooterLinkInput) {
	if (id) await db.update(footerLinks).set(input).where(eq(footerLinks.id, id));
	else await db.insert(footerLinks).values(input);
}

export async function deleteFooterLink(db: Db, id: string) {
	await db.delete(footerLinks).where(eq(footerLinks.id, id));
}

/** Hub placement of existing games; full game editing arrives with the preset editor. */
export async function listHubGames(db: Db) {
	return db
		.select({
			id: gamePresets.id,
			slug: gamePresets.slug,
			title: gamePresets.title,
			type: gamePresets.type,
			visibility: gamePresets.visibility,
			hubState: gamePresets.hubState,
			hubOrder: gamePresets.hubOrder,
			hubLabel: gamePresets.hubLabel,
			pointsOnComplete: gamePresets.pointsOnComplete,
			leaderboardEnabled: gamePresets.leaderboardEnabled
		})
		.from(gamePresets)
		.orderBy(asc(gamePresets.hubOrder), asc(gamePresets.createdAt));
}

export async function updateHubGame(
	db: Db,
	id: string,
	input: {
		hubState: HubState;
		visibility: Visibility;
		hubLabel: string;
		hubOrder: number;
		pointsOnComplete: number;
		leaderboardEnabled: boolean;
	}
) {
	await db
		.update(gamePresets)
		.set({ ...input, updatedAt: new Date() })
		.where(eq(gamePresets.id, id));
}
