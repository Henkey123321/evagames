import { and, asc, desc, eq, inArray, isNull, max, min, ne } from 'drizzle-orm';
import type { Db } from './db';
import { gamePresets, plays, type GamePreset } from './db/schema';
import { getManifest } from '$lib/games/registry';
import type { FinishResponse } from '$lib/games/sdk/types';
import { isStaff, type SessionUser } from './auth';
import { logActivity } from './activity';
import { evaluateProgress, type ProgressOutcome } from './rewards';

/** Who is playing: a signed-in user or an anonymous guest cookie. */
export type Player = { userId: string; guestId?: string } | { userId?: undefined; guestId: string };

export async function getPresetBySlug(db: Db, slug: string) {
	return db.select().from(gamePresets).where(eq(gamePresets.slug, slug)).get();
}

/** Presets shown on the hub, in order. */
export async function listHubPresets(db: Db) {
	return db
		.select()
		.from(gamePresets)
		.where(
			and(ne(gamePresets.hubState, 'off'), inArray(gamePresets.visibility, ['public', 'members']))
		)
		.orderBy(asc(gamePresets.hubOrder), asc(gamePresets.createdAt));
}

export type Access =
	{ ok: true } | { ok: false; reason: 'login' | 'hidden' | 'coming_soon' | 'unknown_type' };

/** `unlocked`: the fan has this (hidden) preset through a reward or an assignment. */
export function presetAccess(
	preset: GamePreset,
	user: SessionUser | null,
	opts: { unlocked?: boolean } = {}
): Access {
	if (!getManifest(preset.type)) return { ok: false, reason: 'unknown_type' };
	if (isStaff(user)) return { ok: true }; // staff can preview anything
	if (preset.hubState === 'coming_soon') return { ok: false, reason: 'coming_soon' };
	// Hidden presets become reachable through assignments (Phase 3).
	if (preset.visibility === 'hidden' && !opts.unlocked) return { ok: false, reason: 'hidden' };
	if (preset.visibility === 'members' && !user) return { ok: false, reason: 'login' };
	return { ok: true };
}

/** Preset config merged with the plugin's defaults. Throws if the stored config is invalid. */
export function resolveConfig(preset: GamePreset) {
	const manifest = getManifest(preset.type);
	if (!manifest) throw new Error(`Unknown game type ${preset.type}`);
	return manifest.configSchema.parse(preset.config ?? {});
}

export async function startPlay(db: Db, preset: GamePreset, player: Player) {
	const row = await db
		.insert(plays)
		.values({
			presetId: preset.id,
			userId: player.userId ?? null,
			guestId: player.guestId ?? null,
			startedAt: new Date()
		})
		.returning({ id: plays.id })
		.get();
	return row.id;
}

const ownedBy = (player: Player) =>
	player.userId
		? eq(plays.userId, player.userId)
		: and(eq(plays.guestId, player.guestId!), isNull(plays.userId));

export type FinishError = 'not_found' | 'already_finished' | 'invalid_result';

export async function finishPlay(
	db: Db,
	playId: string,
	player: Player,
	rawResult: unknown
): Promise<
	{ ok: true; response: FinishResponse } | { ok: false; error: FinishError; detail?: string }
> {
	const row = await db
		.select({ play: plays, preset: gamePresets })
		.from(plays)
		.innerJoin(gamePresets, eq(plays.presetId, gamePresets.id))
		.where(and(eq(plays.id, playId), ownedBy(player)))
		.get();
	if (!row) return { ok: false, error: 'not_found' };
	const { play, preset } = row;
	if (play.status !== 'started') return { ok: false, error: 'already_finished' };

	const manifest = getManifest(preset.type)!;
	const parsed = manifest.resultSchema.safeParse(rawResult);
	if (!parsed.success)
		return { ok: false, error: 'invalid_result', detail: parsed.error.issues[0]?.message };

	const config = resolveConfig(preset);
	const result = parsed.data;
	const finishedAt = new Date();
	const durationMs = finishedAt.getTime() - play.startedAt.getTime();
	const outcome = manifest.verify(config, result, { durationMs });
	const completed = outcome.verification !== 'rejected' && manifest.isComplete(config, result);
	const score = Math.round(manifest.score(result));

	let personalBest: boolean | undefined;
	const ranks = outcome.verification !== 'rejected' && (completed || !manifest.rankCompletedOnly);
	if (player.userId && ranks) {
		const agg = manifest.scoreOrder === 'desc' ? max(plays.score) : min(plays.score);
		const previous = await db
			.select({ best: agg })
			.from(plays)
			.where(
				and(
					eq(plays.userId, player.userId),
					eq(plays.presetId, preset.id),
					eq(plays.status, 'finished'),
					ne(plays.verification, 'rejected'),
					manifest.rankCompletedOnly ? eq(plays.completed, true) : undefined
				)
			)
			.get();
		const best = previous?.best;
		personalBest = best == null || (manifest.scoreOrder === 'desc' ? score > best : score < best);
	}

	const updated = await db
		.update(plays)
		.set({
			status: 'finished',
			finishedAt,
			durationMs,
			result: result as Record<string, unknown>,
			score,
			completed,
			verification: outcome.verification
		})
		.where(and(eq(plays.id, play.id), eq(plays.status, 'started')))
		.returning({ id: plays.id });
	if (updated.length === 0) return { ok: false, error: 'already_finished' };

	let progress: ProgressOutcome | undefined;
	if (player.userId && outcome.verification !== 'rejected') {
		await logActivity(db, player.userId, completed ? 'completed' : 'played', {
			presetId: preset.id,
			presetTitle: preset.title,
			score
		});
		if (completed) {
			progress = await evaluateProgress(db, player.userId, { completedPresetId: preset.id });
		}
	}

	return {
		ok: true,
		response: {
			completed,
			verification: outcome.verification,
			score,
			personalBest,
			pointsAwarded: progress?.pointsAwarded || undefined,
			badges: progress?.badges.length ? progress.badges : undefined,
			rewards: progress?.rewards.length ? progress.rewards : undefined
		}
	};
}

/** A signed-in player's most recent finished rounds (for their profile). */
export async function recentPlays(db: Db, userId: string, limit = 20) {
	return db
		.select({
			id: plays.id,
			presetTitle: gamePresets.title,
			presetSlug: gamePresets.slug,
			score: plays.score,
			completed: plays.completed,
			finishedAt: plays.finishedAt
		})
		.from(plays)
		.innerJoin(gamePresets, eq(plays.presetId, gamePresets.id))
		.where(
			and(
				eq(plays.userId, userId),
				eq(plays.status, 'finished'),
				ne(plays.verification, 'rejected')
			)
		)
		.orderBy(desc(plays.finishedAt))
		.limit(limit);
}
