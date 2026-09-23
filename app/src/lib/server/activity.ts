import { eq } from 'drizzle-orm';
import type { Db } from './db';
import { activity, auditLog, users } from './db/schema';

/** Fan activity kinds shown in the EMS feed. */
export type ActivityKind =
	| 'signed_up'
	| 'played'
	| 'completed'
	| 'profile_updated'
	| 'handle_added'
	| 'messaged'
	| 'reward_unlocked'
	| 'badge_earned'
	| 'proof_submitted'
	| 'points_granted';

/** Records fan activity and bumps them to the top of the EMS "newest" ordering. */
export async function logActivity(
	db: Db,
	userId: string,
	kind: ActivityKind,
	data: Record<string, unknown> = {}
) {
	const now = new Date();
	await db.batch([
		db.insert(activity).values({ userId, kind, data, createdAt: now }),
		db.update(users).set({ lastActivityAt: now }).where(eq(users.id, userId))
	]);
}

export async function audit(
	db: Db,
	actorId: string | null,
	action: string,
	entityType: string,
	entityId: string | null,
	data: Record<string, unknown> = {}
) {
	await db.insert(auditLog).values({ actorId, action, entityType, entityId, data });
}
