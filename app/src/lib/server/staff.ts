import { and, asc, eq, inArray } from 'drizzle-orm';
import type { Db } from './db';
import { staffPermissions, users, type Permission } from './db/schema';
import { hashPassword, randomToken } from './crypto';
import { invalidateUserSessions } from './auth';
import { issueResetCode } from './people';

export const PERMISSION_LABELS: Record<Permission, string> = {
	people: 'People: view fans, lists, notes, verify names',
	messages: 'Inbox: read and reply to messages, broadcasts',
	games: 'Games: edit games and presets',
	rewards: 'Rewards: manage and fulfil rewards',
	site: 'Site: hub, footer links, artwork',
	analytics: 'Stats: dashboards and numbers',
	staff: 'Staff: add staff and see the audit log'
};

export async function listStaff(db: Db) {
	const rows = await db
		.select({
			id: users.id,
			username: users.usernameDisplay,
			displayName: users.displayName,
			role: users.role,
			disabledAt: users.disabledAt,
			lastSeenAt: users.lastSeenAt,
			createdAt: users.createdAt
		})
		.from(users)
		.where(inArray(users.role, ['owner', 'staff']))
		.orderBy(asc(users.createdAt));
	const perms = await db.select().from(staffPermissions);
	return rows.map((r) => ({
		...r,
		permissions: perms.filter((p) => p.userId === r.id).map((p) => p.permission)
	}));
}

/**
 * Creates a staff account with an unusable random password and returns a 48-hour setup code.
 * The new staff member sets their own password at /recover, so no password is ever shared.
 */
export async function createStaff(
	db: Db,
	createdBy: string,
	input: { username: string; displayName: string; permissions: Permission[] }
) {
	const user = await db
		.insert(users)
		.values({
			username: input.username.toLowerCase(),
			usernameDisplay: input.username,
			displayName: input.displayName,
			passwordHash: await hashPassword(randomToken(32)),
			role: 'staff',
			ageConfirmedAt: new Date()
		})
		.onConflictDoNothing()
		.returning({ id: users.id })
		.get();
	if (!user) return null;
	await setPermissions(db, user.id, input.permissions);
	const code = await issueResetCode(db, user.id, createdBy, 'staff');
	return code ? { id: user.id, code } : null;
}

export async function setPermissions(db: Db, userId: string, permissions: Permission[]) {
	await db.batch([
		db.delete(staffPermissions).where(eq(staffPermissions.userId, userId)),
		...(permissions.length
			? [
					db
						.insert(staffPermissions)
						.values(permissions.map((permission) => ({ userId, permission })))
				]
			: [])
	]);
}

/** A fresh 48-hour setup/reset code for a staff member (never for the owner). */
export async function staffResetCode(db: Db, userId: string, issuedBy: string) {
	return issueResetCode(db, userId, issuedBy, 'staff');
}

export async function setStaffDisabled(db: Db, userId: string, disabled: boolean) {
	const changed = await db
		.update(users)
		.set({ disabledAt: disabled ? new Date() : null })
		.where(and(eq(users.id, userId), eq(users.role, 'staff')))
		.returning({ id: users.id });
	// Only sign out an account we actually disabled.
	if (disabled && changed.length > 0) await invalidateUserSessions(db, userId);
	return changed.length > 0;
}
