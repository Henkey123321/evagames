import { asc } from 'drizzle-orm';
import type { Db } from './db';
import { footerLinks, siteSettings } from './db/schema';

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
