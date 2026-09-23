import type { Db } from './db';
import { activity, auditLog } from './db/schema';

/** Fan activity kinds shown in the EMS feed. */
export type ActivityKind =
	'signed_up' | 'played' | 'completed' | 'profile_updated' | 'handle_added';

export async function logActivity(
	db: Db,
	userId: string,
	kind: ActivityKind,
	data: Record<string, unknown> = {}
) {
	await db.insert(activity).values({ userId, kind, data });
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
