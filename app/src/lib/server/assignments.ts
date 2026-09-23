import { and, count, desc, eq, inArray, isNull } from 'drizzle-orm';
import type { Db } from './db';
import {
	assignmentRecipients,
	assignments,
	gamePresets,
	rewards,
	users,
	type Assignment,
	type AssignmentTarget,
	type GamePreset,
	type RecipientStatus
} from './db/schema';
import { getManifest } from '$lib/games/registry';
import { describeTarget } from '$lib/games/sdk/editor';
import { broadcast } from './messages';

/** What a fan sees: 'expired' is derived from the deadline, never stored. */
export type EffectiveStatus = RecipientStatus | 'expired';

export function effectiveStatus(
	status: RecipientStatus,
	a: Pick<Assignment, 'deadline' | 'cancelledAt'>,
	now = Date.now()
): EffectiveStatus {
	if (a.cancelledAt && (status === 'sent' || status === 'in_progress')) return 'cancelled';
	if (
		a.deadline &&
		a.deadline.getTime() <= now &&
		(status === 'sent' || status === 'in_progress')
	) {
		return 'expired';
	}
	return status;
}

/** Preset config with the assignment's overrides applied, validated by the plugin. */
export function assignmentConfig(preset: GamePreset, a: Pick<Assignment, 'configOverrides'>) {
	const manifest = getManifest(preset.type);
	if (!manifest) throw new Error(`Unknown game type ${preset.type}`);
	return manifest.configSchema.parse({ ...(preset.config ?? {}), ...(a.configOverrides ?? {}) });
}

export function targetLines(presetType: string, targets: AssignmentTarget[]) {
	const manifest = getManifest(presetType);
	return manifest ? targets.map((t) => describeTarget(manifest.targets, t)).filter(Boolean) : [];
}

/* ── Sending ────────────────────────────────────────────────────────── */

export interface NewAssignment {
	presetId: string;
	title: string;
	message: string;
	configOverrides: Record<string, unknown>;
	targets: AssignmentTarget[];
	deadline: Date | null;
	maxAttempts: number | null;
	points: number;
	rewardId: string | null;
	createdBy: string;
	userIds: string[];
	listId: string | null;
}

/**
 * Creates the assignment, adds recipients (individual fans and/or a whole list), and posts
 * a message with the play link into each recipient's conversation. Returns the recipient count.
 */
export async function sendAssignment(db: Db, input: NewAssignment, presetSlug: string) {
	const { userIds, listId, ...fields } = input;
	const a = await db.insert(assignments).values(fields).returning({ id: assignments.id }).get();

	// D1 allows at most 100 bound parameters per statement, so handle individual fans in chunks.
	const ids = [...new Set(userIds)].slice(0, 400);
	for (let i = 0; i < ids.length; i += 40) {
		const players = await db
			.select({ id: users.id })
			.from(users)
			.where(
				and(
					inArray(users.id, ids.slice(i, i + 40)),
					eq(users.role, 'player'),
					isNull(users.disabledAt)
				)
			);
		if (players.length === 0) continue;
		await db
			.insert(assignmentRecipients)
			.values(players.map((p) => ({ assignmentId: a.id, userId: p.id })))
			.onConflictDoNothing();
	}
	if (listId) {
		await db.$client
			.prepare(
				`INSERT OR IGNORE INTO assignment_recipients (assignment_id, user_id)
				 SELECT ?, lm.user_id FROM list_members lm JOIN users u ON u.id = lm.user_id
				 WHERE lm.list_id = ? AND u.role = 'player' AND u.disabled_at IS NULL`
			)
			.bind(a.id, listId)
			.run();
	}

	const lines = [`I sent you a game: ${input.title}.`];
	if (input.message) lines.push(input.message);
	lines.push(`Play it here: /play/${presetSlug}?a=${a.id}`);
	const recipients = await broadcast(db, {
		staffId: input.createdBy,
		body: lines.join('\n\n'),
		target: { assignmentId: a.id, label: `Sent game: ${input.title}` }
	});
	return { id: a.id, recipients };
}

/* ── Playing ────────────────────────────────────────────────────────── */

/** The assignment as seen by one fan, or null if they weren't sent it. */
export async function assignmentForFan(db: Db, assignmentId: string, userId: string) {
	const row = await db
		.select({ a: assignments, r: assignmentRecipients, preset: gamePresets })
		.from(assignmentRecipients)
		.innerJoin(assignments, eq(assignmentRecipients.assignmentId, assignments.id))
		.innerJoin(gamePresets, eq(assignments.presetId, gamePresets.id))
		.where(
			and(
				eq(assignmentRecipients.assignmentId, assignmentId),
				eq(assignmentRecipients.userId, userId)
			)
		)
		.get();
	if (!row) return null;
	const status = effectiveStatus(row.r.status, row.a);
	const attemptsLeft =
		row.a.maxAttempts === null ? null : Math.max(0, row.a.maxAttempts - row.r.attemptsUsed);
	const playable = (status === 'sent' || status === 'in_progress') && attemptsLeft !== 0;
	return { ...row, status, attemptsLeft, playable };
}

/**
 * Uses up one attempt, atomically. Returns false when there is nothing left to play
 * (no attempts, past the deadline, cancelled, already finished).
 */
export async function startAssignmentAttempt(db: Db, assignmentId: string, userId: string) {
	const now = Date.now();
	const result = await db.$client
		.prepare(
			`UPDATE assignment_recipients
			 SET attempts_used = attempts_used + 1, status = 'in_progress', updated_at = ?
			 WHERE assignment_id = ? AND user_id = ? AND status IN ('sent', 'in_progress')
			   AND EXISTS (
			     SELECT 1 FROM assignments a WHERE a.id = assignment_recipients.assignment_id
			       AND a.cancelled_at IS NULL
			       AND (a.deadline IS NULL OR a.deadline > ?)
			       AND (a.max_attempts IS NULL OR assignment_recipients.attempts_used < a.max_attempts)
			   )`
		)
		.bind(now, assignmentId, userId, now)
		.run();
	return (result.meta.changes ?? 0) > 0;
}

/** Records a finished attempt. Returns the new status. */
export async function recordAssignmentResult(
	db: Db,
	a: Assignment,
	userId: string,
	outcome: { completed: boolean; score: number; betterScore: (prev: number | null) => boolean }
): Promise<RecipientStatus> {
	const r = await db
		.select()
		.from(assignmentRecipients)
		.where(
			and(eq(assignmentRecipients.assignmentId, a.id), eq(assignmentRecipients.userId, userId))
		)
		.get();
	if (!r || r.status !== 'in_progress') return r?.status ?? 'sent';

	const outOfAttempts = a.maxAttempts !== null && r.attemptsUsed >= a.maxAttempts;
	const status: RecipientStatus = outcome.completed
		? 'completed'
		: outOfAttempts
			? 'failed'
			: 'in_progress';
	await db
		.update(assignmentRecipients)
		.set({
			status,
			bestScore: outcome.betterScore(r.bestScore) ? outcome.score : r.bestScore,
			completedAt: outcome.completed ? new Date() : null,
			updatedAt: new Date()
		})
		.where(
			and(
				eq(assignmentRecipients.assignmentId, a.id),
				eq(assignmentRecipients.userId, userId),
				eq(assignmentRecipients.status, 'in_progress')
			)
		);
	return status;
}

/** Games Eva sent that this fan can still play, newest first. */
export async function activeForFan(db: Db, userId: string) {
	const rows = await db
		.select({
			a: assignments,
			r: assignmentRecipients,
			slug: gamePresets.slug,
			type: gamePresets.type
		})
		.from(assignmentRecipients)
		.innerJoin(assignments, eq(assignmentRecipients.assignmentId, assignments.id))
		.innerJoin(gamePresets, eq(assignments.presetId, gamePresets.id))
		.where(
			and(
				eq(assignmentRecipients.userId, userId),
				inArray(assignmentRecipients.status, ['sent', 'in_progress']),
				isNull(assignments.cancelledAt)
			)
		)
		.orderBy(desc(assignments.createdAt))
		.limit(12);
	return rows
		.filter((row) => effectiveStatus(row.r.status, row.a) !== 'expired')
		.map((row) => ({
			id: row.a.id,
			title: row.a.title,
			message: row.a.message,
			slug: row.slug,
			deadline: row.a.deadline,
			attemptsLeft:
				row.a.maxAttempts === null ? null : Math.max(0, row.a.maxAttempts - row.r.attemptsUsed),
			targets: targetLines(row.type, row.a.targets),
			started: row.r.status === 'in_progress'
		}))
		.filter((row) => row.attemptsLeft !== 0);
}

/* ── EMS ────────────────────────────────────────────────────────────── */

export async function listAssignments(db: Db, limit = 100) {
	const [rows, counts] = await Promise.all([
		db
			.select({
				a: assignments,
				presetTitle: gamePresets.title,
				rewardName: rewards.name,
				authorName: users.displayName
			})
			.from(assignments)
			.innerJoin(gamePresets, eq(assignments.presetId, gamePresets.id))
			.leftJoin(rewards, eq(assignments.rewardId, rewards.id))
			.leftJoin(users, eq(assignments.createdBy, users.id))
			.orderBy(desc(assignments.createdAt))
			.limit(limit),
		db
			.select({
				id: assignmentRecipients.assignmentId,
				status: assignmentRecipients.status,
				n: count()
			})
			.from(assignmentRecipients)
			.groupBy(assignmentRecipients.assignmentId, assignmentRecipients.status)
	]);
	return rows.map((row) => {
		const mine = counts.filter((c) => c.id === row.a.id);
		const by = (s: RecipientStatus) => mine.find((c) => c.status === s)?.n ?? 0;
		const total = mine.reduce((n, c) => n + c.n, 0);
		return {
			...row.a,
			presetTitle: row.presetTitle,
			rewardName: row.rewardName,
			authorName: row.authorName,
			total,
			completed: by('completed'),
			failed: by('failed'),
			playing: by('in_progress'),
			waiting: by('sent')
		};
	});
}

export async function assignmentDetail(db: Db, id: string) {
	const row = await db
		.select({ a: assignments, preset: gamePresets, rewardName: rewards.name })
		.from(assignments)
		.innerJoin(gamePresets, eq(assignments.presetId, gamePresets.id))
		.leftJoin(rewards, eq(assignments.rewardId, rewards.id))
		.where(eq(assignments.id, id))
		.get();
	if (!row) return null;
	const recipients = await db
		.select({
			userId: users.id,
			displayName: users.displayName,
			status: assignmentRecipients.status,
			attemptsUsed: assignmentRecipients.attemptsUsed,
			bestScore: assignmentRecipients.bestScore,
			completedAt: assignmentRecipients.completedAt,
			updatedAt: assignmentRecipients.updatedAt
		})
		.from(assignmentRecipients)
		.innerJoin(users, eq(assignmentRecipients.userId, users.id))
		.where(eq(assignmentRecipients.assignmentId, id))
		.orderBy(desc(assignmentRecipients.updatedAt));
	const manifest = getManifest(row.preset.type);
	return {
		...row,
		targets: targetLines(row.preset.type, row.a.targets),
		recipients: recipients.map((r) => ({
			...r,
			status: effectiveStatus(r.status, row.a),
			best:
				r.bestScore === null
					? null
					: manifest?.formatScore
						? manifest.formatScore(r.bestScore)
						: String(r.bestScore)
		}))
	};
}

export async function cancelAssignment(db: Db, id: string) {
	await db.batch([
		db.update(assignments).set({ cancelledAt: new Date() }).where(eq(assignments.id, id)),
		db
			.update(assignmentRecipients)
			.set({ status: 'cancelled', updatedAt: new Date() })
			.where(
				and(
					eq(assignmentRecipients.assignmentId, id),
					inArray(assignmentRecipients.status, ['sent', 'in_progress'])
				)
			)
	]);
}

export async function setDeadline(db: Db, id: string, deadline: Date | null) {
	await db
		.update(assignments)
		.set({ deadline })
		.where(and(eq(assignments.id, id), isNull(assignments.cancelledAt)));
}

/** Assignments of one fan, for the person page. */
export async function assignmentsForPerson(db: Db, userId: string) {
	const rows = await db
		.select({ a: assignments, r: assignmentRecipients })
		.from(assignmentRecipients)
		.innerJoin(assignments, eq(assignmentRecipients.assignmentId, assignments.id))
		.where(eq(assignmentRecipients.userId, userId))
		.orderBy(desc(assignments.createdAt))
		.limit(20);
	return rows.map((row) => ({
		id: row.a.id,
		title: row.a.title,
		status: effectiveStatus(row.r.status, row.a),
		attemptsUsed: row.r.attemptsUsed,
		createdAt: row.a.createdAt
	}));
}
