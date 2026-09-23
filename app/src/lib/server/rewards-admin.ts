import { and, asc, count, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { Db } from './db';
import {
	badges,
	gamePresets,
	rewardTriggers,
	rewards,
	userBadges,
	userRewards,
	users,
	type BadgeRule,
	type RewardContent,
	type RewardKind,
	type TriggerType,
	type UserRewardStatus
} from './db/schema';
import { logActivity } from './activity';
import { statusAfterApproval, VISIBLE_STATUSES } from './rewards';

/* ── Library ────────────────────────────────────────────────────────── */

export async function listRewards(db: Db) {
	const [rows, triggers, granted] = await Promise.all([
		db.select().from(rewards).where(isNull(rewards.archivedAt)).orderBy(desc(rewards.createdAt)),
		db
			.select({
				id: rewardTriggers.id,
				rewardId: rewardTriggers.rewardId,
				type: rewardTriggers.type,
				threshold: rewardTriggers.threshold,
				presetTitle: gamePresets.title,
				badgeName: badges.name
			})
			.from(rewardTriggers)
			.leftJoin(gamePresets, eq(rewardTriggers.presetId, gamePresets.id))
			.leftJoin(badges, eq(rewardTriggers.badgeId, badges.id)),
		db
			.select({ rewardId: userRewards.rewardId, n: count() })
			.from(userRewards)
			.groupBy(userRewards.rewardId)
	]);
	const grantedBy = new Map(granted.map((g) => [g.rewardId, g.n]));
	return rows.map((r) => ({
		...r,
		granted: grantedBy.get(r.id) ?? 0,
		triggers: triggers.filter((t) => t.rewardId === r.id)
	}));
}

export async function getReward(db: Db, id: string) {
	return db.select().from(rewards).where(eq(rewards.id, id)).get();
}

export async function saveReward(
	db: Db,
	id: string | null,
	input: {
		name: string;
		kind: RewardKind;
		message: string;
		content: RewardContent;
		requiresApproval: boolean;
	},
	createdBy: string
) {
	if (id) {
		await db.update(rewards).set(input).where(eq(rewards.id, id));
		return id;
	}
	const row = await db
		.insert(rewards)
		.values({ ...input, createdBy })
		.returning({ id: rewards.id })
		.get();
	return row.id;
}

export async function archiveReward(db: Db, id: string) {
	await db.update(rewards).set({ archivedAt: new Date() }).where(eq(rewards.id, id));
	await db.delete(rewardTriggers).where(eq(rewardTriggers.rewardId, id));
}

export async function addTrigger(
	db: Db,
	rewardId: string,
	input: {
		type: TriggerType;
		presetId?: string | null;
		threshold?: number | null;
		badgeId?: string | null;
	}
) {
	await db.insert(rewardTriggers).values({ rewardId, ...input });
}

export async function removeTrigger(db: Db, rewardId: string, triggerId: string) {
	await db
		.delete(rewardTriggers)
		.where(and(eq(rewardTriggers.id, triggerId), eq(rewardTriggers.rewardId, rewardId)));
}

/* ── Badges ─────────────────────────────────────────────────────────── */

export async function listBadges(db: Db) {
	const [rows, holders] = await Promise.all([
		db
			.select({
				id: badges.id,
				name: badges.name,
				description: badges.description,
				mark: badges.mark,
				rule: badges.rule,
				threshold: badges.threshold,
				presetId: badges.presetId,
				presetTitle: gamePresets.title
			})
			.from(badges)
			.leftJoin(gamePresets, eq(badges.presetId, gamePresets.id))
			.where(isNull(badges.archivedAt))
			.orderBy(asc(badges.createdAt)),
		db
			.select({ badgeId: userBadges.badgeId, n: count() })
			.from(userBadges)
			.groupBy(userBadges.badgeId)
	]);
	const byBadge = new Map(holders.map((h) => [h.badgeId, h.n]));
	return rows.map((b) => ({ ...b, holders: byBadge.get(b.id) ?? 0 }));
}

export async function saveBadge(
	db: Db,
	id: string | null,
	input: {
		name: string;
		description: string;
		mark: string;
		rule: BadgeRule;
		threshold: number | null;
		presetId: string | null;
	}
) {
	if (id) await db.update(badges).set(input).where(eq(badges.id, id));
	else await db.insert(badges).values(input);
}

export async function archiveBadge(db: Db, id: string) {
	await db.update(badges).set({ archivedAt: new Date() }).where(eq(badges.id, id));
}

/* ── Queue ──────────────────────────────────────────────────────────── */

export const QUEUE_STATUSES: UserRewardStatus[] = [
	'pending_approval',
	'submitted',
	'awaiting_fulfilment'
];

export async function rewardQueue(db: Db) {
	return db
		.select({
			id: userRewards.id,
			status: userRewards.status,
			proofText: userRewards.proofText,
			updatedAt: userRewards.updatedAt,
			createdAt: userRewards.createdAt,
			source: userRewards.source,
			userId: users.id,
			displayName: users.displayName,
			onlyfansHandle: users.onlyfansHandle,
			loyalfansHandle: users.loyalfansHandle,
			rewardName: rewards.name,
			kind: rewards.kind,
			content: rewards.content
		})
		.from(userRewards)
		.innerJoin(users, eq(userRewards.userId, users.id))
		.innerJoin(rewards, eq(userRewards.rewardId, rewards.id))
		.where(inArray(userRewards.status, QUEUE_STATUSES))
		.orderBy(asc(userRewards.updatedAt))
		.limit(200);
}

export async function queueCount(db: Db) {
	const row = await db
		.select({ n: count() })
		.from(userRewards)
		.where(inArray(userRewards.status, QUEUE_STATUSES))
		.get();
	return row?.n ?? 0;
}

export type QueueDecision =
	'approve' | 'decline' | 'fulfil' | 'accept_proof' | 'reject_proof' | 'mark_done';

/**
 * Moves a granted reward along. Returns the fan id and reward name so the caller can notify them,
 * or null when the transition isn't valid from the current status.
 */
export async function resolveUserReward(
	db: Db,
	id: string,
	decision: QueueDecision,
	staffId: string,
	reply?: string
) {
	const row = await db
		.select({ ur: userRewards, kind: rewards.kind, name: rewards.name })
		.from(userRewards)
		.innerJoin(rewards, eq(userRewards.rewardId, rewards.id))
		.where(eq(userRewards.id, id))
		.get();
	if (!row) return null;

	const from = row.ur.status;
	const next: Partial<Record<QueueDecision, [UserRewardStatus[], UserRewardStatus]>> = {
		approve: [['pending_approval'], statusAfterApproval(row.kind)],
		decline: [['pending_approval'], 'declined'],
		fulfil: [['awaiting_fulfilment'], 'done'],
		accept_proof: [['submitted'], 'done'],
		reject_proof: [['submitted'], 'unlocked'],
		mark_done: [['unlocked'], 'done']
	};
	const rule = next[decision];
	if (!rule || !rule[0].includes(from)) return null;

	await db
		.update(userRewards)
		.set({
			status: rule[1],
			staffReply: reply ?? row.ur.staffReply,
			resolvedBy: staffId,
			resolvedAt: new Date(),
			updatedAt: new Date()
		})
		.where(and(eq(userRewards.id, id), eq(userRewards.status, from)));
	return { userId: row.ur.userId, rewardName: row.name, status: rule[1] };
}

/* ── Fan side ───────────────────────────────────────────────────────── */

export async function vaultFor(db: Db, userId: string) {
	const rows = await db
		.select({
			id: userRewards.id,
			status: userRewards.status,
			proofText: userRewards.proofText,
			staffReply: userRewards.staffReply,
			createdAt: userRewards.createdAt,
			name: rewards.name,
			kind: rewards.kind,
			message: rewards.message,
			content: rewards.content,
			presetSlug: gamePresets.slug,
			presetTitle: gamePresets.title
		})
		.from(userRewards)
		.innerJoin(rewards, eq(userRewards.rewardId, rewards.id))
		.leftJoin(gamePresets, sql`${gamePresets.id} = json_extract(${rewards.content}, '$.presetId')`)
		.where(and(eq(userRewards.userId, userId), sql`${userRewards.status} != 'declined'`))
		.orderBy(desc(userRewards.createdAt));

	// Never send hidden content (codes, links, task text) before the reward is visible to the fan.
	return rows.map((r) => {
		const visible = VISIBLE_STATUSES.includes(r.status);
		const c = r.content ?? {};
		return {
			id: r.id,
			status: r.status,
			name: r.name,
			kind: r.kind,
			createdAt: r.createdAt,
			message: visible ? r.message : '',
			staffReply: r.staffReply,
			proofText: r.proofText,
			url: visible ? (c.url ?? null) : null,
			code: visible ? (c.code ?? null) : null,
			instructions: visible ? (c.instructions ?? null) : null,
			proof: c.proof ?? 'none',
			game: visible && r.presetSlug ? { slug: r.presetSlug, title: r.presetTitle } : null
		};
	});
}

export async function badgesFor(db: Db, userId: string) {
	return db
		.select({
			id: badges.id,
			name: badges.name,
			description: badges.description,
			mark: badges.mark,
			awardedAt: userBadges.awardedAt
		})
		.from(userBadges)
		.innerJoin(badges, eq(userBadges.badgeId, badges.id))
		.where(eq(userBadges.userId, userId))
		.orderBy(desc(userBadges.awardedAt));
}

/** Fan sends task proof. Only valid for their own unlocked task that asks for text proof. */
export async function submitProof(db: Db, userId: string, userRewardId: string, text: string) {
	const row = await db
		.select({ ur: userRewards, name: rewards.name, kind: rewards.kind, content: rewards.content })
		.from(userRewards)
		.innerJoin(rewards, eq(userRewards.rewardId, rewards.id))
		.where(and(eq(userRewards.id, userRewardId), eq(userRewards.userId, userId)))
		.get();
	if (!row || row.kind !== 'task' || row.ur.status !== 'unlocked') return false;
	if (!['text', 'text_image'].includes(row.content?.proof ?? 'none')) return false;
	await db
		.update(userRewards)
		.set({ status: 'submitted', proofText: text, updatedAt: new Date() })
		.where(eq(userRewards.id, userRewardId));
	await logActivity(db, userId, 'proof_submitted', { rewardName: row.name });
	return true;
}

/** Everything granted to one fan, for their EMS person page. */
export async function rewardsForPerson(db: Db, userId: string) {
	return db
		.select({
			id: userRewards.id,
			status: userRewards.status,
			name: rewards.name,
			kind: rewards.kind,
			proofText: userRewards.proofText,
			createdAt: userRewards.createdAt
		})
		.from(userRewards)
		.innerJoin(rewards, eq(userRewards.rewardId, rewards.id))
		.where(eq(userRewards.userId, userId))
		.orderBy(desc(userRewards.createdAt));
}
