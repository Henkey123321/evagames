import { and, count, desc, eq, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import type { Db } from './db';
import {
	badges,
	gamePresets,
	plays,
	pointsLedger,
	rewardTriggers,
	rewards,
	userBadges,
	userRewards,
	users,
	type Reward,
	type UserRewardStatus
} from './db/schema';
import { logActivity } from './activity';

/* ── Points ─────────────────────────────────────────────────────────── */

/**
 * Adds a ledger entry and bumps the cached total. With a `ref`, the same (reason, ref) is only
 * ever awarded once per fan. Returns false when it was already awarded.
 */
export async function awardPoints(
	db: Db,
	input: {
		userId: string;
		delta: number;
		reason: string;
		ref?: string | null;
		note?: string;
		createdBy?: string;
	}
) {
	if (!input.delta) return false;
	const row = await db
		.insert(pointsLedger)
		.values({
			userId: input.userId,
			delta: input.delta,
			reason: input.reason,
			ref: input.ref ?? null,
			note: input.note ?? null,
			createdBy: input.createdBy ?? null
		})
		.onConflictDoNothing()
		.returning({ id: pointsLedger.id })
		.get();
	if (!row) return false;
	await db
		.update(users)
		.set({ points: sql`max(0, ${users.points} + ${input.delta})` })
		.where(eq(users.id, input.userId));
	return true;
}

export async function pointsHistory(db: Db, userId: string, limit = 20) {
	return db
		.select({
			id: pointsLedger.id,
			delta: pointsLedger.delta,
			reason: pointsLedger.reason,
			note: pointsLedger.note,
			createdAt: pointsLedger.createdAt
		})
		.from(pointsLedger)
		.where(eq(pointsLedger.userId, userId))
		.orderBy(desc(pointsLedger.createdAt))
		.limit(limit);
}

/* ── Rewards ────────────────────────────────────────────────────────── */

/** Where a reward starts once granted (after approval, if it needs one). */
export function statusAfterApproval(kind: Reward['kind']): UserRewardStatus {
	return kind === 'manual' ? 'awaiting_fulfilment' : 'unlocked';
}

/** Statuses in which the fan can see the reward's content. */
export const VISIBLE_STATUSES: UserRewardStatus[] = [
	'unlocked',
	'awaiting_fulfilment',
	'submitted',
	'done'
];

/**
 * Grants a reward. `source` makes it idempotent: the same trigger/assignment never grants twice.
 * Returns the reward if newly granted.
 */
export async function grantReward(
	db: Db,
	input: {
		userId: string;
		rewardId: string;
		source: string;
		grantedBy?: string;
		skipApproval?: boolean;
	}
) {
	const reward = await db
		.select()
		.from(rewards)
		.where(and(eq(rewards.id, input.rewardId), isNull(rewards.archivedAt)))
		.get();
	if (!reward) return null;
	const status: UserRewardStatus =
		reward.requiresApproval && !input.skipApproval
			? 'pending_approval'
			: statusAfterApproval(reward.kind);
	const row = await db
		.insert(userRewards)
		.values({
			userId: input.userId,
			rewardId: reward.id,
			status,
			source: input.source,
			grantedBy: input.grantedBy ?? null
		})
		.onConflictDoNothing()
		.returning({ id: userRewards.id })
		.get();
	if (!row) return null;
	await logActivity(db, input.userId, 'reward_unlocked', {
		rewardName: reward.name,
		pending: status === 'pending_approval'
	});
	return { ...reward, status };
}

/* ── Badges ─────────────────────────────────────────────────────────── */

export async function awardBadge(db: Db, userId: string, badgeId: string, awardedBy?: string) {
	const row = await db
		.insert(userBadges)
		.values({ userId, badgeId, awardedBy: awardedBy ?? null })
		.onConflictDoNothing()
		.returning({ badgeId: userBadges.badgeId })
		.get();
	if (!row) return null;
	const badge = await db.select().from(badges).where(eq(badges.id, badgeId)).get();
	if (badge) await logActivity(db, userId, 'badge_earned', { badgeName: badge.name });
	return badge ?? null;
}

/* ── Progress evaluation ────────────────────────────────────────────── */

export interface ProgressOutcome {
	pointsAwarded: number;
	badges: string[];
	rewards: { name: string; pending: boolean }[];
}

/**
 * Called after a fan completes a preset (outside assignments) or gains points.
 * Awards first-completion points, automatic badges, and reward triggers, in that order,
 * so a badge or points threshold reached by this completion also fires its rewards.
 */
export async function evaluateProgress(
	db: Db,
	userId: string,
	event: { completedPresetId?: string } = {}
): Promise<ProgressOutcome> {
	const outcome: ProgressOutcome = { pointsAwarded: 0, badges: [], rewards: [] };

	if (event.completedPresetId) {
		const preset = await db
			.select({ points: gamePresets.pointsOnComplete, title: gamePresets.title })
			.from(gamePresets)
			.where(eq(gamePresets.id, event.completedPresetId))
			.get();
		if (preset && preset.points > 0) {
			const awarded = await awardPoints(db, {
				userId,
				delta: preset.points,
				reason: 'first_completion',
				ref: event.completedPresetId,
				note: `First time completing ${preset.title}`
			});
			if (awarded) outcome.pointsAwarded = preset.points;
		}
	}

	const [user, completions, earned, activeBadges] = await Promise.all([
		db.select({ points: users.points }).from(users).where(eq(users.id, userId)).get(),
		db
			.select({ n: count() })
			.from(plays)
			.where(and(eq(plays.userId, userId), eq(plays.completed, true)))
			.get(),
		db.select({ id: userBadges.badgeId }).from(userBadges).where(eq(userBadges.userId, userId)),
		db
			.select()
			.from(badges)
			.where(
				and(
					isNull(badges.archivedAt),
					inArray(badges.rule, ['completions', 'points', 'completed_preset'])
				)
			)
	]);
	const points = user?.points ?? 0;
	const have = new Set(earned.map((b) => b.id));

	const completedPresetIds = new Set<string>();
	if (activeBadges.some((b) => b.rule === 'completed_preset')) {
		const rows = await db
			.selectDistinct({ presetId: plays.presetId })
			.from(plays)
			.where(and(eq(plays.userId, userId), eq(plays.completed, true)));
		rows.forEach((r) => completedPresetIds.add(r.presetId));
	}

	const newBadgeIds: string[] = [];
	for (const badge of activeBadges) {
		if (have.has(badge.id)) continue;
		const qualifies =
			(badge.rule === 'completions' && (completions?.n ?? 0) >= (badge.threshold ?? Infinity)) ||
			(badge.rule === 'points' && points >= (badge.threshold ?? Infinity)) ||
			(badge.rule === 'completed_preset' &&
				!!badge.presetId &&
				completedPresetIds.has(badge.presetId));
		if (!qualifies) continue;
		const awarded = await awardBadge(db, userId, badge.id);
		if (awarded) {
			outcome.badges.push(awarded.name);
			newBadgeIds.push(awarded.id);
		}
	}

	// Triggers that could fire now. The unique (user, reward, source) index keeps each to once.
	const conditions = [
		and(eq(rewardTriggers.type, 'points_reached'), lte(rewardTriggers.threshold, points))
	];
	if (event.completedPresetId) {
		conditions.push(
			and(
				eq(rewardTriggers.type, 'preset_completed'),
				eq(rewardTriggers.presetId, event.completedPresetId)
			)
		);
	}
	if (newBadgeIds.length) {
		conditions.push(
			and(eq(rewardTriggers.type, 'badge_earned'), inArray(rewardTriggers.badgeId, newBadgeIds))
		);
	}
	const triggers = await db
		.select({ id: rewardTriggers.id, rewardId: rewardTriggers.rewardId })
		.from(rewardTriggers)
		.where(or(...conditions));

	for (const t of triggers) {
		const granted = await grantReward(db, {
			userId,
			rewardId: t.rewardId,
			source: `trigger:${t.id}`
		});
		if (granted)
			outcome.rewards.push({ name: granted.name, pending: granted.status === 'pending_approval' });
	}

	return outcome;
}

/** A fan has unlocked access to a (hidden) preset through a 'game' reward. */
export async function hasGameUnlock(db: Db, userId: string, presetId: string) {
	const row = await db
		.select({ id: userRewards.id })
		.from(userRewards)
		.innerJoin(rewards, eq(userRewards.rewardId, rewards.id))
		.where(
			and(
				eq(userRewards.userId, userId),
				eq(rewards.kind, 'game'),
				sql`json_extract(${rewards.content}, '$.presetId') = ${presetId}`,
				inArray(userRewards.status, VISIBLE_STATUSES)
			)
		)
		.get();
	return !!row;
}
